#!/usr/bin/env osascript -l JavaScript
// Perform native DEVONthink summarization (annotations, content, mentions)
// Usage: osascript -l JavaScript summarizeNative.js '<json>'
// JSON format: { "uuid": "...", "type": "annotations|content|mentions", "format": "markdown|rich|sheet" }
// Returns: { success: true, uuid: "new-summary-uuid", ... }

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({ success: false, error: "Missing arguments" });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const uuid = extractUuid(params.uuid);
    
    if (!uuid) throw new Error("Missing UUID");

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(uuid);

    if (!record) throw new Error("Record not found: " + uuid);

    const type = params.type || "annotations"; // annotations, content, mentions
    const format = params.format || "markdown"; // markdown, rich, sheet, simple

    let resultRecord;

    // Map format string to AppleScript enum
    // Note: JXA often accepts string 'markdown', 'rich' directly if they match the sdef code or name
    // sdef says: 'markdown', 'rich text' (or 'rich'), 'sheet', 'simple'

    const formatMap = {
        "markdown": "markdown",
        "rich": "rich",
        "rtf": "rich",
        "sheet": "sheet",
        "simple": "simple"
    };

    const targetFormat = formatMap[format.toLowerCase()] || "markdown";

    if (type === "annotations" || type === "highlights") {
        // summarize annotations of records ... to ...
        // Note: 'records' parameter expects a list
        resultRecord = app.summarizeAnnotationsOf({
            records: [record],
            to: targetFormat
        });
    } else if (type === "content") {
        // summarize contents of records ... to ...
        resultRecord = app.summarizeContentsOf({
            records: [record],
            to: targetFormat
        });
    } else if (type === "mentions") {
        // summarize mentions of records ... to ...
        resultRecord = app.summarizeMentionsOf({
            records: [record],
            to: targetFormat
        });
    } else {
        throw new Error("Unknown summary type: " + type);
    }

    if (!resultRecord) {
        throw new Error("Summarization returned no result (possibly no highlights found or unsupported format)");
    }

    JSON.stringify({
      success: true,
      originalUuid: uuid,
      summaryUuid: resultRecord.uuid(),
      summaryName: resultRecord.name(),
      summaryPath: resultRecord.path()
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
