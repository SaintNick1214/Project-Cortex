# Cortex CLI completion script for Fish
# Auto-installed by @cortexmemory/cli

# Helper function to get deployments from config
function __cortex_deployments
  set -l config "$HOME/.cortexrc"
  if test -f "$config"
    grep -o '"[^"]*"[[:space:]]*:[[:space:]]*{' "$config" 2>/dev/null | \
      grep -v '"deployments"' | grep -v '"apps"' | \
      sed 's/"//g' | sed 's/[[:space:]]*:[[:space:]]*{//'
  end
end

# Helper function to get apps from config
function __cortex_apps
  set -l config "$HOME/.cortexrc"
  if test -f "$config"
    grep -A1 '"apps"' "$config" 2>/dev/null | \
      grep -o '"[^"]*"[[:space:]]*:[[:space:]]*{' | grep -v '"apps"' | \
      sed 's/"//g' | sed 's/[[:space:]]*:[[:space:]]*{//'
  end
end

# Config subcommands list (for exclusion checks)
set -l __cortex_config_subcmds show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset

# DB subcommands list
set -l __cortex_db_subcmds stats clear backup restore export

# Convex subcommands list
set -l __cortex_convex_subcmds status deploy dev logs dashboard update schema init env

# Users subcommands list
set -l __cortex_users_subcmds list get delete delete-many export stats update create exists

# Spaces subcommands list
set -l __cortex_spaces_subcmds list create get delete archive reactivate stats participants add-participant remove-participant update count search

# Conversations subcommands list
set -l __cortex_conversations_subcmds list get delete export count clear messages

# Memory subcommands list
set -l __cortex_memory_subcmds list search get delete clear export stats archive restore

# Facts subcommands list
set -l __cortex_facts_subcmds list search get delete export count clear

# Disable file completion by default
complete -c cortex -f

# Top-level commands
complete -c cortex -n '__fish_use_subcommand' -a start -d 'Start development services'
complete -c cortex -n '__fish_use_subcommand' -a stop -d 'Stop background services'
complete -c cortex -n '__fish_use_subcommand' -a deploy -d 'Deploy schema and functions to Convex'
complete -c cortex -n '__fish_use_subcommand' -a update -d 'Update SDK packages in projects'
complete -c cortex -n '__fish_use_subcommand' -a status -d 'Show Cortex setup status dashboard'
complete -c cortex -n '__fish_use_subcommand' -a config -d 'Manage CLI configuration'
complete -c cortex -n '__fish_use_subcommand' -a init -d 'Initialize a new Cortex Memory project'
complete -c cortex -n '__fish_use_subcommand' -a dev -d 'Start interactive development mode'
complete -c cortex -n '__fish_use_subcommand' -a use -d 'Set current deployment for all commands'
complete -c cortex -n '__fish_use_subcommand' -a db -d 'Database-wide operations'
complete -c cortex -n '__fish_use_subcommand' -a convex -d 'Manage Convex deployments'
complete -c cortex -n '__fish_use_subcommand' -a memory -d 'Manage memories (vector store)'
complete -c cortex -n '__fish_use_subcommand' -a users -d 'Manage user profiles and data'
complete -c cortex -n '__fish_use_subcommand' -a spaces -d 'Manage memory spaces'
complete -c cortex -n '__fish_use_subcommand' -a facts -d 'Manage extracted facts'
complete -c cortex -n '__fish_use_subcommand' -a conversations -d 'Manage conversations'
complete -c cortex -n '__fish_use_subcommand' -a completion -d 'Generate shell completion script'

# Global options
complete -c cortex -s d -l deployment -d 'Deployment name to use' -xa '(__cortex_deployments)'
complete -c cortex -l debug -d 'Enable debug output'
complete -c cortex -s V -l version -d 'Show version'
complete -c cortex -s h -l help -d 'Show help'

