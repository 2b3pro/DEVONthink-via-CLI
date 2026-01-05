#!/usr/bin/env osascript -l JavaScript
// Get concordance (word list) of a DEVONthink record
// Usage: osascript -l JavaScript getConcordance.js <uuid> [sortBy]
// sortBy: weight (default), frequency, name
//
// Examples:
//   osascript -l JavaScript getConcordance.js "ABC123-DEF456"
//   osascript -l JavaScript getConcordance.js "ABC123-DEF456" "frequency"
//   osascript -l JavaScript getConcordance.js "ABC123-DEF456" "name"

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

const uuid = getArg(4, null);
const sortBy = getArg(5, "weight");

if (!uuid) {
  JSON.stringify({
    success: false,
    error: "Usage: getConcordance.js <uuid> [sortBy]"
  });
} else {
  try {
    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(uuid);

    if (!record) throw new Error("Record not found: " + uuid);

    // Map sort option to DEVONthink concordance sorting
    let sortOption;
    switch (sortBy.toLowerCase()) {
      case "frequency":
      case "count":
        sortOption = "frequency";
        break;
      case "weight":
      default:
        sortOption = "weight";
        break;
    }

    // Get concordance using correct JXA syntax with explicit 'record' parameter
    const concordance = app.getConcordanceOf({ record: record, sortedBy: sortOption });

    if (!concordance || concordance.length === 0) {
      JSON.stringify({
        success: true,
        uuid: uuid,
        name: record.name(),
        sortedBy: sortOption,
        wordCount: 0,
        words: []
      }, null, 2);
    } else {
      // DEVONthink returns array of strings when using native concordance
      // Sort alphabetically if requested (native API only supports weight/frequency)
      let words = concordance.slice();

      if (sortBy.toLowerCase() === "name" || sortBy.toLowerCase() === "alphabetical") {
        words.sort((a, b) => a.localeCompare(b));
      }

      JSON.stringify({
        success: true,
        uuid: uuid,
        name: record.name(),
        sortedBy: sortBy,
        wordCount: words.length,
        words: words
      }, null, 2);
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
