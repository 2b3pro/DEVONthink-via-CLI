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
