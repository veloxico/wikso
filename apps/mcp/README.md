# @wikso/mcp

A **Model Context Protocol** server for [Wikso](https://github.com/veloxico/wikso) — the self-hosted wiki. Lets Claude Desktop, Claude Code, Cursor, and any other MCP-capable client search and edit wiki pages over a natural-language conversation.

---

## What it does

Exposes the Wikso REST API as six MCP tools. Your MCP client (Claude etc.) will pick the right tool for each turn based on the descriptions below.

| Tool                   | What it does                                                           |
| ---------------------- | ---------------------------------------------------------------------- |
| `search_pages`         | Full-text search across all accessible pages                           |
| `read_page`            | Fetch a single page's title, metadata, and body text                   |
| `list_spaces`          | List every space the authenticated user can access                     |
| `list_pages_in_space`  | Render the hierarchical page tree of a given space                     |
| `create_page`          | Create a new page (with optional markdown body or raw tiptap JSON)     |
| `update_page`          | Update an existing page's title, body, and/or status                   |

---

## Requirements

- Node.js **>= 20**
- A running Wikso backend reachable over HTTP(S)
- A JWT bearer token for a Wikso user account

### Getting a JWT

For v1, the quickest way to grab a JWT is from your browser:

1. Sign in to your Wikso frontend in a browser.
2. Open DevTools > Application > Cookies (or Local Storage — depending on your deployment).
3. Copy the value of the `access_token` / `jwt` entry.

(Personal access tokens from the Settings page are planned for a future release.)

---

## Build

```bash
pnpm install
pnpm --filter @wikso/mcp build
```

This produces `apps/mcp/dist/index.js`, which is the binary your MCP client will run.

You can verify it starts correctly:

```bash
WIKSO_BASE_URL=http://localhost:3000/api/v1 \
WIKSO_TOKEN=eyJhbGciOi... \
node apps/mcp/dist/index.js
```

It should print `Wikso MCP server listening on stdio` to **stderr** and then wait for protocol traffic on stdin/stdout. Press `Ctrl-C` to quit.

---

## Configuration — Claude Desktop

Edit your `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "wikso": {
      "command": "node",
      "args": ["/path/to/apps/mcp/dist/index.js"],
      "env": {
        "WIKSO_BASE_URL": "http://localhost:3000/api/v1",
        "WIKSO_TOKEN": "eyJhbGciOi..."
      }
    }
  }
}
```

Restart Claude Desktop. You should see a hammer icon indicating the Wikso tools are available.

---

## Configuration — Claude Code

Add to `~/.claude/claude_code_config.json` (or your project-local equivalent):

```json
{
  "mcpServers": {
    "wikso": {
      "command": "node",
      "args": ["/absolute/path/to/apps/mcp/dist/index.js"],
      "env": {
        "WIKSO_BASE_URL": "http://localhost:3000/api/v1",
        "WIKSO_TOKEN": "eyJhbGciOi..."
      }
    }
  }
}
```

---

## Configuration — Cursor

In Cursor: **Settings > Features > Model Context Protocol > Add Server**.

Or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wikso": {
      "command": "node",
      "args": ["/absolute/path/to/apps/mcp/dist/index.js"],
      "env": {
        "WIKSO_BASE_URL": "http://localhost:3000/api/v1",
        "WIKSO_TOKEN": "eyJhbGciOi..."
      }
    }
  }
}
```

---

## Environment variables

| Variable          | Required | Example                              |
| ----------------- | -------- | ------------------------------------ |
| `WIKSO_BASE_URL`  | yes      | `http://localhost:3000/api/v1`       |
| `WIKSO_TOKEN`     | yes      | a JWT from a signed-in Wikso user    |

`WIKSO_BASE_URL` should include the `/api/v1` suffix — this is the Wikso API root, not the frontend URL.

---

## Example prompts

Once connected, try:

- "Search the wiki for pages about OAuth."
- "List all my wiki spaces."
- "Show me the page tree of the engineering space."
- "Create a new page called 'Release Playbook' in the engineering space, with a two-paragraph body summarising our deploy steps."
- "Append a section about rollback to the Release Playbook page."

---

## Troubleshooting

- **Server exits with `Missing required environment variable(s)`** — set `WIKSO_BASE_URL` and `WIKSO_TOKEN` in the MCP client's `env` block.
- **401 Unauthorized** — your JWT has expired. Grab a fresh one from the browser.
- **403 Forbidden on a space** — your user lacks access to that space. Use `list_spaces` first.
- **Tools do not appear in Claude Desktop** — check the log files at `~/Library/Logs/Claude/mcp*.log` (macOS). All stderr output from the server is captured there.

---

## Development

```bash
# Build
pnpm --filter @wikso/mcp build

# Watch mode
pnpm --filter @wikso/mcp dev

# Start (requires a prior build)
pnpm --filter @wikso/mcp start
```
