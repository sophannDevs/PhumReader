import type { PolicyId } from "@/data"

/** The policies on /legal/[doc], in side-menu order (spec §20). Shared by the server route and the client page. */
export const POLICY_IDS: PolicyId[] = ["terms", "privacy", "refund", "community", "creator"]
export const isPolicyId = (id: string): id is PolicyId => (POLICY_IDS as string[]).includes(id)
