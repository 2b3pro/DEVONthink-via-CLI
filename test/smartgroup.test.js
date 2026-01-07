/**
 * Smart Group Command Tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  runCommand,
  runJxaScript,
  createTestRecord,
  getRecordProps,
  cleanupTestRecords,
  uniqueName,
  TEST_DATABASE
} from './helpers.js';

const createdRecords = [];

describe('smartgroup command', () => {
  let smartGroupUuid;
  let tag;
  let recordUuids;

  before(async () => {
    tag = uniqueName('SGTag');
    const recordA = await createTestRecord({
      name: uniqueName('SGRecordA'),
      tags: [tag]
    });
    const recordB = await createTestRecord({
      name: uniqueName('SGRecordB'),
      tags: [tag]
    });
    recordUuids = [recordA, recordB];
    createdRecords.push(recordA, recordB);
  });

  after(async () => {
    if (smartGroupUuid) createdRecords.push(smartGroupUuid);
    await cleanupTestRecords(createdRecords);
  });

  it('should create and list a smart group', async () => {
    const name = uniqueName('SG_Test');
    const createResult = await runCommand([
      'smartgroup', 'create',
      '-n', name,
      '-d', TEST_DATABASE.name,
      '--query', `tags:${tag}`
    ]);

    assert.strictEqual(createResult.success, true);
    assert.strictEqual(createResult.recordType, 'smart group');
    smartGroupUuid = createResult.uuid;

    const listResult = await runCommand([
      'smartgroup', 'list',
      '-d', TEST_DATABASE.name
    ]);

    assert.strictEqual(listResult.success, true);
    const uuids = (listResult.smartGroups || []).map(sg => sg.uuid);
    assert.ok(uuids.includes(smartGroupUuid));
  });

  it('should update smart group predicates', async () => {
    const newQuery = `tags:${tag} AND kind:any`;
    const updateResult = await runCommand([
      'smartgroup', 'update',
      smartGroupUuid,
      '--query', newQuery
    ]);

    assert.strictEqual(updateResult.success, true);

    const checkResult = await runJxaScript(`
      ObjC.import("Foundation");
      try {
        const app = Application("DEVONthink");
        const record = app.getRecordWithUuid("${smartGroupUuid}");
        if (!record) throw new Error("Record not found");
        JSON.stringify({ success: true, predicates: record.searchPredicates() });
      } catch (e) {
        JSON.stringify({ success: false, error: e.message });
      }
    `);

    assert.strictEqual(checkResult.success, true);
    assert.strictEqual(checkResult.predicates, newQuery);
  });

  it('should list items in a smart group', async () => {
    const itemsResult = await runCommand([
      'smartgroup', 'items',
      smartGroupUuid
    ]);

    assert.strictEqual(itemsResult.success, true);
    const itemUuids = (itemsResult.items || []).map(item => item.uuid);
    assert.ok(itemUuids.includes(recordUuids[0]));
    assert.ok(itemUuids.includes(recordUuids[1]));
  });

  it('should modify items in a smart group', async () => {
    const result = await runCommand([
      'smartgroup', 'modify-items',
      smartGroupUuid,
      '--add-tag', 'review'
    ]);

    assert.strictEqual(result.success, true);

    const props = await getRecordProps(recordUuids[0]);
    assert.ok(props.tags.includes('review'));
  });

  it('should delete items in a smart group', async () => {
    const itemsResult = await runCommand([
      'smartgroup', 'items',
      smartGroupUuid
    ]);
    assert.strictEqual(itemsResult.success, true);
    const countBefore = (itemsResult.items || []).length;
    assert.ok(countBefore >= 2);

    const deleteResult = await runCommand([
      'smartgroup', 'delete-items',
      smartGroupUuid
    ]);

    assert.strictEqual(deleteResult.success, true);
    assert.strictEqual(deleteResult.count, countBefore);
  });
});
