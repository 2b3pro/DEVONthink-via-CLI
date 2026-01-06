#!/usr/bin/env osascript -l JavaScript
// Get a preview of a DEVONthink record's content
// Usage: osascript -l JavaScript getRecordPreview.js <uuid> [maxChars]
// Examples:
//   osascript -l JavaScript getRecordPreview.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5"
//   osascript -l JavaScript getRecordPreview.js "27D0D443-4E18-40EF-86EE-6F5E15966FC5" 5000

ObjC.import("Foundation");

const uuid = getArg(4, null);
const maxChars = parseInt(getArg(5, "3000"), 10) || 3000;

if (!uuid) {
  JSON.stringify({ success: false, error: "Usage: getRecordPreview.js <uuid> [maxChars]" });
} else {
  const app = Application("DEVONthink");
  const record = app.getRecordWithUuid(extractUuid(uuid));

  if (!record) {
    JSON.stringify({ success: false, error: "Record not found: " + uuid });
  } else {
    const plainText = record.plainText() || "";
    const totalLength = plainText.length;
    const truncated = totalLength > maxChars;
    const preview = truncated ? plainText.substring(0, maxChars) : plainText;

    JSON.stringify({
      success: true,
      uuid: uuid,
      name: record.name(),
      recordType: record.recordType(),
      preview: preview,
      totalLength: totalLength,
      truncated: truncated
    }, null, 2);
  }
}
