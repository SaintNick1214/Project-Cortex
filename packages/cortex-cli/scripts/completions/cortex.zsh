#compdef cortex

# Cortex CLI 0.38 completion. Install explicitly with cortex completion <shell>.
# Completion reads no configuration and invokes no Cortex commands.

_cortex_children() {
  case "$1" in
    '') printf '%s\n' 'start deploy update status doctor config use init install graph schema templates db backend dev memory users spaces facts conversations convex completion' ;;
    'start') printf '%s\n' '' ;;
    'deploy') printf '%s\n' '' ;;
    'update') printf '%s\n' '' ;;
    'status') printf '%s\n' '' ;;
    'doctor') printf '%s\n' '' ;;
    'config') printf '%s\n' 'show list set test set-path deployments add-deployment remove-deployment set-key set-url path reset' ;;
    'config show') printf '%s\n' '' ;;
    'config list') printf '%s\n' '' ;;
    'config set') printf '%s\n' '' ;;
    'config test') printf '%s\n' '' ;;
    'config set-path') printf '%s\n' '' ;;
    'config deployments') printf '%s\n' '' ;;
    'config add-deployment') printf '%s\n' '' ;;
    'config remove-deployment') printf '%s\n' '' ;;
    'config set-key') printf '%s\n' '' ;;
    'config set-url') printf '%s\n' '' ;;
    'config path') printf '%s\n' '' ;;
    'config reset') printf '%s\n' '' ;;
    'use') printf '%s\n' '' ;;
    'init') printf '%s\n' '' ;;
    'install') printf '%s\n' '' ;;
    'graph') printf '%s\n' 'setup start stop status' ;;
    'graph setup') printf '%s\n' '' ;;
    'graph start') printf '%s\n' '' ;;
    'graph stop') printf '%s\n' '' ;;
    'graph status') printf '%s\n' '' ;;
    'schema') printf '%s\n' 'status sync references migrate' ;;
    'schema status') printf '%s\n' '' ;;
    'schema sync') printf '%s\n' '' ;;
    'schema references') printf '%s\n' '' ;;
    'schema migrate') printf '%s\n' '' ;;
    'templates') printf '%s\n' 'list init update' ;;
    'templates list') printf '%s\n' '' ;;
    'templates init') printf '%s\n' '' ;;
    'templates update') printf '%s\n' '' ;;
    'db') printf '%s\n' 'export import retire-scope runtime-stats export-metadata stats' ;;
    'db export') printf '%s\n' '' ;;
    'db import') printf '%s\n' '' ;;
    'db retire-scope') printf '%s\n' '' ;;
    'db runtime-stats') printf '%s\n' '' ;;
    'db export-metadata') printf '%s\n' '' ;;
    'db stats') printf '%s\n' '' ;;
    'backend') printf '%s\n' 'install register provision configure guide' ;;
    'backend install') printf '%s\n' '' ;;
    'backend register') printf '%s\n' '' ;;
    'backend provision') printf '%s\n' '' ;;
    'backend configure') printf '%s\n' '' ;;
    'backend guide') printf '%s\n' '' ;;
    'dev') printf '%s\n' '' ;;
    'memory') printf '%s\n' 'list search delete clear export stats get archive restore' ;;
    'memory list') printf '%s\n' '' ;;
    'memory search') printf '%s\n' '' ;;
    'memory delete') printf '%s\n' '' ;;
    'memory clear') printf '%s\n' '' ;;
    'memory export') printf '%s\n' '' ;;
    'memory stats') printf '%s\n' '' ;;
    'memory get') printf '%s\n' '' ;;
    'memory archive') printf '%s\n' '' ;;
    'memory restore') printf '%s\n' '' ;;
    'users') printf '%s\n' 'list get delete delete-many export stats update create exists' ;;
    'users list') printf '%s\n' '' ;;
    'users get') printf '%s\n' '' ;;
    'users delete') printf '%s\n' '' ;;
    'users delete-many') printf '%s\n' '' ;;
    'users export') printf '%s\n' '' ;;
    'users stats') printf '%s\n' '' ;;
    'users update') printf '%s\n' '' ;;
    'users create') printf '%s\n' '' ;;
    'users exists') printf '%s\n' '' ;;
    'spaces') printf '%s\n' 'list create get delete archive reactivate stats participants add-participant remove-participant update count search' ;;
    'spaces list') printf '%s\n' '' ;;
    'spaces create') printf '%s\n' '' ;;
    'spaces get') printf '%s\n' '' ;;
    'spaces delete') printf '%s\n' '' ;;
    'spaces archive') printf '%s\n' '' ;;
    'spaces reactivate') printf '%s\n' '' ;;
    'spaces stats') printf '%s\n' '' ;;
    'spaces participants') printf '%s\n' '' ;;
    'spaces add-participant') printf '%s\n' '' ;;
    'spaces remove-participant') printf '%s\n' '' ;;
    'spaces update') printf '%s\n' '' ;;
    'spaces count') printf '%s\n' '' ;;
    'spaces search') printf '%s\n' '' ;;
    'facts') printf '%s\n' 'list search get delete export count clear' ;;
    'facts list') printf '%s\n' '' ;;
    'facts search') printf '%s\n' '' ;;
    'facts get') printf '%s\n' '' ;;
    'facts delete') printf '%s\n' '' ;;
    'facts export') printf '%s\n' '' ;;
    'facts count') printf '%s\n' '' ;;
    'facts clear') printf '%s\n' '' ;;
    'conversations') printf '%s\n' 'list get delete export count clear messages' ;;
    'conversations list') printf '%s\n' '' ;;
    'conversations get') printf '%s\n' '' ;;
    'conversations delete') printf '%s\n' '' ;;
    'conversations export') printf '%s\n' '' ;;
    'conversations count') printf '%s\n' '' ;;
    'conversations clear') printf '%s\n' '' ;;
    'conversations messages') printf '%s\n' '' ;;
    'convex') printf '%s\n' 'deploy update dev status schema dashboard logs env codegen run data export import deployment insights' ;;
    'convex deploy') printf '%s\n' '' ;;
    'convex update') printf '%s\n' '' ;;
    'convex dev') printf '%s\n' '' ;;
    'convex status') printf '%s\n' '' ;;
    'convex schema') printf '%s\n' '' ;;
    'convex dashboard') printf '%s\n' '' ;;
    'convex logs') printf '%s\n' '' ;;
    'convex env') printf '%s\n' 'list get set remove' ;;
    'convex env list') printf '%s\n' '' ;;
    'convex env get') printf '%s\n' '' ;;
    'convex env set') printf '%s\n' '' ;;
    'convex env remove') printf '%s\n' '' ;;
    'convex codegen') printf '%s\n' '' ;;
    'convex run') printf '%s\n' '' ;;
    'convex data') printf '%s\n' '' ;;
    'convex export') printf '%s\n' '' ;;
    'convex import') printf '%s\n' '' ;;
    'convex deployment') printf '%s\n' 'select' ;;
    'convex deployment select') printf '%s\n' '' ;;
    'convex insights') printf '%s\n' '' ;;
    'completion') printf '%s\n' '' ;;
  esac
}

