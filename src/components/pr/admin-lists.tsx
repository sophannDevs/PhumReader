"use client";

import type { UseInfiniteQueryResult } from "@tanstack/react-query";
import { InboxIcon } from "@/components/animate-ui/icons/inbox";
import { SearchIcon } from "@/components/animate-ui/icons/search";
import { useFormatter } from "next-intl";
import { useTranslations } from "@/i18n/translations";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ReasonDialog, type ReasonAsk } from "@/components/pr/admin-dialogs";
import { EmptyState } from "@/components/pr/empty-state";
import { NativeSelect } from "@/components/pr/settings-ui";
import { ErrorState } from "@/components/pr/error-state";
import { SkeletonRow } from "@/components/pr/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import {
  actions,
  useAdminAction,
  useAudit,
  useContent,
  useOrders,
  useUsers,
} from "@/lib/admin";
import { Effect } from "@animate-ui/react/primitives/effects/effect";
import type {
  AdminContent,
  AdminOrder,
  AdminUser,
  AuditEntry,
  ContentType,
} from "@/lib/api/admin";

type Variant =
  "default" | "secondary" | "outline" | "brand" | "warn" | "danger";
const STATE_BADGE: Record<string, Variant> = {
  published: "brand",
  visible: "brand",
  active: "brand",
  paid: "brand",
  open: "warn",
  pending: "warn",
  scheduled: "warn",
  review: "warn",
  changes: "warn",
  hidden: "danger",
  banned: "danger",
  failed: "danger",
  refunded: "secondary",
};

function StateBadge({ state }: { state: string }) {
  const t = useTranslations("admin");
  return (
    <Badge variant={STATE_BADGE[state] ?? "secondary"}>
      {t.has(`state_${state}`) ? t(`state_${state}` as "state_active") : state}
    </Badge>
  );
}

/** A search box that reports its text a moment after typing stops. */
function useSearch() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 250);
    return () => clearTimeout(id);
  }, [text]);
  return { text, setText, q };
}

function SearchBox({
  text,
  onChange,
  label,
}: {
  text: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div className="relative w-full md:max-w-sm">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={label}
        className="pl-9"
      />
    </div>
  );
}

/** A list filter on the animated Select (NativeSelect), labelled by `aria-label`. */
function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <NativeSelect
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      wrapperClassName="w-auto"
      className="h-10 rounded-md px-3 shadow-none focus-visible:border-input focus-visible:ring-2 focus-visible:ring-ring"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}

/** Loading, error and empty states around a list that loads more pages. */
function Listing<T>({
  query,
  items,
  row,
  filtering,
  label,
}: {
  query: UseInfiniteQueryResult<unknown>;
  items: T[];
  row: (item: T) => React.ReactNode;
  filtering: boolean;
  label: string;
}) {
  const t = useTranslations("admin");
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4 rounded-card border p-4" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonRow key={i} thumb="size-10" />
        ))}
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (items.length === 0) {
    return (
      <div className="rounded-card border bg-card">
        <EmptyState
          icon={filtering ? SearchIcon : InboxIcon}
          title={filtering ? t("noMatchTitle") : t("emptyTitle")}
          description={filtering ? t("noMatchDesc") : t("emptyDesc")}
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <ul
        className="divide-y rounded-card border bg-card shadow-xs"
        aria-label={label}
      >
        {items.map((item, i) => (
          <Effect key={i} asChild fade delay={Math.min(i, 10) * 30} inView>
            <li className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 md:flex-nowrap">
              {row(item)}
            </li>
          </Effect>
        ))}
      </ul>
      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t("loadMore")}
        </Button>
      ) : null}
    </div>
  );
}

function useWhen() {
  const format = useFormatter();
  return (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
}

const Main = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
    {children}
  </div>
);
const Sub = ({ children }: { children: React.ReactNode }) => (
  <p className="type-small truncate font-normal text-muted-foreground">
    {children}
  </p>
);
const Buttons = ({ children }: { children: React.ReactNode }) => (
  <div className="ml-auto flex shrink-0 flex-wrap gap-2">{children}</div>
);

// ---------------------------------------------------------------- users

