/**
 * List Command
 * List contents of groups, inbox, or by tag
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { getDatabaseCache, setDatabaseCache } from '../cache.js';
import { trackGroupAccess } from '../state.js';

export function registerListCommand(program) {
  const list = program
    .command('list')
    .alias('ls')
    .description('List records');

  // dt list databases
  list
    .command('databases')
    .alias('dbs')
    .alias('db')
    .description('List open databases')
    .option('--refresh', 'Force refresh from DEVONthink')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .addHelpText('after', `
Examples:
  dt list databases
  dt list dbs --refresh
`)
    .action(async (options) => {
      try {
        await requireDevonthink();

        // Try cache first unless forced
        let dbs = null;
        if (!options.refresh) {
          const cache = await getDatabaseCache();
          if (cache && !cache.isStale) {
            dbs = cache.databases;
          }
        }

        // Fetch if needed
        if (!dbs) {
          const result = await runJxa('read', 'listDatabases', []);
          if (Array.isArray(result)) {
            dbs = result;
            await setDatabaseCache(dbs);
          } else {
             // If JXA returned error object
             print(result, options);
             if (!result.success) process.exit(1);
             return; 
          }
        }

        print(dbs, options);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt list group <uuid|database> [path]
  list
    .command('group [target] [path]')
    .alias('folder')
    .description('List contents of a group/folder (by UUID or database/path)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .addHelpText('after', `
Examples:
  dt list group "Research" "/Papers/2024"
  dt list group ABCD-1234 --quiet
`)
    .action(async (target, path, options) => {
      try {
        await requireDevonthink();

        // If target looks like a UUID (contains hyphens, long enough)
        const looksLikeUuid = target && target.includes('-') && target.length > 20;
        const args = looksLikeUuid ? [target] : [target || '', path || '/'];

        const result = await runJxa('read', 'listGroupContents', args);
        
        // Track access if successful and we have group info
        // The JXA script returns list of children. It might not return group metadata.
        // If we want to track the group, we might need to know which group it was.
        // For now, let's skip tracking in 'list group' unless we update the JXA to return metadata too.
        // Actually, if 'target' is a UUID, we can track it.
        if (result.success && looksLikeUuid) {
             // We'll track it as a group access. 
             // Ideally we need name/path for the recent list, but we only have UUID here.
             // We can defer or look it up. For now, let's track minimal info.
             // Wait, state.js expects {uuid, name, path...}.
             // If we don't have name, maybe we shouldn't track or track as "Unknown".
             // Let's hold off on tracking here until we can get full metadata.
        }

        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt list inbox
  list
    .command('inbox')
    .description('List items in Inbox pending classification')
    .option('-l, --limit <n>', 'Maximum items to return', '50')
    .option('-f, --folder <name>', 'Folder within Inbox', '_TO BE FILED')
    .option('-p, --preview <chars>', 'Include preview with max characters (0 = no preview)', '0')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .addHelpText('after', `
Examples:
  dt list inbox
  dt list inbox -l 10 --preview 200
`)
    .action(async (options) => {
      try {
        await requireDevonthink();

        const args = [
          options.limit || '50',
          options.folder || '_TO BE FILED',
          options.preview || '0'
        ];

        const result = await runJxa('read', 'listInbox', args);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt list tag <tag>
  list
    .command('tag <tag>')
    .alias('tagged')
    .description('List records with a specific tag')
    .option('-d, --database <nameOrUuid>', 'Search within specific database (name or UUID)')
    .option('-l, --limit <n>', 'Maximum results to return', '50')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .addHelpText('after', `
Examples:
  dt list tag "inbox"
  dt list tag "research" -d "Research" -l 25
`)
    .action(async (tag, options) => {
      try {
        await requireDevonthink();

        const args = [tag, options.database || '', options.limit || '50'];
        const result = await runJxa('read', 'queryByTag', args);
        print(result, options);
        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
