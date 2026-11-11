"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo } from "react";
import {
  demoData,
  type AdminReportItem,
  type AdminSeriesItem,
  type MyWork,
} from "@/data";
import { DEMO_MODE } from "@/lib/api/config";
import * as real from "@/lib/api/admin";
import { withDemo } from "@/lib/demo-api";
import { useAccountEmail } from "@/lib/me";
import { useDemoFlag } from "@/lib/queries";
import { useAppStore } from "@/lib/store";

/** Query keys of the admin pages; every key starts with "admin" so one invalidation refreshes them all. */
const key = (email: string | undefined, ...rest: unknown[]) =>
  ["admin", email ?? "", ...rest] as const;

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

// ------------------------------------------------------------------------------------------------
// V2.1 queues (spec §22). The series review queue, refund requests and "Paid but no coins" have no API yet: they
// run on demo data (demo-data.json `adminSeriesQueue`, the prototype's payment rows) plus the local store in both
// modes. The report queue uses `adminReportQueue` + the reader's own reports in demo mode, and GET /admin/reports in
// real mode. Handled demo items are remembered in the store's `adminLog` (id = "<queue item>:<id>").

/** The admin screens' "today" (screens 22-*: "Tuesday, Nov 10"); the demo queues' ages are relative to it. */
export const ADMIN_TODAY = "2026-11-10";

export type FlagKind = "contact" | "watermark" | "similar" | "other";
/** An automatic-check finding: `detail` is the handle or the similar title; `text` the raw line for "other". */
export type Flag = { kind: FlagKind; detail?: string; text?: string };

export type QueueSeries = {
  id: string;
  title: string;
  creator: string;
  format: "comic" | "novel";
  genre: string;
  /** "All ages", "13+", … */
  age: string;
  lang: "en" | "km";
  eps: number;
  /** Epoch ms of the submission, or null for "just now" */
  submittedAt: number | null;
  hours: number;
  cover: string;
  summary: string;
  flags: Flag[];
  /** In the store's `myWorks`: decisions change its status there */
  own: boolean;
};

export type ReportKind = "comment" | "series" | "episode" | "user";
export type Priority = "urgent" | "high" | "normal";

export type QueueReport = {
  id: string;
  kind: ReportKind;
  /** Reason id ("spam", "violence", …) or the API's free text */
  reason: string;
  /** "Comment by night_owl_22" (demo data, English) or the reporter's own words (store, their language) */
  target: string;
  /** The reported person ("" when unknown) */
  who: string;
  /** "Midnight Courier · Episode 41"; "" = reported from the reader app */
  where: string;
  /** The reported text; null = not stored ("Content as reported") */
  text: string | null;
  count: number;
  hours: number;
  /** The reporter's note */
  details: string;
  /** The reported account's history (demo data, English); "" = none */
  history: string;
  /** Sent from this device (store `reports`): the reporter's status follows the decision */
  mine: boolean;
  /** Real mode: the API report */
  api?: real.AdminReport;
};

export type PaymentMethod = "khqr" | "aba" | "card";
export type RefundRequest = {
  id: string;
  order: string;
  user: string;
  coins: number;
  bonus: boolean;
  method: PaymentMethod;
  /** ISO date of the request */
  date: string;
  /** The reader's words (stay English, like other demo content) or a known reason */
  reason: { quote: string } | { key: "double" };
  elig: { kind: "unused" } | { kind: "double" } | { kind: "partial"; spent: number; unused: number };
};
export type StuckPayment = {
  id: string;
  order: string;
  user: string;
  coins: number;
  bonus: boolean;
  /** Coins the reader should have received (pack + bonus) */
  credit: number;
  method: PaymentMethod;
  at: number;
};
export type DemoLogLine = { key: string; name: string; at: number };

const ict = (y: number, m: number, d: number, h: number, min: number) =>
  Date.UTC(y, m - 1, d, h - 7, min);

/** The prototype's refund requests (Admin page.js). */
export const DEMO_REFUNDS: RefundRequest[] = [
  {
    id: "F1",
    order: "TW-48213377",
    user: "Sokha P.",
    coins: 120,
    bonus: true,
    method: "khqr",
    date: "2026-11-09",
    reason: { quote: "I bought the wrong pack by mistake." },
    elig: { kind: "unused" },
  },
  {
    id: "F2",
    order: "TW-48207731",
    user: "Vibol K.",
    coins: 60,
    bonus: false,
    method: "aba",
    date: "2026-11-08",
    reason: { key: "double" },
    elig: { kind: "double" },
  },
  {
    id: "F3",
    order: "TW-48190020",
    user: "Linh T.",
    coins: 300,
    bonus: false,
    method: "card",
    date: "2026-10-21",
    reason: { quote: "I don’t read anymore." },
    elig: { kind: "partial", spent: 210, unused: 90 },
  },
];

