/**
 * Batch Commands
 * Batch operations on multiple records
 * @version 1.1.0
 * @tested 2026-01-05
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';
import { readUuidsFromStdin, isStdinMarker } from '../utils.js';

export function registerBatchCommand(program) {
  const batch = program
    .command('batch')
    .description('Batch operations on multiple records');

  // dt batch preview
  batch
    .command('preview')
    .description('Get previews for multiple records')
    .requiredOption('-u, --uuids <uuids...>', 'UUIDs of records to preview (use - for stdin)')
    .option('-l, --length <chars>', 'Maximum characters per preview', '3000')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (options) => {
      try {
        await requireDevonthink();

        let uuids = Array.isArray(options.uuids) ? options.uuids : [options.uuids];

        // Read UUIDs from stdin if first value is "-"
        if (uuids.length === 1 && isStdinMarker(uuids[0])) {
          uuids = await readUuidsFromStdin();
          if (uuids.length === 0) {
            throw new Error('No UUIDs received from stdin');
          }
        }

        const args = [JSON.stringify(uuids), options.length || '3000'];

        const result = await runJxa('read', 'batchPreview', args);
        print(result, options);

        if (!result.success) {
          process.exit(1);
        }
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt batch verify
  batch
    .command('verify')
    .description('Verify multiple records after operations')
    .requiredOption('-u, --uuids <uuids...>', 'UUIDs of records to verify (use - for stdin)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (options) => {
      try {
        await requireDevonthink();

        let uuids = Array.isArray(options.uuids) ? options.uuids : [options.uuids];

        // Read UUIDs from stdin if first value is "-"
        if (uuids.length === 1 && isStdinMarker(uuids[0])) {
          uuids = await readUuidsFromStdin();
          if (uuids.length === 0) {
            throw new Error('No UUIDs received from stdin');
          }
        }

        const args = [JSON.stringify(uuids)];

        const result = await runJxa('read', 'batchVerify', args);
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
