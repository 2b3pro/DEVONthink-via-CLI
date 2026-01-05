#!/usr/bin/env osascript -l JavaScript
// Export a DEVONthink record (and its children) to a directory
// Usage: osascript -l JavaScript exportRecord.js '<json>'
// JSON format: {"uuid":"...","destination":"...","includeMetadata":true}
// Required: uuid, destination
// Optional: includeMetadata (default: true)
//
// Examples:
//   osascript -l JavaScript exportRecord.js '{"uuid":"ABC123","destination":"~/Desktop/Export"}'
//   osascript -l JavaScript exportRecord.js '{"uuid":"ABC123","destination":"/tmp/export","includeMetadata":false}'

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

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: exportRecord.js \'{"uuid":"...","destination":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuid, destination, includeMetadata } = params;

    if (!uuid) throw new Error("Missing required field: uuid");
    if (!destination) throw new Error("Missing required field: destination");

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(extractUuid(uuid));

    if (!record) throw new Error("Record not found: " + uuid);

    // Expand tilde in path
    const destPath = ObjC.unwrap($(destination).stringByExpandingTildeInPath);

    // Build export options
    const exportOptions = {
      record: record,
      to: destPath
    };

    // Include metadata by default
    if (includeMetadata !== undefined) {
      exportOptions.DEVONtech_Storage = includeMetadata;
    }

    // Perform export
    const exportedPath = app.export(exportOptions);

    if (exportedPath) {
      JSON.stringify({
        success: true,
        uuid: uuid,
        name: record.name(),
        exportedPath: exportedPath,
        destination: destPath,
        includeMetadata: includeMetadata !== false
      }, null, 2);
    } else {
      JSON.stringify({
        success: false,
        uuid: uuid,
        error: "Export failed or returned no path"
      }, null, 2);
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
