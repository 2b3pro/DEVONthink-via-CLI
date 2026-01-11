/**
 * DEVONthink CLI
 * Unified command-line interface for DEVONthink 4
 */

import { Command } from 'commander';
import { registerSearchCommand } from './commands/search.js';
import { registerGetCommand } from './commands/get.js';
import { registerListCommand } from './commands/list.js';
import { registerCreateCommand } from './commands/create.js';
import { registerModifyCommand } from './commands/modify.js';
import { registerDeleteCommand } from './commands/delete.js';
import { registerReplicateCommand } from './commands/replicate.js';
import { registerClassifyCommand } from './commands/classify.js';
import { registerGroupCommand } from './commands/group.js';
import { registerRevealCommand } from './commands/reveal.js';
import { registerBatchCommand } from './commands/batch.js';
import { registerStatusCommand } from './commands/status.js';
import { registerImportCommand } from './commands/import.js';
import { registerDownloadCommand } from './commands/download.js';
import { registerReadingListCommand } from './commands/reading-list.js';
import { registerConvertCommand } from './commands/convert.js';
import { registerMoveCommand } from './commands/move.js';
import { registerDuplicateCommand } from './commands/duplicate.js';
import { registerUpdateCommand } from './commands/update.js';
import { registerExportCommand } from './commands/export.js';
import { registerIndexCommand } from './commands/index.js';
import { registerMergeCommand } from './commands/merge.js';
import { registerTranscribeCommand } from './commands/transcribe.js';
import { registerChatCommand } from './commands/chat.js';
import { registerLinkCommand } from './commands/link.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerOrganizeCommand } from './commands/organize.js';
import { registerSummarizeCommand } from './commands/summarize.js';
import { registerTagsCommand } from './commands/tags.js';
import { registerQueueCommand } from './commands/queue.js';
import { registerSmartGroupCommand } from './commands/smartgroup.js';
import { registerTreeCommand } from './commands/tree.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json');

export function createProgram() {
  const program = new Command();

  program
    .name('dt')
    .description('Command-line and MCP interface for DEVONthink 4')
    .version(VERSION, '-v, --version', 'Show version number')
    .configureHelp({
      sortSubcommands: true,
      sortOptions: true
    });

  // Register all commands
  registerSearchCommand(program);
  registerGetCommand(program);
  registerListCommand(program);
  registerCreateCommand(program);
  registerModifyCommand(program);
  registerDeleteCommand(program);
  registerReplicateCommand(program);
  registerClassifyCommand(program);
  registerGroupCommand(program);
  registerRevealCommand(program);
  registerBatchCommand(program);
  registerStatusCommand(program);
  registerImportCommand(program);
  registerDownloadCommand(program);
  registerReadingListCommand(program);
  registerConvertCommand(program);
  registerMoveCommand(program);
  registerDuplicateCommand(program);
  registerUpdateCommand(program);
  registerExportCommand(program);
  registerIndexCommand(program);
  registerMergeCommand(program);
  registerTranscribeCommand(program);
  registerChatCommand(program);
  registerLinkCommand(program);
  registerMcpCommand(program);
  registerOrganizeCommand(program);
  registerSummarizeCommand(program);
  registerTagsCommand(program);
  registerQueueCommand(program);
  registerSmartGroupCommand(program);
  registerTreeCommand(program);

  // Add completion command
  program
    .command('completion <shell>')
    .description('Generate shell completion script (bash, zsh, fish)')
    .action((shell) => {
      console.log(generateCompletion(shell));
    });

  return program;
}

/**
 * Generate shell completion scripts
 */
