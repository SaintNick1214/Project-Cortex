#compdef cortex

# Cortex CLI completion script for Zsh
# Auto-installed by @cortexmemory/cli

_cortex() {
  local curcontext="$curcontext" state line
  typeset -A opt_args

  # Global options available to all commands
  local -a global_opts=(
    '-d[Deployment name to use]:deployment:_cortex_deployments'
    '--deployment[Deployment name to use]:deployment:_cortex_deployments'
    '--debug[Enable debug output]'
    '-V[Show version]'
    '--version[Show version]'
    '-h[Show help]'
    '--help[Show help]'
  )

  _arguments -C \
    $global_opts \
    '1:command:_cortex_commands' \
    '*::arg:->args'

  case $state in
    args)
      case $words[1] in
        config) _cortex_config ;;
        db) _cortex_db ;;
        convex) _cortex_convex ;;
        users) _cortex_users ;;
        spaces) _cortex_spaces ;;
        conversations|convs) _cortex_conversations ;;
        memory) _cortex_memory ;;
        facts) _cortex_facts ;;
        use) _cortex_use ;;
        start) _cortex_start ;;
        stop) _cortex_stop ;;
        deploy) _cortex_deploy ;;
        update) _cortex_update ;;
        status) _cortex_status ;;
        init) _cortex_init ;;
        dev) _cortex_dev ;;
        completion) _cortex_completion ;;
      esac
      ;;
  esac
}

# Dynamic deployment completion from ~/.cortexrc
_cortex_deployments() {
  local config="$HOME/.cortexrc"
  [[ -f "$config" ]] || return
  local -a deployments
  # Parse deployment names from JSON config
  deployments=(${(f)"$(grep -o '"[^"]*"[[:space:]]*:[[:space:]]*{' "$config" | grep -v '"deployments"' | grep -v '"apps"' | sed 's/"//g' | sed 's/[[:space:]]*:[[:space:]]*{//')"})
  [[ ${#deployments} -gt 0 ]] && _describe 'deployment' deployments
}

# Dynamic app completion from ~/.cortexrc
_cortex_apps() {
  local config="$HOME/.cortexrc"
  [[ -f "$config" ]] || return
  local -a apps
  # This is a simplified parser - apps are in the "apps" section
  apps=(${(f)"$(grep -A1 '"apps"' "$config" | grep -o '"[^"]*"[[:space:]]*:[[:space:]]*{' | grep -v '"apps"' | sed 's/"//g' | sed 's/[[:space:]]*:[[:space:]]*{//')"})
  [[ ${#apps} -gt 0 ]] && _describe 'app' apps
}

# Combined deployment and app names
_cortex_deployments_and_apps() {
  _cortex_deployments
  _cortex_apps
}

# Main commands
_cortex_commands() {
  local -a commands=(
    'start:Start development services (all enabled deployments)'
    'stop:Stop background services'
    'deploy:Deploy schema and functions to Convex'
    'update:Update SDK packages in projects'
    'status:Show Cortex setup status dashboard'
    'config:Manage CLI configuration'
    'init:Initialize a new Cortex Memory project'
    'dev:Start interactive development mode'
    'use:Set current deployment for all commands'
    'db:Database-wide operations'
    'convex:Manage Convex deployments'
    'memory:Manage memories (vector store)'
    'users:Manage user profiles and data'
    'spaces:Manage memory spaces'
    'facts:Manage extracted facts'
    'conversations:Manage conversations'
    'completion:Generate shell completion script'
  )
  _describe 'command' commands
}

# config subcommands
_cortex_config() {
  local -a subcommands=(
    'show:Show current configuration'
    'list:List all deployments in table format'
    'set:Set a configuration value'
    'test:Test connection to Convex deployment'
    'set-path:Set project path for a deployment'
    'enable:Enable a deployment or app'
    'disable:Disable a deployment or app'
    'deployments:List configured deployments'
    'add-deployment:Add a new deployment configuration'
    'remove-deployment:Remove a deployment configuration'
    'set-key:Set or update deploy key for a deployment'
    'set-url:Set or update URL for a deployment'
    'path:Show configuration file paths'
    'reset:Reset configuration to defaults'
  )

  _arguments -C \
    '1:subcommand:->subcmd' \
    '*::arg:->args'

  case $state in
    subcmd)
      _describe 'subcommand' subcommands
      ;;
    args)
      case $words[1] in
        show)
          _arguments '-f[Output format]:format:(table json)'
          ;;
        set)
          _arguments '1:key:(default format confirmDangerous)' '2:value:'
          ;;
        test)
          _arguments '-d[Deployment to test]:deployment:_cortex_deployments'
          ;;
        set-path)
          _arguments '1:deployment:_cortex_deployments' '2:path:_files -/'
          ;;
        enable|disable)
          _arguments '1:name:_cortex_deployments_and_apps'
          ;;
        deployments)
          _arguments '-f[Output format]:format:(table json)'
          ;;
        add-deployment)
          _arguments \
            '1:name:' \
            '-u[Convex deployment URL]:url:' \
            '--url[Convex deployment URL]:url:' \
            '-k[Convex deploy key]:key:' \
            '--key[Convex deploy key]:key:' \
            '--default[Set as default deployment]' \
            '--json-only[Only save to ~/.cortexrc]'
          ;;
        remove-deployment)
          _arguments \
            '1:name:_cortex_deployments' \
            '--json-only[Only remove from ~/.cortexrc]'
          ;;
        set-key)
          _arguments \
            '1:deployment:_cortex_deployments' \
            '-k[Deploy key]:key:' \
            '--key[Deploy key]:key:' \
            '--json-only[Only update ~/.cortexrc]'
          ;;
        set-url)
          _arguments \
            '1:deployment:_cortex_deployments' \
            '-u[Deployment URL]:url:' \
            '--url[Deployment URL]:url:' \
            '--json-only[Only update ~/.cortexrc]'
          ;;
        reset)
          _arguments '-y[Skip confirmation]' '--yes[Skip confirmation]'
          ;;
      esac
      ;;
  esac
}

