"use client";

import { InfoIcon } from "lucide-react";
import { useLocale } from "next-intl";
import { useTranslations } from "@/i18n/translations";
import { useState } from "react";
import {
  AdminCard,
  AdminError,
  AdminHead,
  useAge,
  useDecisionTime,
  useReasonLabel,
  useReportText,
} from "@/components/pr/admin-kit";
import {
  AuditTab,
  ContentTab,
  OrdersTab,
  UsersTab,
} from "@/components/pr/admin-lists";
import { StatCard } from "@/components/pr/patterns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { DEMO_MODE } from "@/lib/api/config";
import type { AuditEntry } from "@/lib/api/admin";
import {
  ADMIN_TODAY,
  fromApiReport,
  priorityOf,
  sortReports,
  useAdminQueues,
  useAudit,
  useOverview,
  usePaymentCounts,
  useReports,
  type QueueReport,
} from "@/lib/admin";
import { formatShortDate, ictDate, weekdayOf } from "@/lib/format";
import { useAppStore, useUser } from "@/lib/store";

type Line = { text: string; meta: string; at: number };

/** The audit actions of a series review (V21-01) → the decision log's wording. */
const SERIES_AUDIT = new Map<string, "approve" | "changes" | "reject">([
  ["series.approve", "approve"],
  ["series.changes", "changes"],
  ["series.reject", "reject"],
]);

/**
 * /admin (spec §22 Overview, screens 22-admin-overview): "Today" with the targets, four counts that open each queue,
 * "Waiting longest" and recent decisions. Demo: the V2.1 queues and the decision log; real mode: the API's series
 * review queue (its count and oldest submission), open reports, open refund requests and "Paid but no coins" payments
 * (the overview's counts, without the ones decided here), and the audit log for recent decisions (series decisions made
 * here reach it once their Undo window closes). Real mode never loads the demo data.
 */
