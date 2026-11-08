"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminKeys } from "@/lib/api/keys";
import { DEMO_MODE } from "@/lib/api/config";
import * as real from "@/lib/api/admin";
import { useAccountEmail } from "@/lib/me";

/** Query keys of the admin pages; every key starts with "admin" so one invalidation refreshes them all. */
const key = (email: string | undefined, ...rest: unknown[]) =>
  adminKeys.list(email, String(rest[0] ?? ""), ...rest.slice(1));

/** The start page's counts. Also tells whether the account may use the admin area (403 when not). */
export function useOverview() {
  const email = useAccountEmail();
  return useQuery({
    queryKey: key(email, "overview"),
    queryFn: real.fetchOverview,
    enabled: !DEMO_MODE && !!email,
    retry: false,
  });
}

/** A list that loads more pages on request. */
function usePaged<T>(
  name: string,
  params: unknown[],
  fetchPage: (
    cursor: string | undefined,
  ) => Promise<{ items: T[]; nextCursor?: string | null }>,
) {
  const email = useAccountEmail();
  const query = useInfiniteQuery({
    queryKey: key(email, name, ...params),
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !DEMO_MODE && !!email,
    retry: false,
  });
  return { ...query, items: query.data?.pages.flatMap((p) => p.items) ?? [] };
}

export const useUsers = (f: real.ListFilter) =>
  usePaged("users", [f.q, f.status], (c) => real.fetchUsers(f, c));
export const useContent = (type: real.ContentType, f: real.ListFilter) =>
  usePaged("content", [type, f.q, f.status], (c) =>
    real.fetchContent(type, f, c),
  );
export const useReports = (status: string | undefined) =>
  usePaged("reports", [status], (c) => real.fetchReports(status, c));
export const useOrders = (f: real.ListFilter) =>
  usePaged("orders", [f.q, f.status], (c) => real.fetchOrders(f, c));
export const useAudit = (action: string | undefined) =>
  usePaged("audit", [action], (c) => real.fetchAudit(action, c));

/** Every admin action changes counts, lists and the audit log: refresh them all afterwards. */
export function useAdminAction<V, R>(run: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

export const actions = real;
