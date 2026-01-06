/**
 * Replicate Command
 * Create replicas of records in other groups
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerReplicateCommand(program) {
  program
    .command('replicate <uuid>')
    .alias('rep')
    .description('Create replicas of a record in other groups')
    .requiredOption('-t, --to <uuid...>', 'Destination group UUID(s)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output replicant UUIDs')
    .addHelpText('after', `
Examples:
  dt replicate ABCD-1234 --to UUID-GROUP-1 UUID-GROUP-2
  dt rep ABCD-1234 --to UUID-GROUP-1
`)
    .action(async (uuid, options) => {
      try {
        await requireDevonthink();

        const destinations = Array.isArray(options.to) ? options.to : [options.to];
        const args = [uuid, ...destinations];

        const result = await runJxa('write', 'replicateRecord', args);
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