export function AdminPage() {
  const t = useTranslations("admin");
  const td = useTranslations("data");
  const locale = useLocale();
  const user = useUser();
  const [now] = useState(() => Date.now());
  const queues = useAdminQueues();
  const overview = useOverview();
  const realReports = useReports(DEMO_MODE ? undefined : "open");
  const payments = usePaymentCounts();
  const audit = useAudit(undefined);
  const decisions = useAppStore((s) => s.adminLog);
  const age = useAge();
  const when = useDecisionTime();
  const reasonLabel = useReasonLabel();
  const text = useReportText();

  const todayIso = DEMO_MODE ? ADMIN_TODAY : ictDate(now);
  const dateLabel = `${td(`dayFull.${weekdayOf(todayIso)}`)}${locale === "km" ? " " : ", "}${formatShortDate(todayIso, locale)}`;

  // `queues.query` is the demo data's load: real mode never runs it (it stays pending), so it counts in demo mode only.
  // Real mode: the payment counts come with the overview (B2), so they don't hold the page back.
  const loading = DEMO_MODE
    ? queues.query.isPending
    : overview.isPending || queues.seriesQuery.isPending;
  const failed = DEMO_MODE
    ? queues.query.isError
    : overview.isError || queues.seriesQuery.isError;

  const series = queues.series;
  const reports: QueueReport[] = DEMO_MODE
    ? queues.reports
    : sortReports(realReports.items.map((r) => fromApiReport(r, now)));
  const urgent = reports.filter((r) => priorityOf(r.reason) === "urgent").length;
  const oldest = queues.oldestHours;
  const seriesWaiting = queues.seriesTotal ?? series.length;
  const stuckLeft = DEMO_MODE ? queues.stuck.filter((s) => !s.done).length : payments.stuckLeft;

  const head = <AdminHead title={t("today")} line={t("todayLine", { date: dateLabel })} />;
  if (loading) {
    return (
      <>
        {head}
        <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-card max-md:h-[92px]" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2" aria-hidden>
          <Skeleton className="h-64 rounded-card" />
          <Skeleton className="h-64 rounded-card" />
        </div>
      </>
    );
  }
  if (failed) {
    return (
      <>
        {head}
        <AdminError
          onRetry={() => {
            if (DEMO_MODE) {
              void queues.query.refetch();
              return;
            }
            void overview.refetch();
            queues.seriesQuery.refetch();
            payments.refetch();
          }}
        />
      </>
    );
  }

  const light = (s: string) => <span className="font-normal">{s}</span>;
  const kpis = DEMO_MODE
    ? [
        {
          label: t("kpi_series"),
          value: series.length,
          change: series.length ? t("kpi_oldest", { age: age(oldest) }) : t("kpi_allDone"),
          tone: "muted" as const,
          href: "/admin/series",
        },
        {
          label: t("kpi_reports"),
          value: reports.length,
          change: t("kpi_urgent", { count: urgent }),
          tone: urgent ? ("down" as const) : ("muted" as const),
          href: "/admin/reports",
        },
        {
          label: t("kpi_refunds"),
          value: queues.refunds.length,
          change: t("kpi_refundTarget"),
          tone: "muted" as const,
          href: "/admin/payments",
        },
        {
          label: t("kpi_stuck"),
          value: stuckLeft,
          change: stuckLeft ? t("kpi_fixToday") : t("kpi_allDone"),
          tone: stuckLeft ? ("down" as const) : ("muted" as const),
          href: "/admin/payments",
        },
      ]
    : [
        {
          label: t("kpi_series"),
          value: seriesWaiting,
          change: seriesWaiting ? t("kpi_oldest", { age: age(oldest) }) : t("kpi_allDone"),
          tone: "muted" as const,
          href: "/admin/series",
        },
        {
          label: t("kpi_reports"),
          value: overview.data?.openReports ?? reports.length,
          change: t("kpi_urgent", { count: urgent }),
          tone: urgent ? ("down" as const) : ("muted" as const),
          href: "/admin/reports",
        },
        // The design's two payment cards (V21-06): open refund requests and "Paid but no coins".
        {
          label: t("kpi_refunds"),
          value: payments.refunds ?? 0,
          change: t("kpi_refundTarget"),
          tone: "muted" as const,
          href: "/admin/payments",
        },
        {
          label: t("kpi_stuck"),
          value: payments.stuck ?? 0,
          change: stuckLeft ? t("kpi_fixToday") : t("kpi_allDone"),
          tone: stuckLeft ? ("down" as const) : ("muted" as const),
          href: "/admin/payments",
        },
      ];

  // Waiting longest: the two oldest series, then the first two reports (urgent first).
  const waiting = [
    ...[...series]
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 2)
      .map((q) => ({
        key: `s-${q.id}`,
        title: q.title,
        meta: t("wait_series", { creator: q.creator }),
        age: age(q.hours),
        hot: q.hours > 24,
        href: `/admin/series?id=${encodeURIComponent(q.id)}`,
      })),
    ...reports.slice(0, 2).map((r) => ({
      key: `r-${r.id}`,
      title: reasonLabel(r.kind, r.reason),
      meta: t("wait_report", { target: text.target(r) || t(`kind_${r.kind}`) }),
      age: age(r.hours),
      hot: priorityOf(r.reason) === "urgent",
      href: `/admin/reports?id=${encodeURIComponent(r.id)}`,
    })),
  ];

  // Recent decisions: demo – the ones made here (newest first), then the demo team's; real mode – the audit log, which
  // has every decision made through the API (series reviews included).
  const realToday = ictDate(now);
  const own: Line[] = (DEMO_MODE ? decisions : [])
    .map((d) => ({
      text: t(`log_${d.action}` as "log_approve", { label: d.label }),
      meta: t("decisionMeta", { name: user?.name ?? "", time: when(d.at, realToday) }),
      at: d.at,
    }));
  const others: Line[] = DEMO_MODE
    ? queues.log.map((l) => ({
        text: t(l.key as "demoLog_1"),
        meta: t("decisionMeta", { name: l.name, time: when(l.at, ADMIN_TODAY) }),
        at: l.at,
      }))
    : audit.items.slice(0, 6).map((e: AuditEntry) => {
        const at = Date.parse(e.createdAt);
        const k = `audit_${e.action.replace(".", "_")}`;
        // A series review names the series, like the decisions made here: "Approved “Lantern Ferry”".
        const review = SERIES_AUDIT.get(e.action);
        const title = e.details.title;
        return {
          text:
            review && typeof title === "string" && title
              ? t(`log_${review}`, { label: title })
              : t.has(k as "audit_user_ban")
                ? t(k as "audit_user_ban")
                : e.action,
          meta: t("decisionMeta", { name: e.actorName ?? "–", time: when(at, realToday) }),
          at,
        };
      });
  const lines = DEMO_MODE ? [...own, ...others].slice(0, 4) : [...own, ...others].sort((a, b) => b.at - a.at).slice(0, 4);

  return (
    <>
      {head}
      <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <StatCard
            key={k.label}
            label={k.label}
            value={k.value}
            change={k.change ? light(k.change) : undefined}
            tone={k.tone}
            href={k.href}
          />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <AdminCard title={t("waiting")} titleId="ad-waiting">
          {waiting.length ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {waiting.map((w) => (
                <li key={w.key} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-px">
                    <Link
                      href={w.href}
                      className="truncate rounded-sm text-[13px] leading-[18px] font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {w.title}
                    </Link>
                    <span className="truncate text-xs leading-4 text-muted-foreground">{w.meta}</span>
                  </span>
                  <Badge variant={w.hot ? "up" : "secondary"} className="tabular-nums">
                    {w.age}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] leading-[18px] text-muted-foreground">{t("waitingEmpty")}</p>
          )}
        </AdminCard>
        <AdminCard title={t("decisions")} titleId="ad-decisions">
          {lines.length ? (
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {lines.map((l, i) => (
                <li key={i} className="flex min-w-0 flex-col gap-px">
                  <span className="truncate text-[13px] leading-[18px]">{l.text}</span>
                  <span className="truncate text-xs leading-4 text-muted-foreground">{l.meta}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] leading-[18px] text-muted-foreground">{t("decisionsEmpty")}</p>
          )}
        </AdminCard>
      </div>
    </>
  );
}

const V1: Record<"users" | "content" | "orders" | "audit", { title: string; body: () => React.ReactNode }> = {
  users: { title: "nav_users", body: () => <UsersTab /> },
  content: { title: "nav_content", body: () => <ContentTab /> },
  orders: { title: "nav_orders", body: () => <OrdersTab /> },
  audit: { title: "nav_audit", body: () => <AuditTab /> },
};

/**
 * Real mode: the V1 screens with no V2.1 design (users, content hide / restore, every order, the audit log) inside
 * the admin shell. Their actions run at once, as in V1. The demo has no data for them.
 */
export function AdminV1Page({ section }: { section: keyof typeof V1 }) {
  const t = useTranslations("admin");
  const page = V1[section];
  return (
    <>
      <AdminHead title={t(page.title as "nav_users")} line={DEMO_MODE ? undefined : t("v1Note")} />
      {DEMO_MODE ? (
        <div className="flex items-start gap-3 rounded-card border bg-card p-4 text-[13px] leading-[18px] text-muted-foreground shadow-xs">
          <InfoIcon className="mt-px size-4 shrink-0" aria-hidden />
          <p>{t("v1DemoNote")}</p>
        </div>
      ) : (
        page.body()
      )}
    </>
  );
}