# db subcommands
_cortex_db() {
  local -a subcommands=(
    'stats:Show database statistics'
    'clear:Clear entire database (DANGEROUS!)'
    'backup:Backup database to a file'
    'restore:Restore database from a backup file'
    'export:Export all data to JSON'
  )

  _arguments -C \
    '1:subcommand:->subcmd' \
    '*::arg:->args'

  case $state in
    subcmd)
      _describe 'subcommand' subcommands
      ;;
    args)
      case $words[1] in
        stats)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)'
          ;;
        clear)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '--keep-users[Keep user profiles]'
          ;;
        backup)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-o[Output file]:file:_files' \
            '--output[Output file]:file:_files'
          ;;
        restore)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '1:backup file:_files'
          ;;
        export)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-o[Output file]:file:_files' \
            '--output[Output file]:file:_files'
          ;;
      esac
      ;;
  esac
}

# convex subcommands
_cortex_convex() {
  local -a subcommands=(
    'status:Check Convex deployment status'
    'deploy:Deploy schema and functions'
    'dev:Start Convex in development mode'
    'logs:View Convex deployment logs'
    'dashboard:Open Convex dashboard in browser'
    'update:Update packages'
    'schema:View schema information'
    'init:Initialize Convex in current project'
    'env:Manage environment variables'
  )

  _arguments -C \
    '1:subcommand:->subcmd' \
    '*::arg:->args'

  case $state in
    subcmd)
      _describe 'subcommand' subcommands
      ;;
    args)
      case $words[1] in
        status|deploy|dev|logs|dashboard|update|schema|init)
          _arguments '-d[Deployment]:deployment:_cortex_deployments'
          ;;
        env)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '1:action:(list set unset)'
          ;;
      esac
      ;;
  esac
}