function generateCompletion(shell) {
  const commands = [
    'search', 'get', 'list', 'create', 'import', 'index', 'export', 'modify', 'update', 'delete',
    'replicate', 'duplicate', 'move', 'merge', 'classify', 'group', 'reveal', 'batch', 'status', 'download', 'reading-list', 'convert', 'deconsolidate', 'transcribe', 'chat', 'link', 'unlink', 'mcp', 'organize', 'summarize', 'tags', 'smartgroup', 'tree', 'completion'
  ];

  const subcommands = {
    search: ['query', 'comment', 'hash', 'file', 'path', 'tags', 'url', 'show'],
    get: ['props', 'preview', 'selection', 'concordance', 'transcribe', 'related'],
    list: ['group', 'inbox', 'tag'],
    create: ['record', 'markdown', 'pdf', 'web', 'image'],
    classify: ['suggest', 'batch'],
    batch: ['preview', 'verify'],
    download: ['add', 'url', 'markup', 'json', 'start', 'stop'],
    'reading-list': ['add'],
    chat: ['ask', 'models', 'capabilities'],
    mcp: ['run', 'config'],
    organize: [],
    summarize: [],
    tags: ['list', 'analyze', 'merge', 'rename', 'delete', 'normalize', 'config'],
    smartgroup: ['list', 'create', 'update', 'delete', 'items', 'delete-items', 'modify-items']
  };

  switch (shell) {
    case 'bash':
      return `# Bash completion for dt (DEVONthink CLI)
# Add to ~/.bashrc or ~/.bash_completion

_dt_completions() {
    local cur prev commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    commands="${commands.join(' ')}"

    case "\${prev}" in
        dt)
            COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
            return 0
            ;;
        search)
            COMPREPLY=( $(compgen -W "query comment hash file path tags url show" -- \${cur}) )
            return 0
            ;;
        get)
            COMPREPLY=( $(compgen -W "props preview selection concordance transcribe related" -- ${cur}) )
            return 0
            ;;
        list|ls)
            COMPREPLY=( $(compgen -W "group inbox tag" -- \${cur}) )
            return 0
            ;;
        create)
            COMPREPLY=( $(compgen -W "record markdown pdf web image" -- \${cur}) )
            return 0
            ;;
        classify)
            COMPREPLY=( $(compgen -W "suggest batch" -- \${cur}) )
            return 0
            ;;
        batch)
            COMPREPLY=( $(compgen -W "preview verify" -- \${cur}) )
            return 0
            ;;
        download|dl)
            COMPREPLY=( $(compgen -W "add url markup json start stop" -- \${cur}) )
            return 0
            ;;
        reading-list|rl)
            COMPREPLY=( $(compgen -W "add" -- \${cur}) )
            return 0
            ;;
        chat)
            COMPREPLY=( $(compgen -W "ask models capabilities" -- ${cur}) )
            return 0
            ;;
        mcp)
            COMPREPLY=( $(compgen -W "run config" -- ${cur}) )
            return 0
            ;;
        smartgroup|sg)
            COMPREPLY=( $(compgen -W "list create update delete items delete-items modify-items" -- \${cur}) )
            return 0
            ;;
        organize|tidy)
            # No subcommands
            return 0
            ;;
        summarize|sum)
            # No subcommands
            return 0
            ;;
        link|ln)
            # No subcommands, just arguments
            return 0
            ;;
        unlink)
            # No subcommands
            return 0
            ;;
        completion)
            COMPREPLY=( $(compgen -W "bash zsh fish" -- \${cur}) )
            return 0
            ;;
    esac

    # Complete options
    if [[ \${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "--help --version --json --pretty --quiet" -- \${cur}) )
        return 0
    fi
}

complete -F _dt_completions dt
`;

    case 'zsh':
      return `#compdef dt
# Zsh completion for dt (DEVONthink CLI)
# Add to ~/.zshrc or place in fpath

_dt() {
    local -a commands
    commands=(
        'search:Search DEVONthink records'
        'get:Get record information'
        'list:List records'
        'create:Create a new record'
        'import:Import a file into DEVONthink'
        'index:Index external file or folder'
        'export:Export record to directory'
        'modify:Modify record properties'
        'update:Update text content of a record'
        'delete:Delete a record'
        'replicate:Create linked copies (replicants)'
        'duplicate:Create independent copies'
        'move:Move record(s) to a different group'
        'merge:Merge records into single document'
        'classify:Classification operations'
        'group:Create or resolve group paths'
        'reveal:Open/reveal record in DEVONthink'
        'batch:Batch operations'
        'status:Check DEVONthink status'
        'download:Add URL to download manager'
        'reading-list:Reading list operations'
        'convert:Convert record to another format'
        'deconsolidate:Move record to external folder'
        'chat:AI chat with DEVONthink'
        'link:Link records or enable linking'
        'unlink:Unlink records or disable linking'
        'mcp:Model Context Protocol (MCP) server'
        'organize:Intelligently organize records'
        'summarize:Generate AI summary of record(s)'
        'smartgroup:Manage smart groups'
        'completion:Generate shell completion script'
    )

    local -a search_commands get_commands list_commands create_commands classify_commands batch_commands reading_list_commands chat_commands mcp_commands smartgroup_commands

    search_commands=(
        'query:Full-text search for records'
        'comment:Lookup records by comment'
        'hash:Lookup records by content hash'
        'file:Lookup records by filename'
        'path:Lookup records by path'
        'tags:Lookup records by tags'
        'url:Lookup records by URL'
        'show:Open search in DEVONthink window'
    )

    get_commands=(
        'props:Get all properties of a record'
        'preview:Get plain text preview'
        'selection:Get selected records'
        'concordance:Get word list (concordance)'
        'transcribe:Transcribe speech/text from media'
        'related:Get related records (backlinks, wikilinks, AI)'
    )

    list_commands=(
        'group:List contents of a group'
        'inbox:List Inbox items'
        'tag:List records with a tag'
    )

    create_commands=(
        'record:Create a new record with properties'
        'markdown:Create Markdown from web URL'
        'pdf:Create PDF from web URL'
        'web:Create web document from URL'
        'image:Generate AI image from prompt'
    )

    classify_commands=(
        'suggest:Get classification proposals'
        'batch:Batch classify records'
    )

    batch_commands=(
        'preview:Get previews for multiple records'
        'verify:Verify multiple records'
    )

    download_commands=(
        'add:Add URL to download manager'
        'url:Download URL content'
        'markup:Download HTML/XML markup'
        'json:Download JSON from URL'
        'start:Start download manager queue'
        'stop:Stop download manager queue'
    )

    reading_list_commands=(
        'add:Add record or URL to reading list'
    )

    chat_commands=(
        'ask:Send a chat message'
        'models:List available chat models'
        'capabilities:Get model capabilities'
    )

    mcp_commands=(
        'run:Run the MCP server'
        'config:Display Claude Desktop config'
    )

    smartgroup_commands=(
        'list:List smart groups'
        'create:Create a smart group'
        'update:Update a smart group'
        'delete:Delete a smart group'
        'items:List smart group items'
        'delete-items:Delete smart group items'
        'modify-items:Modify smart group items'
    )

    _arguments -C \\
        '1: :->command' \\
        '2: :->subcommand' \\
        '*::arg:->args'

    case "$state" in
        command)
            _describe 'command' commands
            ;;
        subcommand)
            case "$words[1]" in
                search)
                    _describe 'subcommand' search_commands
                    ;;
                get)
                    _describe 'subcommand' get_commands
                    ;;
                list|ls)
                    _describe 'subcommand' list_commands
                    ;;
                create)
                    _describe 'subcommand' create_commands
                    ;;
                classify)
                    _describe 'subcommand' classify_commands
                    ;;
                batch)
                    _describe 'subcommand' batch_commands
                    ;;
                download|dl)
                    _describe 'subcommand' download_commands
                    ;;
                reading-list|rl)
                    _describe 'subcommand' reading_list_commands
                    ;;
                chat)
                    _describe 'subcommand' chat_commands
                    ;;
                mcp)
                    _describe 'subcommand' mcp_commands
                    ;;
                smartgroup|sg)
                    _describe 'subcommand' smartgroup_commands
                    ;;
            esac
            ;;
    esac
}

_dt "$@"
`;

    case 'fish':
      return `# Fish completion for dt (DEVONthink CLI)
# Save to ~/.config/fish/completions/dt.fish

# Main commands
complete -c dt -f -n "__fish_use_subcommand" -a "search" -d "Search DEVONthink records"
complete -c dt -f -n "__fish_use_subcommand" -a "get" -d "Get record information"
complete -c dt -f -n "__fish_use_subcommand" -a "list" -d "List records"
complete -c dt -f -n "__fish_use_subcommand" -a "create" -d "Create a new record"
complete -c dt -f -n "__fish_use_subcommand" -a "import" -d "Import a file into DEVONthink"
complete -c dt -f -n "__fish_use_subcommand" -a "index" -d "Index external file or folder"
complete -c dt -f -n "__fish_use_subcommand" -a "export" -d "Export record to directory"
complete -c dt -f -n "__fish_use_subcommand" -a "modify" -d "Modify record properties"
complete -c dt -f -n "__fish_use_subcommand" -a "update" -d "Update text content of a record"
complete -c dt -f -n "__fish_use_subcommand" -a "delete" -d "Delete a record"
complete -c dt -f -n "__fish_use_subcommand" -a "replicate" -d "Create linked copies (replicants)"
complete -c dt -f -n "__fish_use_subcommand" -a "duplicate" -d "Create independent copies"
complete -c dt -f -n "__fish_use_subcommand" -a "move" -d "Move record(s) to a different group"
complete -c dt -f -n "__fish_use_subcommand" -a "merge" -d "Merge records into single document"
complete -c dt -f -n "__fish_use_subcommand" -a "classify" -d "Classification operations"
complete -c dt -f -n "__fish_use_subcommand" -a "group" -d "Create or resolve group paths"
complete -c dt -f -n "__fish_use_subcommand" -a "reveal" -d "Open/reveal in DEVONthink"
complete -c dt -f -n "__fish_use_subcommand" -a "batch" -d "Batch operations"
complete -c dt -f -n "__fish_use_subcommand" -a "status" -d "Check DEVONthink status"
complete -c dt -f -n "__fish_use_subcommand" -a "download" -d "Add URL to download manager"
complete -c dt -f -n "__fish_use_subcommand" -a "reading-list" -d "Reading list operations"
complete -c dt -f -n "__fish_use_subcommand" -a "convert" -d "Convert record to another format"
complete -c dt -f -n "__fish_use_subcommand" -a "deconsolidate" -d "Move record to external folder"
complete -c dt -f -n "__fish_use_subcommand" -a "chat" -d "AI chat with DEVONthink"
complete -c dt -f -n "__fish_use_subcommand" -a "link" -d "Link records or enable linking"
complete -c dt -f -n "__fish_use_subcommand" -a "unlink" -d "Unlink records or disable linking"
complete -c dt -f -n "__fish_use_subcommand" -a "mcp" -d "Model Context Protocol (MCP) server"
complete -c dt -f -n "__fish_use_subcommand" -a "organize" -d "Intelligently organize records"
complete -c dt -f -n "__fish_use_subcommand" -a "summarize" -d "Generate AI summary of record(s)"
complete -c dt -f -n "__fish_use_subcommand" -a "smartgroup" -d "Manage smart groups"
complete -c dt -f -n "__fish_use_subcommand" -a "completion" -d "Generate shell completion"

# search subcommands
--
# chat subcommands
complete -c dt -f -n "__fish_seen_subcommand_from chat" -a "ask" -d "Send a chat message"
complete -c dt -f -n "__fish_seen_subcommand_from chat" -a "models" -d "List available chat models"
complete -c dt -f -n "__fish_seen_subcommand_from chat" -a "capabilities" -d "Get model capabilities"

# mcp subcommands
complete -c dt -f -n "__fish_seen_subcommand_from mcp" -a "run" -d "Run the MCP server"
complete -c dt -f -n "__fish_seen_subcommand_from mcp" -a "config" -d "Display Claude Desktop config"

# smartgroup subcommands
complete -c dt -f -n "__fish_seen_subcommand_from smartgroup" -a "list" -d "List smart groups"
complete -c dt -f -n "__fish_seen_subcommand_from smartgroup" -a "create" -d "Create a smart group"
complete -c dt -f -n "__fish_seen_subcommand_from smartgroup" -a "update" -d "Update a smart group"
complete -c dt -f -n "__fish_seen_subcommand_from smartgroup" -a "delete" -d "Delete a smart group"
complete -c dt -f -n "__fish_seen_subcommand_from smartgroup" -a "items" -d "List smart group items"
complete -c dt -f -n "__fish_seen_subcommand_from smartgroup" -a "delete-items" -d "Delete smart group items"
complete -c dt -f -n "__fish_seen_subcommand_from smartgroup" -a "modify-items" -d "Modify smart group items"

# completion subcommands
complete -c dt -f -n "__fish_seen_subcommand_from completion" -a "bash zsh fish"

# Common options
complete -c dt -l json -d "Output raw JSON"
complete -c dt -l pretty -d "Pretty print JSON"
complete -c dt -s q -l quiet -d "Minimal output"
complete -c dt -s h -l help -d "Show help"
complete -c dt -s v -l version -d "Show version"
`;

    default:
      return `Unsupported shell: ${shell}. Supported: bash, zsh, fish`;
  }
}

export { VERSION };
