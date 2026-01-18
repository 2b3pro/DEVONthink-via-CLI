#!/usr/bin/env osascript -l JavaScript
// Get versioning status for a database or record's database
// Usage: osascript -l JavaScript getVersioningStatus.js '<json>'
// JSON format: {"database":"...", "uuid":"..."}
// At least one of database or uuid is required
// If uuid is provided, gets status of that record's database
//
// Dependencies (injected by runner):
// - getArg, extractUuid

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: getVersioningStatus.js \'{"database":"..." OR "uuid":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { database, uuid } = params;

    if (!database && !uuid) {
      throw new Error("Either database or uuid is required");
    }

    const app = Application("DEVONthink");
    let db;

    if (uuid) {
      const record = app.getRecordWithUuid(extractUuid(uuid));
      if (!record) throw new Error("Record not found: " + uuid);
      db = record.database();
    } else {
      const dbs = app.databases().filter(d =>
        d.name().toLowerCase() === database.toLowerCase() ||
        d.uuid() === database
      );
      if (dbs.length === 0) throw new Error("Database not found: " + database);
      db = dbs[0];
    }

    // Get versioning info
    const versioningEnabled = db.versioning();
    const versionsGroup = db.versionsGroup();

    const result = {
      success: true,
      database: db.name(),
      databaseUuid: db.uuid(),
      versioningEnabled: versioningEnabled
    };

    if (versionsGroup) {
      result.versionsGroup = {
        name: versionsGroup.name(),
        uuid: versionsGroup.uuid(),
        location: versionsGroup.location()
      };
    }

    JSON.stringify(result, null, 2);

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
