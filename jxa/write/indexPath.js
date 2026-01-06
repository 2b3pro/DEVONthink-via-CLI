#!/usr/bin/env osascript -l JavaScript
// Index a file or folder in DEVONthink (creates reference, not copy)
// Usage: osascript -l JavaScript indexPath.js '<json>'
// JSON format: {"path":"...","database":"...","groupPath":"/"}
// Required: path, database (database optional if groupPath is a UUID)
// Optional: groupPath (default: "/")
//
// Notes:
// - Creates a reference to an external file/folder
// - Not supported by revision-proof databases
// - Folder indexing includes subfolders
//
// Examples:
//   osascript -l JavaScript indexPath.js '{"path":"~/Documents/Project","database":"Work"}'
//   osascript -l JavaScript indexPath.js '{"path":"/Users/me/file.pdf","database":"Research","groupPath":"Papers"}'

ObjC.import("Foundation");

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: indexPath.js \'{"path":"...","database":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { path, database, groupPath } = params;

    if (!path) throw new Error("Missing required field: path");

    const app = Application("DEVONthink");

    // Expand tilde in path
    const expandedPath = ObjC.unwrap($(path).stringByExpandingTildeInPath);

    // Check if path exists
    const fm = $.NSFileManager.defaultManager;
    if (!fm.fileExistsAtPath($(expandedPath))) {
      throw new Error("Path not found: " + expandedPath);
    }

    // Find database and destination group
    let db;
    let destination;

    if (groupPath && isUuid(groupPath)) {
      // Group UUID provided - get database from the group itself
      destination = app.getRecordWithUuid(extractUuid(groupPath));
      if (!destination) throw new Error("Group not found with UUID: " + groupPath);
      const groupType = destination.recordType();
      if (groupType !== "group" && groupType !== "smart group") {
        throw new Error("UUID does not point to a group: " + groupType);
      }
      db = destination.database();
    } else {
      // Need database for path resolution
      if (!database) throw new Error("Missing required field: database (required when groupPath is not a UUID)");
      db = getDatabase(app, database);
      if (!db) throw new Error("Database not found: " + database);
      destination = resolveGroup(app, db, groupPath || "/", true);
    }

    // Build index options
    const indexOptions = { to: destination };

    // Index the path
    const record = app.indexPath(expandedPath, indexOptions);

    if (!record) {
      throw new Error("Indexing failed. Database may be revision-proof or path inaccessible.");
    }

    // Check if it's a folder (will have children for indexed folders)
    const isFolder = fm.fileExistsAtPathIsDirectory($(expandedPath), Ref());

    JSON.stringify({
      success: true,
      uuid: record.uuid(),
      name: record.name(),
      location: record.location(),
      database: db.name(),
      recordType: record.recordType(),
      path: record.path(),
      indexed: true,
      isFolder: isFolder
    }, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
