#!/bin/bash

# Cortex CLI completion script for Bash
# Auto-installed by @cortexmemory/cli
# Compatible with bash 3.2+ (macOS default)

_cortex_deployments() {
  local config="$HOME/.cortexrc"
  if [[ -f "$config" ]]; then
    # Parse deployment names from JSON config
    grep -o '"[^"]*"[[:space:]]*:[[:space:]]*{' "$config" 2>/dev/null | \
      grep -v '"deployments"' | grep -v '"apps"' | \
      sed 's/"//g' | sed 's/[[:space:]]*:[[:space:]]*{//'
  fi
}

_cortex_apps() {
  local config="$HOME/.cortexrc"
  if [[ -f "$config" ]]; then
    # Parse app names from JSON config (simplified)
    grep -A1 '"apps"' "$config" 2>/dev/null | \
      grep -o '"[^"]*"[[:space:]]*:[[:space:]]*{' | grep -v '"apps"' | \
      sed 's/"//g' | sed 's/[[:space:]]*:[[:space:]]*{//'
  fi
}

_cortex() {
  local cur prev
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"
  local cword=$COMP_CWORD

  # Top-level commands
  local commands="start stop deploy update status config init dev use db convex memory users spaces facts conversations completion"

  # config subcommands
  local config_cmds="show list set test set-path enable disable deployments add-deployment remove-deployment set-key set-url path reset"

  # db subcommands
  local db_cmds="stats clear backup restore export"

  # convex subcommands
  local convex_cmds="status deploy dev logs dashboard update schema init env"

  # users subcommands
  local users_cmds="list get delete delete-many export stats update create exists"

  # spaces subcommands
  local spaces_cmds="list create get delete archive reactivate stats participants add-participant remove-participant update count search"

  # conversations subcommands
  local conversations_cmds="list get delete export count clear messages"

  # memory subcommands
  local memory_cmds="list search get delete clear export stats archive restore"

  # facts subcommands
  local facts_cmds="list search get delete export count clear"

  # completion subcommands
  local completion_cmds="zsh bash fish"

  # Output formats
  local formats="table json"

  # Space types
  local space_types="personal team project custom"

  # Fact types
  local fact_types="preference identity knowledge relationship event observation custom"

  # Handle completion based on position
  case ${cword} in
    1)
      COMPREPLY=($(compgen -W "$commands" -- "$cur"))
      return
      ;;
    2)
      case ${COMP_WORDS[1]} in
        config)
          COMPREPLY=($(compgen -W "$config_cmds" -- "$cur"))
          return
          ;;
        db)
          COMPREPLY=($(compgen -W "$db_cmds" -- "$cur"))
          return
          ;;
        convex)
          COMPREPLY=($(compgen -W "$convex_cmds" -- "$cur"))
          return
          ;;
        users)
          COMPREPLY=($(compgen -W "$users_cmds" -- "$cur"))
          return
          ;;
        spaces)
          COMPREPLY=($(compgen -W "$spaces_cmds" -- "$cur"))
          return
          ;;
        conversations|convs)
          COMPREPLY=($(compgen -W "$conversations_cmds" -- "$cur"))
          return
          ;;
        memory)
          COMPREPLY=($(compgen -W "$memory_cmds" -- "$cur"))
          return
          ;;
        facts)
          COMPREPLY=($(compgen -W "$facts_cmds" -- "$cur"))
          return
          ;;
        completion)
          COMPREPLY=($(compgen -W "$completion_cmds" -- "$cur"))
          return
          ;;
        use)
          COMPREPLY=($(compgen -W "$(_cortex_deployments) --clear" -- "$cur"))
          return
          ;;
        init)
          COMPREPLY=($(compgen -d -- "$cur"))
          return
          ;;
      esac
      ;;
  esac

  # Handle options
  case ${prev} in
    -d|--deployment)
      COMPREPLY=($(compgen -W "$(_cortex_deployments)" -- "$cur"))
      return
      ;;
    -f|--format)
      COMPREPLY=($(compgen -W "$formats" -- "$cur"))
      return
      ;;
    -t|--template)
      COMPREPLY=($(compgen -W "basic vercel-ai-quickstart" -- "$cur"))
      return
      ;;
    --type)
      COMPREPLY=($(compgen -W "$space_types" -- "$cur"))
      return
      ;;
    --status)
      COMPREPLY=($(compgen -W "active archived" -- "$cur"))
      return
      ;;
    -o|--output)
      COMPREPLY=($(compgen -f -- "$cur"))
      return
      ;;
    --dev-path)
      COMPREPLY=($(compgen -d -- "$cur"))
      return
      ;;
    set-path)
      # First arg is deployment, second is path
      if [[ ${cword} -eq 3 ]]; then
        COMPREPLY=($(compgen -W "$(_cortex_deployments)" -- "$cur"))
      elif [[ ${cword} -eq 4 ]]; then
        COMPREPLY=($(compgen -d -- "$cur"))
      fi
      return
      ;;
    enable|disable)
      COMPREPLY=($(compgen -W "$(_cortex_deployments) $(_cortex_apps)" -- "$cur"))
      return
      ;;
    remove-deployment|set-key|set-url)
      COMPREPLY=($(compgen -W "$(_cortex_deployments)" -- "$cur"))
      return
      ;;
  esac

  # Command-specific option completion
  case ${COMP_WORDS[1]} in
    start|stop)
      COMPREPLY=($(compgen -W "-d --deployment --deployments-only --apps-only" -- "$cur"))
      return
      ;;
    deploy)
      COMPREPLY=($(compgen -W "-d --deployment -y --yes" -- "$cur"))
      return
      ;;
    update)
      COMPREPLY=($(compgen -W "-d --deployment --deployments-only --apps-only --dev-path --sync-template -y --yes" -- "$cur"))
      return
      ;;
    status)
      COMPREPLY=($(compgen -W "-d --deployment -f --format" -- "$cur"))
      return
      ;;
    init)
      COMPREPLY=($(compgen -W "-t --template -n --name --skip-install -y --yes" -- "$cur"))
      return
      ;;
    dev)
      COMPREPLY=($(compgen -W "-d --deployment" -- "$cur"))
      return
      ;;
    use)
      COMPREPLY=($(compgen -W "--clear $(_cortex_deployments)" -- "$cur"))
      return
      ;;
    config)
      case ${COMP_WORDS[2]} in
        show|deployments)
          COMPREPLY=($(compgen -W "-f --format" -- "$cur"))
          ;;
        test)
          COMPREPLY=($(compgen -W "-d --deployment" -- "$cur"))
          ;;
        add-deployment)
          COMPREPLY=($(compgen -W "-u --url -k --key --default --json-only" -- "$cur"))
          ;;
        remove-deployment|set-key|set-url)
          COMPREPLY=($(compgen -W "--json-only" -- "$cur"))
          ;;
        reset)
          COMPREPLY=($(compgen -W "-y --yes" -- "$cur"))
          ;;
      esac
      return
      ;;
    db)
      case ${COMP_WORDS[2]} in
        stats)
          COMPREPLY=($(compgen -W "-d --deployment -f --format" -- "$cur"))
          ;;
        clear)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes --keep-users" -- "$cur"))
          ;;
        backup|export)
          COMPREPLY=($(compgen -W "-d --deployment -o --output" -- "$cur"))
          ;;
        restore)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes" -- "$cur"))
          ;;
      esac
      return
      ;;
    users)
      case ${COMP_WORDS[2]} in
        list)
          COMPREPLY=($(compgen -W "-d --deployment -f --format -l --limit" -- "$cur"))
          ;;
        get|stats|exists)
          COMPREPLY=($(compgen -W "-d --deployment -f --format" -- "$cur"))
          ;;
        delete)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes --gdpr" -- "$cur"))
          ;;
        delete-many)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes --gdpr" -- "$cur"))
          ;;
        export)
          COMPREPLY=($(compgen -W "-d --deployment -o --output" -- "$cur"))
          ;;
        update|create)
          COMPREPLY=($(compgen -W "-d --deployment --name --email" -- "$cur"))
          ;;
      esac
      return
      ;;
    spaces)
      case ${COMP_WORDS[2]} in
        list)
          COMPREPLY=($(compgen -W "-d --deployment -f --format -l --limit --status" -- "$cur"))
          ;;
        create)
          COMPREPLY=($(compgen -W "-d --deployment --name --type" -- "$cur"))
          ;;
        get|stats|participants|archive|reactivate)
          COMPREPLY=($(compgen -W "-d --deployment -f --format" -- "$cur"))
          ;;
        delete)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes --cascade" -- "$cur"))
          ;;
        add-participant|remove-participant)
          COMPREPLY=($(compgen -W "-d --deployment --user" -- "$cur"))
          ;;
        update)
          COMPREPLY=($(compgen -W "-d --deployment --name --status" -- "$cur"))
          ;;
        count)
          COMPREPLY=($(compgen -W "-d --deployment --status" -- "$cur"))
          ;;
        search)
          COMPREPLY=($(compgen -W "-d --deployment -f --format" -- "$cur"))
          ;;
      esac
      return
      ;;
    conversations|convs)
      case ${COMP_WORDS[2]} in
        list)
          COMPREPLY=($(compgen -W "-d --deployment -f --format -l --limit -s --space" -- "$cur"))
          ;;
        get|messages)
          COMPREPLY=($(compgen -W "-d --deployment -f --format" -- "$cur"))
          ;;
        delete)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes" -- "$cur"))
          ;;
        export)
          COMPREPLY=($(compgen -W "-d --deployment -o --output" -- "$cur"))
          ;;
        count)
          COMPREPLY=($(compgen -W "-d --deployment -s --space" -- "$cur"))
          ;;
        clear)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes -s --space" -- "$cur"))
          ;;
      esac
      return
      ;;
    memory)
      case ${COMP_WORDS[2]} in
        list|stats)
          COMPREPLY=($(compgen -W "-d --deployment -f --format -s --space -l --limit" -- "$cur"))
          ;;
        search)
          COMPREPLY=($(compgen -W "-d --deployment -f --format -s --space -l --limit" -- "$cur"))
          ;;
        get|archive|restore)
          COMPREPLY=($(compgen -W "-d --deployment -f --format" -- "$cur"))
          ;;
        delete)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes" -- "$cur"))
          ;;
        clear)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes -s --space" -- "$cur"))
          ;;
        export)
          COMPREPLY=($(compgen -W "-d --deployment -s --space -o --output" -- "$cur"))
          ;;
      esac
      return
      ;;
    facts)
      case ${COMP_WORDS[2]} in
        list)
          COMPREPLY=($(compgen -W "-d --deployment -f --format -s --space -l --limit -t --type" -- "$cur"))
          ;;
        search)
          COMPREPLY=($(compgen -W "-d --deployment -f --format -s --space" -- "$cur"))
          ;;
        get)
          COMPREPLY=($(compgen -W "-d --deployment -f --format" -- "$cur"))
          ;;
        delete)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes" -- "$cur"))
          ;;
        export)
          COMPREPLY=($(compgen -W "-d --deployment -s --space -o --output" -- "$cur"))
          ;;
        count)
          COMPREPLY=($(compgen -W "-d --deployment -s --space" -- "$cur"))
          ;;
        clear)
          COMPREPLY=($(compgen -W "-d --deployment -y --yes -s --space" -- "$cur"))
          ;;
      esac
      return
      ;;
    convex)
      COMPREPLY=($(compgen -W "-d --deployment" -- "$cur"))
      return
      ;;
  esac

  # Default: global options
  COMPREPLY=($(compgen -W "-d --deployment --debug -V --version -h --help" -- "$cur"))
}

complete -F _cortex cortex
