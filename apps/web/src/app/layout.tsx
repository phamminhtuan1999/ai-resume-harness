import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";

import { hasClerkEnv } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ApplyWise. Apply now or improve first?",
    template: "%s · ApplyWise",
  },
  description:
    "An AI career copilot for software engineers moving into AI, LLM, and applied AI roles. Analyze fit honestly, improve before applying, and track every application from one private workspace.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfdfc" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1311" },
  ],
};

// Set the theme before first paint to avoid a flash. Honors a stored choice,
// otherwise falls back to the system preference.
const themeScript = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(_){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fontVars = `${geistSans.variable} ${geistMono.variable} ${sora.variable}`;

  const shell = (
    <html lang="en" className={`${fontVars} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );

  if (!hasClerkEnv()) {
    return shell;
  }

  return <ClerkProvider>{shell}</ClerkProvider>;
}