_cortex_options() {
  case "$1" in
    '') printf '%s\n' '-h --help -V --version -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'start') printf '%s\n' '-h --help -d --deployment --project --env-file -l --local --prod --once --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'deploy') printf '%s\n' '-h --help -d --deployment --project --env-file -l --local -p --prod --push -y --yes --dry-run --sync --skip-sync -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'update') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --sdk-version --convex-version --sdk-package --dry-run --sync --skip-sync -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'status') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --check -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'doctor') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --json --check --graph -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config show') printf '%s\n' '-h --help -f --format -d --deployment --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config list') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config set') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config test') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config set-path') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config deployments') printf '%s\n' '-h --help -f --format -d --deployment --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config add-deployment') printf '%s\n' '-h --help -u --url -k --key --default --json-only -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config remove-deployment') printf '%s\n' '-h --help -y --yes --json-only -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config set-key') printf '%s\n' '-h --help -k --key --json-only -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config set-url') printf '%s\n' '-h --help -u --url --json-only -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config path') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config reset') printf '%s\n' '-h --help -y --yes -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'use') printf '%s\n' '-h --help --clear -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'init') printf '%s\n' '-h --help --graph --skip-graph --graph-mode --graph-uri --graph-bolt-port --graph-http-port --graph-credentials --local --cloud --no-install --no-deploy --sdk-package --dry-run --overwrite -y --yes -t --template --templates-package --catalog-version --template-version -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'install') printf '%s\n' '-h --help --graph --skip-graph --graph-mode --graph-uri --graph-bolt-port --graph-http-port --graph-credentials --local --cloud --no-install --no-deploy --sdk-package --dry-run --overwrite -y --yes -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph setup') printf '%s\n' '-h --help --dry-run -y --yes --graph --skip-graph --graph-mode --graph-uri --graph-bolt-port --graph-http-port --graph-credentials -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph start') printf '%s\n' '-h --help --dry-run -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph stop') printf '%s\n' '-h --help --dry-run -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph status') printf '%s\n' '-h --help --dry-run -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema status') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema sync') printf '%s\n' '-h --help --dry-run --overwrite -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema references') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema migrate') printf '%s\n' '-h --help -d --deployment -f --format --quiet --dry-run --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'templates') printf '%s\n' '-h --help --catalog-version --templates-package -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'templates list') printf '%s\n' '-h --help --catalog-version --templates-package -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'templates init') printf '%s\n' '-h --help --catalog-version --templates-package --template --template-version --sdk-package --provider-package --graph --skip-graph --graph-mode --graph-uri --graph-bolt-port --graph-http-port --graph-credentials --yes --no-install --dry-run -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'templates update') printf '%s\n' '-h --help --catalog-version --templates-package --to --recover --yes --sdk-package --provider-package --dry-run --no-install -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db export') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod -o --output --include-file-storage --metadata -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db import') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --append --replace --replace-all -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db retire-scope') printf '%s\n' '-h --help --target --project --management-token-env --deploy-key-env --tenant-id --memory-space-id -y --yes -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --graph-sync' ;;
    'db runtime-stats') printf '%s\n' '-h --help --target --project --management-token-env --deploy-key-env -f --format -d --deployment --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db export-metadata') printf '%s\n' '-h --help -o --output -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db stats') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend install') printf '%s\n' '-h --help --sdk-path --jwt-provider --plan -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend register') printf '%s\n' '-h --help --target --management-token-env --deploy-key-env -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend provision') printf '%s\n' '-h --help --target --management-token-env --deploy-key-env --principal -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend configure') printf '%s\n' '-h --help --url --http-url --agent-id --agent-version --space -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend guide') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'dev') printf '%s\n' '-h --help -d --deployment --project --env-file -l --local --prod --once --sync --skip-sync -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory list') printf '%s\n' '-h --help -d --deployment -s --space -u --user -l --limit -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory search') printf '%s\n' '-h --help -d --deployment -s --space -u --user -l --limit -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory delete') printf '%s\n' '-h --help -d --deployment -s --space --cascade -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory clear') printf '%s\n' '-h --help -d --deployment -s --space -u --user --source -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory export') printf '%s\n' '-h --help -d --deployment -s --space -u --user -o --output --include-facts -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory stats') printf '%s\n' '-h --help -d --deployment -s --space -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory get') printf '%s\n' '-h --help -d --deployment -s --space --include-conversation -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory archive') printf '%s\n' '-h --help -d --deployment -s --space -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory restore') printf '%s\n' '-h --help -d --deployment -s --space -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users list') printf '%s\n' '-h --help -d --deployment -l --limit --offset -f --format --no-stats --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users get') printf '%s\n' '-h --help -d --deployment -f --format --include-history --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users delete') printf '%s\n' '-h --help -d --deployment --cascade --tenant --dry-run --verify --no-verify -y --yes -f --format --quiet --debug --scope-user --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users delete-many') printf '%s\n' '-h --help -d --deployment --cascade --tenant --dry-run --verify --no-verify -y --yes -f --format --quiet --debug --scope-user --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users export') printf '%s\n' '-h --help -d --deployment -o --output --tenant --format --quiet --debug --scope-user --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users stats') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users update') printf '%s\n' '-h --help -d --deployment --data -f --file --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users create') printf '%s\n' '-h --help -d --deployment --data -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users exists') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces list') printf '%s\n' '-h --help -d --deployment -t --type -s --status -l --limit --offset -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces create') printf '%s\n' '-h --help -d --deployment -t --type -n --name -m --metadata -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces get') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces delete') printf '%s\n' '-h --help -d --deployment --cascade --tenant --dry-run --verify --no-verify -r --reason -y --yes -f --format --quiet --debug --scope-user --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces archive') printf '%s\n' '-h --help -d --deployment -r --reason -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces reactivate') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces stats') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces participants') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces add-participant') printf '%s\n' '-h --help -d --deployment -i --id -t --type -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces remove-participant') printf '%s\n' '-h --help -d --deployment -i --id -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces update') printf '%s\n' '-h --help -d --deployment -n --name -s --status -m --metadata -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces count') printf '%s\n' '-h --help -d --deployment -t --type -s --status -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces search') printf '%s\n' '-h --help -d --deployment -t --type -s --status -l --limit -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts list') printf '%s\n' '-h --help -d --deployment -s --space -t --type -u --user -l --limit -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts search') printf '%s\n' '-h --help -d --deployment -s --space -t --type -l --limit -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts get') printf '%s\n' '-h --help -d --deployment -s --space -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts delete') printf '%s\n' '-h --help -d --deployment -s --space -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts export') printf '%s\n' '-h --help -d --deployment -s --space -t --type -o --output -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts count') printf '%s\n' '-h --help -d --deployment -s --space -t --type -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts clear') printf '%s\n' '-h --help -d --deployment -s --space -t --type -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations list') printf '%s\n' '-h --help -d --deployment -s --space -u --user -t --type -l --limit -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations get') printf '%s\n' '-h --help -d --deployment -m --messages -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations delete') printf '%s\n' '-h --help -d --deployment -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations export') printf '%s\n' '-h --help -d --deployment -o --output -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations count') printf '%s\n' '-h --help -d --deployment -s --space -u --user -t --type -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations clear') printf '%s\n' '-h --help -d --deployment -s --space -u --user -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations messages') printf '%s\n' '-h --help -d --deployment -l --limit -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex deploy') printf '%s\n' '-h --help -d --deployment --project --env-file -l --local -p --prod --push -y --yes --dry-run --sync --skip-sync -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex update') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --sdk-version --convex-version --sdk-package --dry-run --sync --skip-sync -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex dev') printf '%s\n' '-h --help -d --deployment --project --env-file -l --local --prod --once --sync --skip-sync -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex status') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --check -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex schema') printf '%s\n' '-h --help --project -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex dashboard') printf '%s\n' '-h --help -d --deployment --project --env-file -l --local -p --prod --print-url -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex logs') printf '%s\n' '-h --help -d --deployment --project --env-file -l --local -p --prod -n --lines -t --tail --jsonl --success -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env') printf '%s\n' '-h --help -d --deployment --project --env-file --local -p --prod -l --list -s --set -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env list') printf '%s\n' '-h --help --values -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env get') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env set') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env remove') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex codegen') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --dry-run -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex run') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex data') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --limit --order -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex export') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod -o --output --include-file-storage --metadata -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex import') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --append --replace --replace-all -y --yes -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex deployment') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex deployment select') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex insights') printf '%s\n' '-h --help -d --deployment --project --env-file --local --prod --details --json -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'completion') printf '%s\n' '-h --help -d --deployment -f --format --quiet --debug --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
  esac
}

