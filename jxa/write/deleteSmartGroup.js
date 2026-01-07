#!/usr/bin/env osascript -l JavaScript
// Delete a smart group (move to Trash)
// Usage: osascript -l JavaScript deleteSmartGroup.js '<json>'
// JSON format: {"smartGroupRef":"UUID|Name","database":"DB","groupPath":"/"}
//
// Dependencies (injected by runner):
// - getArg, isUuid, extractUuid, getDatabase, resolveGroup

const arg1 = getArg(4, null);

if (!arg1) {
  JSON.stringify({ success: false, error: "Usage: deleteSmartGroup.js '{\"smartGroupRef\":\"...\"}'" });
} else {
  try {
    const params = JSON.parse(arg1);
    const { smartGroupRef, database, groupPath } = params;

    if (!smartGroupRef) throw new Error("Missing smartGroupRef");

    const app = Application("DEVONthink");
    let record = null;

    if (isUuid(smartGroupRef)) {
      record = app.getRecordWithUuid(extractUuid(smartGroupRef));
    } else {
      if (!database) throw new Error("Database is required when smartGroupRef is a name");
      const db = getDatabase(app, database);
      const parent = resolveGroup(app, groupPath || "/", db);
      const children = parent.children();
      record = children.find(c => c.recordType() === "smart group" && c.name() === smartGroupRef);
    }

    if (!record) throw new Error("Smart group not found: " + smartGroupRef);
    if (record.recordType() !== "smart group") {
      throw new Error("Record is not a smart group: " + record.recordType());
    }

    const uuid = record.uuid();
    const name = record.name();
    app.delete({ record: record });

    JSON.stringify({
      success: true,
      uuid,
      name
    }, null, 2);
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
