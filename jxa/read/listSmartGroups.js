#!/usr/bin/env osascript -l JavaScript
// List Smart Groups in a database/group
// Usage: osascript -l JavaScript listSmartGroups.js <database> [path]
//    OR: osascript -l JavaScript listSmartGroups.js <groupUuid>
//    OR: osascript -l JavaScript listSmartGroups.js <json>
// JSON format: {"database":"DB","groupRef":"/path/or/uuid"}
//
// Dependencies (injected by runner):
// - getArg, isUuid, extractUuid, getDatabase, resolveGroup

const arg1 = getArg(4, null);
const arg2 = getArg(5, null);
const app = Application("DEVONthink");

try {
  let params = null;
  if (arg1 && arg1.trim && arg1.trim().startsWith("{")) {
    params = JSON.parse(arg1);
  }

  let group = null;
  let db = null;

  if (params) {
    if (params.groupRef) {
      if (isUuid(params.groupRef)) {
        group = app.getRecordWithUuid(extractUuid(params.groupRef));
        if (!group) throw new Error("Group not found with UUID: " + params.groupRef);
        db = group.database();
      } else {
        if (!params.database) throw new Error("Database required for group path");
        db = getDatabase(app, params.database);
        group = resolveGroup(app, params.groupRef, db);
      }
    } else {
      db = getDatabase(app, params.database);
      group = db.root();
    }
  } else if (arg1 && isUuid(arg1) && !arg2) {
    group = app.getRecordWithUuid(extractUuid(arg1));
    if (!group) throw new Error("Group not found with UUID: " + arg1);
    db = group.database();
  } else {
    db = getDatabase(app, arg1);
    group = resolveGroup(app, arg2 || "/", db);
  }

  if (!group) throw new Error("Group not found");
  const groupType = group.recordType();
  if (groupType !== "group" && groupType !== "smart group") {
    throw new Error("Not a group: " + groupType);
  }

  const children = group.children();
  
  // Filter for smart groups
  const smartGroups = children.filter(c => c.recordType() === "smart group");
  
  const result = smartGroups.map(sg => ({
    name: sg.name(),
    uuid: sg.uuid(),
    path: sg.location(),
    database: db.name()
  }));

  JSON.stringify({
    success: true,
    database: db.name(),
    group: group.name(),
    uuid: group.uuid(),
    count: result.length,
    smartGroups: result
  }, null, 2);
} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
