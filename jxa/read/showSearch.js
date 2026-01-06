#!/usr/bin/env osascript -l JavaScript
// Perform search in DEVONthink's frontmost main window
// Usage: osascript -l JavaScript showSearch.js [query]
//
// Examples:
//   osascript -l JavaScript showSearch.js "project notes"
//   osascript -l JavaScript showSearch.js "kind:pdf author:Smith"

ObjC.import("Foundation");

const query = getArg(4, null);

try {
  const app = Application("DEVONthink");

  // Show search with optional query
  const result = app.showSearch(query || "");

  JSON.stringify({
    success: result === true,
    query: query || "",
    message: result ? "Search opened in DEVONthink" : "Failed to open search"
  }, null, 2);

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
