"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/api";

export default function SettingsPage() {
  const [status, setStatus] = useState("");

  async function startCheckout() {
    setStatus("");
    const response = await apiFetch("/api/billing/checkout", { method: "POST" });
    const payload = await response.json();

    if (!response.ok) {
      setStatus(payload.error ?? "Failed to start checkout");
      return;
    }

    if (payload.url) {
      window.location.assign(payload.url);
    }
  }

  async function exportData() {
    setStatus("");
    const response = await apiFetch("/api/account/export");
    const payload = await response.json();

    if (!response.ok) {
      setStatus(payload.error ?? "Export failed");
      return;
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `visobot-export-${new Date().toISOString()}.json`;
    link.click();

    setStatus("Export downloaded.");
  }

  async function deleteAccount() {
    const confirmed = window.confirm("This permanently deletes your workspace. Continue?");
    if (!confirmed) return;

    setStatus("");
    const response = await apiFetch("/api/account/delete", { method: "POST" });
    const payload = await response.json();

    if (!response.ok) {
      setStatus(payload.error ?? "Delete failed");
      return;
    }

    setStatus("Workspace deleted.");
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="prose-display text-4xl">Settings</h1>
      <p className="mt-2 text-slate-600">Billing, data controls, and connection health.</p>

      <section className="mt-8 grid gap-4">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-semibold">Billing</h2>
          <p className="mt-1 text-sm text-slate-600">Upgrade to Pro for higher limits and faster indexing.</p>
          <Button className="mt-4" onClick={startCheckout}>
            Upgrade to Pro
          </Button>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-semibold">Data controls</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="ghost" onClick={exportData}>
              Export data
            </Button>
            <Button variant="secondary" onClick={deleteAccount}>
              Delete workspace
            </Button>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-xl font-semibold">Milestone 2 Preview</h2>
          <p className="mt-1 text-sm text-slate-600">
            Graph/node view is queued for the next milestone using item relationships and topic links.
          </p>
        </article>
      </section>

      {status ? <p className="mt-4 text-sm text-slate-600">{status}</p> : null}
    </main>
  );
}
