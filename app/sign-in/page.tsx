"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({ provider: "google" });
  }

  async function sendMagicLink() {
    setLoading(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/app`
      }
    });

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Magic link sent. Check your inbox.");
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h1 className="prose-display text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Use Google or a passwordless magic link.</p>

        <div className="mt-6 space-y-3">
          <Button className="w-full" onClick={signInWithGoogle}>
            Continue with Google
          </Button>

          <div className="rounded-xl border border-[var(--border)] p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Magic link</p>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Button className="mt-2 w-full" variant="secondary" onClick={sendMagicLink} disabled={loading || !email}>
              {loading ? "Sending..." : "Send magic link"}
            </Button>
          </div>

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