# users subcommands
_cortex_users() {
  local -a subcommands=(
    'list:List all user profiles'
    'get:Get user profile details'
    'delete:Delete user profile'
    'delete-many:Delete multiple users'
    'export:Export all user data (GDPR)'
    'stats:Show statistics for a user'
    'update:Update user profile data'
    'create:Create a new user profile'
    'exists:Check if a user exists'
  )

  _arguments -C \
    '1:subcommand:->subcmd' \
    '*::arg:->args'

  case $state in
    subcmd)
      _describe 'subcommand' subcommands
      ;;
    args)
      case $words[1] in
        list)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '-l[Limit results]:limit:' \
            '--limit[Limit results]:limit:'
          ;;
        get|stats|exists)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '1:userId:'
          ;;
        delete)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '--gdpr[GDPR cascade deletion]' \
            '1:userId:'
          ;;
        delete-many)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '--gdpr[GDPR cascade deletion]' \
            '*:userIds:'
          ;;
        export)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-o[Output file]:file:_files' \
            '--output[Output file]:file:_files' \
            '1:userId:'
          ;;
        update)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '1:userId:' \
            '--name[User name]:name:' \
            '--email[User email]:email:'
          ;;
        create)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '1:userId:' \
            '--name[User name]:name:' \
            '--email[User email]:email:'
          ;;
      esac
      ;;
  esac
}

# spaces subcommands
_cortex_spaces() {
  local -a subcommands=(
    'list:List all memory spaces'
    'create:Create a new memory space'
    'get:Get memory space details'
    'delete:Delete a memory space'
    'archive:Archive a memory space'
    'reactivate:Reactivate an archived space'
    'stats:Get statistics for a space'
    'participants:List participants in a space'
    'add-participant:Add a participant to a space'
    'remove-participant:Remove a participant'
    'update:Update a memory space'
    'count:Count memory spaces'
    'search:Search memory spaces by name'
  )

  _arguments -C \
    '1:subcommand:->subcmd' \
    '*::arg:->args'

  case $state in
    subcmd)
      _describe 'subcommand' subcommands
      ;;
    args)
      case $words[1] in
        list)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '-l[Limit results]:limit:' \
            '--limit[Limit results]:limit:' \
            '--status[Filter by status]:status:(active archived)'
          ;;
        create)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '1:spaceId:' \
            '--name[Space name]:name:' \
            '--type[Space type]:type:(personal team project custom)'
          ;;
        get|stats|participants|archive|reactivate)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '1:spaceId:'
          ;;
        delete)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '--cascade[Delete all contents]' \
            '1:spaceId:'
          ;;
        add-participant|remove-participant)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '1:spaceId:' \
            '--user[User ID]:userId:'
          ;;
        update)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '1:spaceId:' \
            '--name[New name]:name:' \
            '--status[New status]:status:(active archived)'
          ;;
        count)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '--status[Filter by status]:status:(active archived)'
          ;;
        search)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '1:query:'
          ;;
      esac
      ;;
  esac
}

# conversations subcommands
_cortex_conversations() {
  local -a subcommands=(
    'list:List conversations'
    'get:Get conversation details'
    'delete:Delete a conversation'
    'export:Export a conversation'
    'count:Count conversations'
    'clear:Clear conversations'
    'messages:List messages in a conversation'
  )

  _arguments -C \
    '1:subcommand:->subcmd' \
    '*::arg:->args'

  case $state in
    subcmd)
      _describe 'subcommand' subcommands
      ;;
    args)
      case $words[1] in
        list)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '-l[Limit results]:limit:' \
            '--limit[Limit results]:limit:' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:'
          ;;
        get|messages)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '1:conversationId:'
          ;;
        delete)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '1:conversationId:'
          ;;
        export)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-o[Output file]:file:_files' \
            '--output[Output file]:file:_files' \
            '1:conversationId:'
          ;;
        count)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:'
          ;;
        clear)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:'
          ;;
      esac
      ;;
  esac
}

# memory subcommands
_cortex_memory() {
  local -a subcommands=(
    'list:List memories in a space'
    'search:Search memories by content'
    'get:Get details of a specific memory'
    'delete:Delete a specific memory'
    'clear:Clear multiple memories'
    'export:Export memories to a file'
    'stats:Show memory statistics'
    'archive:Archive a memory'
    'restore:Restore an archived memory'
  )

  _arguments -C \
    '1:subcommand:->subcmd' \
    '*::arg:->args'

  case $state in
    subcmd)
      _describe 'subcommand' subcommands
      ;;
    args)
      case $words[1] in
        list|stats)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:' \
            '-l[Limit results]:limit:' \
            '--limit[Limit results]:limit:'
          ;;
        search)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:' \
            '-l[Limit results]:limit:' \
            '--limit[Limit results]:limit:' \
            '1:query:'
          ;;
        get|archive|restore)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '1:memoryId:'
          ;;
        delete)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '1:memoryId:'
          ;;
        clear)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:'
          ;;
        export)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:' \
            '-o[Output file]:file:_files' \
            '--output[Output file]:file:_files'
          ;;
      esac
      ;;
  esac
}