_cortex_value_options() {
  case "$1" in
    '') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'start') printf '%s\n' '-d --deployment --project --env-file --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'deploy') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'update') printf '%s\n' '-d --deployment --project --env-file --sdk-version --convex-version --sdk-package -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'status') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'doctor') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config show') printf '%s\n' '-f --format -d --deployment --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config list') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config set') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config test') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config set-path') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config deployments') printf '%s\n' '-f --format -d --deployment --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config add-deployment') printf '%s\n' '-u --url -k --key -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config remove-deployment') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config set-key') printf '%s\n' '-k --key -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config set-url') printf '%s\n' '-u --url -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config path') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'config reset') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'use') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'init') printf '%s\n' '--graph --graph-mode --graph-uri --graph-bolt-port --graph-http-port --graph-credentials --sdk-package -t --template --templates-package --catalog-version --template-version -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'install') printf '%s\n' '--graph --graph-mode --graph-uri --graph-bolt-port --graph-http-port --graph-credentials --sdk-package -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph setup') printf '%s\n' '--graph --graph-mode --graph-uri --graph-bolt-port --graph-http-port --graph-credentials -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph start') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph stop') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'graph status') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema status') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema sync') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema references') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'schema migrate') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'templates') printf '%s\n' '--catalog-version --templates-package -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'templates list') printf '%s\n' '--catalog-version --templates-package -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'templates init') printf '%s\n' '--catalog-version --templates-package --template --template-version --sdk-package --provider-package --graph --graph-mode --graph-uri --graph-bolt-port --graph-http-port --graph-credentials -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'templates update') printf '%s\n' '--catalog-version --templates-package --to --sdk-package --provider-package -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db export') printf '%s\n' '-d --deployment --project --env-file -o --output -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db import') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db retire-scope') printf '%s\n' '--target --project --management-token-env --deploy-key-env --tenant-id --memory-space-id -d --deployment -f --format --scope-user --tenant --token-env --token-file --graph-sync' ;;
    'db runtime-stats') printf '%s\n' '--target --project --management-token-env --deploy-key-env -f --format -d --deployment --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db export-metadata') printf '%s\n' '-o --output -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'db stats') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend install') printf '%s\n' '--sdk-path --jwt-provider -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend register') printf '%s\n' '--target --management-token-env --deploy-key-env -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend provision') printf '%s\n' '--target --management-token-env --deploy-key-env --principal -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend configure') printf '%s\n' '--url --http-url --agent-id --agent-version --space -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'backend guide') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'dev') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory list') printf '%s\n' '-d --deployment -s --space -u --user -l --limit -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory search') printf '%s\n' '-d --deployment -s --space -u --user -l --limit -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory delete') printf '%s\n' '-d --deployment -s --space -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory clear') printf '%s\n' '-d --deployment -s --space -u --user --source -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory export') printf '%s\n' '-d --deployment -s --space -u --user -o --output -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory stats') printf '%s\n' '-d --deployment -s --space -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory get') printf '%s\n' '-d --deployment -s --space -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory archive') printf '%s\n' '-d --deployment -s --space -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'memory restore') printf '%s\n' '-d --deployment -s --space -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users list') printf '%s\n' '-d --deployment -l --limit --offset -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users get') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users delete') printf '%s\n' '-d --deployment --tenant -f --format --scope-user --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users delete-many') printf '%s\n' '-d --deployment --tenant -f --format --scope-user --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users export') printf '%s\n' '-d --deployment -o --output --tenant --format --scope-user --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users stats') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users update') printf '%s\n' '-d --deployment --data -f --file --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users create') printf '%s\n' '-d --deployment --data -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'users exists') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces list') printf '%s\n' '-d --deployment -t --type -s --status -l --limit --offset -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces create') printf '%s\n' '-d --deployment -t --type -n --name -m --metadata -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces get') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces delete') printf '%s\n' '-d --deployment --tenant -r --reason -f --format --scope-user --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces archive') printf '%s\n' '-d --deployment -r --reason -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces reactivate') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces stats') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces participants') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces add-participant') printf '%s\n' '-d --deployment -i --id -t --type -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces remove-participant') printf '%s\n' '-d --deployment -i --id -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces update') printf '%s\n' '-d --deployment -n --name -s --status -m --metadata -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces count') printf '%s\n' '-d --deployment -t --type -s --status -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'spaces search') printf '%s\n' '-d --deployment -t --type -s --status -l --limit -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts list') printf '%s\n' '-d --deployment -s --space -t --type -u --user -l --limit -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts search') printf '%s\n' '-d --deployment -s --space -t --type -l --limit -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts get') printf '%s\n' '-d --deployment -s --space -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts delete') printf '%s\n' '-d --deployment -s --space -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts export') printf '%s\n' '-d --deployment -s --space -t --type -o --output -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts count') printf '%s\n' '-d --deployment -s --space -t --type -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'facts clear') printf '%s\n' '-d --deployment -s --space -t --type -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations list') printf '%s\n' '-d --deployment -s --space -u --user -t --type -l --limit -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations get') printf '%s\n' '-d --deployment -m --messages -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations delete') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations export') printf '%s\n' '-d --deployment -o --output -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations count') printf '%s\n' '-d --deployment -s --space -u --user -t --type -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations clear') printf '%s\n' '-d --deployment -s --space -u --user -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'conversations messages') printf '%s\n' '-d --deployment -l --limit -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex deploy') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex update') printf '%s\n' '-d --deployment --project --env-file --sdk-version --convex-version --sdk-package -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex dev') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex status') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex schema') printf '%s\n' '--project -d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex dashboard') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex logs') printf '%s\n' '-d --deployment --project --env-file -n --lines -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env') printf '%s\n' '-d --deployment --project --env-file -s --set -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env list') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env get') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env set') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex env remove') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex codegen') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex run') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex data') printf '%s\n' '-d --deployment --project --env-file --limit --order -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex export') printf '%s\n' '-d --deployment --project --env-file -o --output -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex import') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex deployment') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex deployment select') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'convex insights') printf '%s\n' '-d --deployment --project --env-file -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
    'completion') printf '%s\n' '-d --deployment -f --format --scope-user --tenant --token-env --token-file --tenant-id --memory-space-id --graph-sync' ;;
  esac
}

