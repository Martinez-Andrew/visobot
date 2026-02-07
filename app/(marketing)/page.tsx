import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MarketingPage() {
  return (
    <main className="min-h-screen px-6 py-14 sm:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="animate-fade-in rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 p-8 shadow-sm backdrop-blur md:p-10">
          <p className="text-sm uppercase tracking-[0.18em] text-teal">Visobot</p>
          <h1 className="prose-display mt-4 text-4xl leading-tight text-ink md:text-6xl">
            Notion-style memory for your LLM work.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-600 md:text-lg">
            Connect your models, keep every chat recoverable, auto-bucket everything by topic, and continue work
            without losing context.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/app">
              <Button>Open Workspace</Button>
            </Link>
            <Link href="/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="animate-slide-up rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <h2 className="text-lg font-semibold">Never Lose a Chat</h2>
            <p className="mt-2 text-sm text-slate-600">
              Every conversation becomes a structured item you can search semantically and reopen instantly.
            </p>
          </article>
          <article className="animate-slide-up rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm [animation-delay:120ms]">
            <h2 className="text-lg font-semibold">Auto Topic Bucketing</h2>
            <p className="mt-2 text-sm text-slate-600">
              New chats, instructions, agents, and files are automatically grouped under related topics.
            </p>
          </article>
          <article className="animate-slide-up rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm [animation-delay:240ms]">
            <h2 className="text-lg font-semibold">Built for BYOK</h2>
            <p className="mt-2 text-sm text-slate-600">
              Connect OpenAI or Anthropic in minutes with plain-language setup that works for non-technical users.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
