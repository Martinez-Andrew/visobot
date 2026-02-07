import { env } from "@/lib/env";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

async function getKey() {
  const secret = env().ENCRYPTION_KEY_BASE64;
  if (!secret) {
    throw new Error("Missing ENCRYPTION_KEY_BASE64");
  }

  const keyBytes = Buffer.from(secret, "base64");

  if (keyBytes.byteLength !== 32) {
    throw new Error("ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes.");
  }

  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    ENCODER.encode(plaintext)
  );

  const payload = {
    iv: Buffer.from(iv).toString("base64"),
    cipher: Buffer.from(encrypted).toString("base64")
  };

  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

export async function decryptSecret(value: string): Promise<string> {
  const decoded = Buffer.from(value, "base64").toString("utf8");
  const payload = JSON.parse(decoded) as { iv: string; cipher: string };

  const key = await getKey();
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: Buffer.from(payload.iv, "base64")
    },
    key,
    Buffer.from(payload.cipher, "base64")
  );

  return DECODER.decode(decrypted);
}
