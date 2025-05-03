# Web Frontend MCP Demo - Frontend

## Integration of ChatGPT and MCP

This project demonstrates how to integrate ChatGPT with the Model Context Protocol (MCP) to extend AI capabilities with external tools.

### How App.tsx and mcpClient.ts Work Together

The integration between ChatGPT and MCP is handled by two main components:

#### mcpClient.ts
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

#### App.tsx
- Implements the chat UI for user interaction
- Manages conversation state with React hooks
- Handles communication with OpenAI's Chat API
- Defines a tool (`randomInt`) that can be called during chat completion
- Processes tool calls by:
  1. Detecting when ChatGPT requests to use the `randomInt` tool
  2. Calling the MCP endpoint via `getMcpClient()`
  3. Sending the tool result back to ChatGPT to complete the response

The flow of a tool-using conversation:
1. User sends a message requiring a random number
2. The message is sent to ChatGPT with available tools defined
3. If ChatGPT decides to use the `randomInt` tool, it returns a `tool_calls` object
4. The frontend detects this and calls the MCP endpoint
5. The result from MCP is sent back to ChatGPT as a tool response
6. ChatGPT generates a final human-readable response incorporating the tool result

### Direct MCP Tool Usage

The app also demonstrates direct tool usage without ChatGPT as an intermediary:

```typescript
// Example from App.tsx - Direct MCP tool call
const handleMcpRandomInt = async () => {
  const client = await getMcpClient();
  const result = await client.callTool({
    name: "randomInt",
    arguments: {},
  });
  // Process and display result
};
```

## Project Structure

The frontend project is organized as follows:

```
frontend/
├── src/
│   ├── App.tsx         # Main application component and ChatGPT integration
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
- `VITE_MCP_ENDPOINT`: URL of the MCP server endpoint (http://localhost:8080/mcp)

You can set these in a `.env` file in the frontend directory:

```
# create env file
cp .env.example .env
```

```
VITE_OPENAI_API_KEY=your-openai-key
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