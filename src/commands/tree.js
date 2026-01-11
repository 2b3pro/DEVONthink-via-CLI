/**
 * Tree Command
 * Generate hierarchical folder structure for database navigation and LLM context
 * @version 1.0.0
 */

import { runJxa, requireDevonthink } from '../jxa-runner.js';
import { print, printError } from '../output.js';

export function registerTreeCommand(program) {
  program
    .command('tree [path]')
    .description('Display folder hierarchy as a tree')
    .option('-d, --database <name>', 'Target database (name or UUID)')
    .option('--depth <n>', 'Maximum depth to traverse (default: 10)', '10')
    .option('--counts', 'Include item counts per folder')
    .option('--exclude-system', 'Exclude system folders (_INBOX, _TRIAGE, etc.)')
    .option('-s, --smart-groups', 'Include smart groups in tree (shown in brackets)')
    .option('--json', 'Output raw JSON (includes tree structure)')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Only output tree text (no metadata)')
    .addHelpText('after', `
Output Formats:
  Default: ASCII tree visualization
  --json:  Full JSON with tree array and text representation

JSON Output:
  {
    "success": true,
    "database": "string",
    "databaseUuid": "string",
    "startPath": "string",
    "depth": number,
    "tree": [
      {
        "name": "string",
        "uuid": "string",
        "path": "string",
        "depth": number,
        "itemCount": number,    // if --counts
        "isSmartGroup": boolean, // if --smart-groups
        "children": [...]       // nested groups
      }
    ],
    "text": "string"            // ASCII tree
  }

Examples:
  dt tree                           # Full tree of current database
  dt tree -d "Research"             # Tree of specific database
  dt tree "/05—Education"           # Subtree from path
  dt tree --depth 2                 # Limit to 2 levels
  dt tree --counts                  # Show item counts
  dt tree --exclude-system          # Hide _INBOX, _TRIAGE, etc.
  dt tree --smart-groups            # Include smart groups: (Smart Group Name)
  dt tree -d "PAI Brain" --json     # JSON output for scripting

Use Cases:
  - Inject folder structure into LLM classification prompts
  - Audit folder organization and item distribution
  - Generate folder documentation
`)
    .action(async (path, options) => {
      try {
        await requireDevonthink();

        const params = {
          database: options.database || '',
          path: path || '/',
          depth: parseInt(options.depth, 10) || 10,
          counts: options.counts || false,
          excludeSystem: options.excludeSystem || false,
          smartGroups: options.smartGroups || false,
          json: options.json || false
        };

        const result = await runJxa('read', 'tree', [JSON.stringify(params)]);

        if (!result.success) {
          print(result, options);
          process.exit(1);
        }

        // For quiet mode, just output the text tree
        if (options.quiet) {
          console.log(result.text);
          return;
        }

        // For JSON mode, output full result
        if (options.json || options.pretty) {
          print(result, options);
          return;
        }

        // Default: output text tree with header
        console.log(result.text);

      } catch (error) {
        printError(error, options);
        process.exit(1);
      }
    });
}