# config subcommands - only show when no config subcommand has been selected yet
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a show -d 'Show current configuration'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a list -d 'List all deployments'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a set -d 'Set a configuration value'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a test -d 'Test connection'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a set-path -d 'Set project path'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a enable -d 'Enable deployment or app'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a disable -d 'Disable deployment or app'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a deployments -d 'List deployments'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a add-deployment -d 'Add deployment'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a remove-deployment -d 'Remove deployment'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a set-key -d 'Set deploy key'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a set-url -d 'Set deployment URL'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a path -d 'Show config paths'
complete -c cortex -n '__fish_seen_subcommand_from config; and not __fish_seen_subcommand_from show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset' -a reset -d 'Reset configuration'

# config subcommand options
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from show' -s f -l format -xa 'table json' -d 'Output format'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from list' -s f -l format -xa 'table json' -d 'Output format'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from set-path' -xa '(__cortex_deployments)' -d 'Deployment name'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from enable' -xa '(__cortex_deployments) (__cortex_apps)' -d 'Name'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from disable' -xa '(__cortex_deployments) (__cortex_apps)' -d 'Name'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from add-deployment' -s u -l url -d 'Convex URL'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from add-deployment' -s k -l key -d 'Deploy key'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from add-deployment' -l default -d 'Set as default'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from add-deployment' -l json-only -d 'Skip .env.local'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from remove-deployment' -xa '(__cortex_deployments)' -d 'Deployment'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from remove-deployment' -l json-only -d 'Skip .env.local'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from set-key' -xa '(__cortex_deployments)' -d 'Deployment'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from set-key' -l json-only -d 'Skip .env.local'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from set-url' -xa '(__cortex_deployments)' -d 'Deployment'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from set-url' -l json-only -d 'Skip .env.local'
complete -c cortex -n '__fish_seen_subcommand_from config; and __fish_seen_subcommand_from reset' -s y -l yes -d 'Skip confirmation'

# db subcommands - only show when no db subcommand has been selected yet
complete -c cortex -n '__fish_seen_subcommand_from db; and not __fish_seen_subcommand_from stats clear backup restore export' -a stats -d 'Show database statistics'
complete -c cortex -n '__fish_seen_subcommand_from db; and not __fish_seen_subcommand_from stats clear backup restore export' -a clear -d 'Clear entire database'
complete -c cortex -n '__fish_seen_subcommand_from db; and not __fish_seen_subcommand_from stats clear backup restore export' -a backup -d 'Backup database'
complete -c cortex -n '__fish_seen_subcommand_from db; and not __fish_seen_subcommand_from stats clear backup restore export' -a restore -d 'Restore database'
complete -c cortex -n '__fish_seen_subcommand_from db; and not __fish_seen_subcommand_from stats clear backup restore export' -a export -d 'Export all data'

# db subcommand options
complete -c cortex -n '__fish_seen_subcommand_from db; and __fish_seen_subcommand_from stats' -s f -l format -xa 'table json' -d 'Output format'
complete -c cortex -n '__fish_seen_subcommand_from db; and __fish_seen_subcommand_from clear' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from db; and __fish_seen_subcommand_from clear' -l keep-users -d 'Keep user profiles'
complete -c cortex -n '__fish_seen_subcommand_from db; and __fish_seen_subcommand_from backup' -s o -l output -r -d 'Output file'
complete -c cortex -n '__fish_seen_subcommand_from db; and __fish_seen_subcommand_from restore' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from db; and __fish_seen_subcommand_from export' -s o -l output -r -d 'Output file'

