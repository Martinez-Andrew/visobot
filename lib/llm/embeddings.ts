import { env } from "@/lib/env";

export async function getEmbedding(input: string): Promise<number[] | null> {
  const config = env();
  if (!config.OPENAI_API_KEY) return null;

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.OPENAI_EMBEDDING_MODEL,
      input
    })
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  return payload.data?.[0]?.embedding ?? null;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (!magnitudeA || !magnitudeB) return 0;

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}
