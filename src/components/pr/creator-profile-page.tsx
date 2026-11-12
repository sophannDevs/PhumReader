"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircleIcon, BookOpenIcon, CheckIcon, EyeIcon, MegaphoneIcon, PlusIcon, ShareIcon } from "lucide-react"
import Image from "next/image"
import { useLocale } from "next-intl"
import { useTranslations } from "@/i18n/translations"
import { useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { CreatorNav, useOwnHandle } from "@/components/layout/creator-nav"
import { NotFoundView } from "@/components/pr/not-found-view"
import { useReport } from "@/components/pr/report-dialog"
import { StateBox } from "@/components/pr/v2-primitives"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { derivedStats, type Weekday } from "@/data"
import { DEMO_MODE } from "@/lib/api/config"
import { toSeries } from "@/lib/api/catalog"
import * as real from "@/lib/api/creators"
import { creatorKeys, meKeys } from "@/lib/api/keys"
import { putFollow, reportUser } from "@/lib/api/me"
import { Link } from "@/i18n/navigation"
import {
  catalogSeriesBy,
  CREATING_SINCE,
  DEMO_CREATOR_BIO,
  DEMO_CREATOR_NAME,
  DEMO_CREATOR_POSTS,
} from "@/lib/creator-profiles"
import { withDemo } from "@/lib/demo-api"
import { daysFromToday, formatCount, formatShortDate, formatTime, initials, localDigits, parseCount } from "@/lib/format"
import { useLocalize } from "@/lib/localize"
import { useAccountEmail, useAskToLogin, useFailed } from "@/lib/me"
import { useDemoFlag } from "@/lib/queries"
import { creatorHandle, readerHref } from "@/lib/routes"
import { unblockUser } from "@/lib/moderation"
import { isCreator, useAppStore, useHydrated, useUser } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Effect } from "@animate-ui/react/primitives/effects/effect"

/**
 * Creator profile (spec §17, prototype Profile/): banner, avatar, verified badge, bio and stats; tabs Series / Updates /
 * About. Reader view: Follow (store `follows`), Share (copies the link), Report (account report, the shared dialog's
 * report-sent step) and Block / Unblock. Owner view (`?view=owner` on your own handle): CreatorNav, a "This is your
 * public profile" note and Edit profile (name, location, bio up to 200 characters; store `profile`).
 * Profiles come from the demo series' creator names; the demo creator account also shows its studio works
 * (store `myWorks`). Demo: demo data. Real API (V21-05): GET /creators/{handle} (bio, location, followers, the published
 * series), Follow with the creator's account, Edit profile saved with PATCH /creator/profile, and Report sent with
 * POST /users/{id}/report.
 */

type Item = {
  key: string
  title: string
  cover: string
  genre: string
  format: "comic" | "novel"
  live: boolean
  summary: string
  eps: number
  /** Update days in week order (V21-02: a series can have several); [] without a schedule */
  days: Weekday[]
  subs: string
  likes: string
  /** Episode 1 in the reader (catalog series only) */
  href?: string
  /** Studio works release at 6:00 PM ICT */
  studio: boolean
}

const BANNER =
  "radial-gradient(600px 200px at 20% 120%, #00dc64 0%, rgba(0,220,100,0) 70%), radial-gradient(500px 220px at 85% -20%, #fbbf24 0%, rgba(251,191,36,0) 70%), linear-gradient(120deg, #04210f, #0b3b22)"

/** 6:00 PM ICT (11:00 UTC) on any day, for the time label. */
const SIX_PM = Date.UTC(2026, 10, 7, 11)

const countFmt = (n: number) => (n < 100_000 ? Math.round(n).toLocaleString("en-US") : formatCount(n))

export function CreatorProfilePage({ handle, name: knownName, ownerView }: { handle: string; name: string | null; ownerView: boolean }) {
  if (!DEMO_MODE) return <RealProfile handle={handle} ownerView={ownerView} />
  return <DemoProfile handle={handle} knownName={knownName} ownerView={ownerView} />
}

