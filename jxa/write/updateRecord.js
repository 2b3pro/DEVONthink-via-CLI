#!/usr/bin/env osascript -l JavaScript
// Update text content of a DEVONthink record
// Usage: osascript -l JavaScript updateRecord.js '<json>'
// JSON format: {"uuid":"...","text":"...","mode":"setting|inserting|appending","url":"..."}
// Required: uuid, text, mode
// Optional: url
//
// Supported record types: plain text, rich text, Markdown, HTML, formatted notes
// Not supported by revision-proof databases
//
// Modes:
//   setting - Replace the entire content
//   inserting - Insert after metadata
//   appending - Append to end of document
//
// Examples:
//   osascript -l JavaScript updateRecord.js '{"uuid":"ABC123","text":"New content","mode":"setting"}'
//   osascript -l JavaScript updateRecord.js '{"uuid":"ABC123","text":"\\n## New Section","mode":"appending"}'

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: updateRecord.js \'{"uuid":"...","text":"...","mode":"setting|inserting|appending"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuid, text, mode, url } = params;

    if (!uuid) throw new Error("Missing required field: uuid");
    if (text === undefined || text === null) throw new Error("Missing required field: text");
    if (!mode) throw new Error("Missing required field: mode");

    const validModes = ["setting", "inserting", "appending"];
    if (!validModes.includes(mode)) {
      throw new Error("Invalid mode: " + mode + ". Valid: setting, inserting, appending");
    }

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(uuid);

    if (!record) throw new Error("Record not found: " + uuid);

    // Get current content for modes that need it
    const recordType = record.recordType();
    let success = false;

    // Perform update based on mode using direct property access
    // This is more reliable than the app.update() method in JXA
    try {
      switch (mode) {
        case "setting":
          // Replace all content
          record.plainText = text;
          success = true;
          break;
        case "inserting":
          // Insert after first line (approximate "after metadata" behavior)
          const currentContent = record.plainText() || "";
          const firstLineEnd = currentContent.indexOf('\n');
          if (firstLineEnd === -1) {
            record.plainText = currentContent + "\n" + text;
          } else {
            record.plainText = currentContent.slice(0, firstLineEnd + 1) + text + currentContent.slice(firstLineEnd + 1);
          }
          success = true;
          break;
        case "appending":
          // Append to end
          record.plainText = (record.plainText() || "") + text;
          success = true;
          break;
      }

      // Set URL if provided
      if (url && url.length > 0) {
        record.URL = url;
      }
    } catch (updateErr) {
      throw new Error("Update failed: " + updateErr.message);
    }

    if (success) {
      JSON.stringify({
        success: true,
        uuid: uuid,
        name: record.name(),
        recordType: recordType,
        mode: mode,
        textLength: text.length
      }, null, 2);
    } else {
      JSON.stringify({
        success: false,
        uuid: uuid,
        name: record.name(),
        error: "Update failed. Record may be in a revision-proof database or unsupported type."
      }, null, 2);
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
