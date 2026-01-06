/**
 * Duplicate Command
 * Create independent copies of records in other groups
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerDuplicateCommand(program) {
  program
    .command('duplicate <uuid...>')
    .alias('dup')
    .description('Create independent copies of record(s) in another group')
    .requiredOption('-t, --to <groupUuid>', 'Destination group (UUID or path with --database)')
    .option('-d, --database <nameOrUuid>', 'Database for path-based destination')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output copied record UUIDs')
    .addHelpText('after', `
Examples:
  dt duplicate ABCD-1234 --to "/Archive" -d "Research"
  dt dup ABCD-1234 EFGH-5678 --to "/Archive" -d "Research"
`)
    .action(async (uuids, options) => {
      try {
        await requireDevonthink();

        const params = {
          records: uuids,
          to: options.to,
          mode: 'duplicate'
        };

        if (options.database) {
          params.database = options.database;
        }

        const result = await runJxa('write', 'copyRecord', [JSON.stringify(params)]);
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
