#!/usr/bin/env osascript -l JavaScript
// Batch move multiple DEVONthink records
// Usage: osascript -l JavaScript batchMove.js '[{"uuid": "...", "destination": "..."}, ...]'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: "Usage: batchMove.js JSON_ARRAY" });
} else {
  try {
    const items = JSON.parse(jsonArg);
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Input must be a non-empty array of objects");
    }

    const app = Application("DEVONthink");
    const results = [];
    const errors = [];

    // Cache destination lookups to speed up moving many items to same folder
    const groupCache = {}; // key: destRef, value: groupRecord

    for (const item of items) {
      const { uuid, destination } = item;
      
      try {
        if (!uuid || !destination) {
          throw new Error("Missing uuid or destination");
        }

        const record = app.getRecordWithUuid(extractUuid(uuid));
        if (!record) {
          errors.push({ uuid: uuid, error: "Record not found" });
          continue;
        }

        // Determine destination group
        let destGroup;
        const cacheKey = destination;
        
        if (groupCache[cacheKey]) {
          destGroup = groupCache[cacheKey];
        } else {
          // If destination is UUID, resolve directly.
          // If path, resolve relative to record's database.
          destGroup = resolveGroup(app, destination, record.database());
          groupCache[cacheKey] = destGroup;
        }

        if (record.locationGroup().uuid() === destGroup.uuid()) {
             // Already there
             results.push({ uuid: record.uuid(), status: "skipped" });
        } else {
             app.move({ record: record, to: destGroup });
             results.push({ uuid: record.uuid(), status: "moved" });
        }

      } catch (e) {
        errors.push({ uuid: uuid, error: e.message });
      }
    }

    JSON.stringify({
      success: errors.length === 0,
      moved: results,
      errors: errors.length > 0 ? errors : undefined,
      count: results.length
    });

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
