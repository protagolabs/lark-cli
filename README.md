# lark-cli

CLI tool for Lark/Feishu Open API. Supports bitable (multi-dimensional table) CRUD and messaging.

## Setup

```bash
npm install
npm run build
npm link
```

Create `~/.lark_auth`:

```json
{
  "app_id": "cli_xxxx",
  "app_secret": "xxxx"
}
```

## Usage

### Bitable

```bash
# List tables
lark bitable list <app_token>

# List fields
lark bitable fields <app_token> <table_id>

# List records (with pagination and filter)
lark bitable records <app_token> <table_id> --page-size 20 --filter '<expr>'

# Get single record
lark bitable get <app_token> <table_id> <record_id>

# Create record
lark bitable create <app_token> <table_id> --data '{"field": "value"}'

# Update record
lark bitable update <app_token> <table_id> <record_id> --data '{"field": "new_value"}'

# Delete record
lark bitable delete <app_token> <table_id> <record_id>

# Search records
lark bitable search <app_token> <table_id> --filter '{"conditions":[...]}'
```

### Messaging

```bash
# Send text message (default: chat_id)
lark msg send --to <receive_id> --content 'Hello'

# Send to specific ID type
lark msg send --to <id> --type open_id --content 'Hello'

# Send rich text
lark msg send --to <id> --msg-type post --content '{"zh_cn":{"title":"Title","content":[[{"tag":"text","text":"content"}]]}}'
```

### Global Options

- `--json` — Output raw JSON instead of formatted tables
- `--help` — Show help for any command

## Lark App Permissions

Required API scopes:

- `bitable:app` or `bitable:app:readonly` — Bitable read/write
- `im:message:create` — Send messages
- `wiki:wiki:readonly` — If accessing bitable embedded in wiki

The app must also be added as a document collaborator on the target bitable.

## Tech Stack

- TypeScript + tsup (ESM)
- `@larksuiteoapi/node-sdk` — Official Lark SDK
- `commander` — CLI framework
- `chalk` + `cli-table3` — Output formatting
