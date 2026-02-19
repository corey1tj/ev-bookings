# Ampeco MCP Server — Setup & Usage Guide

## Overview

The [`@ampeco/public-api-mcp`](https://github.com/ampeco/public-api-mcp) package is an MCP (Model Context Protocol) server that exposes the full AMPECO.CHARGE Public API (OpenAPI v3.108.0, 449 endpoints) as MCP resources and tools. This lets Claude Code (and other MCP-compatible clients) browse, query, and call Ampeco API endpoints directly during development sessions.

This project uses the MCP server to give Claude Code live access to the Ampeco Bookings API during development — eliminating the need to manually reference API docs or guess at endpoint shapes.

---

## Prerequisites

- Node.js 18+
- An Ampeco API bearer token with booking permissions
- The Ampeco instance base URL (e.g., `https://yourinstance.ampeco.tech/public-api`)

---

## Quick Start

### 1. Set environment variables

Add these to your shell profile or `.env.local`:

```bash
export AMPECO_API_URL="https://yourinstance.ampeco.tech/public-api"
export AMPECO_API_TOKEN="your-bearer-token-here"
```

### 2. Project-level configuration (already set up)

The `.mcp.json` file at the repository root configures the MCP server for Claude Code:

```json
{
  "mcpServers": {
    "ampeco-api": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@ampeco/public-api-mcp",
        "--stdio",
        "--hostname",
        "${AMPECO_API_URL}"
      ],
      "env": {
        "AMPECO_BEARER_TOKEN": "${AMPECO_API_TOKEN}"
      }
    }
  }
}
```

Claude Code reads this file automatically when you open a session in the project directory.

### 3. Verify the connection

Start a Claude Code session in the project root. The MCP server should appear in the active servers list. You can verify by asking Claude to list the available Ampeco API tags or read a specific endpoint definition.

---

## Alternative Setup Methods

### Claude Code CLI one-liner

If you prefer not to use `.mcp.json`, you can add the server via the CLI:

```bash
claude mcp add --transport stdio ampeco-api \
  --env AMPECO_BEARER_TOKEN=$AMPECO_API_TOKEN \
  -- npx -y @ampeco/public-api-mcp --stdio --hostname $AMPECO_API_URL
```

### HTTP transport (remote/shared server)

Start the server as an HTTP service:

```bash
PORT=3001 npx -y @ampeco/public-api-mcp --http --port 3001
```

Then connect from Claude Code:

```bash
claude mcp add --transport http ampeco-api \
  http://localhost:3001/yourinstance.ampeco.tech \
  --header "Authorization: Bearer $AMPECO_API_TOKEN"
```

### Claude Desktop

Claude Desktop does not support native MCP resources. Use the `--emulate-resources-via-tools` flag:

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ampeco-api": {
      "command": "npx",
      "args": [
        "-y",
        "@ampeco/public-api-mcp",
        "--stdio",
        "--hostname",
        "https://yourinstance.ampeco.tech/public-api",
        "--emulate-resources-via-tools"
      ],
      "env": {
        "AMPECO_BEARER_TOKEN": "your-token-here"
      }
    }
  }
}
```

---

## CLI Flags Reference

| Flag | Description |
|------|-------------|
| `--stdio` | Use stdio transport (for Claude Code, Claude Desktop, npx) |
| `--http` | Use HTTP transport (for remote access) |
| `--hostname <url>` | Target Ampeco API hostname (required for stdio mode) |
| `--token <token>` | Bearer token (alternative to `AMPECO_BEARER_TOKEN` env var) |
| `--port <port>` | HTTP server port (default: 3000) |
| `--emulate-resources-via-tools` | Tool emulation mode (required for Claude Desktop) |

---

## MCP Server Capabilities

### Resource Mode (default — Claude Code)

The server exposes a 3-tier hierarchical resource navigation:

1. **Tags** — API groups (e.g., `resource / bookings`, `action / location`)
2. **Endpoints** — Individual operations within a tag
3. **Details** — Full endpoint specification (parameters, request body, response schemas)

### Tool Emulation Mode (Claude Desktop)

When `--emulate-resources-via-tools` is enabled, three tools become available:

| Tool | Purpose |
|------|---------|
| `list_resources` | List all API tags with endpoint counts |
| `read_resource` | Read endpoint definitions by URI (`tag://TagName` or `api://METHOD/path`) |
| `api_request` | Execute API calls with automatic auth and parameter validation |

---

## API Coverage

The MCP server exposes the complete Ampeco Public API — 449 endpoints across 82 tags. The endpoints most relevant to this project's booking functionality are documented below.
