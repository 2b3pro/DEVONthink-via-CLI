#!/usr/bin/env osascript -l JavaScript
// Query DEVONthink records by tag
// Usage: osascript -l JavaScript queryByTag.js <tag> [database] [limit]
// database can be name or UUID (auto-detected)
// Examples:
//   osascript -l JavaScript queryByTag.js "action:extract"
//   osascript -l JavaScript queryByTag.js "action:review" "Inbox" 20
//   osascript -l JavaScript queryByTag.js "action:discard" "A1B2-C3D4-..." 100

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

const tag = getArg(4, null);
const databaseRef = getArg(5, "");
const limit = parseInt(getArg(6, "50"), 10) || 50;

if (!tag) {
  JSON.stringify({ success: false, error: "Usage: queryByTag.js <tag> [database] [limit]" });
} else {
  try {
    const app = Application("DEVONthink");

    // Build tag query - DEVONthink uses "tag:tagname" syntax
    const query = `tag:${tag}`;

    // Get database scope if specified (by name or UUID)
    let searchScope = null;
    let dbName = databaseRef;
    if (databaseRef && databaseRef.length > 0) {
      const db = getDatabase(app, databaseRef);
      searchScope = db.root();
      dbName = db.name();
    }

    // Build search options
    const searchOptions = {};
    if (searchScope) {
      searchOptions["in"] = searchScope;
    }

    // Execute search
    let results = app.search(query, searchOptions);

    if (!results || results.length === 0) {
      JSON.stringify({
        success: true,
        tag: tag,
        database: dbName || "all",
        results: [],
        totalCount: 0
      });
    } else {
      // Filter out groups
      results = results.filter(r => {
        const type = r.recordType();
        return type !== "group" && type !== "smart group";
      });

      // Sort by addition date (oldest first - FIFO queue)
      results.sort((a, b) => {
        const dateA = a.additionDate() ? a.additionDate().getTime() : 0;
        const dateB = b.additionDate() ? b.additionDate().getTime() : 0;
        return dateA - dateB;
      });

      // Limit results
      const limitedResults = results.slice(0, limit);

      // Map to output format
      const output = limitedResults.map(r => ({
        uuid: r.uuid(),
        name: r.name(),
        recordType: r.recordType(),
        location: r.location(),
        database: r.database().name(),
        path: r.path(),
        tags: r.tags(),
        additionDate: r.additionDate() ? r.additionDate().toString() : null
      }));

      JSON.stringify({
        success: true,
        tag: tag,
        database: dbName || "all",
        results: output,
        totalCount: results.length,
        returned: output.length
      }, null, 2);
    }
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
