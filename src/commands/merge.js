/**
 * Merge Command
 * Merge records into a single document or merge groups/tags
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerMergeCommand(program) {
  program
    .command('merge <uuids...>')
    .description('Merge records into RTF(D)/PDF or merge groups/tags')
    .option('-g, --to <pathOrUuid>', 'Destination group for merged record')
    .option('-d, --database <nameOrUuid>', 'Database for destination group (if using path)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output UUID of merged record')
    .addHelpText('after', `
Examples:
  dt merge UUID1 UUID2 -g "/Merged" -d "Research"
  dt merge UUID1 UUID2 UUID3
`)
    .action(async (uuids, options) => {
      try {
        await requireDevonthink();

        if (uuids.length < 2) {
          throw new Error('At least 2 UUIDs required for merge');
        }

        const params = { uuids };
        if (options.to) params.groupPath = options.to;
        if (options.database) params.database = options.database;

        const result = await runJxa('write', 'mergeRecords', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
