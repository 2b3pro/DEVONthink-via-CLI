#!/usr/bin/env osascript -l JavaScript
// List contents of a DEVONthink group with optional recursive depth
// Usage: osascript -l JavaScript listGroupContents.js <json>
//    OR: osascript -l JavaScript listGroupContents.js <groupUuid>
//    OR: osascript -l JavaScript listGroupContents.js <database> <path>
//
// JSON params:
//   groupRef: UUID or x-devonthink-item:// URL (required if no database/path)
//   database: Database name (alternative to groupRef)
//   path: Path within database (default "/", used with database)
//   depth: Number of levels to traverse (default 1, -1 for unlimited)
//
// Dependencies (injected by runner):
// - getArg, isUuid, extractUuid, resolveGroup

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
    let maxDepth = 1; // Default: single level (original behavior)

    // Check if arg1 is JSON
    let params = null;
    try {
      if (arg1.trim().startsWith("{")) {
        params = JSON.parse(arg1);
      }
    } catch (e) {
      // Not JSON
    }

    if (params) {
      // JSON mode - parse depth first
      if (params.depth !== undefined) {
        maxDepth = parseInt(params.depth, 10);
        if (isNaN(maxDepth)) maxDepth = 1;
        if (maxDepth === -1) maxDepth = 100; // Unlimited = 100 levels deep
      }

      if (params.groupRef) {
        // UUID mode
        group = app.getRecordWithUuid(extractUuid(params.groupRef));
        if (!group) throw new Error("Group not found with UUID: " + params.groupRef);
      } else if (params.database) {
        // Database + path mode
        const databases = app.databases();
        const db = databases.find(d => d.name() === params.database);
        if (!db) throw new Error("Database not found: " + params.database);

        const groupPath = params.path || "/";
        if (!groupPath || groupPath === "/") {
          group = db.root();
        } else {
          group = resolveGroup(app, groupPath, db);
        }
      } else {
        throw new Error("Either groupRef or database must be provided");
      }
    } else {
      // Legacy CLI mode
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
          group = resolveGroup(app, groupPath, db);
        }
      }
    }

    if (!group) throw new Error("Group not found");

    const recordType = group.recordType();
    if (recordType !== "group" && recordType !== "smart group") {
      throw new Error("Not a group: " + recordType);
    }

    // Collect items with recursive traversal
    // depth=1 means direct children only (level 0)
    // depth=2 means children and grandchildren (levels 0-1)
    // depth=N means levels 0 through N-1
    const items = [];

    function collectItems(parentGroup, currentLevel) {
      // currentLevel is 0-indexed, maxDepth is 1-indexed
      // So depth=1 allows level 0, depth=2 allows levels 0-1, etc.
      if (currentLevel >= maxDepth) return;

      const children = parentGroup.children();
      for (let i = 0; i < children.length; i++) {
        const c = children[i];
        const cType = c.recordType();
        const isGroup = cType === "group" || cType === "smart group";

        const item = {
          uuid: c.uuid(),
          name: c.name(),
          type: cType,
          level: currentLevel,
          path: c.location() + c.name()
        };

        // Include itemCount for groups
        if (isGroup) {
          const groupChildren = c.children();
          let docCount = 0;
          for (let j = 0; j < groupChildren.length; j++) {
            const childType = groupChildren[j].recordType();
            if (childType !== "group" && childType !== "smart group") {
              docCount++;
            }
          }
          item.itemCount = docCount;
        }

        items.push(item);

        // Recurse into groups if we haven't hit max depth
        if (isGroup && currentLevel + 1 < maxDepth) {
          collectItems(c, currentLevel + 1);
        }
      }
    }

    collectItems(group, 0);

    JSON.stringify({
      success: true,
      group: group.name(),
      uuid: group.uuid(),
      path: group.location(),
      depth: maxDepth,
      totalItems: items.length,
      items: items
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}