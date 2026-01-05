#!/usr/bin/env osascript -l JavaScript
// Get previews for multiple DEVONthink records in one call
// Usage: osascript -l JavaScript batchPreview.js '<json-array-of-uuids>' [maxChars]
// Examples:
//   osascript -l JavaScript batchPreview.js '["uuid1", "uuid2", "uuid3"]'
//   osascript -l JavaScript batchPreview.js '["uuid1", "uuid2"]' 5000

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

// Record types that might need OCR if content is empty
function mightNeedOCR(recordType) {
  const ocrTypes = [
    "PDF document",
    "picture",
    "image",
    "JPEG image",
    "PNG image",
    "TIFF image",
    "GIF image",
    "PDF+Text"  // Even PDF+Text might have empty text layer
  ];
  return ocrTypes.some(t => recordType.toLowerCase().includes(t.toLowerCase()));
}

const uuidsJson = getArg(4, null);
const maxChars = parseInt(getArg(5, "3000"), 10) || 3000;

if (!uuidsJson) {
  JSON.stringify({
    success: false,
    error: "Usage: batchPreview.js '<json-array-of-uuids>' [maxChars]"
  });
} else {
  try {
    const uuids = JSON.parse(uuidsJson);
    if (!Array.isArray(uuids)) throw new Error("Input must be a JSON array of UUIDs");

    const app = Application("DEVONthink");
    const results = [];
    const errors = [];
    const needsOCR = [];

    for (const uuid of uuids) {
      try {
        const record = app.getRecordWithUuid(extractUuid(uuid));
        if (!record) {
          errors.push({ uuid: uuid, error: "Record not found" });
          continue;
        }

        const plainText = record.plainText() || "";
        const totalLength = plainText.length;
        const recordType = record.recordType();
        const path = record.path();

        // Check if OCR is needed
        if (totalLength === 0 && mightNeedOCR(recordType)) {
          needsOCR.push({
            uuid: uuid,
            name: record.name(),
            recordType: recordType,
            path: path
          });
          // Still add to results but flag it
          results.push({
            uuid: uuid,
            name: record.name(),
            recordType: recordType,
            path: path,
            preview: "",
            totalLength: 0,
            needsOCR: true,
            tags: record.tags()
          });
        } else {
          const truncated = totalLength > maxChars;
          const preview = truncated ? plainText.substring(0, maxChars) : plainText;

          results.push({
            uuid: uuid,
            name: record.name(),
            recordType: recordType,
            path: path,
            preview: preview,
            totalLength: totalLength,
            truncated: truncated,
            needsOCR: false,
            tags: record.tags()
          });
        }
      } catch (e) {
        errors.push({ uuid: uuid, error: e.message });
      }
    }

    JSON.stringify({
      success: true,
      requested: uuids.length,
      returned: results.length,
      needsOCRCount: needsOCR.length,
      errorCount: errors.length,
      results: results,
      needsOCR: needsOCR,
      errors: errors
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
