import { notFound } from "next/navigation"

// This page only calls notFound(), so there is no UI to validate for instant navigation.
export const instant = false

// Any URL that matches no page renders the 404 inside the site layout.
export default function CatchAll(): never {
  notFound()
}