/** The prototype's "Paid but no coins" rows: 30 + 3 bonus, and 10 coins. */
export const DEMO_STUCK: StuckPayment[] = [
  {
    id: "S1",
    order: "TW-48215502",
    user: "Dara K.",
    coins: 30,
    bonus: true,
    credit: 33,
    method: "khqr",
    at: ict(2026, 11, 10, 7, 58),
  },
  {
    id: "S2",
    order: "TW-48215488",
    user: "Chenda P.",
    coins: 10,
    bonus: false,
    credit: 10,
    method: "aba",
    at: ict(2026, 11, 10, 7, 41),
  },
];

/** The prototype's "Recent decisions" (other moderators), after the ones made here. */
export const DEMO_LOG: DemoLogLine[] = [
  { key: "demoLog_1", name: "Dara M.", at: ict(2026, 11, 10, 9, 40) },
  { key: "demoLog_2", name: "Sophea R.", at: ict(2026, 11, 10, 9, 12) },
  { key: "demoLog_3", name: "Dara M.", at: ict(2026, 11, 10, 8, 55) },
  { key: "demoLog_4", name: "Sophea R.", at: ict(2026, 11, 9, 16, 20) },
];

type AdminDemoData = {
  series: AdminSeriesItem[];
  reports: AdminReportItem[];
  refunds: RefundRequest[];
  stuck: StuckPayment[];
  log: DemoLogLine[];
  /** false under ?demo=empty: the store's own series and reports are left out too */
  local: boolean;
};

const fetchAdminDemo = () =>
  withDemo<AdminDemoData>(
    () => ({
      series: demoData.adminSeriesQueue,
      reports: demoData.adminReportQueue,
      refunds: DEMO_REFUNDS,
      stuck: DEMO_STUCK,
      log: DEMO_LOG,
      local: true,
    }),
    {
      empty: () => ({ series: [], reports: [], refunds: [], stuck: [], log: [], local: false }),
    },
  );

