#!/usr/bin/env osascript -l JavaScript
// Update content, comment, or custom metadata of a DEVONthink record
// Usage: osascript -l JavaScript updateRecord.js '<json>'
// JSON format: {"uuid":"...","text":"...","mode":"setting|inserting|appending","target":"content|comment|customMetadata","customMetadataField":"...","url":"..."}
// Required: uuid, text
// Optional: mode (default: setting), target (default: content), customMetadataField (required when target=customMetadata), url
//
// Targets:
//   content - Update plainText (default). Supported: plain text, rich text, Markdown, HTML, formatted notes
//   comment - Update the comment property. Supported: all record types
//   customMetadata - Update a custom metadata field (requires customMetadataField)
//
// Modes (apply to content, comment):
//   setting - Replace the entire content (default)
//   inserting - Insert after first line
//   appending - Append to end
//
// Not supported by revision-proof databases (except comment and customMetadata)
//
// Examples:
//   osascript -l JavaScript updateRecord.js '{"uuid":"ABC123","text":"New content","mode":"setting"}'
//   osascript -l JavaScript updateRecord.js '{"uuid":"ABC123","text":"My comment","target":"comment"}'
//   osascript -l JavaScript updateRecord.js '{"uuid":"ABC123","text":"John Doe","target":"customMetadata","customMetadataField":"author"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: updateRecord.js \'{"uuid":"...","text":"...","target":"content|annotation|comment|customMetadata"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuid, text, url, customMetadataField } = params;
    const mode = params.mode || "setting";
    const target = params.target || "content";

    if (!uuid) throw new Error("Missing required field: uuid");
    if (text === undefined || text === null) throw new Error("Missing required field: text");

    const validModes = ["setting", "inserting", "appending"];
    if (!validModes.includes(mode)) {
      throw new Error("Invalid mode: " + mode + ". Valid: setting, inserting, appending");
    }

    const validTargets = ["content", "comment", "customMetadata"];
    if (!validTargets.includes(target)) {
      throw new Error("Invalid target: " + target + ". Valid: content, comment, customMetadata");
    }

    if (target === "customMetadata" && !customMetadataField) {
      throw new Error("customMetadataField is required when target is customMetadata");
    }

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(extractUuid(uuid));

    if (!record) throw new Error("Record not found: " + uuid);

    const recordType = record.recordType();
    let success = false;
    let updatedValue = text;

    // Helper function to apply mode to string properties
    function applyMode(currentValue, newValue, mode) {
      const current = currentValue || "";
      switch (mode) {
        case "setting":
          return newValue;
        case "inserting":
          const firstLineEnd = current.indexOf('\n');
          if (firstLineEnd === -1) {
            return current + "\n" + newValue;
          }
          return current.slice(0, firstLineEnd + 1) + newValue + current.slice(firstLineEnd + 1);
        case "appending":
          return current + newValue;
        default:
          return newValue;
      }
    }

    try {
      switch (target) {
        case "content":
          updatedValue = applyMode(record.plainText(), text, mode);
          record.plainText = updatedValue;
          success = true;
          break;

        case "comment":
          updatedValue = applyMode(record.comment(), text, mode);
          record.comment = updatedValue;
          success = true;
          break;

        case "customMetadata":
          // Custom metadata always uses "setting" mode (replace)
          app.addCustomMetaData(text, { for: customMetadataField, to: record });
          updatedValue = text;
          success = true;
          break;
      }

      // Set URL if provided (only relevant for content target)
      if (url && url.length > 0) {
        record.URL = url;
      }
    } catch (updateErr) {
      throw new Error("Update failed: " + updateErr.message);
    }

    if (success) {
      const result = {
        success: true,
        uuid: uuid,
        name: record.name(),
        recordType: recordType,
        target: target,
        mode: mode,
        textLength: text.length
      };
      if (target === "customMetadata") {
        result.field = customMetadataField;
      }
      JSON.stringify(result, null, 2);
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
