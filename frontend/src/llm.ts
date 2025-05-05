import type { ChatMessage } from "./types";
import { getMcpClient } from "./mcpClient";

// constants
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const GEMINI_MODEL = "gemini-2.0-flash-lite";
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

const OPENAI_TOOLS = [{ type: "function", function: RANDOM_INT_FUNCTION }];
const GEMINI_TOOLS = [{ functionDeclarations: [RANDOM_INT_FUNCTION] }];

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
        model: "gpt-4.1-nano",
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
