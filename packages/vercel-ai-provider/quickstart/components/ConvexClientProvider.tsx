"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convex = useMemo(() => {
    if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
      console.warn("NEXT_PUBLIC_CONVEX_URL not set");
      return null;
    }
    return new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL);
  }, []);

  if (!convex) {
    // Render without Convex for development without backend
    return <>{children}</>;
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
