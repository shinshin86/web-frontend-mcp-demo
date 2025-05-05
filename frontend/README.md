# Web Frontend MCP Demo - Frontend

## Integration of LLM Providers and Model Context Protocol (MCP)

This project demonstrates how to integrate multiple LLM providers (OpenAI, Gemini, Claude) with the Model Context Protocol (MCP) to extend AI capabilities with external tools.

## Application Architecture

The application consists of the following main components:

### mcpClient.ts
- Initializes and manages the MCP client using `@modelcontextprotocol/sdk`
- Implements a singleton pattern to reuse the client instance
- Creates a connection to the MCP endpoint using `StreamableHTTPClientTransport`
- Provides the `getMcpClient()` function that ensures a single client instance is created and reused

```typescript
// Simplified example from mcpClient.ts
export async function getMcpClient(): Promise<MCPClient> {
  if (clientPromise) return clientPromise;

  const client = new MCPClient({
    name: "random-int-server",
    version: "0.0.1",
  });
  
  // Connect to MCP endpoint and reuse the promise
  clientPromise = client.connect(transport).then(() => client);
  return clientPromise;
}
```

### llm.ts
- Handles API communication with each LLM provider (OpenAI, Gemini, Claude)
- Formats tool definitions for each provider
- Manages conversation history between user and AI
- Implements MCP tool calls and processes their results

```typescript
// Example of tool definition for all providers
const RANDOM_INT_FUNCTION = {
  name: "randomInt",
  description:
    "Return a random integer from 0 (inclusive) up to, but not including, `max`. If `max` is omitted the default upper‑bound is 100.",
  parameters: {
    type: "object",
    properties: {
      max: {
        type: "integer",
        minimum: 1,
        description: "Exclusive upper bound for the random integer",
      },
    },
  },
};

// Tool calling function
export async function callRandomIntTool(args: { max?: number }) {
  const client = await getMcpClient();
  const out = await client.callTool({ name: "randomInt", arguments: args });
  return (out.content as { text: string }[] | undefined)?.[0]?.text ?? "";
}
```

### App.tsx
- Implements the user interface
- Manages conversation state with React hooks
- Provides provider selection (OpenAI, Gemini, Claude)
- Processes tool calls by:
  1. Detecting when an LLM requests to use a tool
  2. Calling the MCP endpoint via `callRandomIntTool()`
  3. Sending the tool result back to the LLM to complete the response

The flow of a tool-using conversation:
1. User sends a message requiring a random number
2. The message is sent to the selected LLM with available tools defined
3. If the LLM decides to use the `randomInt` tool, it returns a tool call object
4. The frontend detects this and calls the MCP endpoint
5. The result from MCP is sent back to the LLM as a tool response
6. The LLM generates a final human-readable response incorporating the tool result

## Direct MCP Tool Usage

The application also demonstrates direct tool usage without an LLM as intermediary:

```typescript
// Example from App.tsx - Direct MCP tool call
const handleMcpRandomInt = async () => {
  try {
    const result = await callRandomIntTool({});
    alert(`Random: ${result}`)
  } catch (err: any) {
    alert(`MCP error: ${err.message}`);
  }
};
```

## Project Structure

The frontend project is organized as follows:

```
frontend/
├── src/
│   ├── App.tsx         # Main application component and LLM integration
│   ├── App.css         # Component-specific styles
│   ├── llm.ts          # API communication with LLM providers and tool definitions
│   ├── mcpClient.ts    # MCP client configuration and singleton implementation
│   ├── types.ts        # TypeScript type definitions
│   ├── main.tsx        # Application entry point
│   └── index.css       # Global styles
├── public/             # Static assets
└── ...configuration files
```

## Environment Variables

This application requires the following environment variables to be set:

- `VITE_OPENAI_API_KEY`: Your OpenAI API key for accessing GPT models
- `VITE_GEMINI_API_KEY`: Your Google API key for accessing Gemini models
- `VITE_CLAUDE_API_KEY`: Your Anthropic API key for accessing Claude models
- `VITE_MCP_ENDPOINT`: URL of the MCP server endpoint (http://localhost:8080/mcp)

You can set these in a `.env` file in the frontend directory:

```
# Create environment file
cp .env.example .env
```

```
VITE_OPENAI_API_KEY=your-openai-key
VITE_GEMINI_API_KEY=your-gemini-key
VITE_CLAUDE_API_KEY=your-claude-key
VITE_MCP_ENDPOINT="http://localhost:8080/mcp"
```

## Development

To start the frontend development server:

```bash
npm run dev
```

This will start the Vite development server with hot-reload enabled.

## Building

To build the frontend for production:

```bash
npm run build
```

The build output will be generated in the `dist` directory.