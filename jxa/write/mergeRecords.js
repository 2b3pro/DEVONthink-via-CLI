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
