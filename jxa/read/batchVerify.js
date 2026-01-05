#!/usr/bin/env osascript -l JavaScript
// Verify multiple DEVONthink records after classification
// Usage: osascript -l JavaScript batchVerify.js '<json-array-of-uuids>'
// Example:
//   osascript -l JavaScript batchVerify.js '["uuid1", "uuid2", "uuid3"]'

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
