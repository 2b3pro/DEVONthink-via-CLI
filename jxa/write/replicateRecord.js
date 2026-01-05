#!/usr/bin/env osascript -l JavaScript
// Replicate a DEVONthink record to one or more groups
// Usage: osascript -l JavaScript replicateRecord.js <uuid> <destUuid1> [destUuid2] [destUuid3] ...
// Examples:
//   osascript -l JavaScript replicateRecord.js "ABC123" "DEF456"
//   osascript -l JavaScript replicateRecord.js "ABC123" "DEF456" "GHI789" "JKL012"

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

function getAllArgs(startIndex) {
  const args = $.NSProcessInfo.processInfo.arguments;
  const result = [];
  for (let i = startIndex; i < args.count; i++) {
    const arg = ObjC.unwrap(args.objectAtIndex(i));
    if (arg && arg.length > 0) result.push(arg);
  }
  return result;
}

const sourceUuid = getArg(4, null);
const destinationUuids = getAllArgs(5);

if (!sourceUuid || destinationUuids.length === 0) {
  JSON.stringify({
    success: false,
    error: "Usage: replicateRecord.js <sourceUuid> <destUuid1> [destUuid2] ..."
  });
} else {
  try {
    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(extractUuid(sourceUuid));

    if (!record) throw new Error("Record not found: " + sourceUuid);

    const results = [];
    const errors = [];

    for (const destUuid of destinationUuids) {
      const destGroup = app.getRecordWithUuid(extractUuid(destUuid));

      if (!destGroup) {
        errors.push({ uuid: destUuid, error: "Destination not found" });
        continue;
      }

      const destType = destGroup.recordType();
      if (destType !== "group" && destType !== "smart group") {
        errors.push({ uuid: destUuid, error: "Not a group: " + destType });
        continue;
      }

      try {
        const replicant = app.replicate({ record: record, to: destGroup });
        results.push({
          destinationUuid: destUuid,
          destinationName: destGroup.name(),
          replicantUuid: replicant.uuid()
        });
      } catch (e) {
        errors.push({ uuid: destUuid, error: e.message });
      }
    }

    JSON.stringify({
      success: results.length > 0,
      sourceUuid: record.uuid(),
      sourceName: record.name(),
      replicated: results,
      errors: errors.length > 0 ? errors : undefined
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
