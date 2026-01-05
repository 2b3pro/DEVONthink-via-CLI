#!/usr/bin/env osascript -l JavaScript
// Merge records into a single document or merge groups/tags
// Usage: osascript -l JavaScript mergeRecords.js '<json>'
// JSON format: {"uuids":["...","..."],"groupPath":"...","database":"..."}
// Required: uuids (array of at least 2 UUIDs)
// Optional: groupPath, database
//
// Notes:
// - Text/RTF records are merged into RTF(D)
// - PDF records are merged into PDF
// - Groups/tags (not indexed) can be merged
//
// Examples:
//   osascript -l JavaScript mergeRecords.js '{"uuids":["ABC123","DEF456"]}'
//   osascript -l JavaScript mergeRecords.js '{"uuids":["ABC123","DEF456","GHI789"],"groupPath":"Merged"}'

ObjC.import("Foundation");

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

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

// Helper to find database by name or UUID
function getDatabase(app, ref) {
  // Try UUID first
  const byUuid = app.getRecordWithUuid(extractUuid(ref));
  if (byUuid) {
    return byUuid.database();
  }
  // Try by name
  const dbs = app.databases();
  for (let i = 0; i < dbs.length; i++) {
    if (dbs[i].name() === ref) {
      return dbs[i];
    }
  }
  return null;
}

// Helper to resolve group path
function resolveGroup(app, db, pathOrUuid, createIfMissing) {
  if (!pathOrUuid || pathOrUuid === "/" || pathOrUuid === "") {
    return db.root();
  }

  // Try UUID first
  if (isUuid(pathOrUuid)) {
    const byUuid = app.getRecordWithUuid(extractUuid(pathOrUuid));
    if (byUuid) return byUuid;
  }

  // Navigate path
  let current = db.root();
  const parts = pathOrUuid.split("/").filter(p => p.length > 0);

  for (const part of parts) {
    const children = current.children();
    let found = null;
    for (let i = 0; i < children.length; i++) {
      if (children[i].name() === part) {
        found = children[i];
        break;
      }
    }
    if (!found) {
      if (createIfMissing) {
        found = app.createRecordWith({ name: part, type: "group" }, { in: current });
      } else {
        throw new Error("Group not found: " + part);
      }
    }
    current = found;
  }

  return current;
}

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: mergeRecords.js \'{"uuids":["ABC123","DEF456"]}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuids, groupPath, database } = params;

    if (!uuids || !Array.isArray(uuids)) throw new Error("Missing required field: uuids (array)");
    if (uuids.length < 2) throw new Error("At least 2 UUIDs required for merge");

    const app = Application("DEVONthink");

    // Get all records
    const records = [];
    for (const uuid of uuids) {
      const record = app.getRecordWithUuid(extractUuid(uuid));
      if (!record) throw new Error("Record not found: " + uuid);
      records.push(record);
    }

    // Build merge options
    const mergeOptions = { records: records };

    // If destination group specified
    if (groupPath) {
      let db;
      if (database) {
        db = getDatabase(app, database);
        if (!db) throw new Error("Database not found: " + database);
      } else {
        // Use the database of the first record
        db = records[0].database();
      }
      const destGroup = resolveGroup(app, db, groupPath, true);
      mergeOptions.in = destGroup;
    }

    // Perform merge
    const mergedRecord = app.merge(mergeOptions);

    if (!mergedRecord) {
      throw new Error("Merge failed or returned no record");
    }

    JSON.stringify({
      success: true,
      uuid: mergedRecord.uuid(),
      name: mergedRecord.name(),
      location: mergedRecord.location(),
      database: mergedRecord.database().name(),
      recordType: mergedRecord.recordType(),
      path: mergedRecord.path(),
      mergedCount: uuids.length
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
