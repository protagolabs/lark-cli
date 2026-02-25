# lark-cli

## Project Overview

CLI tool for Lark (international) / Feishu Open API. Built with TypeScript, bundled with tsup to ESM.

## Architecture

```
src/
  index.ts              # CLI entry, commander program setup
  auth.ts               # Read ~/.lark_auth credentials
  client.ts             # Lark SDK client singleton (Domain.Lark, SelfBuild app)
  commands/
    bitable.ts          # Bitable subcommands: list, fields, records, get, create, update, delete, search
    message.ts          # Message subcommands: send (text, post, interactive)
  utils/
    format.ts           # Output helpers: printJson, printTable, printRecord, checkResponse, exitWithError
```

## Key Design Decisions

- **Lark international domain**: SDK configured with `Domain.Lark` (larksuite.com), not Feishu (feishu.cn)
- **Auth**: Credentials stored in `~/.lark_auth` as JSON with `app_id` and `app_secret`
- **SDK handles token refresh**: No manual token management needed
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
- **Wiki-embedded bitable**: URL token is wiki_token; `appTable.list` works but other endpoints may need the actual bitable `obj_token` via wiki API conversion
