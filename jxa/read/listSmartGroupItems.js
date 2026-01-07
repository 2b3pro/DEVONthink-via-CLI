#!/usr/bin/env osascript -l JavaScript
// List items in a smart group
// Usage: osascript -l JavaScript listSmartGroupItems.js '<json>'
// JSON format: {"smartGroupRef":"UUID|Name","database":"DB","groupPath":"/","limit":50}
//
// Dependencies (injected by runner):
// - getArg, isUuid, extractUuid, getDatabase, resolveGroup

const arg1 = getArg(4, null);

if (!arg1) {
  JSON.stringify({ success: false, error: "Usage: listSmartGroupItems.js '{\"smartGroupRef\":\"...\"}'" });
} else {
  try {
    const app = Application("DEVONthink");
    let params = null;

    if (arg1.trim().startsWith("{")) {
      params = JSON.parse(arg1);
    } else {
      params = { smartGroupRef: arg1 };
    }

    const smartGroupRef = params.smartGroupRef;
    if (!smartGroupRef) throw new Error("Missing smartGroupRef");

    let record = null;

    if (isUuid(smartGroupRef)) {
      record = app.getRecordWithUuid(extractUuid(smartGroupRef));
    } else {
      if (!params.database) {
        throw new Error("Database is required when smartGroupRef is a name");
      }
      const db = getDatabase(app, params.database);
      const parent = resolveGroup(app, params.groupPath || "/", db);
      const children = parent.children();
      record = children.find(c => c.recordType() === "smart group" && c.name() === smartGroupRef);
    }

    if (!record) throw new Error("Smart group not found: " + smartGroupRef);
    if (record.recordType() !== "smart group") {
      throw new Error("Record is not a smart group: " + record.recordType());
    }

    const items = record.children();
    const limit = params.limit ? parseInt(params.limit, 10) : null;
    const slice = limit ? items.slice(0, limit) : items;

    const results = slice.map(item => ({
      uuid: item.uuid(),
      name: item.name(),
      recordType: item.recordType(),
      path: item.location()
    }));

    JSON.stringify({
      success: true,
      smartGroup: record.name(),
      uuid: record.uuid(),
      count: results.length,
      items: results
    }, null, 2);
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
