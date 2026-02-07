import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  ENCRYPTION_KEY_BASE64: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  OPENAI_CLASSIFIER_MODEL: z.string().default("gpt-4o-mini"),
  INNGEST_EVENT_KEY: optionalString,
  INNGEST_SIGNING_KEY: optionalString,
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRO_PRICE_ID: optionalString,
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl,
  DEV_BYPASS_AUTH: z
    .string()
    .transform((value) => value === "true")
    .default("false"),
  DEV_USER_ID: z.preprocess(
    emptyToUndefined,
    z.string().uuid().default("00000000-0000-0000-0000-000000000001")
  )
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function env() {
  if (cachedEnv) return cachedEnv;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.errors
      .map((entry) => `${entry.path.join(".")}: ${entry.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
