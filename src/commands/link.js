/**
 * Link Command
 * Manage links and exclusion flags for records
 * @version 1.0.0
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerLinkCommand(program) {
  // dt link <source> [target]
  program
    .command('link <source> [target]')
    .alias('ln')
    .description('Link records or enable linking features')
    .option('--wiki', 'Enable Wiki Linking (excludeFromWikiLinking = false)')
    .option('--no-wiki', 'Disable Wiki Linking (excludeFromWikiLinking = true)')
    .option('--see-also', 'Enable See Also (excludeFromSeeAlso = false)')
    .option('--no-see-also', 'Disable See Also (excludeFromSeeAlso = true)')
    .option('--search', 'Enable Searching (excludeFromSearch = false)')
    .option('--no-search', 'Disable Searching (excludeFromSearch = true)')
    .option('--chat', 'Enable AI Chat (excludeFromChat = false)')
    .option('--no-chat', 'Disable AI Chat (excludeFromChat = true)')
    .option('--classification', 'Enable Classification (excludeFromClassification = false)')
    .option('--no-classification', 'Disable Classification (excludeFromClassification = true)')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (source, target, options) => {
      try {
        await requireDevonthink();

        const params = {
          sourceUuid: source,
          mode: 'link'
        };

        if (target) params.targetUuid = target;

        // Check for specific flags
        // Commander handles --no-wiki as options.wiki = false
        if (options.wiki !== undefined) params.wiki = options.wiki;
        if (options.seeAlso !== undefined) params.seeAlso = options.seeAlso;
        if (options.search !== undefined) params.search = options.search;
        if (options.chat !== undefined) params.chat = options.chat;
        if (options.classification !== undefined) params.classification = options.classification;

        const result = await runJxa('write', 'linkRecords', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });

  // dt unlink <source> [target]
  program
    .command('unlink <source> [target]')
    .description('Unlink records or disable linking features')
    .option('--wiki', 'Disable Wiki Linking')
    .option('--see-also', 'Disable See Also')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .action(async (source, target, options) => {
      try {
        await requireDevonthink();

        const params = {
          sourceUuid: source,
          mode: 'unlink'
        };

        if (target) params.targetUuid = target;

        // For unlink command, if flags are present, we set them to FALSE (disable)
        if (options.wiki) params.wiki = false;
        if (options.seeAlso) params.seeAlso = false;

        // If no target and no flags, default to disabling both wiki and see also
        if (!target && !options.wiki && !options.seeAlso) {
             params.wiki = false;
             params.seeAlso = false;
        }

        const result = await runJxa('write', 'linkRecords', [JSON.stringify(params)]);
        print(result, options);

        if (!result.success) process.exit(1);
      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