/** Real API: loads the profile; an unknown handle is a 404 page. */
function RealProfile({ handle, ownerView }: { handle: string; ownerView: boolean }) {
  const ts = useTranslations("states")
  const email = useAccountEmail()
  const query = useQuery({ queryKey: creatorKeys.profile(handle, email ?? ""), queryFn: () => real.fetchCreatorProfile(handle) })
  if (query.isPending) return <ProfileSkeleton />
  if (query.isError)
    return (
      <div className="container py-10">
        <StateBox
          icon={AlertCircleIcon}
          tone="bad"
          title={ts("errorTitle")}
          text={ts("errorDescription")}
          action={
            <Button variant="outline" size="sm" className="mt-1" onClick={() => void query.refetch()}>
              {ts("retry")}
            </Button>
          }
        />
      </div>
    )
  if (!query.data) return <NotFoundView />
  return <Profile handle={handle} baseName={query.data.name} isOwner={ownerView && query.data.owner} api={query.data} />
}

function DemoProfile({ handle, knownName, ownerView }: { handle: string; knownName: string | null; ownerView: boolean }) {
  const user = useUser()
  const hydrated = useHydrated()
  const ownHandle = useOwnHandle()
  const isOwner = ownerView && hydrated && isCreator(user) && ownHandle === handle

  // A handle outside the demo data only exists as the signed-in creator's own profile; the owner view waits for the
  // stored account so the reader buttons don't flash first.
  if (!hydrated && (ownerView || !knownName)) return <ProfileSkeleton />
  if (!knownName && !isOwner) return <NotFoundView />
  return <Profile handle={handle} baseName={knownName ?? user?.name ?? handle} isOwner={isOwner} />
}

