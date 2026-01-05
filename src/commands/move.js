/**
 * Move Command
 * Move records to a different group
 * @version 1.0.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { readUuidsFromStdin, isStdinMarker } from '../utils.js';

export function registerMoveCommand(program) {
  program
    .command('move <uuid...>')
    .alias('mv')
    .description('Move record(s) to a different group (use - to read UUIDs from stdin)')
    .requiredOption('-t, --to <groupUuid>', 'Destination group (UUID or path with --database)')
    .option('-f, --from <groupUuid>', 'Source group UUID (for moving single instance in same database)')
    .option('-d, --database <nameOrUuid>', 'Database for path-based destination')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output moved record UUIDs')
    .action(async (uuids, options) => {
      try {
        await requireDevonthink();

        // Read UUIDs from stdin if first arg is "-"
        let recordUuids = uuids;
        if (uuids.length === 1 && isStdinMarker(uuids[0])) {
          recordUuids = await readUuidsFromStdin();
          if (recordUuids.length === 0) {
            throw new Error('No UUIDs received from stdin');
          }
        }

        const params = {
          records: recordUuids,
          to: options.to
        };

        if (options.from) {
          params.from = options.from;
        }

        if (options.database) {
          params.database = options.database;
        }

        const result = await runJxa('write', 'moveRecord', [JSON.stringify(params)]);
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
