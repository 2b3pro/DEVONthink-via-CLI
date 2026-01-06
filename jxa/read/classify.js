#!/usr/bin/env osascript -l JavaScript
// Get classification proposals for a DEVONthink record
// Usage: osascript -l JavaScript classify.js <uuid> [database] [includeTags]
// database can be name or UUID (auto-detected)
// Examples:
//   osascript -l JavaScript classify.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5"
//   osascript -l JavaScript classify.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5" "IAS Personal"
//   osascript -l JavaScript classify.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5" "A1B2-C3D4-..." "true"

ObjC.import("Foundation");

const recordUuid = getArg(4, null);
const databaseRef = getArg(5, "");
const includeTags = getArg(6, "false").toLowerCase() === "true";

if (!recordUuid) {
  JSON.stringify({ success: false, error: "Usage: classify.js <uuid> [database] [includeTags]" });
} else {
  try {
    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(extractUuid(recordUuid));

    if (!record) {
      JSON.stringify({ success: false, error: "Record not found: " + recordUuid });
    } else {
      // Build classify options
      const classifyOptions = { record: record };

      // Add database scope if specified (by name or UUID)
      if (databaseRef && databaseRef.length > 0) {
        const db = getDatabase(app, databaseRef);
        if (db) {
          classifyOptions.in = db;
        }
      }

      // Get classification proposals using the classify command
      const proposals = app.classify(classifyOptions);

      if (!proposals || proposals.length === 0) {
        JSON.stringify({
          success: true,
          uuid: recordUuid,
          name: record.name(),
          proposals: [],
          message: "No classification proposals found"
        });
      } else {
        // Map proposals to output format
        const results = proposals.map(p => ({
          uuid: p.uuid(),
          name: p.name(),
          path: p.location(),
          database: p.database().name(),
          recordType: p.recordType()
        }));

        JSON.stringify({
          success: true,
          uuid: recordUuid,
          name: record.name(),
          proposalCount: results.length,
          proposals: results
        }, null, 2);
      }
    }
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
