#!/usr/bin/env osascript -l JavaScript
// Control DEVONthink download manager
// Usage: osascript -l JavaScript downloadManager.js '<json>'
// JSON format: {"action":"start|stop"}
// Required: action
//
// Examples:
//   osascript -l JavaScript downloadManager.js '{"action":"start"}'
//   osascript -l JavaScript downloadManager.js '{"action":"stop"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: downloadManager.js \'{"action":"start|stop"}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { action } = params;

    if (!action) throw new Error("Missing required field: action");

    const validActions = ["start", "stop"];
    if (!validActions.includes(action)) {
      throw new Error("Invalid action: " + action + ". Valid: start, stop");
    }

    const app = Application("DEVONthink");
    let success;

    if (action === "start") {
      success = app.startDownloads();
      JSON.stringify({
        success: success,
        action: "start",
        message: success ? "Download manager started" : "Failed to start download manager"
      }, null, 2);
    } else if (action === "stop") {
      success = app.stopDownloads();
      JSON.stringify({
        success: success,
        action: "stop",
        message: success ? "Download manager stopped" : "Failed to stop download manager"
      }, null, 2);
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
