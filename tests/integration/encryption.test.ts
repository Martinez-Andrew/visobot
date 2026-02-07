import { describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

describe("api key encryption", () => {
  it("round-trips plaintext", async () => {
    vi.stubEnv("ENCRYPTION_KEY_BASE64", Buffer.alloc(32, 7).toString("base64"));
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("DEV_BYPASS_AUTH", "true");
    vi.stubEnv("DEV_USER_ID", "00000000-0000-0000-0000-000000000001");

    const original = "sk-test-secret";
    const encrypted = await encryptSecret(original);
    const decrypted = await decryptSecret(encrypted);

    expect(decrypted).toBe(original);
  });
});