# facts subcommands
_cortex_facts() {
  local -a subcommands=(
    'list:List facts in a space'
    'search:Search facts by content'
    'get:Get fact details'
    'delete:Delete a fact'
    'export:Export facts to a file'
    'count:Count facts in a space'
    'clear:Clear all facts in a space'
  )

  _arguments -C \
    '1:subcommand:->subcmd' \
    '*::arg:->args'

  case $state in
    subcmd)
      _describe 'subcommand' subcommands
      ;;
    args)
      case $words[1] in
        list)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:' \
            '-l[Limit results]:limit:' \
            '--limit[Limit results]:limit:' \
            '-t[Filter by type]:type:(preference identity knowledge relationship event observation custom)'
          ;;
        search)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:' \
            '1:query:'
          ;;
        get)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-f[Output format]:format:(table json)' \
            '1:factId:'
          ;;
        delete)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '1:factId:'
          ;;
        export)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:' \
            '-o[Output file]:file:_files' \
            '--output[Output file]:file:_files'
          ;;
        count)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:'
          ;;
        clear)
          _arguments \
            '-d[Deployment]:deployment:_cortex_deployments' \
            '-y[Skip confirmation]' \
            '--yes[Skip confirmation]' \
            '-s[Memory space]:space:' \
            '--space[Memory space]:space:'
          ;;
      esac
      ;;
  esac
}

# use command
_cortex_use() {
  _arguments \
    '--clear[Clear current deployment setting]' \
    '1:deployment:_cortex_deployments'
}

# start command
_cortex_start() {
  _arguments \
    '-d[Specific deployment to start]:deployment:_cortex_deployments' \
    '--deployment[Specific deployment to start]:deployment:_cortex_deployments' \
    '--deployments-only[Only start deployments, not apps]' \
    '--apps-only[Only start apps, not deployments]'
}

# stop command
_cortex_stop() {
  _arguments \
    '-d[Specific deployment to stop]:deployment:_cortex_deployments' \
    '--deployment[Specific deployment to stop]:deployment:_cortex_deployments' \
    '--deployments-only[Only stop deployments]' \
    '--apps-only[Only stop apps]'
}

# deploy command
_cortex_deploy() {
  _arguments \
    '-d[Deployment to deploy]:deployment:_cortex_deployments' \
    '--deployment[Deployment to deploy]:deployment:_cortex_deployments' \
    '-y[Auto-accept prompts]' \
    '--yes[Auto-accept prompts]'
}

# update command
_cortex_update() {
  _arguments \
    '-d[Specific deployment to update]:deployment:_cortex_deployments' \
    '--deployment[Specific deployment to update]:deployment:_cortex_deployments' \
    '--deployments-only[Only update deployments]' \
    '--apps-only[Only update apps]' \
    '--dev-path[Path to local SDK for dev mode]:path:_files -/' \
    '--sync-template[Sync template files]' \
    '-y[Auto-accept all updates]' \
    '--yes[Auto-accept all updates]'
}

# status command
_cortex_status() {
  _arguments \
    '-d[Specific deployment to check]:deployment:_cortex_deployments' \
    '--deployment[Specific deployment to check]:deployment:_cortex_deployments' \
    '-f[Output format]:format:(table json)'
}

# init command
_cortex_init() {
  _arguments \
    '1:directory:_files -/' \
    '-t[Template type]:template:(basic vercel-ai-quickstart)' \
    '--template[Template type]:template:(basic vercel-ai-quickstart)' \
    '-n[Project name]:name:' \
    '--name[Project name]:name:' \
    '--skip-install[Skip npm install]' \
    '-y[Accept defaults]' \
    '--yes[Accept defaults]'
}

# dev command
_cortex_dev() {
  _arguments \
    '-d[Deployment to use]:deployment:_cortex_deployments' \
    '--deployment[Deployment to use]:deployment:_cortex_deployments'
}

# completion command
_cortex_completion() {
  _arguments '1:shell:(zsh bash fish)'
}

# Register the completion function
compdef _cortex cortex
