import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { toReqRes, toFetchResponse } from 'fetch-to-node'

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport }
  from '@modelcontextprotocol/sdk/server/streamableHttp.js'

import { randomInt, randomUUID } from 'crypto'
import { z } from 'zod'

// ────────────────────────────────────────────────────────────
// MCP server is here
// ────────────────────────────────────────────────────────────
const server = new McpServer({ name: 'random-int-server', version: '0.0.1' })
server.tool(
  'randomInt',
  { max: z.number().int().optional().default(100) },
  async ({ max = 100 }) => ({
    content: [{ type: 'text', text: String(randomInt(max)) }],
  }),
)

// ────────────────────────────────────────────────────────────
// Create a transport for each session and store it in a Map
// ────────────────────────────────────────────────────────────
const transports: Record<string, StreamableHTTPServerTransport> = {}

function getOrCreateTransport(sessionId: string) {
  if (!transports[sessionId]) {
    const t = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
      enableJsonResponse: false,
    })
    server.connect(t)
    transports[sessionId] = t
  }
  return transports[sessionId]
}

// ────────────────────────────────────────────────────────────
// ③ Hono routing
// ────────────────────────────────────────────────────────────
const app = new Hono()
app.use('/*', cors({ origin: '*', exposeHeaders: ['Mcp-Session-Id'] }))

app.post('/mcp', async (c) => {
  const { req, res } = toReqRes(c.req.raw)
  const body = await c.req.json().catch(() => ({}))

  // Determine / generate session ID
  let sid = (req.headers['mcp-session-id'] as string | undefined) ?? ''
  if (!sid) {
    sid = randomUUID()
    // Return to response → Frontend SDK will save it automatically
    res.setHeader('Mcp-Session-Id', sid)
  }

  await getOrCreateTransport(sid).handleRequest(req, res, body)
  return toFetchResponse(res)
})

app.get('/mcp', async (c) => {
  const url = new URL(c.req.url)
  const sid =
    (url.searchParams.get('session') ||
      c.req.header('mcp-session-id')) ?? undefined

  if (!sid || !transports[sid]) {
    return c.json(
      {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Session' },
        id: null,
      },
      400,
    )
  }

  const { req, res } = toReqRes(c.req.raw)
  // Replace the header （SDK checks it by header）
  req.headers['mcp-session-id'] = sid

  await transports[sid].handleRequest(req, res)
  return toFetchResponse(res)
})

// ────────────────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: 8080 }, (info) =>
  console.log(`✓ MCP Hono server → http://localhost:${info.port}/mcp`),
)