_cortex_values_for() {
  case "$1" in
    '|-d'|'|--deployment'|'|--scope-user'|'|--tenant'|'start|-d'|'start|--deployment'|'start|--scope-user'|'start|--tenant'|'deploy|-d'|'deploy|--deployment'|'deploy|--scope-user'|'deploy|--tenant'|'update|-d'|'update|--deployment'|'update|--sdk-version'|'update|--convex-version'|'update|--scope-user'|'update|--tenant'|'status|-d'|'status|--deployment'|'status|--scope-user'|'status|--tenant'|'doctor|-d'|'doctor|--deployment'|'doctor|--scope-user'|'doctor|--tenant'|'config|-d'|'config|--deployment'|'config|--scope-user'|'config|--tenant'|'config show|-d'|'config show|--deployment'|'config show|--scope-user'|'config show|--tenant'|'config list|-d'|'config list|--deployment'|'config list|--scope-user'|'config list|--tenant'|'config set|-d'|'config set|--deployment'|'config set|--scope-user'|'config set|--tenant'|'config test|-d'|'config test|--deployment'|'config test|--scope-user'|'config test|--tenant'|'config set-path|-d'|'config set-path|--deployment'|'config set-path|--scope-user'|'config set-path|--tenant'|'config deployments|-d'|'config deployments|--deployment'|'config deployments|--scope-user'|'config deployments|--tenant'|'config add-deployment|-u'|'config add-deployment|--url'|'config add-deployment|-k'|'config add-deployment|--key'|'config add-deployment|-d'|'config add-deployment|--deployment'|'config add-deployment|--scope-user'|'config add-deployment|--tenant'|'config remove-deployment|-d'|'config remove-deployment|--deployment'|'config remove-deployment|--scope-user'|'config remove-deployment|--tenant'|'config set-key|-k'|'config set-key|--key'|'config set-key|-d'|'config set-key|--deployment'|'config set-key|--scope-user'|'config set-key|--tenant'|'config set-url|-u'|'config set-url|--url'|'config set-url|-d'|'config set-url|--deployment'|'config set-url|--scope-user'|'config set-url|--tenant'|'config path|-d'|'config path|--deployment'|'config path|--scope-user'|'config path|--tenant'|'config reset|-d'|'config reset|--deployment'|'config reset|--scope-user'|'config reset|--tenant'|'use|-d'|'use|--deployment'|'use|--scope-user'|'use|--tenant'|'init|--graph-uri'|'init|--graph-bolt-port'|'init|--graph-http-port'|'init|--catalog-version'|'init|--template-version'|'init|-d'|'init|--deployment'|'init|--scope-user'|'init|--tenant'|'install|--graph-uri'|'install|--graph-bolt-port'|'install|--graph-http-port'|'install|-d'|'install|--deployment'|'install|--scope-user'|'install|--tenant'|'graph|-d'|'graph|--deployment'|'graph|--scope-user'|'graph|--tenant'|'graph setup|--graph-uri'|'graph setup|--graph-bolt-port'|'graph setup|--graph-http-port'|'graph setup|-d'|'graph setup|--deployment'|'graph setup|--scope-user'|'graph setup|--tenant'|'graph start|-d'|'graph start|--deployment'|'graph start|--scope-user'|'graph start|--tenant'|'graph stop|-d'|'graph stop|--deployment'|'graph stop|--scope-user'|'graph stop|--tenant'|'graph status|-d'|'graph status|--deployment'|'graph status|--scope-user'|'graph status|--tenant'|'schema|-d'|'schema|--deployment'|'schema|--scope-user'|'schema|--tenant'|'schema status|-d'|'schema status|--deployment'|'schema status|--scope-user'|'schema status|--tenant'|'schema sync|-d'|'schema sync|--deployment'|'schema sync|--scope-user'|'schema sync|--tenant'|'schema references|-d'|'schema references|--deployment'|'schema references|--scope-user'|'schema references|--tenant'|'schema migrate|-d'|'schema migrate|--deployment'|'schema migrate|--scope-user'|'schema migrate|--tenant'|'templates|--catalog-version'|'templates|-d'|'templates|--deployment'|'templates|--scope-user'|'templates|--tenant'|'templates list|--catalog-version'|'templates list|-d'|'templates list|--deployment'|'templates list|--scope-user'|'templates list|--tenant'|'templates init|--catalog-version'|'templates init|--template-version'|'templates init|--graph-uri'|'templates init|--graph-bolt-port'|'templates init|--graph-http-port'|'templates init|-d'|'templates init|--deployment'|'templates init|--scope-user'|'templates init|--tenant'|'templates update|--catalog-version'|'templates update|--to'|'templates update|-d'|'templates update|--deployment'|'templates update|--scope-user'|'templates update|--tenant'|'db|-d'|'db|--deployment'|'db|--scope-user'|'db|--tenant'|'db export|-d'|'db export|--deployment'|'db export|--scope-user'|'db export|--tenant'|'db import|-d'|'db import|--deployment'|'db import|--scope-user'|'db import|--tenant'|'db stats|-d'|'db stats|--deployment'|'db stats|--scope-user'|'db stats|--tenant'|'dev|-d'|'dev|--deployment'|'dev|--scope-user'|'dev|--tenant'|'memory|-d'|'memory|--deployment'|'memory|--scope-user'|'memory|--tenant'|'memory list|-d'|'memory list|--deployment'|'memory list|-s'|'memory list|--space'|'memory list|-u'|'memory list|--user'|'memory list|-l'|'memory list|--limit'|'memory list|--scope-user'|'memory list|--tenant'|'memory search|-d'|'memory search|--deployment'|'memory search|-s'|'memory search|--space'|'memory search|-u'|'memory search|--user'|'memory search|-l'|'memory search|--limit'|'memory search|--scope-user'|'memory search|--tenant'|'memory delete|-d'|'memory delete|--deployment'|'memory delete|-s'|'memory delete|--space'|'memory delete|--scope-user'|'memory delete|--tenant'|'memory clear|-d'|'memory clear|--deployment'|'memory clear|-s'|'memory clear|--space'|'memory clear|-u'|'memory clear|--user'|'memory clear|--source'|'memory clear|--scope-user'|'memory clear|--tenant'|'memory export|-d'|'memory export|--deployment'|'memory export|-s'|'memory export|--space'|'memory export|-u'|'memory export|--user'|'memory export|--scope-user'|'memory export|--tenant'|'memory stats|-d'|'memory stats|--deployment'|'memory stats|-s'|'memory stats|--space'|'memory stats|--scope-user'|'memory stats|--tenant'|'memory get|-d'|'memory get|--deployment'|'memory get|-s'|'memory get|--space'|'memory get|--scope-user'|'memory get|--tenant'|'memory archive|-d'|'memory archive|--deployment'|'memory archive|-s'|'memory archive|--space'|'memory archive|--scope-user'|'memory archive|--tenant'|'memory restore|-d'|'memory restore|--deployment'|'memory restore|-s'|'memory restore|--space'|'memory restore|--scope-user'|'memory restore|--tenant'|'users|-d'|'users|--deployment'|'users|--scope-user'|'users|--tenant'|'users list|-d'|'users list|--deployment'|'users list|-l'|'users list|--limit'|'users list|--offset'|'users list|--scope-user'|'users list|--tenant'|'users get|-d'|'users get|--deployment'|'users get|--scope-user'|'users get|--tenant'|'users delete|-d'|'users delete|--deployment'|'users delete|--tenant'|'users delete|--scope-user'|'users delete-many|-d'|'users delete-many|--deployment'|'users delete-many|--tenant'|'users delete-many|--scope-user'|'users export|-d'|'users export|--deployment'|'users export|--tenant'|'users export|--scope-user'|'users stats|-d'|'users stats|--deployment'|'users stats|--scope-user'|'users stats|--tenant'|'users update|-d'|'users update|--deployment'|'users update|--data'|'users update|--scope-user'|'users update|--tenant'|'users create|-d'|'users create|--deployment'|'users create|--data'|'users create|--scope-user'|'users create|--tenant'|'users exists|-d'|'users exists|--deployment'|'users exists|--scope-user'|'users exists|--tenant'|'spaces|-d'|'spaces|--deployment'|'spaces|--scope-user'|'spaces|--tenant'|'spaces list|-d'|'spaces list|--deployment'|'spaces list|-l'|'spaces list|--limit'|'spaces list|--offset'|'spaces list|--scope-user'|'spaces list|--tenant'|'spaces create|-d'|'spaces create|--deployment'|'spaces create|-n'|'spaces create|--name'|'spaces create|-m'|'spaces create|--metadata'|'spaces create|--scope-user'|'spaces create|--tenant'|'spaces get|-d'|'spaces get|--deployment'|'spaces get|--scope-user'|'spaces get|--tenant'|'spaces delete|-d'|'spaces delete|--deployment'|'spaces delete|--tenant'|'spaces delete|-r'|'spaces delete|--reason'|'spaces delete|--scope-user'|'spaces archive|-d'|'spaces archive|--deployment'|'spaces archive|-r'|'spaces archive|--reason'|'spaces archive|--scope-user'|'spaces archive|--tenant'|'spaces reactivate|-d'|'spaces reactivate|--deployment'|'spaces reactivate|--scope-user'|'spaces reactivate|--tenant'|'spaces stats|-d'|'spaces stats|--deployment'|'spaces stats|--scope-user'|'spaces stats|--tenant'|'spaces participants|-d'|'spaces participants|--deployment'|'spaces participants|--scope-user'|'spaces participants|--tenant'|'spaces add-participant|-d'|'spaces add-participant|--deployment'|'spaces add-participant|-i'|'spaces add-participant|--id'|'spaces add-participant|-t'|'spaces add-participant|--type'|'spaces add-participant|--scope-user'|'spaces add-participant|--tenant'|'spaces remove-participant|-d'|'spaces remove-participant|--deployment'|'spaces remove-participant|-i'|'spaces remove-participant|--id'|'spaces remove-participant|--scope-user'|'spaces remove-participant|--tenant'|'spaces update|-d'|'spaces update|--deployment'|'spaces update|-n'|'spaces update|--name'|'spaces update|-m'|'spaces update|--metadata'|'spaces update|--scope-user'|'spaces update|--tenant'|'spaces count|-d'|'spaces count|--deployment'|'spaces count|--scope-user'|'spaces count|--tenant'|'spaces search|-d'|'spaces search|--deployment'|'spaces search|-l'|'spaces search|--limit'|'spaces search|--scope-user'|'spaces search|--tenant'|'facts|-d'|'facts|--deployment'|'facts|--scope-user'|'facts|--tenant'|'facts list|-d'|'facts list|--deployment'|'facts list|-s'|'facts list|--space'|'facts list|-t'|'facts list|--type'|'facts list|-u'|'facts list|--user'|'facts list|-l'|'facts list|--limit'|'facts list|--scope-user'|'facts list|--tenant'|'facts search|-d'|'facts search|--deployment'|'facts search|-s'|'facts search|--space'|'facts search|-t'|'facts search|--type'|'facts search|-l'|'facts search|--limit'|'facts search|--scope-user'|'facts search|--tenant'|'facts get|-d'|'facts get|--deployment'|'facts get|-s'|'facts get|--space'|'facts get|--scope-user'|'facts get|--tenant'|'facts delete|-d'|'facts delete|--deployment'|'facts delete|-s'|'facts delete|--space'|'facts delete|--scope-user'|'facts delete|--tenant'|'facts export|-d'|'facts export|--deployment'|'facts export|-s'|'facts export|--space'|'facts export|-t'|'facts export|--type'|'facts export|--scope-user'|'facts export|--tenant'|'facts count|-d'|'facts count|--deployment'|'facts count|-s'|'facts count|--space'|'facts count|-t'|'facts count|--type'|'facts count|--scope-user'|'facts count|--tenant'|'facts clear|-d'|'facts clear|--deployment'|'facts clear|-s'|'facts clear|--space'|'facts clear|-t'|'facts clear|--type'|'facts clear|--scope-user'|'facts clear|--tenant'|'conversations|-d'|'conversations|--deployment'|'conversations|--scope-user'|'conversations|--tenant'|'conversations list|-d'|'conversations list|--deployment'|'conversations list|-s'|'conversations list|--space'|'conversations list|-u'|'conversations list|--user'|'conversations list|-t'|'conversations list|--type'|'conversations list|-l'|'conversations list|--limit'|'conversations list|--scope-user'|'conversations list|--tenant'|'conversations get|-d'|'conversations get|--deployment'|'conversations get|-m'|'conversations get|--messages'|'conversations get|--scope-user'|'conversations get|--tenant'|'conversations delete|-d'|'conversations delete|--deployment'|'conversations delete|--scope-user'|'conversations delete|--tenant'|'conversations export|-d'|'conversations export|--deployment'|'conversations export|--scope-user'|'conversations export|--tenant'|'conversations count|-d'|'conversations count|--deployment'|'conversations count|-s'|'conversations count|--space'|'conversations count|-u'|'conversations count|--user'|'conversations count|-t'|'conversations count|--type'|'conversations count|--scope-user'|'conversations count|--tenant'|'conversations clear|-d'|'conversations clear|--deployment'|'conversations clear|-s'|'conversations clear|--space'|'conversations clear|-u'|'conversations clear|--user'|'conversations clear|--scope-user'|'conversations clear|--tenant'|'conversations messages|-d'|'conversations messages|--deployment'|'conversations messages|-l'|'conversations messages|--limit'|'conversations messages|--scope-user'|'conversations messages|--tenant'|'convex|-d'|'convex|--deployment'|'convex|--scope-user'|'convex|--tenant'|'convex deploy|-d'|'convex deploy|--deployment'|'convex deploy|--scope-user'|'convex deploy|--tenant'|'convex update|-d'|'convex update|--deployment'|'convex update|--sdk-version'|'convex update|--convex-version'|'convex update|--scope-user'|'convex update|--tenant'|'convex dev|-d'|'convex dev|--deployment'|'convex dev|--scope-user'|'convex dev|--tenant'|'convex status|-d'|'convex status|--deployment'|'convex status|--scope-user'|'convex status|--tenant'|'convex schema|-d'|'convex schema|--deployment'|'convex schema|--scope-user'|'convex schema|--tenant'|'convex dashboard|-d'|'convex dashboard|--deployment'|'convex dashboard|--scope-user'|'convex dashboard|--tenant'|'convex logs|-d'|'convex logs|--deployment'|'convex logs|-n'|'convex logs|--lines'|'convex logs|--scope-user'|'convex logs|--tenant'|'convex env|-d'|'convex env|--deployment'|'convex env|-s'|'convex env|--set'|'convex env|--scope-user'|'convex env|--tenant'|'convex env list|-d'|'convex env list|--deployment'|'convex env list|--scope-user'|'convex env list|--tenant'|'convex env get|-d'|'convex env get|--deployment'|'convex env get|--scope-user'|'convex env get|--tenant'|'convex env set|-d'|'convex env set|--deployment'|'convex env set|--scope-user'|'convex env set|--tenant'|'convex env remove|-d'|'convex env remove|--deployment'|'convex env remove|--scope-user'|'convex env remove|--tenant'|'convex codegen|-d'|'convex codegen|--deployment'|'convex codegen|--scope-user'|'convex codegen|--tenant'|'convex run|-d'|'convex run|--deployment'|'convex run|--scope-user'|'convex run|--tenant'|'convex data|-d'|'convex data|--deployment'|'convex data|--limit'|'convex data|--scope-user'|'convex data|--tenant'|'convex export|-d'|'convex export|--deployment'|'convex export|--scope-user'|'convex export|--tenant'|'convex import|-d'|'convex import|--deployment'|'convex import|--scope-user'|'convex import|--tenant'|'convex deployment|-d'|'convex deployment|--deployment'|'convex deployment|--scope-user'|'convex deployment|--tenant'|'convex deployment select|-d'|'convex deployment select|--deployment'|'convex deployment select|--scope-user'|'convex deployment select|--tenant'|'convex insights|-d'|'convex insights|--deployment'|'convex insights|--scope-user'|'convex insights|--tenant'|'completion|-d'|'completion|--deployment'|'completion|--scope-user'|'completion|--tenant') printf '%s\n' '' ;;
    '|-f'|'|--format'|'start|--format'|'deploy|-f'|'deploy|--format'|'update|-f'|'update|--format'|'doctor|-f'|'doctor|--format'|'config|-f'|'config|--format'|'config show|-f'|'config show|--format'|'config list|-f'|'config list|--format'|'config set|-f'|'config set|--format'|'config test|-f'|'config test|--format'|'config set-path|-f'|'config set-path|--format'|'config deployments|-f'|'config deployments|--format'|'config add-deployment|-f'|'config add-deployment|--format'|'config remove-deployment|-f'|'config remove-deployment|--format'|'config set-key|-f'|'config set-key|--format'|'config set-url|-f'|'config set-url|--format'|'config path|-f'|'config path|--format'|'config reset|-f'|'config reset|--format'|'use|-f'|'use|--format'|'init|-f'|'init|--format'|'install|-f'|'install|--format'|'graph|-f'|'graph|--format'|'graph setup|-f'|'graph setup|--format'|'graph start|-f'|'graph start|--format'|'graph stop|-f'|'graph stop|--format'|'graph status|-f'|'graph status|--format'|'schema|-f'|'schema|--format'|'schema status|-f'|'schema status|--format'|'schema sync|-f'|'schema sync|--format'|'schema references|-f'|'schema references|--format'|'schema migrate|-f'|'schema migrate|--format'|'templates|-f'|'templates|--format'|'templates list|-f'|'templates list|--format'|'templates init|-f'|'templates init|--format'|'templates update|-f'|'templates update|--format'|'db|-f'|'db|--format'|'db export|-f'|'db export|--format'|'db import|-f'|'db import|--format'|'db stats|-f'|'db stats|--format'|'dev|-f'|'dev|--format'|'memory|-f'|'memory|--format'|'memory list|-f'|'memory list|--format'|'memory search|-f'|'memory search|--format'|'memory delete|-f'|'memory delete|--format'|'memory clear|-f'|'memory clear|--format'|'memory stats|-f'|'memory stats|--format'|'memory get|-f'|'memory get|--format'|'memory archive|-f'|'memory archive|--format'|'memory restore|-f'|'memory restore|--format'|'users|-f'|'users|--format'|'users list|-f'|'users list|--format'|'users get|-f'|'users get|--format'|'users delete|-f'|'users delete|--format'|'users delete-many|-f'|'users delete-many|--format'|'users stats|-f'|'users stats|--format'|'users update|--format'|'users create|-f'|'users create|--format'|'users exists|-f'|'users exists|--format'|'spaces|-f'|'spaces|--format'|'spaces list|-f'|'spaces list|--format'|'spaces create|-f'|'spaces create|--format'|'spaces get|-f'|'spaces get|--format'|'spaces delete|-f'|'spaces delete|--format'|'spaces archive|-f'|'spaces archive|--format'|'spaces reactivate|-f'|'spaces reactivate|--format'|'spaces stats|-f'|'spaces stats|--format'|'spaces participants|-f'|'spaces participants|--format'|'spaces add-participant|-f'|'spaces add-participant|--format'|'spaces remove-participant|-f'|'spaces remove-participant|--format'|'spaces update|-f'|'spaces update|--format'|'spaces count|-f'|'spaces count|--format'|'spaces search|-f'|'spaces search|--format'|'facts|-f'|'facts|--format'|'facts list|-f'|'facts list|--format'|'facts search|-f'|'facts search|--format'|'facts get|-f'|'facts get|--format'|'facts delete|-f'|'facts delete|--format'|'facts count|-f'|'facts count|--format'|'facts clear|-f'|'facts clear|--format'|'conversations|-f'|'conversations|--format'|'conversations list|-f'|'conversations list|--format'|'conversations get|-f'|'conversations get|--format'|'conversations delete|-f'|'conversations delete|--format'|'conversations count|-f'|'conversations count|--format'|'conversations clear|-f'|'conversations clear|--format'|'conversations messages|-f'|'conversations messages|--format'|'convex|-f'|'convex|--format'|'convex deploy|-f'|'convex deploy|--format'|'convex update|-f'|'convex update|--format'|'convex dev|-f'|'convex dev|--format'|'convex schema|-f'|'convex schema|--format'|'convex dashboard|-f'|'convex dashboard|--format'|'convex logs|-f'|'convex logs|--format'|'convex env|-f'|'convex env|--format'|'convex env list|-f'|'convex env list|--format'|'convex env get|-f'|'convex env get|--format'|'convex env set|-f'|'convex env set|--format'|'convex env remove|-f'|'convex env remove|--format'|'convex codegen|-f'|'convex codegen|--format'|'convex run|-f'|'convex run|--format'|'convex data|-f'|'convex data|--format'|'convex export|-f'|'convex export|--format'|'convex import|-f'|'convex import|--format'|'convex deployment|-f'|'convex deployment|--format'|'convex deployment select|-f'|'convex deployment select|--format'|'convex insights|-f'|'convex insights|--format'|'completion|-f'|'completion|--format') printf '%s\n' 'table json csv' ;;
    '|--graph-sync'|'start|--graph-sync'|'deploy|--graph-sync'|'update|--graph-sync'|'status|--graph-sync'|'doctor|--graph-sync'|'config|--graph-sync'|'config show|--graph-sync'|'config list|--graph-sync'|'config set|--graph-sync'|'config test|--graph-sync'|'config set-path|--graph-sync'|'config deployments|--graph-sync'|'config add-deployment|--graph-sync'|'config remove-deployment|--graph-sync'|'config set-key|--graph-sync'|'config set-url|--graph-sync'|'config path|--graph-sync'|'config reset|--graph-sync'|'use|--graph-sync'|'init|--graph-sync'|'install|--graph-sync'|'graph|--graph-sync'|'graph setup|--graph-sync'|'graph start|--graph-sync'|'graph stop|--graph-sync'|'graph status|--graph-sync'|'schema|--graph-sync'|'schema status|--graph-sync'|'schema sync|--graph-sync'|'schema references|--graph-sync'|'schema migrate|--graph-sync'|'templates|--graph-sync'|'templates list|--graph-sync'|'templates init|--graph-sync'|'templates update|--graph-sync'|'db|--graph-sync'|'db export|--graph-sync'|'db import|--graph-sync'|'db stats|--graph-sync'|'dev|--graph-sync'|'memory|--graph-sync'|'memory list|--graph-sync'|'memory search|--graph-sync'|'memory delete|--graph-sync'|'memory clear|--graph-sync'|'memory export|--graph-sync'|'memory stats|--graph-sync'|'memory get|--graph-sync'|'memory archive|--graph-sync'|'memory restore|--graph-sync'|'users|--graph-sync'|'users list|--graph-sync'|'users get|--graph-sync'|'users delete|--graph-sync'|'users delete-many|--graph-sync'|'users export|--graph-sync'|'users stats|--graph-sync'|'users update|--graph-sync'|'users create|--graph-sync'|'users exists|--graph-sync'|'spaces|--graph-sync'|'spaces list|--graph-sync'|'spaces create|--graph-sync'|'spaces get|--graph-sync'|'spaces delete|--graph-sync'|'spaces archive|--graph-sync'|'spaces reactivate|--graph-sync'|'spaces stats|--graph-sync'|'spaces participants|--graph-sync'|'spaces add-participant|--graph-sync'|'spaces remove-participant|--graph-sync'|'spaces update|--graph-sync'|'spaces count|--graph-sync'|'spaces search|--graph-sync'|'facts|--graph-sync'|'facts list|--graph-sync'|'facts search|--graph-sync'|'facts get|--graph-sync'|'facts delete|--graph-sync'|'facts export|--graph-sync'|'facts count|--graph-sync'|'facts clear|--graph-sync'|'conversations|--graph-sync'|'conversations list|--graph-sync'|'conversations get|--graph-sync'|'conversations delete|--graph-sync'|'conversations export|--graph-sync'|'conversations count|--graph-sync'|'conversations clear|--graph-sync'|'conversations messages|--graph-sync'|'convex|--graph-sync'|'convex deploy|--graph-sync'|'convex update|--graph-sync'|'convex dev|--graph-sync'|'convex status|--graph-sync'|'convex schema|--graph-sync'|'convex dashboard|--graph-sync'|'convex logs|--graph-sync'|'convex env|--graph-sync'|'convex env list|--graph-sync'|'convex env get|--graph-sync'|'convex env set|--graph-sync'|'convex env remove|--graph-sync'|'convex codegen|--graph-sync'|'convex run|--graph-sync'|'convex data|--graph-sync'|'convex export|--graph-sync'|'convex import|--graph-sync'|'convex deployment|--graph-sync'|'convex deployment select|--graph-sync'|'convex insights|--graph-sync'|'completion|--graph-sync') printf '%s\n' 'auto off required' ;;
    'start|--project'|'start|--env-file'|'deploy|--project'|'deploy|--env-file'|'update|--project'|'update|--env-file'|'update|--sdk-package'|'status|--project'|'status|--env-file'|'doctor|--project'|'doctor|--env-file'|'init|--graph-credentials'|'init|--sdk-package'|'init|--templates-package'|'install|--graph-credentials'|'install|--sdk-package'|'graph setup|--graph-credentials'|'templates|--templates-package'|'templates list|--templates-package'|'templates init|--templates-package'|'templates init|--sdk-package'|'templates init|--provider-package'|'templates init|--graph-credentials'|'templates update|--templates-package'|'templates update|--sdk-package'|'templates update|--provider-package'|'db export|--project'|'db export|--env-file'|'db export|-o'|'db export|--output'|'db import|--project'|'db import|--env-file'|'db stats|--project'|'db stats|--env-file'|'dev|--project'|'dev|--env-file'|'memory export|-o'|'memory export|--output'|'users export|-o'|'users export|--output'|'users update|-f'|'users update|--file'|'facts export|-o'|'facts export|--output'|'conversations export|-o'|'conversations export|--output'|'convex deploy|--project'|'convex deploy|--env-file'|'convex update|--project'|'convex update|--env-file'|'convex update|--sdk-package'|'convex dev|--project'|'convex dev|--env-file'|'convex status|--project'|'convex status|--env-file'|'convex schema|--project'|'convex dashboard|--project'|'convex dashboard|--env-file'|'convex logs|--project'|'convex logs|--env-file'|'convex env|--project'|'convex env|--env-file'|'convex codegen|--project'|'convex codegen|--env-file'|'convex run|--project'|'convex run|--env-file'|'convex data|--project'|'convex data|--env-file'|'convex export|--project'|'convex export|--env-file'|'convex export|-o'|'convex export|--output'|'convex import|--project'|'convex import|--env-file'|'convex deployment|--project'|'convex deployment|--env-file'|'convex insights|--project'|'convex insights|--env-file') printf '%s\n' @files ;;
    'status|-f'|'status|--format'|'convex status|-f'|'convex status|--format') printf '%s\n' 'table json csv dashboard' ;;
    'init|--graph'|'install|--graph'|'graph setup|--graph'|'templates init|--graph') printf '%s\n' 'none neo4j memgraph' ;;
    'init|--graph-mode'|'install|--graph-mode'|'graph setup|--graph-mode'|'templates init|--graph-mode') printf '%s\n' 'local existing' ;;
    'init|-t'|'init|--template') printf '%s\n' 'basic none' ;;
    'templates init|--template') printf '%s\n' 'basic vercel-ai-quickstart chat-sdk' ;;
    'memory export|-f'|'memory export|--format'|'users export|--format'|'facts export|-f'|'facts export|--format') printf '%s\n' 'json csv' ;;
    'spaces list|-t'|'spaces list|--type'|'spaces create|-t'|'spaces create|--type'|'spaces count|-t'|'spaces count|--type'|'spaces search|-t'|'spaces search|--type') printf '%s\n' 'personal team project custom' ;;
    'spaces list|-s'|'spaces list|--status'|'spaces update|-s'|'spaces update|--status'|'spaces count|-s'|'spaces count|--status'|'spaces search|-s'|'spaces search|--status') printf '%s\n' 'active archived' ;;
    'conversations export|-f'|'conversations export|--format') printf '%s\n' 'json txt' ;;
    'convex data|--order') printf '%s\n' 'asc desc' ;;
    'completion|') printf '%s\n' 'bash zsh fish' ;;
  esac
}

