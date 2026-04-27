#!/usr/bin/env node
/**
 * Wikso MCP server entry point.
 *
 * Starts a Model Context Protocol server over stdio. Exposes a suite of
 * tools for searching, reading, and editing Wikso wiki pages. Intended
 * to be launched by Claude Desktop, Claude Code, Cursor, or any other
 * MCP-capable client via a local `node dist/index.js` invocation.
 *
 * IMPORTANT: stdout is reserved for the MCP protocol. All logging must
 * go to stderr.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfigFromEnv, WiksoClient } from './api-client.js';
import { tools, dispatchTool } from './tools.js';

function logStderr(msg: string): void {
  process.stderr.write(`${msg}\n`);
}

async function main(): Promise<void> {
  let client: WiksoClient;
  try {
    client = new WiksoClient(loadConfigFromEnv());
  } catch (err: any) {
    logStderr(`[wikso-mcp] Configuration error: ${err?.message ?? err}`);
    process.exit(1);
  }

  const server = new Server(
    {
      name: 'wikso-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const result = await dispatchTool(name, args ?? {}, client);
    return {
      content: [
        {
          type: 'text',
          text: result.text,
        },
      ],
      isError: result.isError,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logStderr('Wikso MCP server listening on stdio');
}

main().catch((err) => {
  logStderr(`[wikso-mcp] Fatal error: ${err?.stack ?? err}`);
  process.exit(1);
});
