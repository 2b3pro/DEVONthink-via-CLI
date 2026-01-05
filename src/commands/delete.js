/**
 * Delete Command
 * Delete records (move to trash)
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerDeleteCommand(program) {
  program
    .command('delete <uuid>')
    .alias('rm')
    .alias('trash')
    .description('Delete a record (moves to Trash)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Suppress output on success')
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const result = await runJxa('write', 'deleteRecord', [uuid]);

        if (!options.quiet || !result.success) {
          print(result, options);
        }

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