# convex subcommands - only show when no convex subcommand has been selected yet
complete -c cortex -n '__fish_seen_subcommand_from convex; and not __fish_seen_subcommand_from status deploy dev logs dashboard update schema init env' -a status -d 'Check deployment status'
complete -c cortex -n '__fish_seen_subcommand_from convex; and not __fish_seen_subcommand_from status deploy dev logs dashboard update schema init env' -a deploy -d 'Deploy schema and functions'
complete -c cortex -n '__fish_seen_subcommand_from convex; and not __fish_seen_subcommand_from status deploy dev logs dashboard update schema init env' -a dev -d 'Start development mode'
complete -c cortex -n '__fish_seen_subcommand_from convex; and not __fish_seen_subcommand_from status deploy dev logs dashboard update schema init env' -a logs -d 'View logs'
complete -c cortex -n '__fish_seen_subcommand_from convex; and not __fish_seen_subcommand_from status deploy dev logs dashboard update schema init env' -a dashboard -d 'Open dashboard'
complete -c cortex -n '__fish_seen_subcommand_from convex; and not __fish_seen_subcommand_from status deploy dev logs dashboard update schema init env' -a update -d 'Update packages'
complete -c cortex -n '__fish_seen_subcommand_from convex; and not __fish_seen_subcommand_from status deploy dev logs dashboard update schema init env' -a schema -d 'View schema'
complete -c cortex -n '__fish_seen_subcommand_from convex; and not __fish_seen_subcommand_from status deploy dev logs dashboard update schema init env' -a init -d 'Initialize Convex'
complete -c cortex -n '__fish_seen_subcommand_from convex; and not __fish_seen_subcommand_from status deploy dev logs dashboard update schema init env' -a env -d 'Manage env variables'

# users subcommands - only show when no users subcommand has been selected yet
complete -c cortex -n '__fish_seen_subcommand_from users; and not __fish_seen_subcommand_from list get delete delete-many export stats update create exists' -a list -d 'List all users'
complete -c cortex -n '__fish_seen_subcommand_from users; and not __fish_seen_subcommand_from list get delete delete-many export stats update create exists' -a get -d 'Get user details'
complete -c cortex -n '__fish_seen_subcommand_from users; and not __fish_seen_subcommand_from list get delete delete-many export stats update create exists' -a delete -d 'Delete user'
complete -c cortex -n '__fish_seen_subcommand_from users; and not __fish_seen_subcommand_from list get delete delete-many export stats update create exists' -a delete-many -d 'Delete multiple users'
complete -c cortex -n '__fish_seen_subcommand_from users; and not __fish_seen_subcommand_from list get delete delete-many export stats update create exists' -a export -d 'Export user data'
complete -c cortex -n '__fish_seen_subcommand_from users; and not __fish_seen_subcommand_from list get delete delete-many export stats update create exists' -a stats -d 'Show user statistics'
complete -c cortex -n '__fish_seen_subcommand_from users; and not __fish_seen_subcommand_from list get delete delete-many export stats update create exists' -a update -d 'Update user profile'
complete -c cortex -n '__fish_seen_subcommand_from users; and not __fish_seen_subcommand_from list get delete delete-many export stats update create exists' -a create -d 'Create user'
complete -c cortex -n '__fish_seen_subcommand_from users; and not __fish_seen_subcommand_from list get delete delete-many export stats update create exists' -a exists -d 'Check if user exists'

# users subcommand options
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from list' -s f -l format -xa 'table json' -d 'Output format'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from list' -s l -l limit -d 'Limit results'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from delete' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from delete' -l gdpr -d 'GDPR cascade deletion'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from delete-many' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from delete-many' -l gdpr -d 'GDPR cascade deletion'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from export' -s o -l output -r -d 'Output file'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from update' -l name -d 'User name'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from update' -l email -d 'User email'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from create' -l name -d 'User name'
complete -c cortex -n '__fish_seen_subcommand_from users; and __fish_seen_subcommand_from create' -l email -d 'User email'

# spaces subcommands - only show when no spaces subcommand has been selected yet
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a list -d 'List memory spaces'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a create -d 'Create memory space'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a get -d 'Get space details'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a delete -d 'Delete space'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a archive -d 'Archive space'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a reactivate -d 'Reactivate space'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a stats -d 'Get space statistics'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a participants -d 'List participants'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a add-participant -d 'Add participant'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a remove-participant -d 'Remove participant'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a update -d 'Update space'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a count -d 'Count spaces'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and not __fish_seen_subcommand_from list create get delete archive reactivate stats participants add-participant remove-participant update count search' -a search -d 'Search spaces'

