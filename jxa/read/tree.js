#!/usr/bin/env osascript -l JavaScript
// Generate hierarchical tree of DEVONthink folder structure
// Usage: osascript -l JavaScript tree.js '{"database":"...", "path":"/", "depth":3, "counts":true}'
//
// Dependencies (injected by runner):
// - getArg, isUuid, extractUuid, getDatabase, resolveGroup

const jsonArg = getArg(4, "{}");

try {
  const params = JSON.parse(jsonArg);
  const app = Application("DEVONthink");

  const maxDepth = params.depth || 10;
  const includeCounts = params.counts === true;
  const excludeSystem = params.excludeSystem === true;
  const includeSmartGroups = params.smartGroups === true;
  const jsonOutput = params.json === true;

  // System folders to optionally exclude
  const systemFolders = ["_INBOX", "_TRIAGE", "_ARCHIVE", "Tags", "Trash"];

  // Get database
  let db;
  if (params.database) {
    db = getDatabase(app, params.database);
  } else {
    db = app.currentDatabase();
  }

  if (!db) throw new Error("No database found");

  // Get starting group
  let startGroup;
  if (params.path && params.path !== "/") {
    startGroup = resolveGroup(app, params.path, db);
  } else {
    startGroup = db.root();
  }

  // Recursive tree builder
  function buildTree(group, currentDepth) {
    if (currentDepth > maxDepth) return null;

    const children = group.children();
    const subgroups = [];
    let itemCount = 0;

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const recordType = child.recordType();

      const isGroup = recordType === "group";
      const isSmartGroup = recordType === "smart group";

      if (isGroup || (includeSmartGroups && isSmartGroup)) {
        const name = child.name();

        // Skip system folders if requested (only applies to regular groups)
        if (excludeSystem && isGroup && systemFolders.includes(name)) {
          continue;
        }

        const node = {
          name: name,
          uuid: child.uuid(),
          path: child.location() + name,
          depth: currentDepth
        };

        // Mark smart groups
        if (isSmartGroup) {
          node.isSmartGroup = true;
        }

        // Only recurse into regular groups (smart groups don't have children in the same way)
        if (isGroup) {
          const childTree = buildTree(child, currentDepth + 1);
          if (childTree && childTree.length > 0) {
            node.children = childTree;
          }

          if (includeCounts) {
            // Count non-group items in this group
            const allChildren = child.children();
            let count = 0;
            for (let j = 0; j < allChildren.length; j++) {
              const childType = allChildren[j].recordType();
              if (childType !== "group" && childType !== "smart group") {
                count++;
              }
            }
            node.itemCount = count;
          }
        }

        subgroups.push(node);
      } else {
        itemCount++;
      }
    }

    return subgroups;
  }

  // Build the tree
  const tree = buildTree(startGroup, 1);

  // Format as text tree
  function formatTextTree(nodes, prefix, isLast) {
    let output = "";

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const last = i === nodes.length - 1;
      const connector = last ? "└── " : "├── ";
      const childPrefix = last ? "    " : "│   ";

      // Smart groups shown in brackets, regular groups with trailing slash
      let line;
      if (node.isSmartGroup) {
        line = prefix + connector + "(" + node.name + ")";
      } else {
        line = prefix + connector + node.name + "/";
      }

      if (includeCounts && node.itemCount > 0) {
        line += " (" + node.itemCount + ")";
      }
      output += line + "\n";

      if (node.children && node.children.length > 0) {
        output += formatTextTree(node.children, prefix + childPrefix, last);
      }
    }

    return output;
  }

  const rootName = params.path && params.path !== "/"
    ? startGroup.name()
    : db.name();

  let textOutput = rootName + "/\n";
  if (tree && tree.length > 0) {
    textOutput += formatTextTree(tree, "", false);
  }

  JSON.stringify({
    success: true,
    database: db.name(),
    databaseUuid: db.uuid(),
    startPath: params.path || "/",
    depth: maxDepth,
    tree: tree || [],
    text: textOutput
  }, null, 2);

} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
