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
    .addHelpText('after', `
Examples:
  dt link UUID1 UUID2
  dt link UUID1 --no-wiki --no-see-also
`)
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
    .option('--search', 'Disable Searching')
    .option('--chat', 'Disable AI Chat')
    .option('--classification', 'Disable Classification')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
Examples:
  dt unlink UUID1 UUID2
  dt unlink UUID1 --search --chat
`)
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
        if (options.search) params.search = false;
        if (options.chat) params.chat = false;
        if (options.classification) params.classification = false;

        // If no target and no flags, default to disabling both wiki and see also
        const hasAnyFlag = options.wiki || options.seeAlso || options.search || options.chat || options.classification;
        if (!target && !hasAnyFlag) {
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
