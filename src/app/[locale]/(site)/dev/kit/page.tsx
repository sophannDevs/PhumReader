import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { demoData } from "@/data";
import {
  AlertCircleIcon,
  CheckIcon,
  GiftIcon,
  InfoIcon,
  Share2Icon,
  TriangleAlertIcon,
  ZapIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KitQueries } from "@/components/dev/kit-queries";
import { KitPatterns } from "@/components/dev/kit-patterns";
import { KitComponents } from "@/components/dev/kit-components";
import { TokenSwatch } from "@/components/dev/token-swatch";

// Temporary preview page for Parts 2-4. Deleted in T53.
const groups: { title: string; tokens: [string, string][] }[] = [
  {
    title: "Brand",
    tokens: [
      ["primary", "bg-primary"],
      ["primary-hover", "bg-primary-hover"],
      ["primary-foreground", "bg-primary-foreground"],
      ["brand-ink", "bg-brand-ink"],
      ["brand-soft", "bg-brand-soft"],
      ["brand-soft-border", "bg-brand-soft-border"],
      ["selected", "bg-selected"],
      ["ring", "bg-ring"],
    ],
  },
  {
    title: "Neutral",
    tokens: [
      ["background", "bg-background"],
      ["foreground", "bg-foreground"],
      ["muted", "bg-muted"],
      ["muted-foreground", "bg-muted-foreground"],
      ["secondary", "bg-secondary"],
      ["accent", "bg-accent"],
      ["border", "bg-border"],
      ["input", "bg-input"],
    ],
  },
  {
    title: "Status, coin, UP",
    tokens: [
      ["destructive", "bg-destructive"],
      ["destructive-soft", "bg-destructive-soft"],
      ["destructive-border", "bg-destructive-border"],
      ["destructive-ink", "bg-destructive-ink"],
      ["warning", "bg-warning"],
      ["warning-soft", "bg-warning-soft"],
      ["warning-border", "bg-warning-border"],
      ["warning-ink", "bg-warning-ink"],
      ["coin", "bg-coin"],
      ["coin-foreground", "bg-coin-foreground"],
      ["up", "bg-up"],
      ["up-foreground", "bg-up-foreground"],
    ],
  },
  {
    title: "Dark surfaces",
    tokens: [
      ["surface", "bg-surface"],
      ["surface-panel", "bg-surface-panel"],
      ["surface-border", "bg-surface-border"],
      ["surface-border-strong", "bg-surface-border-strong"],
      ["surface-foreground", "bg-surface-foreground"],
      ["surface-quiet", "bg-surface-quiet"],
      ["scrim", "bg-scrim"],
    ],
  },
];

const readerThemes = ["light", "sepia", "dark"] as const;
const radii = [
  ["rounded-badge", "badge 6"],
  ["rounded-control", "control 8"],
  ["rounded-card", "card 12"],
  ["rounded-dialog", "dialog 14"],
  ["rounded-hero", "hero 20 / 16"],
  ["rounded-full", "chip"],
] as const;
const typeRows: [string, string, string, string][] = [
  ["type-hero", "Display", "Inter 48/52 · 700", "Glass Compass"],
  ["type-h1", "H1", "Inter 36/42 · 700", "Daily updates"],
  ["type-series-title", "Series title", "Inter 40/46 · 700", "The Quiet Kingdom"],
  ["type-h2", "H2", "Inter 24/30 · 600", "Trending now"],
  ["type-h3", "H3", "Inter 18/26 · 600", "Order summary"],
  ["type-h4", "H4", "Inter 15/22 · 600", "Fast Pass episodes"],
  ["type-card-title", "Card title", "Inter 14/20 · 600", "Paper Tigers"],
  ["type-body", "Body", "Inter 14/20 · 400", "New episodes every Thursday. Read the first 48 free."],
  ["type-lead", "Lead", "Inter 16/26 · 400", "Unlock Fast Pass episodes before they're free."],
  ["type-small", "Small", "Inter 13/18 · 500", "Owen Blake · Fantasy"],
  ["type-caption", "Caption", "Inter 12/16 · 500", "Nov 5, 2026 · 52.1K likes"],
  ["type-eyebrow", "Eyebrow", "Inter 12/16 · 600 · 0.06em", "For creators"],
];
const shadows = ["shadow-xs", "shadow-md", "shadow-lg"] as const;

