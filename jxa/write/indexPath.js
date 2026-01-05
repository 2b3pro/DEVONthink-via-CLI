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

// Helper to find database by name or UUID
function getDatabase(app, ref) {
  // Try UUID first
  const byUuid = app.getRecordWithUuid(extractUuid(ref));
  if (byUuid) {
    return byUuid.database();
  }
  // Try by name
  const dbs = app.databases();
  for (let i = 0; i < dbs.length; i++) {
    if (dbs[i].name() === ref) {
      return dbs[i];
    }
  }
  return null;
}

// Helper to resolve group path
function resolveGroup(app, db, pathOrUuid, createIfMissing) {
  if (!pathOrUuid || pathOrUuid === "/" || pathOrUuid === "") {
    return db.root();
  }

  // Try UUID first
  if (isUuid(pathOrUuid)) {
    const byUuid = app.getRecordWithUuid(extractUuid(pathOrUuid));
    if (byUuid) return byUuid;
  }

  // Navigate path
  let current = db.root();
  const parts = pathOrUuid.split("/").filter(p => p.length > 0);

  for (const part of parts) {
    const children = current.children();
    let found = null;
    for (let i = 0; i < children.length; i++) {
      if (children[i].name() === part) {
        found = children[i];
        break;
      }
    }
    if (!found) {
      if (createIfMissing) {
        found = app.createRecordWith({ name: part, type: "group" }, { in: current });
      } else {
        throw new Error("Group not found: " + part);
      }
    }
    current = found;
  }

  return current;
}

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
