#!/usr/bin/env osascript -l JavaScript
// Update a smart group (name, search predicates, search group)
// Usage: osascript -l JavaScript updateSmartGroup.js '<json>'
// JSON format: {"smartGroupRef":"UUID|Name","database":"DB","groupPath":"/","name":"New","query":"tags:foo","searchGroup":"/Scope"}
//
// Dependencies (injected by runner):
// - getArg, isUuid, extractUuid, getDatabase, resolveGroup

const arg1 = getArg(4, null);

if (!arg1) {
  JSON.stringify({ success: false, error: "Usage: updateSmartGroup.js '{\"smartGroupRef\":\"...\"}'" });
} else {
  try {
    const params = JSON.parse(arg1);
    const { smartGroupRef, database, groupPath, name, query, searchGroup } = params;

    if (!smartGroupRef) throw new Error("Missing smartGroupRef");
    if (name === undefined && query === undefined && searchGroup === undefined) {
      throw new Error("No updates provided");
    }

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

    if (name !== undefined) {
      record.name = name;
    }
    if (query !== undefined) {
      record.searchPredicates = query;
    }
    if (searchGroup !== undefined) {
      const db = record.database();
      const scope = resolveGroup(app, searchGroup, db);
      record.searchGroup = scope;
    }

    JSON.stringify({
      success: true,
      uuid: record.uuid(),
      name: record.name(),
      searchPredicates: record.searchPredicates(),
      searchGroup: record.searchGroup() ? record.searchGroup().location() : null
    }, null, 2);
  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
