import { describe, expect, it } from "vitest";

import { classifySimilarity, TOPIC_MATCH_THRESHOLD } from "@/lib/organize/scoring";

describe("topic scoring", () => {
  it("creates new topic for low similarity", () => {
    expect(classifySimilarity(0.45)).toBe("create-topic");
    expect(classifySimilarity(TOPIC_MATCH_THRESHOLD - 0.01)).toBe("create-topic");
  });

  it("links to existing topic at threshold", () => {
    expect(classifySimilarity(TOPIC_MATCH_THRESHOLD)).toBe("link-topic");
    expect(classifySimilarity(0.91)).toBe("link-topic");
  });
});
