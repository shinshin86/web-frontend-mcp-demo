import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./types";
import { callRandomIntTool, chatWithGeminiTools, chatWithOpenAITools } from "./llm";

type Provider = "OPENAI" | "GEMINI";

export default function App() {
  const [provider, setProvider] = useState<Provider>("OPENAI");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto‑scroll when new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


  const chatDispatcher = useCallback(
    (prompt: string) =>
      provider === "OPENAI"
        ? chatWithOpenAITools(prompt, messages)
        : chatWithGeminiTools(prompt, messages),
    [messages, provider],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setInput("");
    setLoading(true);
    try {
      const aiContent = await chatDispatcher(input);
      setMessages((prev) => [...prev, { role: "assistant", content: aiContent }]);
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  // Simple MCP demo: call "randomInt" tool with fixed numbers
  const handleMcpRandomInt = async () => {
    try {
      const result = await callRandomIntTool({});
      alert(`Random: ${result}`)
    } catch (err: any) {
      alert(`MCP error: ${err.message}`);
    }
  };

  return (
    <div className="h-screen grid grid-rows-[auto_1fr_auto] p-4 max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-2">
        <h1 className="text-2xl font-semibold">MCP × {provider}</h1>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as Provider)}
          className="px-2 py-1 border rounded-lg text-sm"
        >
          <option value="OPENAI">OpenAI</option>
          <option value="GEMINI">Gemini</option>
        </select>
      </div>

      <div className="overflow-y-auto space-y-2 bg-white p-4 rounded-xl shadow inner-scroll">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded-lg ${
              m.role === "user" ? "bg-blue-50" : "bg-gray-50"
            }`}
          >
            <strong>{m.role === "user" ? "You" : "AI"}:</strong> {m.content}
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