#!/bin/sh
set -eu

load_secret_file() {
  variable_name="$1"
  case "$variable_name" in
    DATABASE_URL) secret_file="${DATABASE_URL_FILE:-}" ;;
    DATABASE_ADMIN_URL) secret_file="${DATABASE_ADMIN_URL_FILE:-}" ;;
    CONVERTAPI_TOKEN) secret_file="${CONVERTAPI_TOKEN_FILE:-}" ;;
    NOTION_TOKEN) secret_file="${NOTION_TOKEN_FILE:-}" ;;
    NOTION_DATABASE_ID) secret_file="${NOTION_DATABASE_ID_FILE:-}" ;;
    NOTION_DATA_SOURCE_ID) secret_file="${NOTION_DATA_SOURCE_ID_FILE:-}" ;;
    *) echo "Variável de secret não permitida: $variable_name" >&2; exit 1 ;;
  esac

  if [ -z "$secret_file" ]; then
    return
  fi
  if [ ! -r "$secret_file" ]; then
    echo "Não foi possível ler o secret configurado para $variable_name." >&2
    exit 1
  fi

  secret_value=$(cat "$secret_file")
  if [ -z "$secret_value" ] && [ "$variable_name" = "DATABASE_URL" ]; then
    echo "O secret DATABASE_URL está vazio." >&2
    exit 1
  fi
  export "$variable_name=$secret_value"
}

load_secret_file DATABASE_URL
load_secret_file DATABASE_ADMIN_URL
load_secret_file CONVERTAPI_TOKEN
load_secret_file NOTION_TOKEN
load_secret_file NOTION_DATABASE_ID
load_secret_file NOTION_DATA_SOURCE_ID

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Configure DATABASE_URL ou DATABASE_URL_FILE." >&2
  exit 1
fi
if [ "${NODE_ENV:-}" = "production" ] && [ -z "${DATABASE_ADMIN_URL:-}" ]; then
  echo "Configure DATABASE_ADMIN_URL por secret antes de iniciar em produção." >&2
  exit 1
fi

exec "$@"
