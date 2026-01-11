/**
 * Smart Group Creation Tests
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import {
  runCommand,
  runJxaScript,
  cleanupTestRecords,
  uniqueName,
  TEST_DATABASE
} from './helpers.js';

const createdRecords = [];

describe('create record smart group', () => {
  after(async () => {
    if (createdRecords.length > 0) {
      await cleanupTestRecords(createdRecords);
    }
  });

  it('should create a smart group with query', async () => {
    const name = uniqueName('SG_Tag_Test');
    const query = 'tags:*';
    const result = await runCommand([
      'create', 'record',
      '-n', name,
      '-T', 'smart group',
      '-d', TEST_DATABASE.name,
      '--query', query
    ]);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.recordType, 'smart group');
    assert.strictEqual(result.name, name);
    createdRecords.push(result.uuid);

    // Smart groups use searchPredicates, not searchQuery (which is for window searches)
    // Must find via children iteration since getRecordWithUuid can be unreliable for new records
    const queryResult = await runJxaScript(`
      ObjC.import("Foundation");
      try {
        const app = Application("DEVONthink");
        const dbs = app.databases();
        const db = dbs.find(d => d.name() === "${TEST_DATABASE.name}");
        const root = db.root();
        const children = root.children();
        const sg = children.find(c => c.uuid() === "${result.uuid}");
        if (!sg) throw new Error("Smart group not found");
        JSON.stringify({ success: true, predicates: sg.searchPredicates() });
      } catch (e) {
        JSON.stringify({ success: false, error: e.message });
      }
    `);

    assert.strictEqual(queryResult.success, true);
    assert.strictEqual(queryResult.predicates, query);
  });

  it('should fail without query for smart group', async () => {
    const result = await runCommand([
      'create', 'record',
      '-n', uniqueName('SG_Tag_NoQuery'),
      '-T', 'smart group',
      '-d', TEST_DATABASE.name
    ], { expectFailure: true });

    assert.strictEqual(result.success, false);
  });
});
