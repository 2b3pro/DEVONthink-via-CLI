#!/usr/bin/env osascript -l JavaScript
// Search DEVONthink records
// Usage: osascript -l JavaScript search.js <query> [options-json]
// Examples:
//   osascript -l JavaScript search.js "productivity"
//   osascript -l JavaScript search.js "AI research" '{"database":"IAS Personal","limit":20}'
//   osascript -l JavaScript search.js "notes" '{"comparison":"fuzzy","excludeSubgroups":true}'
//
// Options JSON:
//   database         - Database name or UUID to search in (default: all databases)
//   parentUUID       - UUID of group to search within
//   limit            - Max results to return (default: 50)
//   recordType       - Filter by record type (e.g., "markdown", "pdf")
//   comparison       - Search comparison: "fuzzy", "no case", "no umlauts", "related"
//   excludeSubgroups - If true, don't search in subgroups (default: false)

ObjC.import("Foundation");

function getArg(index, defaultValue) {
  const args = $.NSProcessInfo.processInfo.arguments;
  if (args.count <= index) return defaultValue;
  const arg = ObjC.unwrap(args.objectAtIndex(index));
  return arg && arg.length > 0 ? arg : defaultValue;
}

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

// Resolve database by name or UUID
function getDatabase(theApp, ref) {
  if (!ref) return null;
  if (isUuid(ref)) {
    const record = theApp.getRecordWithUuid(extractUuid(ref));
    if (record) return record.database();
    throw new Error("Database not found with UUID: " + ref);
  }
  const databases = theApp.databases();
  const found = databases.find(db => db.name() === ref);
  if (!found) throw new Error("Database not found: " + ref);
  return found;
}

const query = getArg(4, null);
const optionsArg = getArg(5, "{}");

let opts = {};
try {
  opts = JSON.parse(optionsArg);
} catch (e) {
  // Legacy mode: treat as database name for backwards compatibility
  opts = { database: optionsArg };
}

const databaseName = opts.database || "";
const parentUUID = opts.parentUUID || "";
const limit = parseInt(opts.limit, 10) || 50;
const recordTypeFilter = opts.recordType || "";
const comparison = opts.comparison || "";
const excludeSubgroups = opts.excludeSubgroups === true;

if (!query) {
  JSON.stringify({ success: false, error: "Usage: search.js <query> [options-json]" });
} else {
  try {
    const app = Application("DEVONthink");

    // Determine search scope (parent group)
    let searchScope = null;

    if (parentUUID && parentUUID.length > 0) {
      // Search within specific group by UUID
      searchScope = app.getRecordWithUuid(extractUuid(parentUUID));
      if (!searchScope) {
        throw new Error("Parent group not found: " + parentUUID);
      }
    } else if (databaseName && databaseName.length > 0) {
      // Search within database root (by name or UUID)
      const db = getDatabase(app, databaseName);
      searchScope = db.root();
    }

    // Build search options
    const searchOptions = {};

    if (searchScope) {
      searchOptions["in"] = searchScope;
    }

    if (excludeSubgroups) {
      searchOptions["excludeSubgroups"] = true;
    }

    // Map comparison string to DEVONthink constant
    if (comparison && comparison.length > 0) {
      const comparisonMap = {
        "fuzzy": "fuzzy",
        "no case": "no case",
        "no umlauts": "no umlauts",
        "related": "related"
      };
      if (comparisonMap[comparison]) {
        searchOptions["comparison"] = comparisonMap[comparison];
      }
    }

    // Execute search
    let results = app.search(query, searchOptions);

    // Build options summary for output
    const optionsSummary = {};
    if (databaseName) optionsSummary.database = databaseName;
    if (parentUUID) optionsSummary.parentUUID = parentUUID;
    if (comparison) optionsSummary.comparison = comparison;
    if (excludeSubgroups) optionsSummary.excludeSubgroups = true;
    if (recordTypeFilter) optionsSummary.recordType = recordTypeFilter;
    optionsSummary.limit = limit;

    if (!results || results.length === 0) {
      JSON.stringify({
        success: true,
        query: query,
        options: optionsSummary,
        results: [],
        totalCount: 0
      });
    } else {
      // Filter by record type if specified
      if (recordTypeFilter && recordTypeFilter.length > 0) {
        results = results.filter(r => r.recordType() === recordTypeFilter);
      }

      // Limit results
      const limitedResults = results.slice(0, limit);

      // Map to output format
      const output = limitedResults.map(r => ({
        uuid: r.uuid(),
        name: r.name(),
        recordType: r.recordType(),
        location: r.location(),
        database: r.database().name(),
        tags: r.tags(),
        modificationDate: r.modificationDate() ? r.modificationDate().toString() : null
      }));

      JSON.stringify({
        success: true,
        query: query,
        options: optionsSummary,
        results: output,
        totalCount: results.length,
        returned: output.length
      }, null, 2);
    }
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