function Profile({ handle, baseName, isOwner, api }: { handle: string; baseName: string; isOwner: boolean; api?: real.CreatorProfile }) {
  const t = useTranslations("profile")
  const ts = useTranslations("states")
  const tt = useTranslations("toasts")
  const locale = useLocale()
  const loc = useLocalize()
  const user = useUser()
  const flag = useDemoFlag()
  const askToLogin = useAskToLogin()
  const { openReport, openBlock } = useReport()
  const ownHandle = useOwnHandle()
  const storedProfile = useAppStore((s) => s.profile)
  const myWorks = useAppStore((s) => s.myWorks)
  const qc = useQueryClient()
  const email = useAccountEmail()
  const failed = useFailed()
  const storeFollowing = useAppStore((s) => s.follows.includes(baseName))
  const following = api ? api.following : storeFollowing
  const blocked = useAppStore((s) => s.blocked.includes(baseName))
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState("series")
  const demoQuery = useQuery({
    queryKey: ["creator-profile", handle, flag],
    queryFn: () => withDemo(() => true, { empty: () => false }),
    enabled: !api,
  })
  // Real API: the profile is loaded already (RealProfile).
  const query = api ? { isPending: false, isError: false, data: true, refetch: () => Promise.resolve() } : demoQuery

  const isDemoCreator = !api && handle === creatorHandle(DEMO_CREATOR_NAME)
  const stored = !api && storedProfile && (storedProfile.handle ? storedProfile.handle === handle : handle === ownHandle) ? storedProfile : null
  const name = api ? api.name : stored?.name.trim() || baseName
  const place = api ? api.location?.trim() || t("defaultPlace") : stored?.location.trim() || t("defaultPlace")
  const catalog = api ? [] : catalogSeriesBy(baseName)
  const apiSeries = api ? api.series.map(toSeries) : []

  const items: Item[] = query.data
    ? [
        ...(!api && (isDemoCreator || isOwner)
          ? myWorks
              .filter((w) => w.status !== "draft")
              .sort((a, b) => Number(b.status === "published") - Number(a.status === "published"))
              .map((w) => ({
                key: w.id,
                title: w.title,
                cover: w.cover,
                genre: w.genre,
                format: w.format,
                live: w.status === "published",
                summary: w.summary,
                eps: w.eps,
                days: [w.day],
                subs: w.subs,
                likes: w.likes,
                studio: true,
              }))
          : []),
        ...[...catalog, ...apiSeries].map((s) => ({
          key: s.id,
          title: s.title,
          cover: s.cover,
          genre: s.genre,
          format: s.type,
          live: true,
          summary: loc.hook(s),
          eps: s.totalEpisodes,
          days: s.updateDays,
          subs: derivedStats(s).subscribers,
          likes: s.likes,
          href: readerHref(s, 1),
          studio: false,
        })),
      ]
    : []

  const genres = [...new Set(items.map((i) => loc.genre(i.genre)))].map((g) => (locale === "en" ? g.toLowerCase() : g))
  const genreList = genres.length > 1 ? t("listAnd", { a: genres.slice(0, -1).join(", "), b: genres[genres.length - 1] }) : (genres[0] ?? "")
  const bio = (api ? api.bio?.trim() : stored?.bio.trim()) || (isDemoCreator ? DEMO_CREATOR_BIO : genres.length ? t("bioDefault", { genres: genreList }) : t("bioEmpty"))
  const followers = api ? api.followers : items.reduce((n, i) => n + parseCount(i.subs), 0) + (following ? 1 : 0)
  const stats = [
    { k: t("statFollowers"), v: countFmt(followers) },
    { k: t("statSeries"), v: String(items.length) },
    { k: t("statLikes"), v: api ? formatCount(api.likes) : formatCount(items.reduce((n, i) => n + parseCount(i.likes), 0)) },
    { k: t("statEpisodes"), v: items.reduce((n, i) => n + i.eps, 0).toLocaleString("en-US") },
  ]
  const year = localDigits(api ? new Date(api.since).getUTCFullYear() : Number(CREATING_SINCE.slice(0, 4)), locale)

  async function toggleFollow() {
    if (!user) return askToLogin()
    if (!api) {
      useAppStore.getState().toggleFollow(baseName)
      toast.success(tt(following ? "unfollowed" : "followed", { name }))
      return
    }
    const next = !api.following
    const key = creatorKeys.profile(handle, email ?? "")
    await qc.cancelQueries({ queryKey: key })
    const before = qc.getQueryData<real.CreatorProfile | null>(key)
    qc.setQueryData<real.CreatorProfile | null>(key, (old) => (old ? { ...old, following: next, followers: old.followers + (next ? 1 : -1) } : old))
    try {
      await putFollow(api.id, next)
      toast.success(tt(next ? "followed" : "unfollowed", { name }))
    } catch (error) {
      qc.setQueryData(key, before)
      failed(error)
    } finally {
      void qc.invalidateQueries({ queryKey: key })
      // The reader's follows list (search's Follow buttons read it).
      if (email) void qc.invalidateQueries({ queryKey: meKeys.follows(email) })
    }
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}`)
      toast.success(t("linkCopied"))
    } catch {
      toast.error(tt("copyFailed"))
    }
  }
  function report() {
    if (!user) return askToLogin()
    const id = api?.id
    openReport({
      kind: "user",
      target: t("reportTarget", { name }),
      who: baseName,
      whoId: id,
      // Real API: POST /users/{id}/report; the dialog shows its case number (demo: kept on this device).
      onSend: id ? (reason, details) => reportUser(id, reason, details) : undefined,
    })
  }
  function block() {
    if (!user) return askToLogin()
    if (blocked) {
      void unblockUser(baseName, tt("actionFailed")).then((ok) => {
        if (ok) toast.success(t("unblocked", { name }))
      })
      return
    }
    openBlock(baseName, api?.id)
  }

  return (
    <>
      {isOwner ? (
        <>
          <CreatorNav active="profile" />
          <div className="container">
            <div role="note" className="mt-4 flex flex-wrap items-start gap-3 rounded-[10px] border border-brand-soft-border bg-brand-soft px-4 py-3.5">
              <EyeIcon className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-hidden />
              <div className="flex min-w-0 flex-1 basis-56 flex-col">
                <span className="text-sm leading-5 font-semibold">{t("ownerTitle")}</span>
                <span className="text-[13px] leading-[19px]">{t("ownerDesc")}</span>
              </div>
              <Button variant="outline" size="sm" className="-my-1 max-md:my-0" aria-expanded={editing} aria-controls="profile-edit" onClick={() => setEditing((v) => !v)}>
                {editing ? t("closeEditor") : t("editProfile")}
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {query.isPending ? (
        <ProfileSkeleton bare />
      ) : query.isError ? (
        <div className="container py-10">
          <StateBox
            icon={AlertCircleIcon}
            tone="bad"
            title={ts("errorTitle")}
            text={ts("errorDescription")}
            action={
              <Button variant="outline" size="sm" className="mt-1" onClick={() => void query.refetch()}>
                {ts("retry")}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <section aria-labelledby="pf-name" className={cn("border-b", isOwner && "mt-4")}>
            <div aria-hidden className="h-40 max-md:h-[110px]" style={{ backgroundImage: BANNER }} />
            <Effect asChild fade slide={{ direction: "up", offset: 10 }}>
              <div className="container flex items-end gap-6 pb-6 max-md:flex-col max-md:items-stretch max-md:gap-3">
                <span
                  aria-hidden
                  className="-mt-12 inline-flex size-[120px] shrink-0 self-start items-center justify-center rounded-full border-[5px] border-white bg-primary text-[40px] font-extrabold text-primary-foreground shadow-md max-md:-mt-10 max-md:size-[84px] max-md:border-4 max-md:text-[28px]"
                >
                  {initials(name)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-4 max-md:pt-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 id="pf-name" className="type-h2">
                      {name}
                    </h1>
                    <Badge variant="brand">
                      <CheckIcon aria-hidden />
                      {t("verified")}
                    </Badge>
                  </div>
                  <span className="text-[13px] leading-5 text-muted-foreground">{t("handleLine", { handle, place, year })}</span>
                  <p className="max-w-[64ch] text-[15px] leading-[23px] text-[#3f3f46]">{bio}</p>
                  <dl className="flex flex-wrap gap-7 pt-1 max-md:gap-[18px]">
                    {stats.map((s) => (
                      <div key={s.k} className="flex flex-col-reverse">
                        <dt className="text-xs leading-4 text-muted-foreground">{s.k}</dt>
                        <dd className="text-lg leading-6 font-bold tabular-nums">{s.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="flex shrink-0 items-center gap-2 max-md:w-full">
                  {isOwner ? null : (
                    <Button variant={following ? "secondary" : "brand"} aria-pressed={following} className="max-md:flex-1" onClick={() => void toggleFollow()}>
                      {following ? <CheckIcon aria-hidden /> : <PlusIcon aria-hidden />}
                      {following ? t("following") : t("follow")}
                    </Button>
                  )}
                  <Button variant="outline" size="icon" aria-label={t("share")} onClick={() => void share()}>
                    <ShareIcon />
                  </Button>
                  {/* Real API: no reporting or blocking yourself, also on your own public page (400 cannot_report_self). */}
                  {isOwner || api?.owner ? null : (
                    <>
                      <Button variant="ghost" onClick={report}>
                        {t("report")}
                      </Button>
                      <Button variant="ghost" aria-pressed={blocked} onClick={block}>
                        {blocked ? t("unblock") : t("block")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Effect>
          </section>

          {isOwner && editing ? (
            <div className="container">
              <EditProfile
                handle={handle}
                initial={{ name, location: api ? (api.location ?? "") : place, bio: api ? (api.bio ?? "") : bio }}
                real={api ? { email: email ?? "" } : undefined}
                onClose={() => setEditing(false)}
              />
            </div>
          ) : null}

          <div className="container flex flex-col gap-5 pt-2 pb-16">
            <Tabs value={tab} onValueChange={setTab} className="gap-5">
              <TabsList variant="line" aria-label={t("tabsLabel")} className="gap-1">
                <TabsTrigger value="series" className="px-3">{t("tabSeries")}</TabsTrigger>
                <TabsTrigger value="updates" className="px-3">{t("tabUpdates")}</TabsTrigger>
                <TabsTrigger value="about" className="px-3">{t("tabAbout")}</TabsTrigger>
              </TabsList>

              <TabsContent value="series">
                {items.length === 0 ? (
                  <StateBox icon={BookOpenIcon} title={t("noSeriesTitle")} text={t("noSeriesText", { name })} />
                ) : (
                  <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2">
                    {items.map((i, n) => (
                      <SeriesItem key={i.key} item={i} index={n} />
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="updates">
                {isDemoCreator && items.length > 0 ? (
                  <ul className="m-0 flex max-w-[720px] list-none flex-col gap-3 p-0">
                    {DEMO_CREATOR_POSTS.map((p, pi) => {
                      const ago = -daysFromToday(p.date)
                      return (
                        <Effect key={p.date} asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(pi, 10) * 40} inView>
                          <li className="flex flex-col gap-1.5 rounded-card border bg-card p-5 shadow-xs max-md:p-4">
                            <span className="text-xs leading-4 text-muted-foreground">
                              {ago <= 0 ? t("today") : ago < 7 ? t("daysAgo", { count: ago }) : formatShortDate(p.date, locale)}
                            </span>
                            <span className="type-h4">{p.title}</span>
                            <p className="text-[13px] leading-[19px] text-[#3f3f46]">{p.body}</p>
                            <span className="text-xs leading-4 text-muted-foreground">{t("postStats", { likes: p.likes, count: p.comments })}</span>
                          </li>
                        </Effect>
                      )
                    })}
                  </ul>
                ) : (
                  <StateBox icon={MegaphoneIcon} title={t("noUpdatesTitle")} text={t("noUpdatesText", { name })} />
                )}
              </TabsContent>

              <TabsContent value="about">
                <div className="rounded-card border bg-card shadow-xs">
                  <dl className="m-0 flex flex-col">
                    {[
                      { k: t("aboutLocation"), v: place },
                      { k: t("aboutLanguages"), v: t("languagesValue") },
                      { k: t("aboutSince"), v: t("sinceValue", { year }) },
                      {
                        k: t("aboutSchedule"),
                        v: items.some((i) => i.live && i.days.length) ? (
                          <span className="flex flex-col gap-0.5">
                            {items
                              .filter((i) => i.live && i.days.length)
                              .map((i) => (
                                <span key={i.key}>
                                  {i.studio
                                    ? t("scheduleTime", { title: i.title, day: loc.days(i.days, "full"), time: formatTime(SIX_PM, locale) })
                                    : t("scheduleItem", { title: i.title, day: loc.days(i.days, "full") })}
                                </span>
                              ))}
                          </span>
                        ) : (
                          t("noSchedule")
                        ),
                      },
                      { k: t("aboutContact"), v: t("contactValue") },
                    ].map((row) => (
                      <div key={row.k} className="grid grid-cols-[160px_minmax(0,1fr)] gap-3 px-5 py-3.5 text-sm not-first:border-t max-md:grid-cols-[110px_minmax(0,1fr)] max-md:px-4 max-md:py-3">
                        <dt className="text-muted-foreground">{row.k}</dt>
                        <dd className="m-0 font-medium">{row.v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </>
  )
}

function SeriesItem({ item: i, index }: { item: Item; index: number }) {
  const t = useTranslations("profile")
  const loc = useLocalize()
  return (
    <Effect asChild fade slide={{ direction: "up", offset: 8 }} delay={Math.min(index, 10) * 40} inView>
      <li className="flex gap-4 rounded-card border bg-card p-4 shadow-xs">
        {i.cover ? (
          <Image src={i.cover} alt="" width={240} height={320} className="aspect-[3/4] w-[120px] shrink-0 self-start rounded-[10px] object-cover max-md:w-[88px]" />
        ) : (
          <span aria-hidden className="aspect-[3/4] w-[120px] shrink-0 self-start rounded-[10px] bg-muted max-md:w-[88px]" />
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{loc.genre(i.genre)}</Badge>
            <Badge variant="outline">{t(i.format === "novel" ? "formatNovel" : "formatComic")}</Badge>
            {i.live ? null : <Badge variant="warn">{t("comingSoon")}</Badge>}
          </div>
          <h2 className="type-h3">{i.title}</h2>
          {i.summary ? <p className="text-[13px] leading-[19px] text-muted-foreground">{i.summary}</p> : null}
          <span className="text-xs leading-4 text-muted-foreground">
            {i.live
              ? t("metaLive", { unit: i.format, count: i.eps, day: i.days.length ? loc.days(i.days, "full") : "—", subs: i.subs })
              : t("metaSoon", { unit: i.format })}
          </span>
          {i.live && i.href ? (
            <div className="pt-1">
              <Button asChild variant="brand" size="sm">
                <Link href={i.href}>{t("readFirst", { unit: i.format })}</Link>
              </Button>
            </div>
          ) : null}
        </div>
      </li>
    </Effect>
  )
}

const editSchema = z.object({
  name: z.string().trim().min(2, "nameError").max(30, "nameError"),
  location: z.string().trim().max(30),
  bio: z.string().max(200),
})
type EditValues = z.infer<typeof editSchema>

function EditProfile({ handle, initial, onClose, real: realMode }: { handle: string; initial: EditValues; onClose: () => void; real?: { email: string } }) {
  const t = useTranslations("profile")
  const qc = useQueryClient()
  const failed = useFailed()
  const form = useForm<EditValues>({ resolver: zodResolver(editSchema), defaultValues: initial })
  const errors = form.formState.errors
  const bioLength = (useWatch({ control: form.control, name: "bio" }) ?? "").length

  async function save(values: EditValues) {
    if (realMode) {
      try {
        const saved = await real.updateCreatorProfile({ name: values.name.trim(), location: values.location.trim(), bio: values.bio.trim() })
        qc.setQueryData(creatorKeys.profile(handle, realMode.email), saved)
        // The studio name in the creator bar comes from the dashboard.
        void qc.invalidateQueries({ queryKey: creatorKeys.all })
      } catch (error) {
        failed(error)
        return
      }
    } else {
      useAppStore.getState().setProfile({ name: values.name.trim(), location: values.location.trim(), bio: values.bio.trim(), handle })
    }
    toast.success(t("saved"))
    onClose()
  }

  return (
    <form
      id="profile-edit"
      onSubmit={form.handleSubmit(save)}
      noValidate
      aria-labelledby="pf-edit-title"
      className="mt-4 flex flex-col gap-3.5 rounded-card border bg-card p-5 shadow-xs max-md:p-4"
    >
      <h2 id="pf-edit-title" className="type-h3">
        {t("editTitle")}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="pf-name-input">{t("fieldName")}</Label>
          <Input
            id="pf-name-input"
            maxLength={30}
            autoComplete="nickname"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "pf-name-error" : undefined}
            {...form.register("name")}
          />
          {errors.name ? (
            <p id="pf-name-error" className="text-[13px] leading-[18px] text-destructive">
              {t("nameError")}
            </p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="pf-place">{t("fieldLocation")}</Label>
          <Input id="pf-place" maxLength={30} autoComplete="address-level2" {...form.register("location")} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pf-bio">{t("fieldBio")}</Label>
        <Textarea id="pf-bio" rows={3} maxLength={200} aria-describedby="pf-bio-count" {...form.register("bio")} />
        <span id="pf-bio-count" className="self-end text-xs leading-4 text-muted-foreground tabular-nums">
          {t("bioCount", { count: bioLength })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="brand">
          {t("save")}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  )
}

export function ProfileSkeleton({ bare = false }: { bare?: boolean }) {
  return (
    <div aria-hidden className={cn(!bare && "pb-16")}>
      <div className="h-40 bg-muted max-md:h-[110px]" />
      <div className="container flex items-end gap-6 pb-6 max-md:flex-col max-md:items-start max-md:gap-3">
        <Skeleton className="-mt-12 size-[120px] shrink-0 rounded-full border-[5px] border-white max-md:-mt-10 max-md:size-[84px]" />
        <div className="flex flex-1 flex-col gap-2 pt-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-10 w-80 max-w-full" />
        </div>
      </div>
      <div className="container flex flex-col gap-5 border-t pt-6">
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-[192px] rounded-card" />
          <Skeleton className="h-[192px] rounded-card" />
        </div>
      </div>
    </div>
  )
}
