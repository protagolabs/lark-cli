# lark-cli

CLI tool for Lark/Feishu Open API. Supports document upload/read, bitable CRUD, and messaging.

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

## Authentication

By default, commands run as the **app identity** (tenant token). To run as your **user identity** (e.g., so documents are owned by you), use OAuth2 login:

```bash
# Login — opens browser for authorization
lark auth login

# Check current identity
lark auth status

# Logout — revert to app identity
lark auth logout
```

**Prerequisites for OAuth2:**

1. In the Lark app console, add `http://localhost:9876/callback` to **Security Settings → Redirect URLs**
2. Enable required **User Token Scopes** under **Permissions & Scopes** (e.g., `docx:document`)

User tokens are auto-refreshed when expired. When the refresh token also expires, commands fall back to app identity.

## Usage

### Documents

```bash
# Upload markdown as a Lark document
lark doc upload ./README.md
lark doc upload ./design.md --title "Design Doc" --folder <folder_token>
lark doc upload ./notes.md --owner <open_id>  # grant user access after creation

# Read a document (plain text)
lark doc read <document_id>
lark doc read <wiki_token>  # wiki pages auto-resolved

# Read as structured block JSON
lark doc read <document_id> --json

# Update an existing document
lark doc update <document_id> ./updated.md
lark doc update <document_id> ./updated.md --resolve-comments
```

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

Enable the required scopes in the app console under **Permissions & Scopes**. Only add scopes for features you use.

| Feature | Scope | Required for |
|---------|-------|-------------|
| `docx:document` | Documents | `doc upload`, `doc update`, `doc read` |
| `wiki:wiki:readonly` | Wiki | `doc read <wiki_token>` |
| `drive:drive` | Drive permissions | `doc upload --owner` |
| `bitable:app` | Bitable | All `bitable` commands |
| `im:message` | Messaging | `msg send` |

For user identity (OAuth2), enable these as **User Token Scopes** and add them to the `SCOPES` array in `src/commands/auth.ts`. For app identity, enable as **App Token Scopes**.

## Tech Stack

- TypeScript + tsup (ESM)
- `@larksuiteoapi/node-sdk` — Official Lark SDK
- `commander` — CLI framework
- `chalk` + `cli-table3` — Output formatting
- `markdown-it` — Markdown parsing for document upload
