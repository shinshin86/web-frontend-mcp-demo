import { useCallback, useEffect, useRef, useState } from "react";
import { getMcpClient } from "./mcpClient";
import type { ChatMessage } from "./types";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

// MCP tool definition
const RANDOM_INT_TOOL = {
  type: "function",
  function: {
    name: "randomInt",
    description:
      "Return a random integer from 0 (inclusive) up to, but not including, `max`. "
      + "If `max` is omitted the default upper-bound is 100.",
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
  },
} as const;


export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto‑scroll when new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatWithTools = useCallback(
    async (userPrompt: string): Promise<string> => {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string;
      if (!apiKey) throw new Error("VITE_OPENAI_API_KEY is not set");

      // React state messages to OpenAI format
      const history = messages.map(({ role, content }) => ({ role, content }));

      // Loop with GPT, and execute MCP when tool_call comes
      let reqMessages: any[] = [
        { role: "system", content: "You are a helpful assistant." },
        ...history,
        { role: "user", content: userPrompt },
      ];

      while (true) {
        const res = await fetch(OPENAI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-nano",
            messages: reqMessages,
            tools: [RANDOM_INT_TOOL],
            tool_choice: "auto",
          }),
        }).then((r) => r.json());

        const msg = res.choices?.[0]?.message;
        if (!msg) throw new Error("No response from OpenAI");

        // If tool_call is included
        if (msg.tool_calls?.length) {
          const call = msg.tool_calls[0];
          const { name, arguments: argsJson } = call.function;
          if (name === "randomInt") {
            const args = JSON.parse(argsJson || "{}") as { max?: number };

            // RPC to MCP
            const client = await getMcpClient();
            const out = await client.callTool({
              name: "randomInt",
              arguments: args,
            });
            const rand =
              (out.content as { text: string }[] | undefined)?.[0]?.text ?? "";

            // Send tool_result back to GPT to get the final answer
            reqMessages = [
              ...reqMessages,
              msg, // assistant(function_call)
              { role: "tool", content: rand, tool_call_id: call.id },
            ];
            continue; // Loop again to get the final answer
          }
        }

        // If a normal assistant response comes → Return this
        return msg.content ?? "(no response)";
      }
    },
    [messages],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const aiContent = await chatWithTools(input);
      setMessages((prev) => [...prev, { role: "assistant", content: aiContent }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Simple MCP demo: call "randomInt" tool with fixed numbers
  const handleMcpRandomInt = async () => {
    try {
      const client = await getMcpClient();
      const result = await client.callTool({
        name: "randomInt",
        arguments: {},
      });
      const contentArr = result.content as { text: string }[] | undefined;
      alert(`Random: ${contentArr?.[0]?.text}`)
    } catch (err: any) {
      alert(`MCP error: ${err.message}`);
    }
  };

  return (
    <div className="h-screen grid grid-rows-[auto_1fr_auto] p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">MCP × ChatGPT Demo</h1>

      <div className="overflow-y-auto space-y-2 bg-white p-4 rounded-xl shadow inner-scroll">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg ${
              m.role === "user" ? "bg-blue-50" : "bg-gray-50"
            }`}
          >
            <strong>{m.role === "user" ? "You" : "GPT"}:</strong> {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        className="mt-2 flex gap-2"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none"
          placeholder="Say something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50"
        >
          Send
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-green-600 text-white"
          onClick={handleMcpRandomInt}
        >
          MCP randomInt
        </button>
      </form>
    </div>
  );
}