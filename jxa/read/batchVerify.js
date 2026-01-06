#!/usr/bin/env osascript -l JavaScript
// Verify multiple DEVONthink records after classification
// Usage: osascript -l JavaScript batchVerify.js '<json-array-of-uuids>'
// Example:
//   osascript -l JavaScript batchVerify.js '["uuid1", "uuid2", "uuid3"]'

ObjC.import("Foundation");

const uuidsJson = getArg(4, null);

if (!uuidsJson) {
  JSON.stringify({
    success: false,
    error: "Usage: batchVerify.js '<json-array-of-uuids>'"
  });
} else {
  try {
    const uuids = JSON.parse(uuidsJson);
    if (!Array.isArray(uuids)) throw new Error("Input must be a JSON array of UUIDs");

    const app = Application("DEVONthink");
    const results = [];
    const errors = [];

    for (const uuid of uuids) {
      try {
        const record = app.getRecordWithUuid(extractUuid(uuid));
        if (!record) {
          errors.push({ uuid: uuid, error: "Record not found" });
          continue;
        }

        results.push({
          uuid: uuid,
          name: record.name(),
          location: record.location(),
          database: record.database().name(),
          recordType: record.recordType(),
          tags: record.tags(),
          comment: record.comment() || "",
          customMetaData: record.customMetaData() || {}
        });
      } catch (e) {
        errors.push({ uuid: uuid, error: e.message });
      }
    }

    JSON.stringify({
      success: true,
      requested: uuids.length,
      verified: results.length,
      errorCount: errors.length,
      results: results,
      errors: errors
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