export default async function DevKitPage({ params }: PageProps<"/[locale]/dev/kit">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const cover = demoData.series.find((x) => x.slug === "glass-compass") ?? demoData.series[0];
  const km = await getTranslations({ locale: "km", namespace: "common" });

  return (
    <main className="container flex flex-col gap-10 py-10">
      <header>
        <p className="text-xs font-semibold tracking-[0.06em] text-brand-ink uppercase">Dev kit</p>
        <h1 className="text-4xl font-bold tracking-tight">Design tokens</h1>
        <p className="mt-1 text-muted-foreground">Values below are read live from the computed CSS variables.</p>
      </header>

      {groups.map((g) => (
        <section key={g.title} className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">{g.title}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {g.tokens.map(([token, cls]) => (
              <TokenSwatch key={token} token={token} className={cls} />
            ))}
          </div>
        </section>
      ))}

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Green on dark text</h2>
        <div className="rounded-card border border-brand-soft-border bg-brand-soft p-4 text-sm text-brand-ink">
          <span className="rounded-control bg-primary px-3 py-2 font-semibold text-primary-foreground">
            Dark green text on #primary
          </span>
          <span className="ml-3">Green text on white uses --brand-ink.</span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Typography</h2>
        <div className="divide-y rounded-card border bg-card shadow-xs">
          {typeRows.map(([cls, name, spec, sample]) => (
            <div key={cls} className="grid items-center gap-1 px-5 py-4 md:grid-cols-[180px_1fr] md:gap-6">
              <div className="type-caption text-muted-foreground">
                {name}
                <br />
                {spec}
              </div>
              <div className={cls}>{sample}</div>
            </div>
          ))}
          <div className="grid items-center gap-1 px-5 py-4 md:grid-cols-[180px_1fr] md:gap-6">
            <div className="type-caption text-muted-foreground">
              Khmer · body
              <br />
              Kantumruy Pro 16/26
            </div>
            <p lang="km" className="text-base leading-[26px]">
              {km("tagline")}
            </p>
          </div>
          <div className="grid items-center gap-1 px-5 py-4 md:grid-cols-[180px_1fr] md:gap-6">
            <div className="type-caption text-muted-foreground">
              Novel · serif
              <br />
              Noto Serif 18 / 1.85
            </div>
            <p className="type-novel font-novel">
              The lantern flickered once, then held. Mara counted the steps down to the cellar.
            </p>
          </div>
          <div className="grid items-center gap-1 px-5 py-4 md:grid-cols-[180px_1fr] md:gap-6">
            <div className="type-caption text-muted-foreground">
              Numbers
              <br />
              tabular-nums
            </div>
            <div className="flex gap-8 text-lg font-semibold">
              <span className="tabular-nums">1,111,111</span>
              <span className="tabular-nums">8,888,888</span>
              <span className="tabular-nums">09:59</span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Motion</h2>
        <p className="type-body text-muted-foreground">
          Hover the cover: zoom 1.04 over 300 ms. Disabled under prefers-reduced-motion.
        </p>
        <a href="#motion" id="motion" className="group block w-40 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2">
          <div className="aspect-[3/4] overflow-hidden rounded-card border">
            <Image
              src={cover.cover}
              alt={`${cover.title} cover`}
              width={240}
              height={320}
              className="cover-zoom size-full object-cover"
            />
          </div>
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Button</h2>
        <p className="type-body text-muted-foreground">
          Variants: default, brand, secondary, outline, ghost, link, destructive. Sizes: sm 32, default 36, lg 44, icon.
          Tab through them to see the 2 px ring.
        </p>
        <div className="flex flex-col gap-4 rounded-card border bg-card p-5 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="brand">
              <ZapIcon /> Read episode 1
            </Button>
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Delete</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="brand" size="sm">Small</Button>
            <Button variant="brand">Default</Button>
            <Button variant="brand" size="lg">Large</Button>
            <Button variant="outline" size="icon" aria-label="Share">
              <Share2Icon />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Share (small)">
              <Share2Icon />
            </Button>
            <Button variant="brand" disabled>Disabled</Button>
            <Button variant="brand" loading>Loading</Button>
            <Button variant="outline" disabled>Disabled</Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Badge</h2>
        <div className="flex flex-wrap items-center gap-2 rounded-card border bg-card p-5 shadow-xs">
          <Badge variant="up">UP</Badge>
          <Badge variant="new">NEW</Badge>
          <Badge variant="warn"><ZapIcon /> Fast Pass · 5 coins</Badge>
          <Badge variant="brand">Unlocked</Badge>
          <Badge variant="outline"><CheckIcon /> Read</Badge>
          <Badge variant="outline">Fantasy</Badge>
          <Badge>Best value</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <span className="rounded-badge bg-muted p-1">
            <Badge variant="dark">Novel</Badge>
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Alert</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>Email or password is incorrect</AlertTitle>
            <AlertDescription>Check them and try again.</AlertDescription>
          </Alert>
          <Alert variant="brand" role="status">
            <GiftIcon />
            <AlertTitle>First purchase: double coins</AlertTitle>
            <AlertDescription>Your first pack of any size comes with the same number of coins again, free.</AlertDescription>
          </Alert>
          <Alert variant="warning" role="status">
            <TriangleAlertIcon />
            <AlertTitle>You need 2 more coins.</AlertTitle>
            <AlertDescription>Get coins to unlock this episode now.</AlertDescription>
          </Alert>
          <Alert role="status">
            <InfoIcon />
            <AlertTitle>Log in to unlock</AlertTitle>
            <AlertDescription>Your coins are saved to your account.</AlertDescription>
          </Alert>
        </div>
      </section>

      <KitQueries />

      <KitComponents />

      <KitPatterns />

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Novel reader themes</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {readerThemes.map((t) => (
            <div
              key={t}
              data-reader-theme={t}
              className="rounded-card border border-reader-border bg-reader-page p-4 text-reader-text"
            >
              <div className="font-semibold capitalize">{t}</div>
              <div className="text-sm text-reader-quiet">Quiet text on the {t} page.</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Radius and shadows</h2>
        <div className="flex flex-wrap gap-4">
          {radii.map(([cls, label]) => (
            <div key={cls} className={`flex h-16 w-28 items-center justify-center border bg-muted text-xs ${cls}`}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 py-2">
          {shadows.map((s) => (
            <div key={s} className={`flex h-16 w-28 items-center justify-center rounded-card bg-card text-xs ${s}`}>
              {s}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
