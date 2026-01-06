/**
 * Delete Command
 * Delete records (move to trash)
 * @version 1.1.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { readUuidsFromStdin, isStdinMarker } from '../utils.js';
import { addTasks } from '../queue.js';

export function registerDeleteCommand(program) {
  program
    .command('delete <uuid...>')
    .alias('rm')
    .alias('trash')
    .description('Delete record(s) - moves to Trash (use - to read UUIDs from stdin)')
    .option('--queue', 'Add task to the execution queue instead of running immediately')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Suppress output on success')
    .action(async (uuids, options) => {
      try {
        // Read UUIDs from stdin if first arg is "-"
        let recordUuids = uuids;
        if (uuids.length === 1 && isStdinMarker(uuids[0])) {
          recordUuids = await readUuidsFromStdin();
          if (recordUuids.length === 0) {
            throw new Error('No UUIDs received from stdin');
          }
        }

        if (options.queue) {
          const tasks = recordUuids.map(uuid => ({
            action: 'delete',
            params: { uuid }
          }));
          const result = await addTasks(tasks);
          print(result, options);
          return;
        }

        await requireDevonthink();

        // Use batch delete for multiple UUIDs, single for one
        let result;
        if (recordUuids.length === 1) {
          result = await runJxa('write', 'deleteRecord', [recordUuids[0]]);
        } else {
          result = await runJxa('write', 'batchDelete', [JSON.stringify(recordUuids)]);
        }

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
