#!/usr/bin/env osascript -l JavaScript
// Copy DEVONthink record(s) to another group (duplicate or replicate)
// Usage: osascript -l JavaScript copyRecord.js '<json>'
// JSON format: {"records":["uuid1","uuid2"],"to":"destUuid","mode":"duplicate|replicate"}
// Required: records (array of UUIDs), to (destination group UUID)
// Optional: mode ("duplicate" or "replicate", default: "duplicate")
//
// Modes:
//   duplicate - Creates independent copies (no linking)
//   replicate - Creates linked copies (changes sync across all replicants)
//
// Examples:
//   osascript -l JavaScript copyRecord.js '{"records":["ABC123"],"to":"DEF456"}'
//   osascript -l JavaScript copyRecord.js '{"records":["ABC123"],"to":"DEF456","mode":"replicate"}'
//   osascript -l JavaScript copyRecord.js '{"records":["ABC123","XYZ789"],"to":"DEF456","mode":"duplicate"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: copyRecord.js \'{"records":["uuid"],"to":"destUuid","mode":"duplicate|replicate"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { records, to, database: databaseRef, mode = "duplicate" } = params;

    if (!records || !Array.isArray(records) || records.length === 0) {
      throw new Error("Missing required field: records (array of UUIDs)");
    }
    if (!to) throw new Error("Missing required field: to (destination group)");

    const validModes = ["duplicate", "replicate"];
    if (!validModes.includes(mode)) {
      throw new Error("Invalid mode: " + mode + ". Valid: duplicate, replicate");
    }

    const app = Application("DEVONthink");

    // Resolve destination group
    let destGroup;
    if (isUuid(to)) {
      destGroup = app.getRecordWithUuid(extractUuid(to));
      if (!destGroup) throw new Error("Destination group not found: " + to);
    } else if (databaseRef) {
      const db = getDatabase(app, databaseRef);
      destGroup = resolveGroup(app, to, db);
    } else {
      throw new Error("Destination must be UUID, or provide database for path-based destination");
    }

    const destType = destGroup.recordType();
    if (destType !== "group" && destType !== "smart group") {
      throw new Error("Destination is not a group: " + destType);
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
        let copiedRecord;

        if (mode === "replicate") {
          // Create linked copy (replicant)
          copiedRecord = app.replicate({ record: record, to: destGroup });
        } else {
          // Create independent copy (duplicate)
          copiedRecord = app.duplicate({ record: record, to: destGroup });
        }

        if (copiedRecord) {
          results.push({
            sourceUuid: uuid,
            sourceName: record.name(),
            copiedUuid: copiedRecord.uuid(),
            copiedName: copiedRecord.name(),
            location: copiedRecord.location(),
            database: copiedRecord.database().name(),
            mode: mode
          });
        } else {
          errors.push({ uuid: uuid, error: "Copy operation returned no result" });
        }
      } catch (e) {
        errors.push({ uuid: uuid, error: e.message });
      }
    }

    JSON.stringify({
      success: results.length > 0,
      mode: mode,
      destination: {
        uuid: destGroup.uuid(),
        name: destGroup.name(),
        database: destGroup.database().name()
      },
      copied: results,
      errors: errors.length > 0 ? errors : undefined
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
