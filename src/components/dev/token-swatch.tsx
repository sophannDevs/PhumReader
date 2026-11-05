"use client";

import { useEffect, useRef } from "react";

/** Dev-only: shows a token's live computed value next to its swatch. */
export function TokenSwatch({ token, className }: { token: string; className: string }) {
  const valueRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (valueRef.current) {
      valueRef.current.textContent = getComputedStyle(document.documentElement)
        .getPropertyValue(`--${token}`)
        .trim();
    }
  }, [token]);

  return (
    <div className="flex items-center gap-3 rounded-card border bg-card p-3 shadow-xs">
      <span className={`size-9 shrink-0 rounded-control border ${className}`} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">--{token}</div>
        <div ref={valueRef} className="text-xs text-muted-foreground uppercase tabular-nums" />
      </div>
    </div>
  );
}