/** The decision log id of a queue item. */
export const decisionKey = (
  item: "series" | "report" | "refund" | "stuck",
  id: string,
) => `${item}:${id}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Nov 9, 4:12 PM" (ICT, the admin year) → epoch ms. */
function parseWhen(s: string): number | null {
  const m = /^(\w{3}) (\d{1,2}), (\d{1,2}):(\d{2}) (AM|PM)$/.exec(s.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[1]);
  if (month < 0) return null;
  const h = (Number(m[3]) % 12) + (m[5] === "PM" ? 12 : 0);
  return ict(Number(ADMIN_TODAY.slice(0, 4)), month + 1, Number(m[2]), h, Number(m[4]));
}

/** The demo data's flag lines → kinds the screens translate. */
export function parseFlag(line: string): Flag {
  const quoted = /[“"]([^”"]+)[”"]/.exec(line)?.[1];
  if (/handle|link|contact|phone/i.test(line)) return { kind: "contact", detail: quoted };
  if (/watermark/i.test(line)) return { kind: "watermark" };
  if (/similar/i.test(line)) return { kind: "similar", detail: quoted };
  return { kind: "other", text: line };
}

const normalTitle = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Automatic checks on a series submitted here: contact details in the summary, a title like a published one. */
function autoFlags(work: MyWork): Flag[] {
  const flags: Flag[] = [];
  const contact =
    /@[\w.]{3,}|https?:\/\/\S+|www\.\S+|t\.me\/\S+|\b\d{3}[ -]?\d{3}[ -]?\d{3,4}\b/i.exec(work.summary)?.[0];
  if (contact) flags.push({ kind: "contact", detail: contact });
  const mine = normalTitle(work.title);
  const twin =
    mine.length >= 4
      ? demoData.series.find((s) => {
          const other = normalTitle(s.title);
          return other === mine || other.includes(mine) || mine.includes(other);
        })
      : undefined;
  if (twin) flags.push({ kind: "similar", detail: twin.title });
  return flags;
}

const RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2 };

/** Spec §22: violence and sexual content first, then harassment, hate, stolen work and impersonation. */
export function priorityOf(reason: string): Priority {
  const id = reason.split(":")[0].trim().toLowerCase();
  if (/violence|sexual/.test(id)) return "urgent";
  if (/harass|hate|copyright|impersonate/.test(id)) return "high";
  return "normal";
}

/** Urgent first, then high, then normal; the newest first within a priority (prototype). */
export const sortReports = (list: QueueReport[]) =>
  [...list].sort((a, b) => RANK[priorityOf(a.reason)] - RANK[priorityOf(b.reason)] || a.hours - b.hours);

const hoursSince = (at: number, now = Date.now()) => Math.max(0, Math.floor((now - at) / 3_600_000));

/** API report → queue row (real mode). The API has no reported person, count or history. */
export function fromApiReport(r: real.AdminReport, now: number): QueueReport {
  return {
    id: r.id,
    kind: r.target.type,
    reason: r.reason,
    target: r.target.title ?? "",
    who: "",
    where: "",
    text: r.target.title ?? null,
    count: 1,
    hours: hoursSince(Date.parse(r.createdAt), now),
    details: r.details ?? "",
    history: "",
    mine: false,
    api: r,
  };
}

/** "Comment by night_owl_22" / the store's "comment by Vibol K." → sentence case. */
const sentence = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function fromSeriesItem(q: AdminSeriesItem, own: boolean): QueueSeries {
  return {
    id: q.id,
    title: q.title,
    creator: q.creator,
    format: /novel/i.test(q.format) ? "novel" : "comic",
    genre: q.genre,
    age: q.age,
    lang: q.lang === "English" ? "en" : "km",
    eps: Number.parseInt(q.eps, 10) || 0,
    submittedAt: parseWhen(q.when),
    hours: q.hours,
    cover: q.cover,
    summary: q.summary,
    flags: q.flags.map(parseFlag),
    own,
  };
}

/**
 * The V2.1 queues from demo data and the store: series waiting for review (demo queue + the creator's own series with
 * status "review"), reports (demo queue + the reader's own reports "In review"), refund requests and "Paid but no
 * coins". `query` carries the loading and error state (demo-api delay and ?demo= flags).
 */
export function useAdminQueues() {
  const flag = useDemoFlag();
  const query = useQuery({
    queryKey: ["admin-demo", flag],
    queryFn: fetchAdminDemo,
    staleTime: Infinity,
  });
  const myWorks = useAppStore((s) => s.myWorks);
  const reports = useAppStore((s) => s.reports);
  const log = useAppStore((s) => s.adminLog);
  const profileName = useAppStore((s) => s.profile?.name);
  const data = query.data;

  const lists = useMemo(() => {
    const handled = new Set(log.map((d) => d.id));
    if (!data) return { series: [], reports: [], refunds: [], stuck: [], log: [] };

    const works = new Map(myWorks.map((w) => [w.id, w]));
    // A series that is also one of the creator's works follows its store status (resubmitting brings it back).
    const listed = data.series
      .filter((q) => {
        const w = works.get(q.id);
        return w ? w.status === "review" : !handled.has(decisionKey("series", q.id));
      })
      .map((q) => fromSeriesItem(q, works.has(q.id)));
    const creator =
      profileName?.trim() || demoData.demoAccounts.find((a) => a.role === "creator")?.name || "";
    const own: QueueSeries[] = data.local
      ? myWorks
          .filter((w) => w.status === "review" && !data.series.some((q) => q.id === w.id))
          .map((w) => ({
            id: w.id,
            title: w.title,
            creator,
            format: w.format,
            genre: w.genre,
            age: "All ages",
            lang: "km" as const,
            eps: w.eps,
            submittedAt: null,
            hours: 0,
            cover: w.cover,
            summary: w.summary,
            flags: autoFlags(w),
            own: true,
          }))
      : [];

    const mine: QueueReport[] = data.local
      ? reports
          .filter((r) => r.status === "In review")
          .map((r) => ({
            id: r.id,
            kind: r.kind,
            reason: r.reason,
            target: sentence(r.target),
            who: r.who,
            where: "",
            text: null,
            count: 1,
            hours: hoursSince(r.at),
            details: r.details,
            history: "",
            mine: true,
          }))
      : [];
    const demoReports: QueueReport[] = data.reports
      .filter((r) => !handled.has(decisionKey("report", r.id)))
      .map((r) => ({ ...r, mine: false }));

    return {
      series: [...listed, ...own],
      reports: sortReports([...mine, ...demoReports]),
      refunds: data.refunds.filter((r) => !handled.has(decisionKey("refund", r.id))),
      stuck: data.stuck.map((s) => ({ ...s, done: handled.has(decisionKey("stuck", s.id)) })),
      log: data.log,
    };
  }, [data, myWorks, reports, log, profileName]);

  return { query, ...lists };
}

export type AdminQueues = ReturnType<typeof useAdminQueues>;