# spaces subcommand options
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from list' -s f -l format -xa 'table json' -d 'Output format'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from list' -s l -l limit -d 'Limit results'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from list' -l status -xa 'active archived' -d 'Filter by status'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from create' -l name -d 'Space name'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from create' -l type -xa 'personal team project custom' -d 'Space type'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from delete' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from delete' -l cascade -d 'Delete all contents'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from add-participant' -l user -d 'User ID'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from remove-participant' -l user -d 'User ID'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from update' -l name -d 'New name'
complete -c cortex -n '__fish_seen_subcommand_from spaces; and __fish_seen_subcommand_from update' -l status -xa 'active archived' -d 'New status'

# conversations subcommands - only show when no conversations subcommand has been selected yet
complete -c cortex -n '__fish_seen_subcommand_from conversations; and not __fish_seen_subcommand_from list get delete export count clear messages' -a list -d 'List conversations'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and not __fish_seen_subcommand_from list get delete export count clear messages' -a get -d 'Get conversation details'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and not __fish_seen_subcommand_from list get delete export count clear messages' -a delete -d 'Delete conversation'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and not __fish_seen_subcommand_from list get delete export count clear messages' -a export -d 'Export conversation'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and not __fish_seen_subcommand_from list get delete export count clear messages' -a count -d 'Count conversations'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and not __fish_seen_subcommand_from list get delete export count clear messages' -a clear -d 'Clear conversations'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and not __fish_seen_subcommand_from list get delete export count clear messages' -a messages -d 'List messages'

# conversations subcommand options
complete -c cortex -n '__fish_seen_subcommand_from conversations; and __fish_seen_subcommand_from list' -s f -l format -xa 'table json' -d 'Output format'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and __fish_seen_subcommand_from list' -s l -l limit -d 'Limit results'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and __fish_seen_subcommand_from list' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and __fish_seen_subcommand_from delete' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and __fish_seen_subcommand_from export' -s o -l output -r -d 'Output file'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and __fish_seen_subcommand_from count' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and __fish_seen_subcommand_from clear' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from conversations; and __fish_seen_subcommand_from clear' -s s -l space -d 'Memory space'

# memory subcommands - only show when no memory subcommand has been selected yet
complete -c cortex -n '__fish_seen_subcommand_from memory; and not __fish_seen_subcommand_from list search get delete clear export stats archive restore' -a list -d 'List memories'
complete -c cortex -n '__fish_seen_subcommand_from memory; and not __fish_seen_subcommand_from list search get delete clear export stats archive restore' -a search -d 'Search memories'
complete -c cortex -n '__fish_seen_subcommand_from memory; and not __fish_seen_subcommand_from list search get delete clear export stats archive restore' -a get -d 'Get memory details'
complete -c cortex -n '__fish_seen_subcommand_from memory; and not __fish_seen_subcommand_from list search get delete clear export stats archive restore' -a delete -d 'Delete memory'
complete -c cortex -n '__fish_seen_subcommand_from memory; and not __fish_seen_subcommand_from list search get delete clear export stats archive restore' -a clear -d 'Clear memories'
complete -c cortex -n '__fish_seen_subcommand_from memory; and not __fish_seen_subcommand_from list search get delete clear export stats archive restore' -a export -d 'Export memories'
complete -c cortex -n '__fish_seen_subcommand_from memory; and not __fish_seen_subcommand_from list search get delete clear export stats archive restore' -a stats -d 'Show statistics'
complete -c cortex -n '__fish_seen_subcommand_from memory; and not __fish_seen_subcommand_from list search get delete clear export stats archive restore' -a archive -d 'Archive memory'
complete -c cortex -n '__fish_seen_subcommand_from memory; and not __fish_seen_subcommand_from list search get delete clear export stats archive restore' -a restore -d 'Restore memory'

# memory subcommand options
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from list' -s f -l format -xa 'table json' -d 'Output format'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from list' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from list' -s l -l limit -d 'Limit results'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from search' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from search' -s l -l limit -d 'Limit results'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from delete' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from clear' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from clear' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from export' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from export' -s o -l output -r -d 'Output file'
complete -c cortex -n '__fish_seen_subcommand_from memory; and __fish_seen_subcommand_from stats' -s s -l space -d 'Memory space'

