#!/usr/bin/env osascript -l JavaScript
// Move DEVONthink record(s) to a different group
// Usage: osascript -l JavaScript moveRecord.js '<json>'
// JSON format: {"records":["uuid1","uuid2"],"to":"destUuid","from":"sourceUuid"}
// Required: records (array of UUIDs), to (destination group UUID or path)
// Optional: from (source group UUID - only for moving single instance within same database)
//
// Examples:
//   osascript -l JavaScript moveRecord.js '{"records":["ABC123"],"to":"DEF456"}'
//   osascript -l JavaScript moveRecord.js '{"records":["ABC123"],"to":"DEF456","from":"GHI789"}'
//   osascript -l JavaScript moveRecord.js '{"records":["ABC123","XYZ789"],"to":"DEF456"}'

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

// Detect if string looks like a UUID or x-devonthink-item:// URL
function isUuid(str) {
  if (!str || typeof str !== "string") return false;
  if (str.startsWith("x-devonthink-item://")) return true;
  if (str.includes("/")) return false;
  return /^[A-F0-9-]{8,}$/i.test(str) && str.includes("-");
}

// Extract UUID from x-devonthink-item:// URL or return raw UUID
function extractUuid(str) {
  if (!str) return null;
  const urlMatch = str.match(/^x-devonthink-item:\/\/([A-F0-9-]+)$/i);
  if (urlMatch) return urlMatch[1];
  if (isUuid(str)) return str;
  return str; // Return as-is, let DEVONthink handle validation
}

// Resolve database by name or UUID
function getDatabase(theApp, ref) {
  if (!ref) return null;
  if (isUuid(ref)) {
    const record = theApp.getRecordWithUuid(extractUuid(ref));
    if (record) return record.database();
    throw new Error("Database not found with UUID: " + ref);
  }
  const databases = theApp.databases();
  const found = databases.find(db => db.name() === ref);
  if (!found) throw new Error("Database not found: " + ref);
  return found;
}

// Resolve group by path or UUID
function resolveGroup(theApp, ref, database) {
  if (!ref || ref === "/") return database.root();
  if (isUuid(ref)) {
    const group = theApp.getRecordWithUuid(extractUuid(ref));
    if (!group) throw new Error("Group not found with UUID: " + ref);
    return group;
  }
  let current = database.root();
  const parts = ref.split("/").filter(p => p.length > 0);
  for (const part of parts) {
    const children = current.children();
    const found = children.find(c => c.name() === part);
    if (!found) throw new Error("Group not found: " + part);
    current = found;
  }
  return current;
}

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: moveRecord.js \'{"records":["uuid"],"to":"destUuid"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { records, to, from: fromGroup, database: databaseRef } = params;

    if (!records || !Array.isArray(records) || records.length === 0) {
      throw new Error("Missing required field: records (array of UUIDs)");
    }
    if (!to) throw new Error("Missing required field: to (destination group)");

    const app = Application("DEVONthink");

    // Resolve destination group
    let destGroup;
    if (isUuid(to)) {
      destGroup = app.getRecordWithUuid(extractUuid(to));
      if (!destGroup) throw new Error("Destination group not found: " + to);
    } else if (databaseRef) {
      // Path-based destination requires database reference
      const db = getDatabase(app, databaseRef);
      destGroup = resolveGroup(app, to, db);
    } else {
      throw new Error("Destination must be UUID, or provide --database for path-based destination");
    }

    const destType = destGroup.recordType();
    if (destType !== "group" && destType !== "smart group") {
      throw new Error("Destination is not a group: " + destType);
    }

    // Resolve source group if specified
    let sourceGroup = null;
    if (fromGroup) {
      if (isUuid(fromGroup)) {
        sourceGroup = app.getRecordWithUuid(extractUuid(fromGroup));
        if (!sourceGroup) throw new Error("Source group not found: " + fromGroup);
      } else {
        throw new Error("Source group must be specified by UUID");
      }
    }

    const results = [];
    const errors = [];

    for (const uuid of records) {
      const record = app.getRecordWithUuid(extractUuid(uuid));
      if (!record) {
        errors.push({ uuid: uuid, error: "Record not found" });
        continue;
      }

      try {
        const moveOptions = {
          record: record,
          to: destGroup
        };

        // Add 'from' only if specified (for moving single instance in same database)
        if (sourceGroup) {
          moveOptions.from = sourceGroup;
        }

        const movedRecord = app.move(moveOptions);

        if (movedRecord) {
          results.push({
            uuid: movedRecord.uuid(),
            name: movedRecord.name(),
            newLocation: movedRecord.location(),
            database: movedRecord.database().name()
          });
        } else {
          errors.push({ uuid: uuid, error: "Move returned no result" });
        }
      } catch (e) {
        errors.push({ uuid: uuid, error: e.message });
      }
    }

    JSON.stringify({
      success: results.length > 0,
      destination: {
        uuid: destGroup.uuid(),
        name: destGroup.name(),
        database: destGroup.database().name()
      },
      moved: results,
      errors: errors.length > 0 ? errors : undefined
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
