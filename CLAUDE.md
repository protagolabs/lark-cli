# lark-cli

## Project Overview

CLI tool for Lark (international) / Feishu Open API. Built with TypeScript, bundled with tsup to ESM.

## Architecture

```
src/
  index.ts              # CLI entry, commander program setup
  auth.ts               # Read/write ~/.lark_auth credentials (app + user tokens)
  client.ts             # Lark SDK client singleton (Domain.Lark, SelfBuild app)
  commands/
    auth.ts             # Auth subcommands: login (OAuth2), logout, status
    bitable.ts          # Bitable subcommands: list, fields, records, get, create, update, delete, search
    doc.ts              # Doc subcommands: upload, update, read (supports wiki tokens)
    message.ts          # Message subcommands: send (text, post, interactive)
  utils/
    format.ts           # Output helpers: printJson, printTable, printRecord, checkResponse, exitWithError
    lark-api.ts         # HTTP helper: tenant/user token management, auto-refresh, API requests
    markdown.ts         # Markdown → Lark document blocks converter (markdown-it)
```

## Key Design Decisions

- **Lark international domain**: SDK configured with `Domain.Lark` (larksuite.com), not Feishu (feishu.cn)
- **Auth**: Credentials stored in `~/.lark_auth` as JSON with `app_id`, `app_secret`, and optional user tokens
- **Dual identity**: Supports both app identity (tenant token) and user identity (OAuth2 user token)
- **Token priority**: user_access_token → auto-refresh via refresh_token → fall back to tenant_access_token
- **larkApi helper**: Direct HTTP calls with auto token management, used by doc commands (SDK client still used by bitable/message)
- **Global `--json` flag**: All commands support raw JSON output via `optsWithGlobals().json`
- **`checkResponse()`**: Validates Lark API response code before accessing data, surfaces error codes clearly

## Build & Run

```bash
npm run build    # tsup → dist/index.js
npm link         # global `lark` command
```

## Common Lark API Issues

- **Error 1254002**: Usually permission scope missing or wrong domain
- **Error 900004230**: Document entity temporarily locked (data sync protection), retry later
- **Error 99991672**: Missing API scope — error message includes direct link to enable it
- **Error 99991679**: User token missing required scope — re-authorize with correct scopes
- **Error 20029**: OAuth redirect_uri not configured in app console Security Settings
- **Wiki-embedded bitable**: URL token is wiki_token; `appTable.list` works but other endpoints may need the actual bitable `obj_token` via wiki API conversion
