/**
 * Smart Group Command
 * Manage smart groups and their items
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { addTasks } from '../queue.js';

export function registerSmartGroupCommand(program) {
  const smartgroup = program
    .command('smartgroup')
    .alias('sg')
    .description('Manage smart groups');

  smartgroup
    .command('list')
    .description('List smart groups in a database or group')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Parent group path or UUID', '/')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .addHelpText('after', `
Examples:
  dt smartgroup list -d "Test_Database"
  dt smartgroup list -d "Test_Database" -g "/Saved Searches"
`)
    .action(async (options) => {
      try {
        await requireDevonthink();

        const params = {
          database: options.database,
          groupRef: options.group || '/'
        };

        const result = await runJxa('read', 'listSmartGroups', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log((result.smartGroups || []).map(sg => sg.uuid).join('\n'));
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  smartgroup
    .command('create')
    .description('Create a smart group')
    .requiredOption('-n, --name <name>', 'Smart group name')
    .requiredOption('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .requiredOption('--query <query>', 'Search predicates/query')
    .option('-g, --group <pathOrUuid>', 'Parent group path or UUID', '/')
    .option('--search-group <pathOrUuid>', 'Search scope group (path or UUID)')
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID')
    .addHelpText('after', `
Examples:
  dt smartgroup create -n "SG Tag Adult" -d "Test_Database" --query "tags:adult"
  dt smartgroup create -n "SG Scoped" -d "Test_Database" --query "tags:adult" --search-group "/Archive"
`)
    .action(async (options) => {
      try {
        const params = {
          name: options.name,
          type: 'smart group',
          database: options.database,
          groupPath: options.group || '/',
          query: options.query,
          searchGroup: options.searchGroup
        };

        if (options.queue) {
          const result = await addTasks([{ action: 'create', params }]);
          print(result, options);
          return;
        }

        await requireDevonthink();

        const result = await runJxa('write', 'createRecord', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log(result.uuid || '');
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  smartgroup
    .command('update <ref>')
    .description('Update a smart group (name/query/search group)')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Parent group path or UUID', '/')
    .option('-n, --name <newName>', 'New smart group name')
    .option('--query <query>', 'Search predicates/query')
    .option('--search-group <pathOrUuid>', 'Search scope group (path or UUID)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .addHelpText('after', `
Examples:
  dt smartgroup update "SG Tag Adult" -d "Test_Database" --query "tags:adult AND kind:pdf"
  dt smartgroup update ABCD-1234 --search-group "/Archive"
`)
    .action(async (ref, options) => {
      try {
        await requireDevonthink();

        const params = {
          smartGroupRef: ref,
          database: options.database,
          groupPath: options.group || '/',
          name: options.name,
          query: options.query,
          searchGroup: options.searchGroup
        };

        const hasUpdates = Object.keys(params).some(key => ['name', 'query', 'searchGroup'].includes(key) && params[key] !== undefined);
        if (!hasUpdates) {
          throw new Error('No updates specified. Use --name, --query, or --search-group.');
        }

        const result = await runJxa('write', 'updateSmartGroup', [JSON.stringify(params)]);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  smartgroup
    .command('delete <ref>')
    .description('Delete a smart group (moves to Trash)')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Parent group path or UUID', '/')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .addHelpText('after', `
Examples:
  dt smartgroup delete "SG Tag Adult" -d "Test_Database"
  dt smartgroup delete ABCD-1234
`)
    .action(async (ref, options) => {
      try {
        await requireDevonthink();

        const params = {
          smartGroupRef: ref,
          database: options.database,
          groupPath: options.group || '/'
        };

        const result = await runJxa('write', 'deleteSmartGroup', [JSON.stringify(params)]);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  smartgroup
    .command('items <ref>')
    .description('List items contained in a smart group')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Parent group path or UUID', '/')
    .option('-l, --limit <n>', 'Maximum results to return')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .addHelpText('after', `
Examples:
  dt smartgroup items "SG Tag Adult" -d "Test_Database"
  dt smartgroup items ABCD-1234 -l 100 --quiet
`)
    .action(async (ref, options) => {
      try {
        await requireDevonthink();

        const params = {
          smartGroupRef: ref,
          database: options.database,
          groupPath: options.group || '/',
          limit: options.limit
        };

        const result = await runJxa('read', 'listSmartGroupItems', [JSON.stringify(params)]);

        if (options.quiet && result.success) {
          console.log((result.items || []).map(item => item.uuid).join('\n'));
        } else {
          print(result, options);
        }

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  smartgroup
    .command('delete-items <ref>')
    .description('Delete all items contained in a smart group')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Parent group path or UUID', '/')
    .option('-l, --limit <n>', 'Maximum items to delete')
    .option('--dry-run', 'Preview items without deleting')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .addHelpText('after', `
Examples:
  dt smartgroup delete-items "SG Tag Adult" -d "Test_Database"
  dt smartgroup delete-items ABCD-1234 --dry-run
`)
    .action(async (ref, options) => {
      try {
        await requireDevonthink();

        const params = {
          smartGroupRef: ref,
          database: options.database,
          groupPath: options.group || '/',
          limit: options.limit
        };

        const itemsResult = await runJxa('read', 'listSmartGroupItems', [JSON.stringify(params)]);
        if (!itemsResult.success) {
          print(itemsResult, options);
          process.exit(1);
        }

        const uuids = (itemsResult.items || []).map(item => item.uuid);
        if (options.dryRun) {
          print({
            success: true,
            dryRun: true,
            count: uuids.length,
            uuids: uuids
          }, options);
          return;
        }

        if (uuids.length === 0) {
          print({ success: true, deleted: [], count: 0 }, options);
          return;
        }

        const result = await runJxa('write', 'batchDelete', [JSON.stringify(uuids)]);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  smartgroup
    .command('modify-items <ref>')
    .description('Modify all items contained in a smart group')
    .option('-d, --database <nameOrUuid>', 'Target database (name or UUID)')
    .option('-g, --group <pathOrUuid>', 'Parent group path or UUID', '/')
    .option('-l, --limit <n>', 'Maximum items to modify')
    .option('--add-tag <tag>', 'Add tag (repeatable)', collectValues, [])
    .option('--remove-tag <tag>', 'Remove tag (repeatable)', collectValues, [])
    .option('--set-tags <tags...>', 'Replace all tags with these')
    .option('-c, --comment <text>', 'Set comment')
    .option('--label <label>', 'Set label (number)')
    .option('--rating <rating>', 'Set rating (number)')
    .option('--unread <true|false>', 'Set unread flag')
    .option('--flagged <true|false>', 'Set flagged state')
    .option('--locked <true|false>', 'Set locked state')
    .option('--aliases <aliases...>', 'Set aliases (replace all)')
    .option('--meta <key=value>', 'Set custom metadata (repeatable)', collectKeyValue, {})
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .addHelpText('after', `
Examples:
  dt smartgroup modify-items "SG Tag Adult" -d "Test_Database" --add-tag review
  dt smartgroup modify-items ABCD-1234 --comment "Reviewed"
`)
    .action(async (ref, options) => {
      try {
        await requireDevonthink();

        const params = {
          smartGroupRef: ref,
          database: options.database,
          groupPath: options.group || '/',
          limit: options.limit
        };

        const itemsResult = await runJxa('read', 'listSmartGroupItems', [JSON.stringify(params)]);
        if (!itemsResult.success) {
          print(itemsResult, options);
          process.exit(1);
        }

        const uuids = (itemsResult.items || []).map(item => item.uuid);
        if (uuids.length === 0) {
          print({ success: true, updated: [], count: 0 }, options);
          return;
        }

        if (options.setTags && (options.addTag.length > 0 || options.removeTag.length > 0)) {
          throw new Error('Cannot combine --set-tags with --add-tag or --remove-tag');
        }

        const tagResults = [];

        if (options.addTag.length > 0) {
          const items = uuids.map(uuid => ({ uuid, tags: options.addTag, operation: 'add' }));
          const result = await runJxa('write', 'batchTag', [JSON.stringify(items)]);
          tagResults.push({ operation: 'add', result });
          if (!result.success) {
            print(result, options);
            process.exit(1);
          }
        }

        if (options.removeTag.length > 0) {
          const items = uuids.map(uuid => ({ uuid, tags: options.removeTag, operation: 'remove' }));
          const result = await runJxa('write', 'batchTag', [JSON.stringify(items)]);
          tagResults.push({ operation: 'remove', result });
          if (!result.success) {
            print(result, options);
            process.exit(1);
          }
        }

        if (options.setTags && options.setTags.length > 0) {
          const items = uuids.map(uuid => ({ uuid, tags: options.setTags, operation: 'set' }));
          const result = await runJxa('write', 'batchTag', [JSON.stringify(items)]);
          tagResults.push({ operation: 'set', result });
          if (!result.success) {
            print(result, options);
            process.exit(1);
          }
        }

        const properties = {};
        if (options.comment !== undefined) properties.comment = options.comment;
        if (options.label !== undefined) properties.label = Number(options.label);
        if (options.rating !== undefined) properties.rating = Number(options.rating);
        if (options.unread !== undefined) properties.unread = options.unread === 'true';
        if (options.flagged !== undefined) properties.flagged = options.flagged === 'true';
        if (options.locked !== undefined) properties.locked = options.locked === 'true';
        if (options.aliases && options.aliases.length > 0) properties.aliases = options.aliases;
        if (options.meta && Object.keys(options.meta).length > 0) properties.customMetaData = options.meta;

        if (Object.keys(properties).length === 0 && tagResults.length === 0) {
          throw new Error('No modifications specified. Use tag or metadata options.');
        }

        let updateResult = null;
        if (Object.keys(properties).length > 0) {
          const items = uuids.map(uuid => ({ uuid, properties }));
          updateResult = await runJxa('write', 'batchUpdate', [JSON.stringify(items)]);
          if (!updateResult.success) {
            print(updateResult, options);
            process.exit(1);
          }
        }

        print({
          success: true,
          count: uuids.length,
          tagOperations: tagResults.length > 0 ? tagResults : undefined,
          updated: updateResult ? updateResult.updated : undefined
        }, options);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}

function collectValues(value, previous) {
  return previous.concat([value]);
}

function collectKeyValue(value, previous) {
  const [key, ...rest] = value.split('=');
  if (key && rest.length > 0) {
    previous[key] = rest.join('=');
  }
  return previous;
}
