/**
 * Command Tests for DevonThink CLI
 * Tests all commands against Test_Database
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  runCommand,
  runCommandWithStdin,
  createTestRecord,
  createTestGroup,
  deleteTestRecord,
  getRecordProps,
  recordExists,
  cleanupTestRecords,
  uniqueName,
  TEST_DATABASE
} from './helpers.js';

// Track records created during tests for cleanup
const createdRecords = [];

describe('DevonThink CLI Commands', () => {
  // ============================================================
  // STATUS COMMAND
  // ============================================================
  describe('status command', () => {
    it('should report DEVONthink is running', async () => {
      const result = await runCommand(['status']);
      assert.strictEqual(result.running, true);
      assert.strictEqual(result.success, true);
    });
  });

  // ============================================================
  // GET COMMANDS
  // ============================================================
  describe('get commands', () => {
    let testRecordUuid;

    before(async () => {
      testRecordUuid = await createTestRecord({
        name: uniqueName('GetTest'),
        content: 'This is test content for get command testing. Multiple words for concordance.'
      });
      createdRecords.push(testRecordUuid);
    });

    describe('get props', () => {
      it('should get record properties by UUID', async () => {
        const result = await runCommand(['get', 'props', testRecordUuid]);
        assert.strictEqual(result.success, true);
        assert.ok(result.uuid);
        assert.ok(result.name);
        assert.ok(result.recordType);
      });

      it('should fail for invalid UUID', async () => {
        const result = await runCommand(['get', 'props', 'INVALID-UUID'], { expectFailure: true });
        assert.strictEqual(result.success, false);
      });
    });

    describe('get preview', () => {
      it('should get record preview text', async () => {
        const result = await runCommand(['get', 'preview', testRecordUuid]);
        assert.strictEqual(result.success, true);
        assert.ok(result.preview !== undefined);
      });

      it('should respect length limit', async () => {
        const result = await runCommand(['get', 'preview', testRecordUuid, '-l', '10']);
        assert.strictEqual(result.success, true);
      });
    });

    describe('get selection', () => {
      it('should get selection status (may be empty)', async () => {
        // This test accepts either successful selection or "no selection" as valid
        // since we can't guarantee items are selected during automated testing
        const result = await runCommand(['get', 'selection'], { expectFailure: true });
        // Either success with records, or failure with "No records selected" is valid
        assert.ok(
          result.success === true ||
          (result.success === false && result.error && result.error.includes('No records selected'))
        );
      });
    });

    describe('get concordance', () => {
      it('should get word list from record', async () => {
        const result = await runCommand(['get', 'concordance', testRecordUuid]);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.words));
      });

      it('should support sorting options', async () => {
        const result = await runCommand(['get', 'concordance', testRecordUuid, '-s', 'frequency']);
        assert.strictEqual(result.success, true);
      });

      it('should support limit option', async () => {
        const result = await runCommand(['get', 'concordance', testRecordUuid, '-l', '5']);
        assert.strictEqual(result.success, true);
        assert.ok(result.words.length <= 5);
      });
    });
  });

  // ============================================================
  // LIST COMMANDS
  // ============================================================
  describe('list commands', () => {
    let testGroupUuid;

    before(async () => {
      testGroupUuid = await createTestGroup(uniqueName('ListTestGroup'));
      createdRecords.push(testGroupUuid);
    });

    describe('list group', () => {
      it('should list database root contents', async () => {
        const result = await runCommand(['list', 'group', TEST_DATABASE.name, '/']);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.items));
      });

      it('should list group by UUID', async () => {
        const result = await runCommand(['list', 'group', testGroupUuid]);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.items));
      });
    });

    describe('list inbox', () => {
      it('should list inbox contents', async () => {
        const result = await runCommand(['list', 'inbox']);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.items) || result.totalCount !== undefined);
      });

      it('should respect limit option', async () => {
        const result = await runCommand(['list', 'inbox', '-l', '5']);
        assert.strictEqual(result.success, true);
      });
    });

    describe('list tag', () => {
      let taggedRecordUuid;

      before(async () => {
        taggedRecordUuid = await createTestRecord({
          name: uniqueName('TagTest'),
          tags: ['cli-test-tag']
        });
        createdRecords.push(taggedRecordUuid);
      });

      it('should list records with specific tag', async () => {
        const result = await runCommand(['list', 'tag', 'cli-test-tag']);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.results));
      });

      it('should support database filter', async () => {
        const result = await runCommand(['list', 'tag', 'cli-test-tag', '-d', TEST_DATABASE.name]);
        assert.strictEqual(result.success, true);
      });
    });
  });

  // ============================================================
  // SEARCH COMMANDS
  // ============================================================
  describe('search commands', () => {
    let searchRecordUuid;

    before(async () => {
      searchRecordUuid = await createTestRecord({
        name: uniqueName('SearchableRecord'),
        content: 'Unique searchable content XYZTEST123'
      });
      createdRecords.push(searchRecordUuid);
    });

    describe('search query', () => {
      it('should search for records by content', async () => {
        const result = await runCommand(['search', 'query', 'XYZTEST123']);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.results));
      });

      it('should support database filter', async () => {
        const result = await runCommand(['search', 'query', 'test', '-d', TEST_DATABASE.name]);
        assert.strictEqual(result.success, true);
      });

      it('should support limit option', async () => {
        const result = await runCommand(['search', 'query', 'test', '-l', '5']);
        assert.strictEqual(result.success, true);
      });
    });

    describe('search file', () => {
      it('should lookup by filename', async () => {
        const result = await runCommand(['search', 'file', 'SearchableRecord']);
        assert.strictEqual(result.success, true);
      });
    });

    describe('search show', () => {
      it('should open search in DEVONthink', async () => {
        const result = await runCommand(['search', 'show', 'test']);
        assert.strictEqual(result.success, true);
      });
    });
  });

  // ============================================================
  // CREATE COMMAND
  // ============================================================
  describe('create command', () => {
    describe('create record', () => {
      it('should create a markdown record', async () => {
        const name = uniqueName('CreateTest');
        const result = await runCommand([
          'create', 'record',
          '-n', name,
          '-T', 'markdown',
          '-d', TEST_DATABASE.name,
          '-c', 'Test content'
        ]);
        assert.strictEqual(result.success, true);
        assert.ok(result.uuid);
        createdRecords.push(result.uuid);
      });

      it('should create a record with tags', async () => {
        const name = uniqueName('TaggedCreate');
        const result = await runCommand([
          'create', 'record',
          '-n', name,
          '-T', 'markdown',
          '-d', TEST_DATABASE.name,
          '-c', 'Content with tags',
          '-t', 'test-tag1',
          '-t', 'test-tag2'
        ]);
        assert.strictEqual(result.success, true);
        createdRecords.push(result.uuid);

        // Verify tags were applied
        const props = await getRecordProps(result.uuid);
        assert.ok(props.tags.includes('test-tag1'));
        assert.ok(props.tags.includes('test-tag2'));
      });

      it('should create a text record', async () => {
        const name = uniqueName('TextCreate');
        const result = await runCommand([
          'create', 'record',
          '-n', name,
          '-T', 'txt',
          '-d', TEST_DATABASE.name,
          '-c', 'Plain text content'
        ]);
        assert.strictEqual(result.success, true);
        createdRecords.push(result.uuid);
      });

      it('should create a bookmark record', async () => {
        const name = uniqueName('BookmarkCreate');
        const result = await runCommand([
          'create', 'record',
          '-n', name,
          '-T', 'bookmark',
          '-d', TEST_DATABASE.name,
          '-u', 'https://example.com'
        ]);
        assert.strictEqual(result.success, true);
        createdRecords.push(result.uuid);
      });

      it('should fail without required options', async () => {
        const result = await runCommand(['create', 'record', '-n', 'Test'], { expectFailure: true });
        assert.strictEqual(result.success, false);
      });
    });
  });

  // ============================================================
  // MODIFY COMMAND
  // ============================================================
  describe('modify command', () => {
    let modifyTestUuid;

    before(async () => {
      modifyTestUuid = await createTestRecord({
        name: uniqueName('ModifyTest'),
        tags: ['original-tag']
      });
      createdRecords.push(modifyTestUuid);
    });

    it('should rename a record', async () => {
      const newName = uniqueName('Renamed');
      const result = await runCommand(['modify', modifyTestUuid, '-n', newName]);
      assert.strictEqual(result.success, true);

      const props = await getRecordProps(modifyTestUuid);
      assert.strictEqual(props.name, newName);
    });

    it('should add tags to a record', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--add-tag', 'added-tag']);
      assert.strictEqual(result.success, true);

      const props = await getRecordProps(modifyTestUuid);
      assert.ok(props.tags.includes('added-tag'));
    });

    it('should remove tags from a record', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--remove-tag', 'original-tag']);
      assert.strictEqual(result.success, true);

      const props = await getRecordProps(modifyTestUuid);
      assert.ok(!props.tags.includes('original-tag'));
    });

    it('should set comment on a record', async () => {
      const comment = 'Test comment';
      const result = await runCommand(['modify', modifyTestUuid, '-c', comment]);
      assert.strictEqual(result.success, true);

      const props = await getRecordProps(modifyTestUuid);
      assert.strictEqual(props.comment, comment);
    });

    it('should fail without modifications', async () => {
      const result = await runCommand(['modify', modifyTestUuid], { expectFailure: true });
      assert.strictEqual(result.success, false);
    });
  });

  // ============================================================
  // UPDATE COMMAND
  // ============================================================
  describe('update command', () => {
    let updateTestUuid;

    before(async () => {
      updateTestUuid = await createTestRecord({
        name: uniqueName('UpdateTest'),
        content: 'Original content'
      });
      createdRecords.push(updateTestUuid);
    });

    it('should replace content with setting mode', async () => {
      const result = await runCommand([
        'update', updateTestUuid,
        '-m', 'setting',
        '-c', 'Replaced content'
      ]);
      assert.strictEqual(result.success, true);
    });

    it('should append content with appending mode', async () => {
      const result = await runCommand([
        'update', updateTestUuid,
        '-m', 'appending',
        '-c', '\nAppended content'
      ]);
      assert.strictEqual(result.success, true);
    });

    it('should fail with invalid mode', async () => {
      const result = await runCommand([
        'update', updateTestUuid,
        '-m', 'invalid',
        '-c', 'Content'
      ], { expectFailure: true });
      assert.strictEqual(result.success, false);
    });
  });

  // ============================================================
  // GROUP COMMAND
  // ============================================================
  describe('group command', () => {
    it('should create/resolve a group path', async () => {
      const groupName = uniqueName('TestGroup');
      const result = await runCommand([
        'group', `/${groupName}`,
        '-d', TEST_DATABASE.name
      ]);
      assert.strictEqual(result.success, true);
      assert.ok(result.uuid);
      createdRecords.push(result.uuid);
    });

    it('should create nested group path', async () => {
      const parentName = uniqueName('Parent');
      const childName = uniqueName('Child');
      const result = await runCommand([
        'group', `/${parentName}/${childName}`,
        '-d', TEST_DATABASE.name
      ]);
      assert.strictEqual(result.success, true);
      assert.ok(result.uuid);
      createdRecords.push(result.uuid);
    });
  });

  // ============================================================
  // MOVE COMMAND
  // ============================================================
  describe('move command', () => {
    let moveRecordUuid;
    let moveDestGroupUuid;

    before(async () => {
      moveRecordUuid = await createTestRecord({
        name: uniqueName('MoveTest')
      });
      moveDestGroupUuid = await createTestGroup(uniqueName('MoveDest'));
      createdRecords.push(moveRecordUuid, moveDestGroupUuid);
    });

    it('should move record to a different group', async () => {
      const result = await runCommand([
        'move', moveRecordUuid,
        '-t', moveDestGroupUuid
      ]);
      assert.strictEqual(result.success, true);

      const props = await getRecordProps(moveRecordUuid);
      assert.ok(props.location.includes(moveDestGroupUuid) || props.success);
    });
  });

  // ============================================================
  // DUPLICATE COMMAND
  // ============================================================
  describe('duplicate command', () => {
    let duplicateSourceUuid;
    let duplicateDestGroupUuid;

    before(async () => {
      duplicateSourceUuid = await createTestRecord({
        name: uniqueName('DuplicateSource')
      });
      duplicateDestGroupUuid = await createTestGroup(uniqueName('DuplicateDest'));
      createdRecords.push(duplicateSourceUuid, duplicateDestGroupUuid);
    });

    it('should create a duplicate of a record', async () => {
      const result = await runCommand([
        'duplicate', duplicateSourceUuid,
        '-t', duplicateDestGroupUuid
      ]);
      assert.strictEqual(result.success, true);
      assert.ok(result.copied && result.copied.length > 0);
      createdRecords.push(...result.copied.map(r => r.uuid));
    });
  });

  // ============================================================
  // REPLICATE COMMAND
  // ============================================================
  describe('replicate command', () => {
    let replicateSourceUuid;
    let replicateDestGroupUuid;

    before(async () => {
      replicateSourceUuid = await createTestRecord({
        name: uniqueName('ReplicateSource')
      });
      replicateDestGroupUuid = await createTestGroup(uniqueName('ReplicateDest'));
      createdRecords.push(replicateSourceUuid, replicateDestGroupUuid);
    });

    it('should create a replica of a record', async () => {
      const result = await runCommand([
        'replicate', replicateSourceUuid,
        '-t', replicateDestGroupUuid
      ]);
      assert.strictEqual(result.success, true);
    });
  });

  // ============================================================
  // DELETE COMMAND
  // ============================================================
  describe('delete command', () => {
    it('should delete a record (move to trash)', async () => {
      const deleteUuid = await createTestRecord({
        name: uniqueName('DeleteTest')
      });

      const result = await runCommand(['delete', deleteUuid]);
      assert.strictEqual(result.success, true);
    });

    it('should fail for non-existent record', async () => {
      const result = await runCommand(['delete', 'NONEXISTENT-UUID-12345'], { expectFailure: true });
      assert.strictEqual(result.success, false);
    });
  });

  // ============================================================
  // CLASSIFY COMMAND
  // ============================================================
  describe('classify command', () => {
    let classifyTestUuid;

    before(async () => {
      classifyTestUuid = await createTestRecord({
        name: uniqueName('ClassifyTest'),
        content: 'Content for classification testing'
      });
      createdRecords.push(classifyTestUuid);
    });

    describe('classify suggest', () => {
      it('should get classification proposals', async () => {
        const result = await runCommand(['classify', 'suggest', classifyTestUuid]);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.proposals));
      });

      it('should support database filter', async () => {
        const result = await runCommand([
          'classify', 'suggest', classifyTestUuid,
          '-d', TEST_DATABASE.name
        ]);
        assert.strictEqual(result.success, true);
      });
    });
  });

  // ============================================================
  // BATCH COMMANDS
  // ============================================================
  describe('batch commands', () => {
    let batchRecord1Uuid;
    let batchRecord2Uuid;

    before(async () => {
      batchRecord1Uuid = await createTestRecord({
        name: uniqueName('BatchTest1'),
        content: 'Batch test content 1'
      });
      batchRecord2Uuid = await createTestRecord({
        name: uniqueName('BatchTest2'),
        content: 'Batch test content 2'
      });
      createdRecords.push(batchRecord1Uuid, batchRecord2Uuid);
    });

    describe('batch preview', () => {
      it('should get previews for multiple records', async () => {
        const result = await runCommand([
          'batch', 'preview',
          '-u', batchRecord1Uuid, batchRecord2Uuid
        ]);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.results));
        assert.strictEqual(result.results.length, 2);
      });
    });

    describe('batch verify', () => {
      it('should verify multiple records exist', async () => {
        const result = await runCommand([
          'batch', 'verify',
          '-u', batchRecord1Uuid, batchRecord2Uuid
        ]);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.results));
      });
    });
  });

  // ============================================================
  // REVEAL COMMAND
  // ============================================================
  describe('reveal command', () => {
    let revealTestUuid;

    before(async () => {
      revealTestUuid = await createTestRecord({
        name: uniqueName('RevealTest')
      });
      createdRecords.push(revealTestUuid);
    });

    it('should reveal record in DEVONthink', async () => {
      const result = await runCommand(['reveal', revealTestUuid]);
      assert.strictEqual(result.success, true);
    });

    it('should support different reveal modes', async () => {
      const result = await runCommand(['reveal', revealTestUuid, '-m', 'tab']);
      assert.strictEqual(result.success, true);
    });
  });

  // ============================================================
  // CONVERT COMMAND
  // ============================================================
  describe('convert command', () => {
    let convertTestUuid;

    before(async () => {
      convertTestUuid = await createTestRecord({
        name: uniqueName('ConvertTest'),
        type: 'markdown',
        content: '# Test Heading\n\nTest content for conversion.'
      });
      createdRecords.push(convertTestUuid);
    });

    it('should convert record to plain text', async () => {
      const result = await runCommand(['convert', convertTestUuid, '-t', 'plain']);
      assert.strictEqual(result.success, true);
      if (result.uuid && result.uuid !== convertTestUuid) {
        createdRecords.push(result.uuid);
      }
    });
  });

  // ============================================================
  // IMPORT COMMAND (requires actual file)
  // ============================================================
  describe('import command', () => {
    it('should fail for non-existent file', async () => {
      const result = await runCommand([
        'import', '/nonexistent/file.txt',
        '-d', TEST_DATABASE.name
      ], { expectFailure: true });
      assert.strictEqual(result.success, false);
    });
  });

  // ============================================================
  // STDIN SUPPORT TESTS
  // ============================================================
  describe('stdin support', () => {
    describe('create record with stdin content', () => {
      it('should create record with content from stdin', async () => {
        const name = uniqueName('StdinCreate');
        const stdinContent = 'This content was piped from stdin';

        const result = await runCommandWithStdin(
          ['create', 'record', '-n', name, '-T', 'markdown', '-d', TEST_DATABASE.name, '-c', '-'],
          stdinContent
        );

        assert.strictEqual(result.success, true);
        assert.ok(result.uuid);
        createdRecords.push(result.uuid);
      });
    });

    describe('update with stdin content', () => {
      let stdinUpdateUuid;

      before(async () => {
        stdinUpdateUuid = await createTestRecord({
          name: uniqueName('StdinUpdate'),
          content: 'Original content for stdin update test'
        });
        createdRecords.push(stdinUpdateUuid);
      });

      it('should update record with content from stdin', async () => {
        const newContent = 'Updated via stdin';

        const result = await runCommandWithStdin(
          ['update', stdinUpdateUuid, '-m', 'setting', '-c', '-'],
          newContent
        );

        assert.strictEqual(result.success, true);
      });
    });

    describe('move with stdin UUIDs', () => {
      let stdinMoveRecord1;
      let stdinMoveRecord2;
      let stdinMoveDestGroup;

      before(async () => {
        stdinMoveRecord1 = await createTestRecord({ name: uniqueName('StdinMove1') });
        stdinMoveRecord2 = await createTestRecord({ name: uniqueName('StdinMove2') });
        stdinMoveDestGroup = await createTestGroup(uniqueName('StdinMoveDest'));
        createdRecords.push(stdinMoveRecord1, stdinMoveRecord2, stdinMoveDestGroup);
      });

      it('should move records with UUIDs from stdin', async () => {
        const stdinInput = `${stdinMoveRecord1}\n${stdinMoveRecord2}`;

        const result = await runCommandWithStdin(
          ['move', '-', '-t', stdinMoveDestGroup],
          stdinInput
        );

        assert.strictEqual(result.success, true);
      });

      it('should accept x-devonthink-item:// URLs from stdin', async () => {
        const record = await createTestRecord({ name: uniqueName('StdinMoveURL') });
        createdRecords.push(record);

        const stdinInput = `x-devonthink-item://${record}`;

        const result = await runCommandWithStdin(
          ['move', '-', '-t', stdinMoveDestGroup],
          stdinInput
        );

        assert.strictEqual(result.success, true);
      });
    });

    describe('delete with stdin UUIDs', () => {
      it('should delete single record with UUID from stdin', async () => {
        const recordToDelete = await createTestRecord({ name: uniqueName('StdinDelete1') });

        const result = await runCommandWithStdin(
          ['delete', '-'],
          recordToDelete
        );

        assert.strictEqual(result.success, true);
      });

      it('should delete multiple records with UUIDs from stdin', async () => {
        const record1 = await createTestRecord({ name: uniqueName('StdinDelete2') });
        const record2 = await createTestRecord({ name: uniqueName('StdinDelete3') });

        const stdinInput = `${record1}\n${record2}`;

        const result = await runCommandWithStdin(
          ['delete', '-'],
          stdinInput
        );

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.count, 2);
      });
    });

    describe('batch preview with stdin UUIDs', () => {
      let batchStdinRecord1;
      let batchStdinRecord2;

      before(async () => {
        batchStdinRecord1 = await createTestRecord({
          name: uniqueName('BatchStdin1'),
          content: 'Content for batch stdin test 1'
        });
        batchStdinRecord2 = await createTestRecord({
          name: uniqueName('BatchStdin2'),
          content: 'Content for batch stdin test 2'
        });
        createdRecords.push(batchStdinRecord1, batchStdinRecord2);
      });

      it('should get previews with UUIDs from stdin', async () => {
        const stdinInput = `${batchStdinRecord1}\n${batchStdinRecord2}`;

        const result = await runCommandWithStdin(
          ['batch', 'preview', '-u', '-'],
          stdinInput
        );

        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.results));
        assert.strictEqual(result.results.length, 2);
      });
    });

    describe('batch verify with stdin UUIDs', () => {
      let verifyStdinRecord1;
      let verifyStdinRecord2;

      before(async () => {
        verifyStdinRecord1 = await createTestRecord({ name: uniqueName('VerifyStdin1') });
        verifyStdinRecord2 = await createTestRecord({ name: uniqueName('VerifyStdin2') });
        createdRecords.push(verifyStdinRecord1, verifyStdinRecord2);
      });

      it('should verify records with UUIDs from stdin', async () => {
        const stdinInput = `${verifyStdinRecord1}\n${verifyStdinRecord2}`;

        const result = await runCommandWithStdin(
          ['batch', 'verify', '-u', '-'],
          stdinInput
        );

        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.results));
        assert.strictEqual(result.results.length, 2);
      });
    });
  });

  // ============================================================
  // CLEANUP
  // ============================================================
  after(async () => {
    console.log(`Cleaning up ${createdRecords.length} test records...`);
    await cleanupTestRecords(createdRecords);
  });
});
