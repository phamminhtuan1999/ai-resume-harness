"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Shared page-count / font selection for the Tailored CV page (US-078). The
// Export controls write it and the inline PDF preview reads it, so the preview
// renders exactly the document the user is about to download — not a default
// sample. Provided once around the page; components fall back to recommended
// values when rendered without a provider.
type RenderOptions = {
  pages: number;
  font: string;
  recommendedPages: number | null;
  recommendedFont: string | null;
  setPages: (value: number) => void;
  setFont: (value: string) => void;
};

const RenderOptionsContext = createContext<RenderOptions | null>(null);

const DEFAULT_PAGES = 1;
const DEFAULT_FONT = "modern_latex";

export function DraftCvRenderOptionsProvider({
  recommendedPages,
  recommendedFont,
  children,
}: {
  recommendedPages: number | null;
  recommendedFont: string | null;
  children: ReactNode;
}) {
  const [pages, setPages] = useState<number>(recommendedPages ?? DEFAULT_PAGES);
  const [font, setFont] = useState<string>(recommendedFont ?? DEFAULT_FONT);

  return (
    <RenderOptionsContext.Provider
      value={{ pages, font, recommendedPages, recommendedFont, setPages, setFont }}
    >
      {children}
    </RenderOptionsContext.Provider>
  );
}

/** Returns the shared render options, or null when no provider is mounted. */
export function useDraftCvRenderOptions(): RenderOptions | null {
  return useContext(RenderOptionsContext);
}
