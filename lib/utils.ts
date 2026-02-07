import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function chunkText(input: string, size = 1200): string[] {
  if (!input.trim()) return [];

  const chunks: string[] = [];
  for (let cursor = 0; cursor < input.length; cursor += size) {
    chunks.push(input.slice(cursor, cursor + size));
  }
  return chunks;
}

export function truncate(input: string, max = 140): string {
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
