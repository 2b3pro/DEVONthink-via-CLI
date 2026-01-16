/**
 * Command Tests for DevonThink CLI
 * Tests all commands against Test_Database
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  runCommand,
  runCommandWithStdin,
  createTestRecord,
  createTestGroup,
  deleteTestRecord,
  getRecordProps,
  getCustomMetadata,
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
        assert.ok(result.filename !== undefined);
        assert.ok(result.mimeType !== undefined);
        assert.ok(result.creationDate !== undefined);
      });

      it('should support selecting specific fields', async () => {
        const result = await runCommand([
          'get', 'props', testRecordUuid,
          '--fields', 'uuid,name,recordType,parentUuid,parentName,parentPath,missingField'
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.uuid, testRecordUuid);
        assert.ok(result.name);
        assert.ok(result.recordType);
        assert.ok(result.parentUuid !== undefined);
        assert.ok(result.parentName !== undefined);
        assert.ok(result.parentPath !== undefined);
        assert.strictEqual(result.missingField, null);
        assert.strictEqual(result.mimeType, undefined);
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

    describe('get metadata', () => {
      let metadataRecordUuid;

      before(async () => {
        // Create a record and set custom metadata on it
        metadataRecordUuid = await createTestRecord({
          name: uniqueName('MetadataGetTest'),
          content: 'Test content for metadata get'
        });
        createdRecords.push(metadataRecordUuid);

        // Set some custom metadata using the update command
        await runCommand([
          'update', metadataRecordUuid,
          '--custom-metadata', 'testfield',
          '-c', 'testvalue'
        ]);
      });

      it('should get a specific custom metadata field', async () => {
        const result = await runCommand(['get', 'metadata', metadataRecordUuid, 'testfield']);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.field, 'testfield');
        assert.strictEqual(result.value, 'testvalue');
      });

      it('should return null for non-existent field', async () => {
        const result = await runCommand(['get', 'metadata', metadataRecordUuid, 'nonexistent']);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.value, null);
      });
    });

    describe('get metadata-list', () => {
      let metadataListRecordUuid;

      before(async () => {
        metadataListRecordUuid = await createTestRecord({
          name: uniqueName('MetadataListTest'),
          content: 'Test content for metadata list'
        });
        createdRecords.push(metadataListRecordUuid);

        // Set multiple custom metadata fields
        await runCommand([
          'update', metadataListRecordUuid,
          '--custom-metadata', 'author',
          '-c', 'John Doe'
        ]);
        await runCommand([
          'update', metadataListRecordUuid,
          '--custom-metadata', 'project',
          '-c', 'Test Project'
        ]);
      });

      it('should list all custom metadata fields', async () => {
        const result = await runCommand(['get', 'metadata-list', metadataListRecordUuid]);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.metadata));
        assert.ok(result.count >= 2);

        // DEVONthink internally prefixes custom metadata keys with "md"
        const fields = result.metadata.map(m => m.field);
        assert.ok(fields.includes('mdauthor'));
        assert.ok(fields.includes('mdproject'));
      });

      it('should return empty array for record without metadata', async () => {
        // Create a fresh record with no metadata
        const freshUuid = await createTestRecord({
          name: uniqueName('NoMetadataTest'),
          content: 'No metadata here'
        });
        createdRecords.push(freshUuid);

        const result = await runCommand(['get', 'metadata-list', freshUuid]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.count, 0);
        assert.deepStrictEqual(result.metadata, []);
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

      it('should return items with level field (depth=1)', async () => {
        const result = await runCommand(['list', 'group', TEST_DATABASE.name, '/', '--depth', '1']);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.items));
        // All items should be level 0 with depth=1
        result.items.forEach(item => {
          assert.strictEqual(item.level, 0, `Item ${item.name} should be at level 0`);
        });
      });

      it('should recurse with depth > 1', async () => {
        const result = await runCommand(['list', 'group', TEST_DATABASE.uuid, '--depth', '2']);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.items));
        // Should have items at multiple levels
        const levels = new Set(result.items.map(i => i.level));
        assert.ok(levels.size > 0, 'Should have items');
        // With depth=2, we should see level 0 and possibly level 1
        assert.ok(levels.has(0), 'Should have level 0 items');
      });

      it('should include itemCount for groups', async () => {
        const result = await runCommand(['list', 'group', TEST_DATABASE.name, '/']);
        assert.strictEqual(result.success, true);
        const groups = result.items.filter(i => i.type === 'group' || i.type === 'smart group');
        if (groups.length > 0) {
          // At least some groups should have itemCount defined
          const withCount = groups.filter(g => typeof g.itemCount === 'number');
          assert.ok(withCount.length > 0, 'Groups should have itemCount property');
        }
      });

      it('should include path for items', async () => {
        const result = await runCommand(['list', 'group', TEST_DATABASE.name, '/']);
        assert.strictEqual(result.success, true);
        if (result.items.length > 0) {
          assert.ok(result.items[0].path, 'Items should have path property');
        }
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

      it('should support time filter flags', async () => {
        const result = await runCommand([
          'search', 'query', 'XYZTEST123',
          '--created-after', '2 weeks',
          '--modified-before', '2024-12-31'
        ]);
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

      it('should default to markdown type when omitted', async () => {
        const name = uniqueName('CreateDefaultMarkdown');
        const result = await runCommand([
          'create', 'record',
          '-n', name,
          '-d', TEST_DATABASE.name,
          '-c', 'Default markdown content'
        ]);
        assert.strictEqual(result.success, true);
        createdRecords.push(result.uuid);

        const props = await getRecordProps(result.uuid);
        assert.strictEqual(props.type, 'markdown');
      });

      it('should support create note alias', async () => {
        const name = uniqueName('CreateNote');
        const result = await runCommand([
          'create', 'note',
          '-n', name,
          '-d', TEST_DATABASE.name,
          '-c', 'Note content'
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

      it('should create a record with group UUID without database', async () => {
        const groupName = uniqueName('CreateGroup');
        const groupUuid = await createTestGroup(groupName);
        createdRecords.push(groupUuid);

        const name = uniqueName('CreateInGroup');
        const result = await runCommand([
          'create', 'record',
          '-n', name,
          '-T', 'markdown',
          '-g', groupUuid,
          '-c', 'Grouped content'
        ]);
        assert.strictEqual(result.success, true);
        assert.ok(result.uuid);
        createdRecords.push(result.uuid);
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

    it('should set label on a record', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--label', '3']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.operations.labelModified, true);
      assert.strictEqual(result.newLabel, 3);

      const props = await getRecordProps(modifyTestUuid);
      assert.strictEqual(props.label, 3);
    });

    it('should set rating on a record', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--rating', '4']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.operations.ratingModified, true);
      assert.strictEqual(result.newRating, 4);

      const props = await getRecordProps(modifyTestUuid);
      assert.strictEqual(props.rating, 4);
    });

    it('should set flag on a record', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--flag']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.operations.flagModified, true);
      assert.strictEqual(result.newFlag, true);

      const props = await getRecordProps(modifyTestUuid);
      assert.strictEqual(props.flag, true);
    });

    it('should clear flag on a record', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--no-flag']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.operations.flagModified, true);
      assert.strictEqual(result.newFlag, false);

      const props = await getRecordProps(modifyTestUuid);
      assert.strictEqual(props.flag, false);
    });

    it('should set aliases on a record', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--aliases', 'alias1, alias2']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.operations.aliasesModified, true);
      assert.strictEqual(result.newAliases, 'alias1, alias2');

      const props = await getRecordProps(modifyTestUuid);
      assert.strictEqual(props.aliases, 'alias1, alias2');
    });

    it('should set URL on a bookmark record', async () => {
      // Create a bookmark record specifically for URL testing
      const bookmarkUuid = await createTestRecord({
        name: uniqueName('URLTest'),
        type: 'bookmark',
        content: 'https://example.com/original'
      });
      createdRecords.push(bookmarkUuid);

      const testUrl = 'https://example.com/updated';
      const result = await runCommand(['modify', bookmarkUuid, '--url', testUrl]);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.operations.urlModified, true);
      assert.strictEqual(result.newUrl, testUrl);

      const props = await getRecordProps(bookmarkUuid);
      assert.strictEqual(props.URL, testUrl);
    });

    it('should mark record as unread', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--unread']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.operations.unreadModified, true);
      assert.strictEqual(result.newUnread, true);

      const props = await getRecordProps(modifyTestUuid);
      assert.strictEqual(props.unread, true);
    });

    it('should mark record as read', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--no-unread']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.operations.unreadModified, true);
      assert.strictEqual(result.newUnread, false);

      const props = await getRecordProps(modifyTestUuid);
      assert.strictEqual(props.unread, false);
    });

    it('should reject invalid label value', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--label', '8'], { expectFailure: true });
      assert.strictEqual(result.success, false);
    });

    it('should reject invalid rating value', async () => {
      const result = await runCommand(['modify', modifyTestUuid, '--rating', '6'], { expectFailure: true });
      assert.strictEqual(result.success, false);
    });

    it('should modify multiple records via arguments', async () => {
      // Create two test records
      const uuid1 = await createTestRecord({ name: uniqueName('BatchMod1') });
      const uuid2 = await createTestRecord({ name: uniqueName('BatchMod2') });
      createdRecords.push(uuid1, uuid2);

      const result = await runCommand(['modify', uuid1, uuid2, '--add-tag', 'batch-test-tag']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.count, 2);
      assert.strictEqual(result.modified.length, 2);

      // Verify both records have the tag
      const props1 = await getRecordProps(uuid1);
      const props2 = await getRecordProps(uuid2);
      assert.ok(props1.tags.includes('batch-test-tag'));
      assert.ok(props2.tags.includes('batch-test-tag'));
    });

    it('should modify multiple records via stdin', async () => {
      // Create two test records
      const uuid1 = await createTestRecord({ name: uniqueName('StdinMod1') });
      const uuid2 = await createTestRecord({ name: uniqueName('StdinMod2') });
      createdRecords.push(uuid1, uuid2);

      const stdinInput = `${uuid1}\n${uuid2}`;
      const result = await runCommandWithStdin(
        ['modify', '-', '--add-tag', 'stdin-test-tag'],
        stdinInput
      );

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.count, 2);
      assert.strictEqual(result.modified.length, 2);

      // Verify both records have the tag
      const props1 = await getRecordProps(uuid1);
      const props2 = await getRecordProps(uuid2);
      assert.ok(props1.tags.includes('stdin-test-tag'));
      assert.ok(props2.tags.includes('stdin-test-tag'));
    });

    it('should report partial success for batch modify', async () => {
      // Create one valid record
      const validUuid = await createTestRecord({ name: uniqueName('ValidMod') });
      createdRecords.push(validUuid);

      const invalidUuid = 'INVALID-UUID-12345';
      const result = await runCommand(
        ['modify', validUuid, invalidUuid, '--add-tag', 'partial-test'],
        { expectFailure: true }
      );

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.count, 1);
      assert.strictEqual(result.errors.length, 1);
      assert.strictEqual(result.errors[0].uuid, invalidUuid);
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

    it('should default to setting mode when not specified', async () => {
      const result = await runCommand([
        'update', updateTestUuid,
        '-c', 'Default mode content'
      ]);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mode, 'setting');
    });

    describe('--comments flag', () => {
      let commentTestUuid;

      before(async () => {
        commentTestUuid = await createTestRecord({
          name: uniqueName('CommentTest'),
          content: 'Content for comment testing'
        });
        createdRecords.push(commentTestUuid);
      });

      it('should set comment with setting mode', async () => {
        const commentText = 'Test comment content';
        const result = await runCommand([
          'update', commentTestUuid,
          '--comments',
          '-c', commentText
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.target, 'comment');

        // Verify comment was set
        const props = await getRecordProps(commentTestUuid);
        assert.strictEqual(props.comment, commentText);
      });

      it('should append to comment with appending mode', async () => {
        const appendText = ' - appended';
        const result = await runCommand([
          'update', commentTestUuid,
          '--comments',
          '-m', 'appending',
          '-c', appendText
        ]);
        assert.strictEqual(result.success, true);

        const props = await getRecordProps(commentTestUuid);
        assert.ok(props.comment.endsWith(appendText));
      });
    });

    describe('--custom-metadata flag', () => {
      let metadataTestUuid;

      before(async () => {
        metadataTestUuid = await createTestRecord({
          name: uniqueName('MetadataTest'),
          content: 'Content for metadata testing'
        });
        createdRecords.push(metadataTestUuid);
      });

      it('should set custom metadata field', async () => {
        const authorValue = 'Test Author';
        const result = await runCommand([
          'update', metadataTestUuid,
          '--custom-metadata', 'author',
          '-c', authorValue
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.target, 'customMetadata');
        assert.strictEqual(result.field, 'author');

        // Verify metadata was set
        const value = await getCustomMetadata(metadataTestUuid, 'author');
        assert.strictEqual(value, authorValue);
      });

      it('should update existing custom metadata field', async () => {
        const newAuthor = 'Updated Author';
        const result = await runCommand([
          'update', metadataTestUuid,
          '--custom-metadata', 'author',
          '-c', newAuthor
        ]);
        assert.strictEqual(result.success, true);

        const value = await getCustomMetadata(metadataTestUuid, 'author');
        assert.strictEqual(value, newAuthor);
      });
    });

    describe('mutually exclusive flags', () => {
      it('should fail when --comments and --custom-metadata used together', async () => {
        const result = await runCommand([
          'update', updateTestUuid,
          '--comments',
          '--custom-metadata', 'field',
          '-c', 'Content'
        ], { expectFailure: true });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('Cannot use'));
      });
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
  // CHAT COMMANDS
  // ============================================================
  describe('chat commands', () => {
    describe('chat models', () => {
      it('should list models for default engine', async () => {
        const result = await runCommand(['chat', 'models']);
        assert.strictEqual(result.success, true);
        assert.ok(result.engine);
        assert.ok(Array.isArray(result.models));
        assert.ok(typeof result.count === 'number');
      });

      it('should list models for specific engine', async () => {
        const result = await runCommand(['chat', 'models', '-e', 'gemini']);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.engine, 'Gemini');
        assert.ok(Array.isArray(result.models));
      });

      it('should fail for invalid engine', async () => {
        const result = await runCommand(['chat', 'models', '-e', 'invalid_engine'], { expectFailure: true });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('Unknown engine'));
      });
    });

    describe('chat capabilities', () => {
      it('should get capabilities for a model', async () => {
        const result = await runCommand(['chat', 'capabilities', '-e', 'gemini', '-m', 'gemini-flash']);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.engine, 'Gemini');
        assert.strictEqual(result.model, 'gemini-flash');
        assert.ok(typeof result.contextWindow === 'number');
        assert.ok(typeof result.vision === 'boolean');
        assert.ok(typeof result.thinking === 'boolean');
        assert.ok(typeof result.toolCalls === 'boolean');
      });
    });

    describe('chat ask', () => {
      // AI calls can take longer - use 90s timeout
      const AI_TIMEOUT = 90000;

      it('should get a response for a simple prompt', async () => {
        const result = await runCommand(
          ['chat', 'ask', 'Say hello'],
          { timeout: AI_TIMEOUT }
        );
        assert.strictEqual(result.success, true);
        // Just verify we got a response (AI outputs vary)
        assert.ok(result.response !== null && result.response !== undefined);
        assert.ok(result.response.length > 0);
      });

      it('should accept prompt from stdin', async () => {
        const result = await runCommandWithStdin(
          ['chat', 'ask'],
          'Say goodbye',
          { timeout: AI_TIMEOUT }
        );
        assert.strictEqual(result.success, true);
        assert.ok(result.response !== null && result.response !== undefined);
        assert.ok(result.response.length > 0);
      });

      it('should work with document context', async () => {
        // Create a test document with unique content
        const testDoc = await createTestRecord({
          name: uniqueName('ChatContextTest'),
          content: 'The secret code is XYZABC789.'
        });
        createdRecords.push(testDoc);

        const result = await runCommand(
          [
            'chat', 'ask',
            'What is the secret code mentioned in this document?',
            '-r', testDoc
          ],
          { timeout: AI_TIMEOUT }
        );
        assert.strictEqual(result.success, true);
        assert.ok(result.response !== null && result.response !== undefined);
        // The response should mention the code (with some tolerance for formatting)
        assert.ok(result.response.includes('XYZABC789') || result.response.includes('XYZ'));
      });

      it('should fail without a prompt', async () => {
        const result = await runCommand(['chat', 'ask'], { expectFailure: true });
        assert.strictEqual(result.success, false);
      });
    });
  });

  // ============================================================
  // NAVIGATOR COMMANDS (get related, link, unlink)
  // ============================================================
  describe('navigator commands', () => {
    let sourceUuid;
    let targetUuid;

    before(async () => {
      sourceUuid = await createTestRecord({ name: uniqueName('LinkSource'), content: 'Source content' });
      targetUuid = await createTestRecord({ name: uniqueName('LinkTarget'), content: 'Target content' });
      createdRecords.push(sourceUuid, targetUuid);
    });

    describe('link', () => {
      it('should create a markdown link between records', async () => {
        const result = await runCommand(['link', sourceUuid, targetUuid]);
        assert.strictEqual(result.success, true);
        assert.ok(result.linkAdded);
      });

      it('should toggle flags on a record', async () => {
        const result = await runCommand(['link', sourceUuid, '--no-wiki']);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.excludeFromWikiLinking, true);
      });
    });

    describe('unlink', () => {
      it('should remove a link between records', async () => {
        // First ensure linked
        await runCommand(['link', sourceUuid, targetUuid]);
        
        // Now unlink
        const result = await runCommand(['unlink', sourceUuid, targetUuid]);
        assert.strictEqual(result.success, true);
        assert.ok(result.linkRemoved);
      });
    });

    describe('get related', () => {
      it('should return related records structure', async () => {
        const result = await runCommand(['get', 'related', sourceUuid]);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.relations));
      });
    });
  });

  // ============================================================
  // ORGANIZE COMMAND
  // ============================================================
  describe('organize command', () => {
    let organizeUuid;

    before(async () => {
      organizeUuid = await createTestRecord({ 
        name: uniqueName('OrganizeTest'),
        content: 'This is a financial document about the budget for 2024. Vendor: Acme Corp. Total: $500.'
      });
      createdRecords.push(organizeUuid);
    });

    it('should run without error (basic check)', async () => {
      // Check if it runs and returns JSON result
      const jsonResult = await runCommand(['organize', organizeUuid, '--rename', '--json']);
      // The output is { results: [...] }
      if (jsonResult.results) {
          assert.ok(jsonResult.results.length > 0);
      }
    });
  });

  // ============================================================
  // SUMMARIZE COMMAND
  // ============================================================
  describe('summarize command', () => {
    let sumUuid;

    before(async () => {
      sumUuid = await createTestRecord({ 
        name: uniqueName('SumTest'),
        content: '# Heading\nImportant point 1.\nImportant point 2.'
      });
      createdRecords.push(sumUuid);
    });

    it('should perform native summarization (highlights)', async () => {
      const result = await runCommand([
        'summarize', sumUuid, 
        '--native', 
        '--type', 'content', 
        '--format', 'markdown'
      ]);
      
      // The CLI returns { results: [ { ... } ] } or [ { ... } ] depending on implementation
      // We need to inspect the first result
      const item = Array.isArray(result) ? result[0] : (result.results ? result.results[0] : result);

      // Check for success or specific error related to content length/type
      if (item.success) {
          assert.ok(item.summaryUuid);
          createdRecords.push(item.summaryUuid);
      } else {
          // Native summarization might fail if content is insufficient, which is valid behavior
          assert.ok(item.error);
      }
    });
  });

  // ============================================================
  // MCP COMMAND
  // ============================================================
  describe('mcp command', () => {
    it('should output config JSON', async () => {
      const result = await runCommand(['mcp', 'config'], { json: false });
      const output = result.output || JSON.stringify(result);
      assert.ok(output.includes('mcpServers'));
      assert.ok(output.includes('devonthink'));
    });
  });

  // ============================================================
  // TAGS COMMANDS
  // ============================================================
  describe('tags commands', () => {
    let tagTestRecord1;
    let tagTestRecord2;
    let tagTestRecord3;

    before(async () => {
      // Create test records with various tags for testing
      tagTestRecord1 = await createTestRecord({
        name: uniqueName('TagsTest1'),
        tags: ['TestTag', 'test-tag', 'TestTag2']
      });
      tagTestRecord2 = await createTestRecord({
        name: uniqueName('TagsTest2'),
        tags: ['TestTag', 'AnotherTag']
      });
      tagTestRecord3 = await createTestRecord({
        name: uniqueName('TagsTest3'),
        tags: [': badtag', 'SingleUse']
      });
      createdRecords.push(tagTestRecord1, tagTestRecord2, tagTestRecord3);
    });

    describe('tags list', () => {
      it('should list all tags in database', async () => {
        const result = await runCommand(['tags', 'list', '-d', TEST_DATABASE.name]);
        assert.strictEqual(result.success, true);
        assert.ok(result.database);
        assert.ok(typeof result.totalTags === 'number');
        assert.ok(Array.isArray(result.tags));
      });

      it('should sort tags by count', async () => {
        const result = await runCommand(['tags', 'list', '-d', TEST_DATABASE.name, '-s', 'count']);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.tags));
        // Verify descending count order
        for (let i = 1; i < result.tags.length; i++) {
          assert.ok(result.tags[i - 1].count >= result.tags[i].count);
        }
      });

      it('should filter by minimum count', async () => {
        const result = await runCommand(['tags', 'list', '-d', TEST_DATABASE.name, '-m', '2']);
        assert.strictEqual(result.success, true);
        // All returned tags should have count >= 2
        for (const tag of result.tags) {
          assert.ok(tag.count >= 2);
        }
      });
    });

    describe('tags analyze', () => {
      it('should analyze tags for problems', async () => {
        const result = await runCommand(['tags', 'analyze', '-d', TEST_DATABASE.name]);
        assert.strictEqual(result.success, true);
        assert.ok(result.database);
        assert.ok(result.problems);
        assert.ok(result.summary);
        assert.ok(typeof result.summary.totalProblems === 'number');
      });

      it('should filter by category', async () => {
        const result = await runCommand(['tags', 'analyze', '-d', TEST_DATABASE.name, '-c', 'case']);
        assert.strictEqual(result.success, true);
        // Should only have case category in problems
        assert.ok(result.problems.case !== undefined);
        assert.strictEqual(Object.keys(result.problems).length, 1);
      });

      it('should detect case variants', async () => {
        const result = await runCommand(['tags', 'analyze', '-d', TEST_DATABASE.name, '-c', 'case']);
        assert.strictEqual(result.success, true);
        // Should find TestTag/test-tag as case variants (after normalization)
        // The exact detection depends on the tags in the test database
        assert.ok(Array.isArray(result.problems.case));
      });

      it('should detect malformed tags', async () => {
        const result = await runCommand(['tags', 'analyze', '-d', TEST_DATABASE.name, '-c', 'malformed']);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.problems.malformed));
        // Should find ': badtag' as malformed
        const badTag = result.problems.malformed.find(p => p.tag === ': badtag');
        if (badTag) {
          assert.ok(badTag.issues.includes('leading_punctuation'));
        }
      });
    });

    describe('tags merge', () => {
      let mergeTargetRecord, mergeSource1Record, mergeSource2Record;
      let mergeTargetTag, mergeSource1Tag, mergeSource2Tag;

      before(async () => {
        // Use unique tag names per test run
        const ts = Date.now();
        mergeTargetTag = `merge-target-${ts}`;
        mergeSource1Tag = `merge-src1-${ts}`;
        mergeSource2Tag = `merge-src2-${ts}`;

        // Create records with tags to merge
        mergeTargetRecord = await createTestRecord({
          name: uniqueName('MergeTarget'),
          tags: [mergeTargetTag]
        });
        mergeSource1Record = await createTestRecord({
          name: uniqueName('MergeSource1'),
          tags: [mergeSource1Tag]
        });
        mergeSource2Record = await createTestRecord({
          name: uniqueName('MergeSource2'),
          tags: [mergeSource2Tag]
        });
        createdRecords.push(mergeTargetRecord, mergeSource1Record, mergeSource2Record);
      });

      it('should dry-run merge tags', async () => {
        const result = await runCommand([
          'tags', 'merge', '-d', TEST_DATABASE.name,
          '-t', mergeTargetTag,
          '-s', mergeSource1Tag, mergeSource2Tag,
          '--dry-run'
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.dryRun, true);
        assert.strictEqual(result.target, mergeTargetTag);
        assert.ok(Array.isArray(result.sources));
        assert.strictEqual(result.sources.length, 2);
      });

      it('should merge tags', async () => {
        const result = await runCommand([
          'tags', 'merge', '-d', TEST_DATABASE.name,
          '-t', mergeTargetTag,
          '-s', mergeSource1Tag, mergeSource2Tag
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.merged, true);
        assert.strictEqual(result.target, mergeTargetTag);
        assert.ok(Array.isArray(result.sourcesMerged));
      });

      it('should fail on non-existent target tag', async () => {
        const result = await runCommand([
          'tags', 'merge', '-d', TEST_DATABASE.name,
          '-t', 'nonexistent-target-xyz',
          '-s', mergeTargetTag
        ], { expectFailure: true });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('not found'));
      });
    });

    describe('tags rename', () => {
      let renameTestRecord;
      let renameFromTag, renameToTag;

      before(async () => {
        // Use unique tag names per test run
        const ts = Date.now();
        renameFromTag = `rename-from-${ts}`;
        renameToTag = `rename-to-${ts}`;

        renameTestRecord = await createTestRecord({
          name: uniqueName('RenameTest'),
          tags: [renameFromTag]
        });
        createdRecords.push(renameTestRecord);
      });

      it('should dry-run rename tag', async () => {
        const result = await runCommand([
          'tags', 'rename', '-d', TEST_DATABASE.name,
          '-f', renameFromTag,
          '-t', renameToTag,
          '--dry-run'
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.dryRun, true);
        assert.strictEqual(result.from, renameFromTag);
        assert.strictEqual(result.to, renameToTag);
        assert.ok(typeof result.recordCount === 'number');
      });

      it('should rename tag', async () => {
        const result = await runCommand([
          'tags', 'rename', '-d', TEST_DATABASE.name,
          '-f', renameFromTag,
          '-t', renameToTag
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.renamed, true);
        assert.strictEqual(result.from, renameFromTag);
        assert.strictEqual(result.to, renameToTag);
      });

      it('should fail on non-existent source tag', async () => {
        const result = await runCommand([
          'tags', 'rename', '-d', TEST_DATABASE.name,
          '-f', 'nonexistent-tag-xyz',
          '-t', 'some-new-name'
        ], { expectFailure: true });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('not found'));
      });
    });

    describe('tags delete', () => {
      let deleteTestRecord;
      let deleteTag;

      before(async () => {
        // Use unique tag name per test run
        deleteTag = `tag-to-delete-${Date.now()}`;
        deleteTestRecord = await createTestRecord({
          name: uniqueName('DeleteTagTest'),
          tags: [deleteTag]
        });
        createdRecords.push(deleteTestRecord);
      });

      it('should dry-run delete tag', async () => {
        const result = await runCommand([
          'tags', 'delete', '-d', TEST_DATABASE.name,
          deleteTag,
          '--dry-run'
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.dryRun, true);
        assert.ok(Array.isArray(result.tagsToDelete));
        assert.strictEqual(result.tagsToDelete.length, 1);
        assert.strictEqual(result.tagsToDelete[0].name, deleteTag);
      });

      it('should delete tag', async () => {
        const result = await runCommand([
          'tags', 'delete', '-d', TEST_DATABASE.name,
          deleteTag
        ]);
        assert.strictEqual(result.success, true);
        assert.ok(Array.isArray(result.deleted));
        assert.strictEqual(result.totalDeleted, 1);
      });

      it('should fail on non-existent tag', async () => {
        const result = await runCommand([
          'tags', 'delete', '-d', TEST_DATABASE.name,
          'nonexistent-tag-xyz'
        ], { expectFailure: true });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('No tags found'));
      });
    });

    describe('tags normalize', () => {
      it('should dry-run normalize with auto mode', async () => {
        const result = await runCommand([
          'tags', 'normalize', '-d', TEST_DATABASE.name,
          '--auto'
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.dryRun, true);
        assert.strictEqual(result.rulesSource, 'auto-generated');
        assert.ok(Array.isArray(result.changes));
        assert.ok(result.summary);
        assert.ok(typeof result.summary.merges === 'number');
        assert.ok(typeof result.summary.renames === 'number');
        assert.ok(typeof result.summary.deletes === 'number');
      });

      it('should dry-run normalize with rules file', async () => {
        const result = await runCommand([
          'tags', 'normalize', '-d', TEST_DATABASE.name,
          '-r', 'test/fixtures/test-rules.yaml'
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.dryRun, true);
        assert.ok(result.rulesSource.includes('test-rules.yaml'));
        assert.ok(Array.isArray(result.changes));
      });

      it('should dry-run with no config (empty rules)', async () => {
        const result = await runCommand([
          'tags', 'normalize', '-d', TEST_DATABASE.name,
          '--no-global'
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.dryRun, true);
        // With no config and no global, should have minimal changes
        assert.ok(Array.isArray(result.changes));
      });

      it('should fail on non-existent rules file', async () => {
        const result = await runCommand([
          'tags', 'normalize', '-d', TEST_DATABASE.name,
          '-r', 'nonexistent-rules.yaml'
        ], { expectFailure: true });
        assert.strictEqual(result.success, false);
        assert.ok(result.error.includes('not found'));
      });
    });

    describe('tags config', () => {
      it('should show config paths', async () => {
        const result = await runCommand(['tags', 'config']);
        assert.strictEqual(result.success, true);
        assert.ok(result.configDir);
        assert.ok(result.globalRules);
        assert.ok(result.globalRules.path);
        assert.ok(typeof result.globalRules.exists === 'boolean');
      });

      it('should show database-specific config path', async () => {
        const result = await runCommand([
          'tags', 'config', '-d', TEST_DATABASE.name
        ]);
        assert.strictEqual(result.success, true);
        assert.ok(result.databaseRules);
        assert.strictEqual(result.databaseRules.database, TEST_DATABASE.name);
        assert.ok(result.databaseRules.path);
      });
    });
  });

  // ============================================================
  // QUEUE TAG ACTIONS
  // ============================================================
  describe('queue tag actions', { concurrency: false }, () => {
    const queueConfigDir = resolve(import.meta.dirname, 'tmp-config-queue');
    const originalConfigDir = process.env.DT_CONFIG_DIR;

    before(async () => {
      process.env.DT_CONFIG_DIR = queueConfigDir;
      await fs.rm(queueConfigDir, { recursive: true, force: true });
    });

    after(async () => {
      await fs.rm(queueConfigDir, { recursive: true, force: true });
      if (originalConfigDir === undefined) {
        delete process.env.DT_CONFIG_DIR;
      } else {
        process.env.DT_CONFIG_DIR = originalConfigDir;
      }
    });

    it('should apply tag.add via queue', async () => {
      const tag = uniqueName('QueueTagAdd');
      const recordUuid = await createTestRecord({
        name: uniqueName('QueueTagAddRecord'),
        tags: []
      });
      createdRecords.push(recordUuid);

      const addResult = await runCommand([
        'queue', 'add', 'tag.add',
        '--uuid', recordUuid,
        '--tags', tag
      ]);
      assert.strictEqual(addResult.success, true);

      const execResult = await runCommand(['queue', 'execute']);
      assert.strictEqual(execResult.success, true);

      const props = await getRecordProps(recordUuid);
      assert.ok(Array.isArray(props.tags));
      assert.ok(props.tags.includes(tag));
    });

    it('should merge tags via queue', async () => {
      const sourceTag = uniqueName('QueueTagSource');
      const targetTag = uniqueName('QueueTagTarget');

      const sourceRecord = await createTestRecord({
        name: uniqueName('QueueTagSourceRecord'),
        tags: [sourceTag]
      });
      const targetRecord = await createTestRecord({
        name: uniqueName('QueueTagTargetRecord'),
        tags: [targetTag]
      });
      createdRecords.push(sourceRecord, targetRecord);

      const addResult = await runCommand([
        'queue', 'add', 'tag.merge',
        '--target', targetTag,
        '--sources', sourceTag,
        '--database', TEST_DATABASE.name
      ]);
      assert.strictEqual(addResult.success, true);

      const execResult = await runCommand(['queue', 'execute']);
      assert.strictEqual(execResult.success, true);

      const sourceProps = await getRecordProps(sourceRecord);
      const targetProps = await getRecordProps(targetRecord);

      assert.ok(sourceProps.tags.includes(targetTag));
      assert.ok(!sourceProps.tags.includes(sourceTag));
      assert.ok(targetProps.tags.includes(targetTag));
    });

    it('should rename tags via queue', async () => {
      const fromTag = uniqueName('QueueTagRenameFrom');
      const toTag = uniqueName('QueueTagRenameTo');

      const recordUuid = await createTestRecord({
        name: uniqueName('QueueTagRenameRecord'),
        tags: [fromTag]
      });
      createdRecords.push(recordUuid);

      const addResult = await runCommand([
        'queue', 'add', 'tag.rename',
        '--from', fromTag,
        '--to', toTag,
        '--database', TEST_DATABASE.name
      ]);
      assert.strictEqual(addResult.success, true);

      const execResult = await runCommand(['queue', 'execute']);
      assert.strictEqual(execResult.success, true);

      const props = await getRecordProps(recordUuid);
      assert.ok(props.tags.includes(toTag));
      assert.ok(!props.tags.includes(fromTag));
    });

    it('should delete tags via queue', async () => {
      const deleteTag = uniqueName('QueueTagDelete');
      const recordUuid = await createTestRecord({
        name: uniqueName('QueueTagDeleteRecord'),
        tags: [deleteTag]
      });
      createdRecords.push(recordUuid);

      const addResult = await runCommand([
        'queue', 'add', 'tag.delete',
        '--tag', deleteTag,
        '--database', TEST_DATABASE.name
      ]);
      assert.strictEqual(addResult.success, true);

      const execResult = await runCommand(['queue', 'execute']);
      assert.strictEqual(execResult.success, true);

      const props = await getRecordProps(recordUuid);
      assert.ok(!props.tags.includes(deleteTag));
    });

    it('should run chat via queue and store response', async () => {
      const prompt = `Say hello from queue ${uniqueName('QueueChat')}`;

      const addResult = await runCommand([
        'queue', 'add', 'chat',
        '--prompt', prompt
      ]);
      assert.strictEqual(addResult.success, true);

      const execResult = await runCommand(['queue', 'execute']);
      assert.strictEqual(execResult.success, true);

      const status = await runCommand(['queue', 'status', '--all']);
      const chatTask = status.tasks.find(t => t.action === 'chat' && t.status === 'completed');
      assert.ok(chatTask);
      assert.strictEqual(chatTask.result.success, true);
      assert.ok(chatTask.result.response !== undefined);
    });
  });

  // ============================================================
  // TREE COMMAND
  // ============================================================
  describe('tree command', () => {
    let testGroupUuid;

    before(async () => {
      testGroupUuid = await createTestGroup(uniqueName('TreeTest'));
      createdRecords.push(testGroupUuid);
    });

    it('should display tree for database', async () => {
      const result = await runCommand(['tree', '-d', TEST_DATABASE.name]);
      assert.strictEqual(result.success, true);
      assert.ok(result.database);
      assert.ok(result.text);
      assert.ok(Array.isArray(result.tree));
    });

    it('should respect depth limit', async () => {
      const result = await runCommand(['tree', '-d', TEST_DATABASE.name, '--depth', '1']);
      assert.strictEqual(result.success, true);
      // With depth 1, no children should have children
      for (const node of result.tree) {
        assert.strictEqual(node.children, undefined);
      }
    });

    it('should include item counts when requested', async () => {
      const result = await runCommand(['tree', '-d', TEST_DATABASE.name, '--counts', '--depth', '2']);
      assert.strictEqual(result.success, true);
      // Find a group with items (Annotations typically has some)
      const hasCount = result.tree.some(n => n.itemCount !== undefined);
      assert.ok(hasCount || result.tree.length === 0);
    });

    it('should exclude system folders when requested', async () => {
      const result = await runCommand(['tree', '-d', TEST_DATABASE.name, '--exclude-system']);
      assert.strictEqual(result.success, true);
      // Tags and Trash should not be present
      const systemNames = ['Tags', 'Trash', '_INBOX', '_TRIAGE'];
      for (const node of result.tree) {
        assert.ok(!systemNames.includes(node.name), `Should not include ${node.name}`);
      }
    });

    it('should handle path argument for subtree', async () => {
      const result = await runCommand(['tree', '/Tags', '-d', TEST_DATABASE.name, '--depth', '1']);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.startPath, '/Tags');
    });

    it('should output text tree', async () => {
      const result = await runCommand(['tree', '-d', TEST_DATABASE.name, '--depth', '1']);
      assert.strictEqual(result.success, true);
      assert.ok(result.text.includes(TEST_DATABASE.name));
      // Should have tree characters
      assert.ok(result.text.includes('├') || result.text.includes('└') || result.tree.length === 0);
    });
  });

  // ============================================================
  // DOWNLOAD COMMANDS
  // ============================================================
  describe('download commands', () => {
    describe('download markdown', () => {
      it('should create markdown from URL', async () => {
        const result = await runCommand([
          'download', 'markdown', 'https://example.com',
          '-d', TEST_DATABASE.name
        ]);
        assert.strictEqual(result.success, true);
        assert.ok(result.uuid);
        assert.strictEqual(result.recordType, 'markdown');
        assert.strictEqual(result.sourceUrl, 'https://example.com');
        createdRecords.push(result.uuid);
      });

      it('should support readability mode', async () => {
        const result = await runCommand([
          'download', 'markdown', 'https://example.com',
          '-d', TEST_DATABASE.name,
          '--readability'
        ]);
        assert.strictEqual(result.success, true);
        assert.ok(result.uuid);
        createdRecords.push(result.uuid);
      });

      it('should support custom name', async () => {
        const customName = uniqueName('CustomMD');
        const result = await runCommand([
          'download', 'markdown', 'https://example.com',
          '-d', TEST_DATABASE.name,
          '-n', customName
        ]);
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.name, customName);
        createdRecords.push(result.uuid);
      });

      it('should fail for invalid URL', async () => {
        const result = await runCommand([
          'download', 'markdown', 'not-a-url',
          '-d', TEST_DATABASE.name
        ], { expectFailure: true });
        assert.strictEqual(result.success, false);
      });

      it('should work with md alias', async () => {
        const result = await runCommand([
          'download', 'md', 'https://example.com',
          '-d', TEST_DATABASE.name
        ]);
        assert.strictEqual(result.success, true);
        createdRecords.push(result.uuid);
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
