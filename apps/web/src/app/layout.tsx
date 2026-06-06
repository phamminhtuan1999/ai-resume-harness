import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { hasClerkEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApplyWise",
  description: "AI career copilot for software engineers applying to AI roles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shell = (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );

  if (!hasClerkEnv()) {
    return shell;
  }

  return <ClerkProvider>{shell}</ClerkProvider>;
}