# facts subcommands - only show when no facts subcommand has been selected yet
complete -c cortex -n '__fish_seen_subcommand_from facts; and not __fish_seen_subcommand_from list search get delete export count clear' -a list -d 'List facts'
complete -c cortex -n '__fish_seen_subcommand_from facts; and not __fish_seen_subcommand_from list search get delete export count clear' -a search -d 'Search facts'
complete -c cortex -n '__fish_seen_subcommand_from facts; and not __fish_seen_subcommand_from list search get delete export count clear' -a get -d 'Get fact details'
complete -c cortex -n '__fish_seen_subcommand_from facts; and not __fish_seen_subcommand_from list search get delete export count clear' -a delete -d 'Delete fact'
complete -c cortex -n '__fish_seen_subcommand_from facts; and not __fish_seen_subcommand_from list search get delete export count clear' -a export -d 'Export facts'
complete -c cortex -n '__fish_seen_subcommand_from facts; and not __fish_seen_subcommand_from list search get delete export count clear' -a count -d 'Count facts'
complete -c cortex -n '__fish_seen_subcommand_from facts; and not __fish_seen_subcommand_from list search get delete export count clear' -a clear -d 'Clear facts'

# facts subcommand options
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from list' -s f -l format -xa 'table json' -d 'Output format'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from list' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from list' -s l -l limit -d 'Limit results'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from list' -s t -l type -xa 'preference identity knowledge relationship event observation custom' -d 'Fact type'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from search' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from delete' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from export' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from export' -s o -l output -r -d 'Output file'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from count' -s s -l space -d 'Memory space'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from clear' -s y -l yes -d 'Skip confirmation'
complete -c cortex -n '__fish_seen_subcommand_from facts; and __fish_seen_subcommand_from clear' -s s -l space -d 'Memory space'

# start command options
complete -c cortex -n '__fish_seen_subcommand_from start' -l deployments-only -d 'Only start deployments'
complete -c cortex -n '__fish_seen_subcommand_from start' -l apps-only -d 'Only start apps'

# stop command options
complete -c cortex -n '__fish_seen_subcommand_from stop' -l deployments-only -d 'Only stop deployments'
complete -c cortex -n '__fish_seen_subcommand_from stop' -l apps-only -d 'Only stop apps'

# deploy command options
complete -c cortex -n '__fish_seen_subcommand_from deploy' -s y -l yes -d 'Auto-accept prompts'

# update command options
complete -c cortex -n '__fish_seen_subcommand_from update' -l deployments-only -d 'Only update deployments'
complete -c cortex -n '__fish_seen_subcommand_from update' -l apps-only -d 'Only update apps'
complete -c cortex -n '__fish_seen_subcommand_from update' -l dev-path -r -d 'Path to local SDK'
complete -c cortex -n '__fish_seen_subcommand_from update' -l sync-template -d 'Sync template files'
complete -c cortex -n '__fish_seen_subcommand_from update' -s y -l yes -d 'Auto-accept updates'

# status command options
complete -c cortex -n '__fish_seen_subcommand_from status' -s f -l format -xa 'table json' -d 'Output format'

# init command options
complete -c cortex -n '__fish_seen_subcommand_from init' -s t -l template -xa 'basic vercel-ai-quickstart' -d 'Template type'
complete -c cortex -n '__fish_seen_subcommand_from init' -s n -l name -d 'Project name'
complete -c cortex -n '__fish_seen_subcommand_from init' -l skip-install -d 'Skip npm install'
complete -c cortex -n '__fish_seen_subcommand_from init' -s y -l yes -d 'Accept defaults'

# use command options
complete -c cortex -n '__fish_seen_subcommand_from use' -l clear -d 'Clear current deployment'
complete -c cortex -n '__fish_seen_subcommand_from use' -xa '(__cortex_deployments)' -d 'Deployment name'

# completion command options
complete -c cortex -n '__fish_seen_subcommand_from completion' -xa 'zsh bash fish' -d 'Shell type'
