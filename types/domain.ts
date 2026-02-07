export type ItemType = "chat" | "gpt" | "file" | "instruction" | "agent";

export type LlmProvider = "openai" | "anthropic";

export type BillingTier = "free" | "pro";

export type TopicNode = {
  id: string;
  name: string;
  parentTopicId: string | null;
  itemCount: number;
  children: TopicNode[];
};

export type WorkspaceSummary = {
  id: string;
  name: string;
  slug: string;
};

export type SearchResult = {
  id: string;
  itemId: string;
  type: ItemType;
  title: string;
  snippet: string;
  source: "title" | "content";
  score: number;
};

export type LlmConnectionStatus = {
  id: string;
  provider: LlmProvider;
  label: string;
  validatedAt: string | null;
  isActive: boolean;
};
