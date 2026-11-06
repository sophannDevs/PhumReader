"use client";

import { LockIcon, LogInIcon, ShieldAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import {
  AuditTab,
  ContentTab,
  OrdersTab,
  ReportsTab,
  UsersTab,
} from "@/components/pr/admin-lists";
import { EmptyState } from "@/components/pr/empty-state";
import { ErrorState } from "@/components/pr/error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, usePathname } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import { DEMO_MODE } from "@/lib/api/config";
import { useOverview } from "@/lib/admin";
import { useAppStore, useUser } from "@/lib/store";

const TABS = [
  "overview",
  "reports",
  "users",
  "content",
  "orders",
  "audit",
] as const;
type Tab = (typeof TABS)[number];

function Shell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  return (
    <div className="container flex flex-col gap-6 py-8 md:py-10">
      <div className="flex flex-col gap-1">
        <p className="type-eyebrow">{t("eyebrow")}</p>
        <h1 className="type-h1">{t("title")}</h1>
      </div>
      {children}
    </div>
  );
}

function Counts({ go }: { go: (tab: Tab) => void }) {
  const t = useTranslations("admin");
  const overview = useOverview();
  if (!overview.data) return null;
  const o = overview.data;
  const cards: { label: string; value: number; tab: Tab }[] = [
    { label: t("count_reports"), value: o.openReports, tab: "reports" },
    { label: t("count_banned"), value: o.bannedUsers, tab: "users" },
    {
      label: t("count_hidden"),
      value: o.hiddenSeries + o.hiddenEpisodes + o.hiddenComments,
      tab: "content",
    },
    { label: t("count_refunds"), value: o.refundedOrders, tab: "orders" },
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <li key={c.label} className="rounded-card border bg-card p-4 shadow-xs">
          <button
            type="button"
            onClick={() => go(c.tab)}
            className="flex w-full flex-col gap-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="type-small font-normal text-muted-foreground">
              {c.label}
            </span>
            <span className="text-3xl font-semibold tabular-nums">
              {c.value}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** /admin: users, content, the report queue, orders with refunds and the audit log (A8, A9). ADMIN only. */
export function AdminPage() {
  const t = useTranslations("admin");
  const user = useUser();
  const pathname = usePathname();
  const overview = useOverview();
  const [tab, setTab] = useState<Tab>("overview");

  if (!user) {
    return (
      <Shell>
        <EmptyState
          icon={LogInIcon}
          title={t("loginTitle")}
          description={t("loginDesc")}
          className="py-16"
          action={
            <Button asChild variant="brand" size="lg">
              <Link
                href="/login"
                onClick={() => useAppStore.getState().setReturnTo(pathname)}
              >
                {t("login")}
              </Link>
            </Button>
          }
        />
      </Shell>
    );
  }
  if (DEMO_MODE) {
    return (
      <Shell>
        <EmptyState
          icon={LockIcon}
          title={t("demoTitle")}
          description={t("demoDesc")}
          className="py-16"
        />
      </Shell>
    );
  }
  if (overview.isPending) {
    return (
      <Shell>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      </Shell>
    );
  }
  if (overview.isError) {
    // The API decides who is an admin: anybody else gets 403.
    if (overview.error instanceof ApiError && overview.error.status === 403) {
      return (
        <Shell>
          <EmptyState
            icon={ShieldAlertIcon}
            title={t("noAccessTitle")}
            description={t("noAccessDesc")}
            className="py-16"
            action={
              <Button asChild variant="outline">
                <Link href="/">{t("home")}</Link>
              </Button>
            }
          />
        </Shell>
      );
    }
    return (
      <Shell>
        <ErrorState onRetry={() => void overview.refetch()} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        className="gap-5"
      >
        <div className="max-w-full overflow-x-auto">
          <TabsList aria-label={t("title")}>
            {TABS.map((v) => (
              <TabsTrigger key={v} value={v}>
                {t(`tab_${v}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="overview" className="flex flex-col gap-4">
          <Counts go={setTab} />
          <p className="type-small font-normal text-muted-foreground">
            {t("overviewHint")}
          </p>
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="content">
          <ContentTab />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersTab />
        </TabsContent>
        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </Shell>
  );
}
