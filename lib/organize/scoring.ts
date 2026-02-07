export const TOPIC_MATCH_THRESHOLD = 0.78;

export function classifySimilarity(score: number): "create-topic" | "link-topic" {
  if (score >= TOPIC_MATCH_THRESHOLD) {
    return "link-topic";
  }

  return "create-topic";
}
