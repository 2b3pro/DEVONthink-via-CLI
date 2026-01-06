/**
 * Reading List Command
 * Add records or URLs to DEVONthink's reading list
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerReadingListCommand(program) {
  const readingList = program
    .command('reading-list')
    .alias('rl')
    .description('Reading list operations');

  // dt reading-list add <uuidOrUrl>
  readingList
    .command('add <uuidOrUrl>')
    .description('Add a record (by UUID) or URL to the reading list')
    .option('-t, --title <title>', 'Title for URL (ignored for records)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
Examples:
  dt reading-list add "https://example.com/article"
  dt rl add ABCD-1234
`)
    .action(async (uuidOrUrl, options) => {
      try {
        await requireDevonthink();

        const params = {};

        // Detect if input is a URL or UUID
        if (uuidOrUrl.startsWith('http://') || uuidOrUrl.startsWith('https://')) {
          params.url = uuidOrUrl;
          if (options.title) {
            params.title = options.title;
          }
        } else {
          params.uuid = uuidOrUrl;
        }

        const result = await runJxa('write', 'addReadingList', [JSON.stringify(params)]);
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
