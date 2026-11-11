"use client";

import { ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "@/i18n/translations";
import type { ReactNode } from "react";
import type { RankingEntry, Series } from "@/data";
import { Link } from "@/i18n/navigation";
import { parseCount } from "@/lib/format";
import { useRankings } from "@/lib/queries";
import { seriesHref } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Num } from "@/i18n/num"

type Tone = "comic" | "novel";

const tones = {
  comic: {
    line: "border-surface-border",
    quiet: "text-surface-quiet",
    hover: "hover:bg-surface-panel",
  },
  novel: {
    line: "border-reader-border",
    quiet: "text-reader-quiet",
    hover: "hover:bg-reader-border/30",
  },
} as const;

function Row({
  series,
  rank,
  tone,
}: {
  series: Series;
  rank: number;
  tone: Tone;
}) {
  const t = useTranslations("cards");
  const c = tones[tone];
  return (
    <Link
      href={seriesHref(series)}
      className={cn(
        "flex min-w-0 items-center gap-3 border-b py-2.5 outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-ring",
        c.line,
        c.hover,
      )}
    >
      <div className="relative size-20 shrink-0 overflow-hidden bg-black/10">
        <Image
          src={series.cover}
          alt={t("cover", { title: series.title })}
          width={160}
          height={160}
          sizes="80px"
          className="size-full object-cover"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={cn("type-caption truncate font-normal", c.quiet)}>
          {series.genre}
        </p>
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="text-lg font-bold tabular-nums"><Num>{rank}</Num></span>
          <h3 className="type-card-title truncate text-base">{series.title}</h3>
        </div>
        <p className={cn("type-caption truncate font-normal", c.quiet)}>
          {series.creator}
        </p>
      </div>
    </Link>
  );
}

function Block({
  title,
  tone,
  children,
}: {
  title: string;
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1 flex items-center gap-1 border-b pb-3 text-xl font-semibold">
        <Link
          href="/rankings"
          className="flex items-center gap-1 rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {title}
          <ChevronRightIcon className="size-5" aria-hidden />
        </Link>
      </h2>
      <ol className={cn("flex flex-col", tones[tone].line)}>{children}</ol>
    </section>
  );
}

/** End of story: "Trending now" and "Most popular" lists, excluding the series being read. */
export function ReaderDiscover({
  series,
  tone,
}: {
  series: Series;
  tone: Tone;
}) {
  const t = useTranslations("reader");
  const comics = useRankings("comics");
  const novels = useRankings("novels");

  const trending: RankingEntry[] = (
    (series.type === "novel" ? novels.data : comics.data) ?? []
  )
    .filter((r) => r.series.id !== series.id)
    .slice(0, 5);
  const trendingIds = new Set(trending.map((r) => r.series.id));
  const popular = [...(comics.data ?? []), ...(novels.data ?? [])]
    .map((r) => r.series)
    .filter((s) => s.id !== series.id && !trendingIds.has(s.id))
    .sort((a, b) => parseCount(b.views) - parseCount(a.views))
    .slice(0, 5);

  if (trending.length === 0 && popular.length === 0) return null;

  return (
    <div className="flex flex-col gap-8">
      {trending.length > 0 ? (
        <Block title={t("trendingNow")} tone={tone}>
          {trending.map((r) => (
            <li key={r.series.id}>
              <Row series={r.series} rank={r.rank} tone={tone} />
            </li>
          ))}
        </Block>
      ) : null}
      {popular.length > 0 ? (
        <Block title={t("mostPopular")} tone={tone}>
          {popular.map((s, i) => (
            <li key={s.id}>
              <Row series={s} rank={i + 1} tone={tone} />
            </li>
          ))}
        </Block>
      ) : null}
    </div>
  );
}
