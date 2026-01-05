#!/usr/bin/env osascript -l JavaScript
// Get all properties of a DEVONthink record
// Usage: osascript -l JavaScript getRecordProperties.js <uuid>
// Example:
//   osascript -l JavaScript getRecordProperties.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5"

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
  JSON.stringify({ success: false, error: "Usage: getRecordProperties.js <uuid>" });
} else {
  const app = Application("DEVONthink");
  const record = app.getRecordWithUuid(extractUuid(uuid));

  if (!record) {
    JSON.stringify({ success: false, error: "Record not found: " + uuid });
  } else {
    JSON.stringify({
      success: true,
      // Identity
      id: record.id(),
      uuid: record.uuid(),
      name: record.name(),

      // Location
      path: record.path(),
      location: record.location(),
      database: record.database().name(),

      // Type
      recordType: record.recordType(),
      kind: record.kind(),

      // Dates
      creationDate: record.creationDate() ? record.creationDate().toString() : null,
      modificationDate: record.modificationDate() ? record.modificationDate().toString() : null,
      additionDate: record.additionDate() ? record.additionDate().toString() : null,

      // Size
      size: record.size(),
      wordCount: record.wordCount(),
      characterCount: record.characterCount(),

      // Metadata
      tags: record.tags(),
      comment: record.comment(),
      url: record.url(),
      aliases: record.aliases(),

      // Ratings
      rating: record.rating(),
      label: record.label(),

      // Flags
      flag: record.flag(),
      unread: record.unread(),
      locked: record.locking()
    }, null, 2);
  }
}
