#!/usr/bin/env bash
# Creates the deltav-leads D1 database, applies schema/leads.sql, and binds it
# to the deltav-web Pages project as DB. The API token needs D1 Edit as well
# as Pages Edit.
set -euo pipefail

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

api="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}"
auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" -H "Content-Type: application/json")
root=$(cd "$(dirname "$0")/.." && pwd)

list=$(curl -sS "${auth[@]}" "$api/d1/database")
echo "D1 databases:"
echo "$list" | jq '{success, errors: [.errors[]? | {code, message}], names: [.result[]?.name]}'
if ! echo "$list" | jq -e '.success == true' >/dev/null; then
  echo "This token cannot edit D1. Add the D1 Edit permission to CLOUDFLARE_API_TOKEN."
  exit 1
fi

id=$(echo "$list" | jq -r '.result[]? | select(.name == "deltav-leads") | (.uuid // .id)' | head -n 1)
if [ -z "$id" ]; then
  created=$(curl -sS -X POST "${auth[@]}" "$api/d1/database" --data '{"name":"deltav-leads"}')
  echo "Created database:"
  echo "$created" | jq '{success, errors: [.errors[]? | {code, message}], uuid: (.result.uuid // .result.id)}'
  echo "$created" | jq -e '.success == true' >/dev/null
  id=$(echo "$created" | jq -r '.result.uuid // .result.id')
fi
if [ -z "$id" ] || [ "$id" = "null" ]; then
  echo "D1 did not return an id for deltav-leads."
  exit 1
fi
echo "Using deltav-leads ${id}"

sql=$(tr '\n' ' ' < "$root/schema/leads.sql")
applied=$(curl -sS -X POST "${auth[@]}" "$api/d1/database/${id}/query" --data "$(jq -n --arg sql "$sql" '{sql: $sql}')")
echo "Schema:"
echo "$applied" | jq '{success, errors: [.errors[]? | {code, message}]}'
echo "$applied" | jq -e '.success == true' >/dev/null

project=$(curl -sS "${auth[@]}" "$api/pages/projects/deltav-web")
echo "$project" | jq -e '.success == true' >/dev/null
if echo "$project" | jq -e '
  [(.result.deployment_configs.production.env_vars // {}), (.result.deployment_configs.preview.env_vars // {})]
  | map(to_entries[].value.type) | any(. == "secret_text")
' >/dev/null; then
  echo "deltav-web has secret env vars, so this script will not rewrite its config."
  echo "In the Pages project, bind D1 database deltav-leads as the variable DB."
  exit 1
fi

payload=$(echo "$project" | jq -c --arg id "$id" '
  (.result.deployment_configs // {})
  | .production = (.production // {})
  | .preview = (if .preview == null then .production else .preview end)
  | .production.d1_databases = ((.production.d1_databases // {}) + {DB: {id: $id}})
  | .preview.d1_databases = ((.preview.d1_databases // {}) + {DB: {id: $id}})
  | del(.production.wrangler_config_hash, .preview.wrangler_config_hash)
  | {deployment_configs: .}
')
updated=$(curl -sS -X PATCH "${auth[@]}" "$api/pages/projects/deltav-web" --data "$payload")
echo "Pages binding:"
echo "$updated" | jq '{success, errors: [.errors[]? | {code, message}], production: .result.deployment_configs.production.d1_databases, preview: .result.deployment_configs.preview.d1_databases}'
echo "$updated" | jq -e '.success == true' >/dev/null
