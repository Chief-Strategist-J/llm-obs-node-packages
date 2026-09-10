#!/usr/bin/env bash

set -euo pipefail

get_script_dir() {
  cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
}

get_package_dir() {
  local script_dir
  script_dir=$(get_script_dir)
  cd "$script_dir/../.." && pwd
}

extract_flag_token() {
  local token=""
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --token=*)
        token="${1#*=}"
        shift
        ;;
      --token|-t)
        token="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done
  echo "$token"
}

prompt_for_token() {
  local token=""
  echo "Please enter your GitHub Personal Access Token (PAT) with write:packages scope:" >&2
  if [ -t 0 ]; then
    read -sp "Token: " token >&2
    echo "" >&2
  else
    read -r token
  fi
  echo "$token"
}

acquire_token() {
  local flag_token
  flag_token=$(extract_flag_token "$@")
  if [ -n "$flag_token" ]; then
    echo "$flag_token"
  else
    prompt_for_token
  fi
}

run_prepublish() {
  echo "Running typecheck and building distribution artifacts..."
  npm run prepublishOnly
}

get_package_name() {
  node -p "require('./package.json').name"
}

get_package_version() {
  node -p "require('./package.json').version"
}

execute_publish() {
  local token="$1"
  local pkg_name="$2"
  local pkg_version="$3"
  echo "Publishing ${pkg_name}@${pkg_version} to GitHub Packages..."
  NODE_AUTH_TOKEN="$token" npm publish --access public
  echo "Package ${pkg_name}@${pkg_version} published successfully!"
}

main() {
  local package_dir
  local token
  local pkg_name
  local pkg_version
  package_dir=$(get_package_dir)
  cd "$package_dir"
  token=$(acquire_token "$@")
  if [ -z "$token" ]; then
    echo "Error: Token cannot be empty. Aborting publish." >&2
    exit 1
  fi
  run_prepublish
  pkg_name=$(get_package_name)
  pkg_version=$(get_package_version)
  execute_publish "$token" "$pkg_name" "$pkg_version"
}

main "$@"
