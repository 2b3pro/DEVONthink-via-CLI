#!/usr/bin/env osascript -l JavaScript
// Delete a DEVONthink record (moves to Trash)
// Usage: osascript -l JavaScript deleteRecord.js <uuid>
// Example:
//   osascript -l JavaScript deleteRecord.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5"

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

const uuid = getArg(4, null);

if (!uuid) {
  JSON.stringify({ success: false, error: "Usage: deleteRecord.js <uuid>" });
} else {
  const app = Application("DEVONthink");
  const record = app.getRecordWithUuid(extractUuid(uuid));

  if (!record) {
    JSON.stringify({ success: false, error: "Record not found: " + uuid });
  } else {
    try {
      const name = record.name();
      const recordUuid = record.uuid();

      // Delete moves to trash
      app.delete({ record: record });

      JSON.stringify({
        success: true,
        deleted: {
          uuid: recordUuid,
          name: name
        }
      });
    } catch (e) {
      JSON.stringify({ success: false, error: e.message });
    }
  }
}
