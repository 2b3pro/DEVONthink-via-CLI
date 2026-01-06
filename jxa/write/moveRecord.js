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