_cortex_resolve_context() {
  _cortex_path=""; _cortex_pending=""; _cortex_end_options=""
  local word short
  for word in "$@"; do
    if [ -n "$_cortex_pending" ]; then _cortex_pending=""; continue; fi
    if [ "$word" = "--" ]; then _cortex_end_options=yes; continue; fi
    if [ -z "$_cortex_end_options" ]; then
      case "$word" in
        --*=*) continue ;;
        -*)
          case " $(_cortex_value_options "$_cortex_path") " in
            *" $word "*) _cortex_pending=$word ;;
            *) short=$(printf '%.2s' "$word")
               case " $(_cortex_value_options "$_cortex_path") " in *" $short "*) ;; esac ;;
          esac
          continue ;;
      esac
    fi
    case " $(_cortex_children "$_cortex_path") " in
      *" $word "*) _cortex_path="${_cortex_path:+$_cortex_path }$word" ;;
    esac
  done
}

_cortex() {
  local cur=$words[CURRENT] flag choices
  local _cortex_path _cortex_pending _cortex_end_options
  local -a candidates
  if (( CURRENT > 2 )); then
    _cortex_resolve_context "${words[@]:1:$((CURRENT-2))}"
  else
    _cortex_resolve_context
  fi
  flag=$_cortex_pending
  if [[ -z $flag && $cur == --*=* ]]; then
    flag=${cur%%=*}
    compset -P '*='
  fi
  if [[ -n $flag ]]; then
    choices=$(_cortex_values_for "$_cortex_path|$flag")
    if [[ $choices == '@files' ]]; then _files; else candidates=(${=choices}); compadd -a candidates; fi
    return
  fi
  if [[ -n $_cortex_end_options ]]; then _files; return; fi
  if [[ $cur == -* ]]; then
    choices=$(_cortex_options "$_cortex_path")
  else
    choices=$(_cortex_children "$_cortex_path")
    [[ $_cortex_path == completion ]] && choices=$(_cortex_values_for 'completion|')
  fi
  candidates=(${=choices})
  if (( ${#candidates} )); then compadd -a candidates; else _files; fi
}
compdef _cortex cortex
