#!/usr/bin/env osascript -l JavaScript
// Get saved versions of a DEVONthink record
// Usage: osascript -l JavaScript getVersions.js '<json>'
// JSON format: {"uuid":"..."}
// Required: uuid
//
// Returns list of versions sorted by date (oldest first)
// Each version is a record with its own UUID that can be used for restoration
//
// Dependencies (injected by runner):
// - getArg, extractUuid

const jsonArg = getArg(4, null);

if (!jsonArg) {
  JSON.stringify({
    success: false,
    error: 'Usage: getVersions.js \'{"uuid":"..."}\''
  });
} else {
  try {
    const params = JSON.parse(jsonArg);
    const { uuid } = params;

    if (!uuid) throw new Error("Missing required field: uuid");

    const app = Application("DEVONthink");
    const record = app.getRecordWithUuid(extractUuid(uuid));

    if (!record) throw new Error("Record not found: " + uuid);

    // Check if database has versioning enabled
    const db = record.database();
    const versioningEnabled = db.versioning();

    // Get versions (returns list of records sorted by date, oldest first)
    const versions = app.getVersionsOf({ record: record });

    if (!versions || versions.length === 0) {
      JSON.stringify({
        success: true,
        uuid: uuid,
        name: record.name(),
        versioningEnabled: versioningEnabled,
        versions: [],
        count: 0
      });
    } else {
      const versionList = versions.map((v, index) => {
        try {
          return {
            index: index,
            uuid: v.uuid(),
            name: v.name(),
            creationDate: v.creationDate() ? v.creationDate().toISOString() : null,
            modificationDate: v.modificationDate() ? v.modificationDate().toISOString() : null,
            size: v.size()
          };
        } catch (e) {
          return {
            index: index,
            uuid: v.uuid ? v.uuid() : "unknown",
            error: e.message
          };
        }
      });

      JSON.stringify({
        success: true,
        uuid: uuid,
        name: record.name(),
        versioningEnabled: versioningEnabled,
        versions: versionList,
        count: versionList.length
      }, null, 2);
    }

  } catch (e) {
    JSON.stringify({ success: false, error: e.message });
  }
}
