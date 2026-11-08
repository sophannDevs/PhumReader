"use server"

import { revalidateTag } from "next/cache"

/**
 * Revalidates Next.js cached public data tags on demand (P5-01).
 * Called after publishing/editing a series or episode so cached public pages refresh instantly.
 */
export async function revalidateCatalogTags(tags: string[] = ["home", "catalog"]): Promise<void> {
  for (const tag of tags) {
    try {
      revalidateTag(tag, "default")
    } catch {
      // Ignored in development or contexts where caching is not active
    }
  }
}
