#!/usr/bin/env osascript -l JavaScript
// Restore a saved version of a DEVONthink record
// Usage: osascript -l JavaScript restoreVersion.js '<json>'
// JSON format: {"versionUuid":"..."}
// Required: versionUuid (the UUID of the version record to restore)
//
// Note: The version record contains a reference to its parent record,
// so only the version UUID is needed.
//
// Dependencies (injected by runner):
// - getArg, extractUuid

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: restoreVersion.js \'{"versionUuid":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { versionUuid } = params;

    if (!versionUuid) throw new Error("Missing required field: versionUuid");

    const app = Application("DEVONthink");
    const versionRecord = app.getRecordWithUuid(extractUuid(versionUuid));

    if (!versionRecord) throw new Error("Version record not found: " + versionUuid);

    // Restore the version
    const restored = app.restoreRecordWith({ version: versionRecord });

    if (restored) {
      JSON.stringify({
        success: true,
        restored: true,
        versionUuid: versionUuid,
        message: "Version restored successfully"
      }, null, 2);
    } else {
      JSON.stringify({
        success: false,
        versionUuid: versionUuid,
        error: "Failed to restore version"
      });
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
