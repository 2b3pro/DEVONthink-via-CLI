/**
 * JXA Smart Group Property Test
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import { runJxaScript, cleanupTestRecords, uniqueName, TEST_DATABASE } from './helpers.js';

const createdRecords = [];

describe('jxa smart group properties', () => {
  after(async () => {
    if (createdRecords.length > 0) {
      await cleanupTestRecords(createdRecords);
    }
  });

  it('should set smart group query property', async () => {
    const name = uniqueName('SG_JXA_Test');
    const query = 'tags:adult';

    const createResult = await runJxaScript(`
      ObjC.import("Foundation");
      try {
        const app = Application("DEVONthink");
        const db = app.databases().find(d => d.uuid() === "${TEST_DATABASE.uuid}");
        if (!db) throw new Error("Test database not found");
        const group = db.root();
        const record = app.createRecordWith(
          { name: "${name}", type: "smart group" },
          { in: group }
        );
        if (!record) throw new Error("Failed to create smart group");
        try { record.searchPredicates = "${query}"; } catch (e) {}
        try { record.searchQuery = "${query}"; } catch (e) {}
        JSON.stringify({ success: true, uuid: record.uuid() });
      } catch (e) {
        JSON.stringify({ success: false, error: e.message });
      }
    `);

    assert.strictEqual(createResult.success, true);
    createdRecords.push(createResult.uuid);

    const checkResult = await runJxaScript(`
      ObjC.import("Foundation");
      try {
        const app = Application("DEVONthink");
        const record = app.getRecordWithUuid("${createResult.uuid}");
        if (!record) throw new Error("Record not found");
        let predicates = null;
        let query = null;
        try { predicates = record.searchPredicates(); } catch (e) {}
        try { query = record.searchQuery(); } catch (e) {}
        JSON.stringify({ success: true, predicates, query });
      } catch (e) {
        JSON.stringify({ success: false, error: e.message });
      }
    `);

    assert.strictEqual(checkResult.success, true);
    assert.strictEqual(checkResult.predicates, query);
  });
});
