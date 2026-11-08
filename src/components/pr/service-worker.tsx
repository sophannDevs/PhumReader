"use client";

import { useEffect } from "react";

/** Registers the service worker that shows /offline when a page cannot be loaded (production only). */
export function ServiceWorker() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Without it the browser's own offline page appears; nothing else depends on it.
    });
  }, []);
  return null;
}
