/**
 * MCP Command
 * Management of the Model Context Protocol server
 * @version 2.0.0
 */

import { runMcpServer } from '../mcp-server.js';
import { requireDevonthink } from '../jxa-runner.js';

export function registerMcpCommand(program) {
  const mcp = program
    .command('mcp')
    .description('Model Context Protocol (MCP) server for DEVONthink');

  mcp
    .command('run')
    .description('Run the MCP server on stdio')
    .addHelpText('after', `
Examples:
  dt mcp run
`)
    .action(async () => {
      try {
        await requireDevonthink();
        await runMcpServer();
      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });
    
  mcp
    .command('config')
    .description('Display the configuration for Claude Desktop')
    .option('--json', 'Output raw JSON')
    .option('--pretty', 'Pretty print JSON output')
    .option('-q, --quiet', 'Minimal output')
    .addHelpText('after', `
Examples:
  dt mcp config
`)
    .action((options) => {
        const fullPath = process.argv[1];
        const config = {
            "mcpServers": {
                "devonthink-mcp": {
                    "command": process.execPath,
                    "args": [fullPath, "mcp", "run"],
                    "env": {
                        "PATH": process.env.PATH,
                        "DT_ORGANIZE_PROMPT": process.env.DT_ORGANIZE_PROMPT || ""
                    }
                }
            }
        };
        console.log("\nAdd this to your Claude Desktop configuration file:");
        console.log("(Typically ~/Library/Application Support/Claude/claude_desktop_config.json)\n");
        console.log(JSON.stringify(config, null, 2));
        console.log("\n");
    });
}