export function UsersTab() {
  const t = useTranslations("admin");
  const when = useWhen();
  const { text, setText, q } = useSearch();
  const [status, setStatus] = useState("");
  const list = useUsers({ q, status });
  const [ask, setAsk] = useState<ReasonAsk | null>(null);
  const ban = useAdminAction((v: { id: string; reason: string }) =>
    actions.banUser(v.id, v.reason),
  );
  const unban = useAdminAction((id: string) => actions.unbanUser(id));

  const suspend = (u: AdminUser) =>
    setAsk({
      title: t("banTitle", { name: u.displayName }),
      description: t("banDesc"),
      confirm: t("ban"),
      required: true,
      destructive: true,
      done: t("banned", { name: u.displayName }),
      run: (reason) => ban.mutateAsync({ id: u.id, reason }),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBox text={text} onChange={setText} label={t("searchUsers")} />
        <Filter
          label={t("filterStatus")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: t("allStatuses") },
            { value: "active", label: t("state_active") },
            { value: "banned", label: t("state_banned") },
            { value: "deletion_pending", label: t("state_deletion_pending") },
          ]}
        />
      </div>
      <Listing
        query={list}
        items={list.items}
        filtering={q !== "" || status !== ""}
        label={t("tab_users")}
        row={(u: AdminUser) => (
          <>
            <Main>
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                <span className="truncate">{u.displayName}</span>
                {u.roles
                  .filter((r) => r !== "READER")
                  .map((r) => (
                    <Badge key={r} variant="outline">
                      {r.toLowerCase()}
                    </Badge>
                  ))}
              </p>
              <Sub>
                {u.email} · {t("joined", { date: when(u.createdAt) })}
              </Sub>
            </Main>
            <StateBadge state={u.status} />
            <Buttons>
              {u.status === "banned" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void unban
                      .mutateAsync(u.id)
                      .then(() =>
                        toast.success(t("unbanned", { name: u.displayName })),
                      )
                  }
                >
                  {t("unban")}
                </Button>
              ) : u.roles.includes("ADMIN") ? null : (
                <Button variant="outline" size="sm" onClick={() => suspend(u)}>
                  {t("ban")}
                </Button>
              )}
            </Buttons>
          </>
        )}
      />
      <ReasonDialog ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- content

const LIVE: Record<ContentType, string> = {
  series: "published",
  episode: "published",
  comment: "visible",
};
const TYPES: ContentType[] = ["series", "episode", "comment"];

