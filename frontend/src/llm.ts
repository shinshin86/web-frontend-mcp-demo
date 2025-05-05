import type { ChatMessage } from "./types";
import { getMcpClient } from "./mcpClient";

// constants
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4.1-nano";

const GEMINI_MODEL = "gemini-2.0-flash-lite";
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CLAUDE_MODEL = "claude-3-haiku-20240307";
const CLAUDE_ENDPOINT = "https://api.anthropic.com/v1/messages";

// tool definition
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
} as const;

// Provider‑specific mappers

const OPENAI_TOOLS = [{ type: "function", function: RANDOM_INT_FUNCTION }];
const GEMINI_TOOLS = [{ functionDeclarations: [RANDOM_INT_FUNCTION] }];
const CLAUDE_TOOLS = [{
  name: RANDOM_INT_FUNCTION.name,
  description: RANDOM_INT_FUNCTION.description,
  input_schema: RANDOM_INT_FUNCTION.parameters,
}];

export async function callRandomIntTool(args: { max?: number }) {
  const client = await getMcpClient();
  const out = await client.callTool({ name: "randomInt", arguments: args });
  return (out.content as { text: string }[] | undefined)?.[0]?.text ?? "";
}

export async function chatWithOpenAITools(
  userPrompt: string,
  history: ChatMessage[],
): Promise<string> {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;
  if (!apiKey) throw new Error("VITE_OPENAI_API_KEY is not set");

  let req: any[] = [
    { role: "system", content: "You are a helpful assistant." },
    ...history.map(({ role, content }) => ({ role, content })),
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
        model: OPENAI_MODEL,
        messages: req,
        tools: OPENAI_TOOLS,
        tool_choice: "auto",
      }),
    }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    });

    const msg = res.choices?.[0]?.message;
    if (!msg) throw new Error("No response from OpenAI");

    if (msg.tool_calls?.length) {
      const call = msg.tool_calls[0];
      if (call.function.name === "randomInt") {
        const args = JSON.parse(call.function.arguments || "{}") as { max?: number };
        const rand = await callRandomIntTool(args);
        req = [
          ...req,
          msg,
          { role: "tool", content: rand, tool_call_id: call.id },
        ];
        continue;
      }
    }

    return msg.content ?? "(no response)";
  }
}

export async function chatWithGeminiTools(
  userPrompt: string,
  history: ChatMessage[],
): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is not set");

  let req: any[] = [
    ...history.map(({ role, content }) => ({ role, parts: [{ text: content }] })),
    { role: "user", parts: [{ text: userPrompt }] },
  ];

  while (true) {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: req,
          tools: GEMINI_TOOLS,
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      });

    const cand = res.candidates?.[0];
    if (!cand) throw new Error("No response from Gemini");
    const parts: any[] = cand.content?.parts ?? [];

    const fc = parts.find((p) => p.functionCall);
    if (fc) {
      if (fc.functionCall.name === "randomInt") {
        const args = fc.functionCall.args as { max?: number };
        const rand = await callRandomIntTool(args);
        req = [
            ...req,
            { role: "model", parts: [fc] },
            {
              role: "tool",
              parts: [
                {
                  functionResponse: {
                    name: "randomInt",
                    response: { value: Number(rand) },
                  },
                },
              ],
            },
          ];

        continue;
      }
    }

    return parts.filter(p => p.text).map(p => p.text).join("") || "(no response)";
  }
}

export async function chatWithClaudeTools(
  userPrompt: string,
  history: ChatMessage[],
): Promise<string> {
  const apiKey = import.meta.env.VITE_CLAUDE_API_KEY as string | undefined;
  if (!apiKey) throw new Error("VITE_CLAUDE_API_KEY is not set");

  let claudeMsgs: any[] = history.map(({ role, content }) => ({
    role,
    content: [{ type: "text", text: content }],
  }));
  claudeMsgs.push({ role: "user", content: [{ type: "text", text: userPrompt }] });

  for (let depth = 0; depth < 3; depth++) {
    const res = await fetch(CLAUDE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        messages: claudeMsgs,
        tools: CLAUDE_TOOLS,
        max_tokens: 1024,
      }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    });

    const parts: any[] = res.content ?? [];
    if (res.stop_reason === "tool_use") {
      const toolUses = parts.filter((b: any) => b.type === "tool_use");
      if (!toolUses.length) throw new Error("tool_use block missing");

      const toolResults = await Promise.all(
        toolUses.map(async (u: any) => {
          if (u.name === "randomInt") {
            return {
              type: "tool_result",
              tool_use_id: u.id,
              content: String(await callRandomIntTool(u.input)),
            };
          }
        }),
      );

      const validResults = toolResults.filter(Boolean);
      const unhandled = toolUses.filter((u) => !validResults.find((v: any) => v.tool_use_id === u.id));
      if (unhandled.length) {
        throw new Error(`Unhandled tool(s): ${unhandled.map((u) => u.name).join(", ")}`);
      }

      claudeMsgs = [
        ...claudeMsgs,
        { role: "assistant", content: parts },
        { role: "user", content: toolResults },
      ];

      continue;
    }

    const answer = parts.filter((p: any) => p.type === "text").map((p: any) => p.text).join("");
    return answer || "(no response)";
  }
  throw new Error("Too many tool-calling hops");
}