#!/usr/bin/env osascript -l JavaScript
// Delete multiple DEVONthink records (moves to Trash)
// Usage: osascript -l JavaScript batchDelete.js '["uuid1", "uuid2", ...]'

ObjC.import("Foundation");

// Extract UUID from x-devonthink-item:// URL or return raw UUID
function extractUuid(str) {
  if (!str) return null;
  const urlMatch = str.match(/^x-devonthink-item:\/\/([A-F0-9-]+)$/i);
  if (urlMatch) return urlMatch[1];
  return str;
}

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: "Usage: batchDelete.js '[\"uuid1\", \"uuid2\", ...]'" });
} else {
  try {
    const uuids = JSON.parse(jsonArg);
    if (!Array.isArray(uuids) || uuids.length === 0) {
      throw new Error("Input must be a non-empty array of UUIDs");
    }

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

        const name = record.name();
        const recordUuid = record.uuid();

        app.delete({ record: record });

        results.push({
          uuid: recordUuid,
          name: name
        });
      } catch (e) {
        errors.push({ uuid: uuid, error: e.message });
      }
    }

    JSON.stringify({
      success: errors.length === 0,
      deleted: results,
      errors: errors.length > 0 ? errors : undefined,
      count: results.length
    });

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
