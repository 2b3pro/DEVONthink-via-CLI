/**
 * List Command
 * List contents of groups, inbox, or by tag
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerListCommand(program) {
  const list = program
    .command('list')
    .alias('ls')
    .description('List records');

  // dt list group <uuid|database> [path]
  list
    .command('group [target] [path]')
    .alias('folder')
    .description('List contents of a group/folder (by UUID or database/path)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUIDs')
    .action(async (target, path, options) => {
      try {
        await requireDevonthink();

        // If target looks like a UUID (contains hyphens, long enough)
        const looksLikeUuid = target && target.includes('-') && target.length > 20;
        const args = looksLikeUuid ? [target] : [target || '', path || '/'];

        const result = await runJxa('read', 'listGroupContents', args);
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
