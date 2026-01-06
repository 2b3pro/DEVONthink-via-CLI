#!/usr/bin/env osascript -l JavaScript
// List all open DEVONthink databases
// Returns: [{"name": "...", "uuid": "...", "path": "...", "isInbox": boolean}]

ObjC.import("Foundation");

function run() {
  try {
    const app = Application("DEVONthink");
    const databases = app.databases();
    
    const result = databases.map(db => ({
      name: db.name(),
      uuid: db.uuid(),
      path: db.path(),
      isInbox: db.name() === "Inbox" || db.uuid() === "Inbox"
    }));

    return JSON.stringify(result, null, 2);
  } catch (e) {
    return JSON.stringify({ success: false, error: e.message });
  }
}

run();
