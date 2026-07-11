#!/usr/bin/env bash
# Turso DB を作成し、Vercel Production に TURSO_* env を設定する。
# 事前: turso auth login
set -euo pipefail

DB_NAME="${TURSO_DB_NAME:-freee-auto-entry}"
LOCATION="${TURSO_LOCATION:-aws-ap-northeast-1}"

if ! turso auth whoami >/dev/null 2>&1; then
  echo "Turso 未ログインです。先に turso auth login を実行してください。"
  exit 1
fi

if ! turso db show "$DB_NAME" >/dev/null 2>&1; then
  echo "Creating Turso database: $DB_NAME ($LOCATION)"
  turso db create "$DB_NAME" --location "$LOCATION"
fi

DB_URL="$(turso db show "$DB_NAME" --url)"
DB_TOKEN="$(turso db tokens create "$DB_NAME")"

add_env() {
  local name=$1
  local value=$2
  vercel env add "$name" production --value "$value" --sensitive --yes --force >/dev/null
  echo "set $name -> production"
}

add_env TURSO_DATABASE_URL "$DB_URL"
add_env TURSO_AUTH_TOKEN "$DB_TOKEN"

echo
echo "Turso 設定完了。本番を再デプロイしてください:"
echo "  vercel --prod --yes"
