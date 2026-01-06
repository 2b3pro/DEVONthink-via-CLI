#!/usr/bin/env osascript -l JavaScript
// List root-level Smart Groups in a database
// Usage: osascript -l JavaScript listSmartGroups.js <database>
//
// Dependencies (injected by runner):
// - getArg, getDatabase

const dbRef = getArg(4, null);
const app = Application("DEVONthink");

try {
  const db = getDatabase(app, dbRef); // helpers.getDatabase handles default (current) if null
  
  // Get root children
  const root = db.root();
  const children = root.children();
  
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
    count: result.length,
    smartGroups: result
  }, null, 2);
} catch (e) {
  JSON.stringify({ success: false, error: e.message });
}
