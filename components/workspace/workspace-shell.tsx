"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Link2, MessageSquareText, Search, Sparkles } from "lucide-react";

import type { ItemType, TopicNode } from "@/types/domain";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { truncate } from "@/lib/utils";
import { apiFetch } from "@/lib/client/api";

type ItemRecord = {
  id: string;
  type: ItemType;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  last_activity_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  token_usage: number | null;
  created_at: string;
};

function flattenTopics(nodes: TopicNode[]): TopicNode[] {
  const output: TopicNode[] = [];

  function walk(items: TopicNode[]) {
    for (const item of items) {
      output.push(item);
      if (item.children.length) {
        walk(item.children);
      }
    }
  }

  walk(nodes);
  return output;
}

function TopicTree({
  nodes,
  selectedTopicId,
  onSelect,
  depth = 0
}: {
  nodes: TopicNode[];
  selectedTopicId: string | null;
  onSelect: (topicId: string) => void;
  depth?: number;
}) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            className={`w-full rounded-lg px-2 py-1 text-left text-sm transition ${
              selectedTopicId === node.id ? "bg-teal/15 text-teal" : "text-slate-700 hover:bg-slate-100"
            }`}
            onClick={() => onSelect(node.id)}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
          >
            {node.name} <span className="text-xs text-slate-500">({node.itemCount})</span>
          </button>
          {node.children.length > 0 ? (
            <TopicTree nodes={node.children} selectedTopicId={selectedTopicId} onSelect={onSelect} depth={depth + 1} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function WorkspaceShell() {
  const [topics, setTopics] = useState<TopicNode[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [selectedItem, setSelectedItem] = useState<ItemRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ itemId: string; title: string; snippet: string }>>([]);
  const [prompt, setPrompt] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadTopics() {
    const response = await apiFetch("/api/topics/tree");
    const payload = await response.json();

    if (!response.ok) {
      setInfo(payload.error ?? "Failed to load topics");
      return;
    }

    setTopics(payload.topics ?? []);
    if (!selectedTopicId && payload.topics?.[0]?.id) {
      setSelectedTopicId(payload.topics[0].id);
    }
  }

  async function loadItems(topicId: string | null) {
    const url = topicId ? `/api/items?topicId=${topicId}` : "/api/items";
    const response = await apiFetch(url);
    const payload = await response.json();

    if (!response.ok) {
      setInfo(payload.error ?? "Failed to load items");
      return;
    }

    setItems(payload.items ?? []);
    if (payload.items?.length && !selectedItem) {
      setSelectedItem(payload.items[0]);
    }
  }

  async function loadMessages(threadId: string) {
    const response = await apiFetch(`/api/chats/${threadId}/messages`);
    const payload = await response.json();

    if (!response.ok) {
      setInfo(payload.error ?? "Failed to load chat history");
      return;
    }

    setMessages(payload.messages ?? []);
  }

  useEffect(() => {
    loadTopics();
  }, []);

  useEffect(() => {
    loadItems(selectedTopicId);
  }, [selectedTopicId]);

  useEffect(() => {
    if (selectedItem?.type !== "chat") {
      setMessages([]);
      return;
    }

    const threadId = String(selectedItem.metadata?.thread_id ?? "");
    if (threadId) {
      loadMessages(threadId);
    }
  }, [selectedItem]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.content.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const allTopics = useMemo(() => flattenTopics(topics), [topics]);

  async function runSearch() {
    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const response = await apiFetch(`/api/search?q=${encodeURIComponent(search.trim())}`);
    const payload = await response.json();

    if (!response.ok) {
      setInfo(payload.error ?? "Search failed");
      return;
    }

    setSearchResults(
      (payload.results ?? []).map((entry: { itemId: string; title: string; snippet: string }) => ({
        itemId: entry.itemId,
        title: entry.title,
        snippet: entry.snippet
      }))
    );
  }

  async function startChat() {
    setBusy(true);
    setInfo("");

    const response = await apiFetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Chat ${new Date().toLocaleDateString()}`,
        starterMessage: prompt || "Hello, I'd like help organizing this project."
      })
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setInfo(payload.error ?? "Failed to start chat");
      return;
    }

    setPrompt("");
    setInfo("Chat created.");

    await loadTopics();
    await loadItems(selectedTopicId);
  }

  async function sendMessage() {
    if (!selectedItem || selectedItem.type !== "chat") {
      setInfo("Select a chat first.");
      return;
    }

    const threadId = String(selectedItem.metadata?.thread_id ?? "");
    if (!threadId) {
      setInfo("This chat item has no thread_id in metadata yet.");
      return;
    }

    if (!prompt.trim()) return;

    setBusy(true);
    const response = await apiFetch(`/api/chats/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: prompt })
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setInfo(payload.error ?? "Failed to send message");
      return;
    }

    setPrompt("");
    await loadMessages(threadId);
    await loadTopics();
  }

  async function connectProvider() {
    setBusy(true);
    const response = await apiFetch("/api/llm-connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openai",
        label: "Primary OpenAI",
        apiKey: prompt
      })
    });

    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setInfo(payload.error ?? "Failed to connect provider");
      return;
    }

    setPrompt("");
    setInfo(`Connected with ${payload.modelCatalog?.length ?? 0} models detected.`);
  }

  async function importFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setBusy(true);
    const response = await apiFetch("/api/imports", {
      method: "POST",
      body: formData
    });
    const payload = await response.json();
    setBusy(false);

    if (!response.ok) {
      setInfo(payload.error ?? "Import failed");
      return;
    }

    setInfo(`Imported ${file.name} (${payload.chunksIndexed} chunks).`);
    await loadTopics();
    await loadItems(selectedTopicId);
  }

  return (
    <main className="grid min-h-screen grid-cols-1 gap-4 p-4 lg:grid-cols-[300px_360px_1fr] lg:p-6">
      <aside className="grid-pattern scroll-soft animate-fade-in rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Topics</p>
          <h1 className="prose-display mt-2 text-3xl">Workspace</h1>
        </div>

        <div className="mb-3 rounded-xl border border-[var(--border)] bg-white/80 p-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search all chats, files, agents..."
          />
          <div className="mt-2 flex items-center gap-2">
            <Button variant="ghost" onClick={runSearch} className="w-full">
              <Search className="mr-1 h-4 w-4" />
              Global Search
            </Button>
          </div>
        </div>

        <div className="scroll-soft max-h-[55vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-white/80 p-2">
          {topics.length ? (
            <TopicTree nodes={topics} selectedTopicId={selectedTopicId} onSelect={setSelectedTopicId} />
          ) : (
            <p className="text-sm text-slate-500">No topics yet. Start a chat or import a file.</p>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-[var(--border)] bg-white/80 p-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Quick actions</p>
          <div className="mt-2 grid gap-2">
            <Button variant="ghost" onClick={startChat} disabled={busy}>
              <MessageSquareText className="mr-1 h-4 w-4" />
              New Chat
            </Button>
            <Button variant="ghost" onClick={connectProvider} disabled={busy}>
              <Link2 className="mr-1 h-4 w-4" />
              Connect API Key
            </Button>
            <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
              <FileDown className="mr-1 h-4 w-4" />
              Import md/txt/json
              <input type="file" className="hidden" accept=".md,.txt,.json" onChange={importFile} />
            </label>
          </div>
        </div>
      </aside>

      <section className="scroll-soft animate-slide-up rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <header className="mb-3 border-b border-[var(--border)] pb-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Items</p>
          <h2 className="mt-1 text-xl font-semibold">{selectedTopicId ? "Selected Topic" : "All Items"}</h2>
          <p className="text-xs text-slate-500">
            {selectedTopicId
              ? allTopics.find((entry) => entry.id === selectedTopicId)?.name ?? "Unknown topic"
              : "Browse all content"}
          </p>
        </header>

        <div className="mb-3 rounded-xl border border-[var(--border)] bg-white/80 p-2">
          <Input
            placeholder="Draft message or paste API key for quick actions"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <div className="scroll-soft max-h-[60vh] overflow-y-auto space-y-2">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              className={`w-full rounded-xl border p-3 text-left transition ${
                selectedItem?.id === item.id
                  ? "border-teal bg-teal/10"
                  : "border-[var(--border)] bg-white/70 hover:border-slate-300"
              }`}
              onClick={() => setSelectedItem(item)}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{item.title}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-600">{item.type}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{truncate(item.content || "No content yet", 120)}</p>
            </button>
          ))}

          {!filteredItems.length ? <p className="text-sm text-slate-500">No items found for this topic yet.</p> : null}
        </div>
      </section>

      <section className="scroll-soft animate-slide-up rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 [animation-delay:120ms]">
        <header className="mb-3 border-b border-[var(--border)] pb-3">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Detail</p>
          <h2 className="mt-1 text-xl font-semibold">{selectedItem?.title ?? "Select an item"}</h2>
          <p className="text-xs text-slate-500">Continue threads and recover context quickly.</p>
        </header>

        {selectedItem ? (
          <div className="space-y-3">
            {selectedItem.type === "chat" ? (
              <div className="rounded-xl border border-[var(--border)] bg-white/80 p-3">
                <div className="scroll-soft mb-3 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                  {messages.length ? (
                    messages.map((message) => (
                      <article
                        key={message.id}
                        className={`rounded-lg p-2 text-sm ${
                          message.role === "assistant" ? "bg-teal/10 text-teal-900" : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-500">{message.role}</p>
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </article>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No chat history loaded yet.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Textarea
                    rows={4}
                    placeholder="Send a message to continue this thread"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                  />
                  <Button onClick={sendMessage} disabled={busy || !prompt.trim()}>
                    <Sparkles className="mr-1 h-4 w-4" />
                    Continue Chat
                  </Button>
                </div>
              </div>
            ) : (
              <article className="rounded-xl border border-[var(--border)] bg-white/80 p-3">
                <p className="mb-1 text-xs uppercase tracking-[0.16em] text-slate-500">{selectedItem.type}</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{selectedItem.content || "No content stored yet."}</p>
              </article>
            )}

            {searchResults.length ? (
              <article className="rounded-xl border border-[var(--border)] bg-white/80 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-slate-500">Search hits</p>
                <ul className="space-y-2">
                  {searchResults.map((result) => (
                    <li key={result.itemId} className="rounded-lg border border-[var(--border)] p-2 text-sm">
                      <p className="font-semibold">{result.title}</p>
                      <p className="text-slate-600">{truncate(result.snippet, 140)}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Select an item to view details.</p>
        )}

        {info ? <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{info}</p> : null}
      </section>
    </main>
  );
}
