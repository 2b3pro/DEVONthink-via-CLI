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

const VERSION = '1.6.0';

export function createProgram() {
  const program = new Command();

  program
    .name('dt')
    .description('Command-line interface for DEVONthink 4')
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
    'replicate', 'duplicate', 'move', 'merge', 'classify', 'group', 'reveal', 'batch', 'status', 'download', 'reading-list', 'convert', 'deconsolidate', 'transcribe', 'chat', 'link', 'unlink', 'completion'
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
    chat: ['ask', 'models', 'capabilities']
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
        'completion:Generate shell completion script'
    )

    local -a search_commands get_commands list_commands create_commands classify_commands batch_commands reading_list_commands chat_commands

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
complete -c dt -f -n "__fish_use_subcommand" -a "completion" -d "Generate shell completion"

# search subcommands
complete -c dt -f -n "__fish_seen_subcommand_from search" -a "query" -d "Full-text search for records"
complete -c dt -f -n "__fish_seen_subcommand_from search" -a "comment" -d "Lookup records by comment"
complete -c dt -f -n "__fish_seen_subcommand_from search" -a "hash" -d "Lookup records by content hash"
complete -c dt -f -n "__fish_seen_subcommand_from search" -a "file" -d "Lookup records by filename"
complete -c dt -f -n "__fish_seen_subcommand_from search" -a "path" -d "Lookup records by path"
complete -c dt -f -n "__fish_seen_subcommand_from search" -a "tags" -d "Lookup records by tags"
complete -c dt -f -n "__fish_seen_subcommand_from search" -a "url" -d "Lookup records by URL"
complete -c dt -f -n "__fish_seen_subcommand_from search" -a "show" -d "Open search in DEVONthink window"

# get subcommands
complete -c dt -f -n "__fish_seen_subcommand_from get" -a "props" -d "Get record properties"
complete -c dt -f -n "__fish_seen_subcommand_from get" -a "preview" -d "Get plain text preview"
complete -c dt -f -n "__fish_seen_subcommand_from get" -a "selection" -d "Get selected records"
complete -c dt -f -n "__fish_seen_subcommand_from get" -a "concordance" -d "Get word list (concordance)"
complete -c dt -f -n "__fish_seen_subcommand_from get" -a "transcribe" -d "Transcribe speech/text from media"
complete -c dt -f -n "__fish_seen_subcommand_from get" -a "related" -d "Get related records"

# list subcommands
complete -c dt -f -n "__fish_seen_subcommand_from list ls" -a "group" -d "List group contents"
complete -c dt -f -n "__fish_seen_subcommand_from list ls" -a "inbox" -d "List Inbox items"
complete -c dt -f -n "__fish_seen_subcommand_from list ls" -a "tag" -d "List records by tag"

# create subcommands
complete -c dt -f -n "__fish_seen_subcommand_from create" -a "record" -d "Create record with properties"
complete -c dt -f -n "__fish_seen_subcommand_from create" -a "markdown" -d "Create Markdown from URL"
complete -c dt -f -n "__fish_seen_subcommand_from create" -a "pdf" -d "Create PDF from URL"
complete -c dt -f -n "__fish_seen_subcommand_from create" -a "web" -d "Create web document from URL"
complete -c dt -f -n "__fish_seen_subcommand_from create" -a "image" -d "Generate AI image from prompt"

# classify subcommands
complete -c dt -f -n "__fish_seen_subcommand_from classify" -a "suggest" -d "Get classification proposals"
complete -c dt -f -n "__fish_seen_subcommand_from classify" -a "batch" -d "Batch classify records"

# batch subcommands
complete -c dt -f -n "__fish_seen_subcommand_from batch" -a "preview" -d "Get multiple previews"
complete -c dt -f -n "__fish_seen_subcommand_from batch" -a "verify" -d "Verify multiple records"

# download subcommands
complete -c dt -f -n "__fish_seen_subcommand_from download dl" -a "add" -d "Add URL to download manager"
complete -c dt -f -n "__fish_seen_subcommand_from download dl" -a "url" -d "Download URL content"
complete -c dt -f -n "__fish_seen_subcommand_from download dl" -a "markup" -d "Download HTML/XML markup"
complete -c dt -f -n "__fish_seen_subcommand_from download dl" -a "json" -d "Download JSON from URL"
complete -c dt -f -n "__fish_seen_subcommand_from download dl" -a "start" -d "Start download manager"
complete -c dt -f -n "__fish_seen_subcommand_from download dl" -a "stop" -d "Stop download manager"

# reading-list subcommands
complete -c dt -f -n "__fish_seen_subcommand_from reading-list rl" -a "add" -d "Add record or URL to reading list"

# chat subcommands
complete -c dt -f -n "__fish_seen_subcommand_from chat" -a "ask" -d "Send a chat message"
complete -c dt -f -n "__fish_seen_subcommand_from chat" -a "models" -d "List available chat models"
complete -c dt -f -n "__fish_seen_subcommand_from chat" -a "capabilities" -d "Get model capabilities"

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
