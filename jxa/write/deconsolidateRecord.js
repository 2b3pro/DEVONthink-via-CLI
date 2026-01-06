#!/usr/bin/env osascript -l JavaScript
// Move an internal DEVONthink record to an external folder
// Usage: osascript -l JavaScript deconsolidateRecord.js '<json>'
// JSON format: {"uuid":"...","destination":"..."}
// Required: uuid
// Optional: destination (POSIX path for documents)
//
// Notes:
// - Moves internal/imported record to external folder in filesystem
// - Updates creation/modification dates, Spotlight comments, OpenMeta tags
// - Not supported by revision-proof databases
//
// Examples:
//   osascript -l JavaScript deconsolidateRecord.js '{"uuid":"ABC123"}'
//   osascript -l JavaScript deconsolidateRecord.js '{"uuid":"ABC123","destination":"~/Documents/External"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: deconsolidateRecord.js \'{"uuid":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuid, destination } = params;

    if (!uuid) throw new Error("Missing required field: uuid");

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(extractUuid(uuid));

    if (!record) throw new Error("Record not found: " + uuid);

    // Build options
    const options = { record: record };

    if (destination && destination.length > 0) {
      const destPath = ObjC.unwrap($(destination).stringByExpandingTildeInPath);
      options.to = destPath;
    }

    // Perform deconsolidation (move to external folder)
    const success = app.moveToExternalFolder(options);

    if (success) {
      // Get updated path after move
      const newPath = record.path();

      JSON.stringify({
        success: true,
        uuid: uuid,
        name: record.name(),
        path: newPath,
        message: "Record moved to external folder"
      }, null, 2);
    } else {
      JSON.stringify({
        success: false,
        uuid: uuid,
        name: record.name(),
        error: "Deconsolidation failed. Record may be in a revision-proof database or already external."
      }, null, 2);
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
