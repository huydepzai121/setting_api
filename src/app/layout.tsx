import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Setting Key",
  description:
    "Generate Claude Code and Codex CLI configuration files and install scripts from a provider endpoint and API key.",
};

// Neutral App Router shell. The real form/result UI is built in a later
// batch (see openspec/changes/add-cli-config-generator/tasks.md, section 8).
export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
