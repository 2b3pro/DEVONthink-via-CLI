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
