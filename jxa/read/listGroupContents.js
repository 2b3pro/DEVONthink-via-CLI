#!/usr/bin/env osascript -l JavaScript
// List contents of a DEVONthink group
// Usage: osascript -l JavaScript listGroupContents.js <groupUuid>
//    OR: osascript -l JavaScript listGroupContents.js <database> <path>
// Examples:
//   osascript -l JavaScript listGroupContents.js "ABC123-DEF456"
//   osascript -l JavaScript listGroupContents.js "Inbox" "/"
//   osascript -l JavaScript listGroupContents.js "IAS Personal" "/Projects/Archive"

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

const arg1 = getArg(4, null);
const arg2 = getArg(5, null);

if (!arg1) {
  JSON.stringify({
    success: false,
    error: "Usage: listGroupContents.js <groupUuid> OR listGroupContents.js <database> <path>"
  });
} else {
  try {
    const app = Application("DEVONthink");
    let group = null;

    // If only one arg and it looks like a UUID or x-devonthink-item:// URL
    const looksLikeUuid = isUuid(arg1);

    if (looksLikeUuid && !arg2) {
      // Treat as UUID
      group = app.getRecordWithUuid(extractUuid(arg1));
      if (!group) throw new Error("Group not found with UUID: " + arg1);
    } else {
      // Treat as database + path
      const databaseName = arg1;
      const groupPath = arg2 || "/";

      const databases = app.databases();
      const db = databases.find(d => d.name() === databaseName);
      if (!db) throw new Error("Database not found: " + databaseName);

      if (!groupPath || groupPath === "/") {
        group = db.root();
      } else {
        // Navigate path
        const parts = groupPath.split("/").filter(p => p.length > 0);
        let current = db.root();
        for (const part of parts) {
          const children = current.children();
          const found = children.find(c => c.name() === part);
          if (!found) throw new Error("Path not found: " + groupPath);
          current = found;
        }
        group = current;
      }
    }

    if (!group) throw new Error("Group not found");

    const recordType = group.recordType();
    if (recordType !== "group" && recordType !== "smart group") {
      throw new Error("Not a group: " + recordType);
    }

    const children = group.children();
    const items = children.map(c => ({
      uuid: c.uuid(),
      name: c.name(),
      recordType: c.recordType(),
      tags: c.tags(),
      modificationDate: c.modificationDate() ? c.modificationDate().toString() : null
    }));

    JSON.stringify({
      success: true,
      group: group.name(),
      uuid: group.uuid(),
      path: group.location(),
      itemCount: items.length,
      items: items
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
