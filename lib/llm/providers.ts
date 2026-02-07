import { z } from "zod";

import type { LlmProvider } from "@/types/domain";

const openAiModelSchema = z.object({
  id: z.string()
});

const anthropicModelSchema = z.object({
  id: z.string(),
  display_name: z.string().optional()
});

export async function validateProviderKey(provider: LlmProvider, apiKey: string) {
  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error("OpenAI API key validation failed.");
    }

    const data = (await response.json()) as { data: unknown[] };
    const models = data.data
      .map((entry) => openAiModelSchema.safeParse(entry))
      .filter((entry) => entry.success)
      .slice(0, 20)
      .map((entry) => entry.data.id);

    return { status: "validated", models };
  }

  const response = await fetch("https://api.anthropic.com/v1/models", {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    }
  });

  if (!response.ok) {
    throw new Error("Anthropic API key validation failed.");
  }

  const data = (await response.json()) as { data: unknown[] };
  const models = data.data
    .map((entry) => anthropicModelSchema.safeParse(entry))
    .filter((entry) => entry.success)
    .slice(0, 20)
    .map((entry) => entry.data.id);

  return { status: "validated", models };
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function sendProviderChat(params: {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
}) {
  const { provider, apiKey, model, messages } = params;

  if (provider === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      throw new Error("OpenAI chat call failed.");
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { total_tokens?: number };
    };

    return {
      content: data.choices?.[0]?.message?.content ?? "I couldn't generate a response.",
      tokens: data.usage?.total_tokens ?? 0
    };
  }

  const userMessages = messages.filter((entry) => entry.role !== "system").map((entry) => ({
    role: entry.role === "assistant" ? "assistant" : "user",
    content: entry.content
  }));

  const systemMessage = messages.find((entry) => entry.role === "system")?.content;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 800,
      system: systemMessage,
      messages: userMessages
    })
  });

  if (!response.ok) {
    throw new Error("Anthropic chat call failed.");
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const text = data.content?.find((entry) => entry.type === "text")?.text ?? "I couldn't generate a response.";
  const tokens = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

  return {
    content: text,
    tokens
  };
}
