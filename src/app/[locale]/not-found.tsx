import { NotFoundView } from "@/components/pr/not-found-view"

// Fallback for the reader and login routes (no site chrome there).
export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <NotFoundView />
    </div>
  )
}
