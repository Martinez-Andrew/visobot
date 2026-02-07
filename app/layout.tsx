import type { Metadata } from "next";
import { Space_Grotesk, Newsreader } from "next/font/google";

import "@/app/globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader"
});

export const metadata: Metadata = {
  title: "Visobot | Notion for LLM Work",
  description:
    "A Notion-style workspace for AI chats, GPTs, instructions, files, and agents with automatic organization."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  );
}
