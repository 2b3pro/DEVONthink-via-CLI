#!/usr/bin/env osascript -l JavaScript
// Lookup DEVONthink records by various criteria
// Usage: osascript -l JavaScript lookupRecords.js '<json>'
// JSON format: {"type":"comment|hash|file|path|tags|url","value":"...","database":"...","any":false}
//
// Types:
//   comment - Lookup by comment
//   hash - Lookup by content hash
//   file - Lookup by filename (last path component)
//   path - Lookup by path
//   tags - Lookup by tags (value is array of tags)
//   url - Lookup by URL
//
// Examples:
//   osascript -l JavaScript lookupRecords.js '{"type":"comment","value":"important"}'
//   osascript -l JavaScript lookupRecords.js '{"type":"tags","value":["project","active"],"any":true}'
//   osascript -l JavaScript lookupRecords.js '{"type":"file","value":"document.pdf","database":"Inbox"}'

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

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

// Resolve database by name or UUID
function getDatabase(theApp, ref) {
  if (!ref) return null;
  if (isUuid(ref)) {
    const record = theApp.getRecordWithUuid(extractUuid(ref));
    if (record) return record.database();
    throw new Error("Database not found with UUID: " + ref);
  }
  const databases = theApp.databases();
  const found = databases.find(db => db.name() === ref);
  if (!found) throw new Error("Database not found: " + ref);
  return found;
}

// Format record for output
function formatRecord(record) {
  return {
    uuid: record.uuid(),
    name: record.name(),
    type: record.recordType(),
    location: record.location(),
    database: record.database().name()
  };
}

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: lookupRecords.js \'{"type":"comment|hash|file|path|tags|url","value":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { type, value, database: databaseRef, any: anyTag } = params;

    if (!type) throw new Error("Missing required field: type");
    if (!value) throw new Error("Missing required field: value");

    const validTypes = ["comment", "hash", "file", "path", "tags", "url"];
    if (!validTypes.includes(type)) {
      throw new Error("Invalid type: " + type + ". Valid: " + validTypes.join(", "));
    }

    const app = Application("DEVONthink");

    // Resolve database if specified
    const db = databaseRef ? getDatabase(app, databaseRef) : null;
    const lookupOptions = db ? { in: db } : {};

    let records = [];

    switch (type) {
      case "comment":
        records = app.lookupRecordsWithComment(value, lookupOptions) || [];
        break;

      case "hash":
        records = app.lookupRecordsWithContentHash(value, lookupOptions) || [];
        break;

      case "file":
        records = app.lookupRecordsWithFile(value, lookupOptions) || [];
        break;

      case "path":
        records = app.lookupRecordsWithPath(value, lookupOptions) || [];
        break;

      case "tags":
        const tags = Array.isArray(value) ? value : [value];
        const tagOptions = { ...lookupOptions };
        if (anyTag === true) {
          tagOptions.any = true;
        }
        records = app.lookupRecordsWithTags(tags, tagOptions) || [];
        break;

      case "url":
        records = app.lookupRecordsWithURL(value, lookupOptions) || [];
        break;
    }

    const formattedRecords = records.map(formatRecord);

    JSON.stringify({
      success: true,
      lookupType: type,
      query: value,
      count: formattedRecords.length,
      records: formattedRecords
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