export function ContentTab() {
  const t = useTranslations("admin");
  const { text, setText, q } = useSearch();
  const [type, setType] = useState<ContentType>("series");
  const [status, setStatus] = useState("");
  const list = useContent(type, { q, status });
  const [ask, setAsk] = useState<ReasonAsk | null>(null);
  const hide = useAdminAction((v: { c: AdminContent; reason: string }) =>
    actions.hideContent(v.c.type, v.c.id, v.reason),
  );
  const restore = useAdminAction((c: AdminContent) =>
    actions.restoreContent(c.type, c.id),
  );

  const takeDown = (c: AdminContent) =>
    setAsk({
      title: t("hideTitle", { title: c.title.slice(0, 60) }),
      description: t(`hideDesc_${c.type}`),
      confirm: t("hide"),
      required: true,
      destructive: true,
      done: t("hidden"),
      run: (reason) => hide.mutateAsync({ c, reason }),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBox text={text} onChange={setText} label={t("searchContent")} />
        <div className="flex gap-2">
          <Filter
            label={t("filterType")}
            value={type}
            onChange={(v) => {
              setType(v as ContentType);
              setStatus("");
            }}
            options={TYPES.map((v) => ({ value: v, label: t(`type_${v}`) }))}
          />
          <Filter
            label={t("filterStatus")}
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: t("allStatuses") },
              {
                value: LIVE[type],
                label: t(`state_${LIVE[type]}` as "state_published"),
              },
              { value: "hidden", label: t("state_hidden") },
            ]}
          />
        </div>
      </div>
      <Listing
        query={list}
        items={list.items}
        filtering={q !== "" || status !== ""}
        label={t("tab_content")}
        row={(c: AdminContent) => (
          <>
            <Main>
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                <span className="line-clamp-2 min-w-0">{c.title}</span>
                {c.openReports > 0 ? (
                  <Badge variant="warn">
                    {t("openReports", { count: c.openReports })}
                  </Badge>
                ) : null}
              </p>
              <Sub>
                {c.type === "episode"
                  ? `${t("episodeNo", { n: c.episodeNumber ?? 0 })} · `
                  : ""}
                {c.owner}
              </Sub>
            </Main>
            <StateBadge state={c.status} />
            <Buttons>
              {c.status === "published" || c.status === "visible" ? (
                <>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/series/${c.seriesSlug}`}>{t("view")}</Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => takeDown(c)}
                  >
                    {t("hide")}
                  </Button>
                </>
              ) : c.status === "hidden" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    void restore
                      .mutateAsync(c)
                      .then(() => toast.success(t("restored")))
                  }
                >
                  {t("restore")}
                </Button>
              ) : null}
            </Buttons>
          </>
        )}
      />
      <ReasonDialog ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- orders

export function OrdersTab() {
  const t = useTranslations("admin");
  const when = useWhen();
  const { text, setText, q } = useSearch();
  const [status, setStatus] = useState("");
  const list = useOrders({ q, status });
  const [ask, setAsk] = useState<ReasonAsk | null>(null);
  const refund = useAdminAction((v: { id: string; reason: string }) =>
    actions.refundOrder(v.id, v.reason),
  );

  const refundOrder = (o: AdminOrder) =>
    setAsk({
      title: t("refundTitle", { number: o.orderNumber }),
      description: t("refundDesc", { coins: o.coins, name: o.displayName }),
      confirm: t("refund"),
      required: true,
      destructive: true,
      done: t("refunded", { number: o.orderNumber }),
      run: (reason) => refund.mutateAsync({ id: o.id, reason }),
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SearchBox text={text} onChange={setText} label={t("searchOrders")} />
        <Filter
          label={t("filterStatus")}
          value={status}
          onChange={setStatus}
          options={[
            { value: "", label: t("allStatuses") },
            ...[
              "paid",
              "refunded",
              "pending",
              "failed",
              "cancelled",
              "expired",
            ].map((s) => ({
              value: s,
              label: t(`state_${s}` as "state_paid"),
            })),
          ]}
        />
      </div>
      <Listing
        query={list}
        items={list.items}
        filtering={q !== "" || status !== ""}
        label={t("tab_orders")}
        row={(o: AdminOrder) => (
          <>
            <Main>
              <p className="flex flex-wrap items-center gap-2 font-semibold tabular-nums">
                <span>{o.orderNumber}</span>
                <span className="font-normal text-muted-foreground">
                  {t("coins", { count: o.coins })}
                </span>
              </p>
              <Sub>
                {o.displayName} · {o.email} · {o.method.replace("_", " ")} ·{" "}
                {when(o.createdAt)}
              </Sub>
            </Main>
            <StateBadge state={o.status} />
            <Buttons>
              {o.refundable ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refundOrder(o)}
                >
                  {t("refund")}
                </Button>
              ) : null}
            </Buttons>
          </>
        )}
      />
      <ReasonDialog ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}

// ---------------------------------------------------------------- audit log

const AREAS = ["", "user.", "content.", "report.", "order."];

export function AuditTab() {
  const t = useTranslations("admin");
  const when = useWhen();
  const [area, setArea] = useState("");
  const list = useAudit(area || undefined);
  return (
    <div className="flex flex-col gap-4">
      <Filter
        label={t("filterArea")}
        value={area}
        onChange={setArea}
        options={AREAS.map((a) => ({
          value: a,
          label: a ? t(`area_${a.slice(0, -1)}` as "area_user") : t("allAreas"),
        }))}
      />
      <Listing
        query={list}
        items={list.items}
        filtering={area !== ""}
        label={t("tab_audit")}
        row={(e: AuditEntry) => (
          <Main>
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <span className="font-mono text-sm">{e.action}</span>
              <span className="font-normal text-muted-foreground">
                {e.targetType.toLowerCase()}{" "}
                {e.targetId ? e.targetId.slice(0, 8) : ""}
              </span>
            </p>
            <Sub>
              {e.actorName ?? "–"} · {when(e.createdAt)}
            </Sub>
            <p className="type-small font-normal break-words text-muted-foreground">
              {Object.entries(e.details)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(" · ")}
            </p>
          </Main>
        )}
      />
    </div>
  );
}
