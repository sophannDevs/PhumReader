import { z } from "zod";

/**
 * Schema and types for src/data/demo-data.json, the only source of demo content.
 * The JSON is validated once at module load (see ./index.ts), so every field
 * below is guaranteed at runtime and typed with literal unions where it matters.
 */

export const localeSchema = z.enum(["en", "km"]);
export const seriesTypeSchema = z.enum(["comic", "novel"]);
export const genreSchema = z.enum([
  "Drama",
  "Fantasy",
  "Comedy",
  "Action",
  "Slice of life",
  "Romance",
  "Superhero",
  "Sci-fi",
]);
export const weekdaySchema = z.enum(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
/** "hiatus" (On break) comes from the real API only (V21-02); the demo series are ongoing or completed. */
export const seriesStatusSchema = z.enum(["ongoing", "completed", "hiatus"]);
export const episodeAccessSchema = z.enum(["free", "fastpass"]);
export const paymentMethodIdSchema = z.enum(["khqr", "aba", "card"]);
export const purchaseStatusSchema = z.enum(["Paid", "Failed", "Cancelled"]);
export const packTagSchema = z.enum(["Popular", "Best value"]);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const positiveInt = z.number().int().positive();
const nonNegativeInt = z.number().int().nonnegative();

export const demoAccountSchema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
  name: z.string().min(1),
  startingCoins: nonNegativeInt,
  verificationCode: z.string().regex(/^\d{6}$/),
});

export const seriesSchema = z.strictObject({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  type: seriesTypeSchema,
  genre: genreSchema,
  creator: z.string().min(1),
  /** The creator's account (real API only): Follow uses it */
  creatorId: z.string().optional(),
  /** The creator's profile handle (real API only); the demo derives it from the name (`creatorHref`) */
  creatorHandle: z.string().optional(),
  /** Public path, e.g. "/covers/<id>.svg" */
  cover: z.string().startsWith("/covers/"),
  /** Pre-formatted count such as "1.6M" */
  views: z.string(),
  /** Pre-formatted count such as "871K" */
  likes: z.string(),
  freeEpisodes: positiveInt,
  fastPassEpisodes: nonNegativeInt,
  totalEpisodes: positiveInt,
  /** The first update day (`updateDays[0]`); null for a series without a schedule (the real API) */
  updateDay: weekdaySchema.nullable(),
  /** Human schedule such as "Every Sun" or "Every Mon and Thu"; "" without a schedule */
  schedule: z.string(),
  badges: z.strictObject({ up: z.boolean(), isNew: z.boolean() }),
  status: seriesStatusSchema,
  language: z.array(localeSchema).min(1),
  /** all, teen (13+), teen16 (16+) or mature (18+) */
  ageRating: z.string(),
})
  // Every update day in week order (V21-02: a series can come out on several days). The demo data has one per
  // series, so the list is that day; the real API sends the whole list (src/lib/api/catalog.ts).
  .transform((s) => ({ ...s, updateDays: s.updateDay ? [s.updateDay] : [] }));

export const heroSlideSchema = z.strictObject({
  /** Series slug */
  series: z.string().min(1),
  tag: z.string(),
  blurb: z.string(),
});

export const continueEntrySchema = z.strictObject({
  /** Series slug */
  series: z.string().min(1),
  episode: positiveInt,
  /** 0..1 */
  progress: z.number().min(0).max(1),
});

export const episodeSchema = z.strictObject({
  n: positiveInt,
  title: z.string(),
  /** Display date such as "Nov 5, 2026"; for Fast Pass episodes this is the free release date */
  date: z.string(),
  likes: z.string(),
  /** Public path, e.g. "/covers/<id>.svg" */
  thumb: z.string(),
  access: episodeAccessSchema,
  isUp: z.boolean(),
  /** Fast Pass price in coins; only the real API sends it (while the episode is still Fast Pass). See `episodePrice`. */
  price: positiveInt.optional(),
});

export const panelSchema = z.strictObject({
  /** Public path, e.g. "/panels/<id>.svg" */
  src: z.string().startsWith("/panels/"),
  width: positiveInt,
  height: positiveInt,
  alt: z.string(),
});

export const novelBlockSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("paragraph"), text: z.string() }),
  z.strictObject({ type: z.literal("heading"), text: z.string() }),
  z.strictObject({ type: z.literal("quote"), text: z.string() }),
  z.strictObject({ type: z.literal("scene-break") }),
]);

export const commentSchema = z.strictObject({
  name: z.string(),
  /** Relative time such as "2h" or "1d" */
  when: z.string(),
  text: z.string(),
  likes: nonNegativeInt,
  top: z.boolean().optional(),
});

export const coinPackSchema = z.strictObject({
  coins: positiveInt,
  bonus: nonNegativeInt,
  tag: packTagSchema.nullable(),
  /** Placeholder such as "[PRICE USD]" */
  priceUSD: z.string(),
  /** Placeholder such as "[PRICE KHR]" */
  priceKHR: z.string(),
});

export const paymentMethodSchema = z.strictObject({
  id: paymentMethodIdSchema,
  label: z.string(),
  desc: z.string(),
  recommended: z.boolean().optional(),
  note: z.string().optional(),
});

export const purchaseSchema = z.strictObject({
  date: isoDate,
  pack: z.string(),
  coins: nonNegativeInt,
  method: paymentMethodIdSchema,
  status: purchaseStatusSchema,
});

export const faqItemSchema = z.strictObject({ q: z.string(), a: z.string() });

export const authQuoteSchema = z.strictObject({ text: z.string(), by: z.string() });

export const authStringsSchema = z.strictObject({
  back: z.string(),
  login: z.string(),
  signup: z.string(),
  orEmail: z.string(),
  email: z.string(),
  password: z.string(),
  forgot: z.string(),
  remember: z.string(),
  name: z.string(),
  create: z.string(),
  terms: z.string(),
  loginTitle: z.string(),
  loginSub: z.string(),
  signupTitle: z.string(),
  signupSub: z.string(),
  verifyTitle: z.string(),
  verifySub: z.string(),
  verify: z.string(),
  noCode: z.string(),
  changeEmail: z.string(),
  forgotTitle: z.string(),
  forgotSub: z.string(),
  sendLink: z.string(),
  backLogin: z.string(),
  sentTitle: z.string(),
  sentSub: z.string(),
  sentSub2: z.string(),
  taking: z.string(),
  legal: z.string(),
  quote: z.string(),
});

// ---- V2.1 additions (design/demo-data.json)

export const demoAccountRoleSchema = z.enum(["reader", "creator", "moderator"]);
export const demoAccountV2Schema = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
  name: z.string().min(1),
  role: demoAccountRoleSchema,
});

export const brandSchema = z.strictObject({
  name: z.string(),
  nameKm: z.string(),
  domain: z.string(),
  storagePrefix: z.string(),
});

export const notificationKindSchema = z.enum(["update", "comment", "coins", "system"]);
export const notificationGroupSchema = z.enum(["Today", "This week", "Earlier"]);
export const notificationSchema = z.strictObject({
  id: z.string(),
  kind: notificationKindSchema,
  /** Inbox group */
  when: notificationGroupSchema,
  time: z.string(),
  title: z.string(),
  body: z.string(),
  /** Series title, or "" */
  series: z.string(),
});
/**
 * The real API's inbox kinds (V21-03, `NotificationItem.kind`) as the inbox's own: the API's "episode" is the
 * demo's "update" (the New episodes tab and its icon); "system" items show under All and Unread only.
 */
export const notificationKindOfApi = {
  episode: "update",
  comment: "comment",
  coins: "coins",
  system: "system",
} as const satisfies Record<"episode" | "comment" | "coins" | "system", z.infer<typeof notificationKindSchema>>;

export const workStatusSchema = z.enum(["published", "review", "changes", "draft"]);
export const myWorkSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  format: seriesTypeSchema,
  genre: genreSchema,
  status: workStatusSchema,
  eps: nonNegativeInt,
  day: weekdaySchema,
  cover: z.string(),
  views: z.string(),
  subs: z.string(),
  likes: z.string(),
  summary: z.string(),
});

/** [id, label, hint] */
export const reportReasonSchema = z.tuple([z.string(), z.string(), z.string()]);
export const reportReasonsSchema = z.strictObject({
  comment: z.array(reportReasonSchema),
  series: z.array(reportReasonSchema),
  user: z.array(reportReasonSchema),
});

export const threadReplySchema = z.strictObject({
  name: z.string(),
  creator: z.boolean().optional(),
  when: z.string(),
  likes: nonNegativeInt,
  text: z.string(),
});
export const commentThreadSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  creator: z.boolean().optional(),
  pinned: z.boolean().optional(),
  when: z.string(),
  /** Hours ago (for sorting by newest) */
  ago: z.number().nonnegative(),
  likes: nonNegativeInt,
  text: z.string(),
  replies: z.array(threadReplySchema),
  spoiler: z.boolean().optional(),
});

export const helpTopicSchema = z.enum(["coins", "account", "reading", "creators", "safety", "tech"]);
export const helpArticleSchema = z.strictObject({
  topic: helpTopicSchema,
  q: z.string(),
  a: z.string(),
  /** Prototype page name (Shop, Legal, Auth, Settings, …) or "" */
  link: z.string(),
  linkLabel: z.string(),
});

export const policyIdSchema = z.enum(["terms", "privacy", "refund", "community", "creator"]);
export const policySchema = z.strictObject({
  label: z.string(),
  kind: z.string(),
  title: z.string(),
  /** Draft template that needs a lawyer's review */
  tpl: z.boolean(),
  summary: z.array(z.string()),
  /** [heading, paragraphs] */
  sections: z.array(z.tuple([z.string(), z.array(z.string())])),
});

export const adminSeriesItemSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  creator: z.string(),
  format: z.string(),
  genre: z.string(),
  age: z.string(),
  lang: z.string(),
  eps: z.string(),
  when: z.string(),
  hours: z.number().nonnegative(),
  cover: z.string(),
  summary: z.string(),
  flags: z.array(z.string()),
});

export const adminReportItemSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(["comment", "series", "user"]),
  reason: z.string(),
  target: z.string(),
  who: z.string(),
  where: z.string(),
  text: z.string(),
  count: positiveInt,
  hours: z.number().nonnegative(),
  details: z.string(),
  history: z.string(),
});

/** [description, banner background, banner text colour] */
export const genreInfoSchema = z.record(genreSchema, z.tuple([z.string(), z.string(), z.string()]));

const v21Keys = {
  brand: brandSchema,
  demoAccounts: z.array(demoAccountV2Schema).min(1),
  emailCode: z.string().regex(/^\d{6}$/),
  notifications: z.array(notificationSchema),
  notificationsReadByDefault: z.array(z.string()),
  myWorks: z.array(myWorkSchema),
  reportReasons: reportReasonsSchema,
  commentThreads: z.array(commentThreadSchema),
  helpArticles: z.array(helpArticleSchema),
  policies: z.record(policyIdSchema, policySchema),
  adminSeriesQueue: z.array(adminSeriesItemSchema),
  adminReportQueue: z.array(adminReportItemSchema),
  genreInfo: genreInfoSchema,
};

export const demoDataSchema = z.strictObject({
  ...v21Keys,
  _note: z.string(),
  /** The app's pinned "today" (YYYY-MM-DD) */
  today: isoDate,
  timezone: z.string(),
  demoAccount: demoAccountSchema,
  genres: z.array(genreSchema).min(1),
  series: z.array(seriesSchema).min(1),
  homeHero: z.array(heroSlideSchema).min(1),
  continueReading: z.array(continueEntrySchema),
  rankingMovement: z.array(z.string()),
  episodeRule: z.string(),
  chapterNames: z.array(z.string()).min(1),
  /** Full episode lists keyed by series slug; other series are generated from episodeRule */
  episodesSample: z.record(z.string(), z.array(episodeSchema)),
  comicPanels: z.array(panelSchema).min(1),
  novelChapterText: z.array(novelBlockSchema).min(1),
  creatorNote: z.string(),
  comments: z.strictObject({
    series: z.array(commentSchema),
    episode: z.array(commentSchema),
  }),
  fastPass: z.strictObject({
    price: positiveInt,
    freeAfterDays: positiveInt,
  }),
  coinPacks: z.array(coinPackSchema).min(1),
  firstPurchaseBonus: z.string(),
  paymentMethods: z.array(paymentMethodSchema).min(1),
  khqrExpiryMinutes: positiveInt,
  purchaseHistory: z.array(purchaseSchema),
  coinsFaq: z.array(faqItemSchema),
  authQuote: authQuoteSchema,
  passwordRules: z.array(z.string()).length(4),
  synopsisByGenre: z.record(genreSchema, z.string()),
  loginPageStrings: z.record(localeSchema, authStringsSchema),
});

export type Locale = z.infer<typeof localeSchema>;
export type SeriesType = z.infer<typeof seriesTypeSchema>;
export type Genre = z.infer<typeof genreSchema>;
export type Weekday = z.infer<typeof weekdaySchema>;
export type SeriesStatus = z.infer<typeof seriesStatusSchema>;
export type EpisodeAccess = z.infer<typeof episodeAccessSchema>;
export type PaymentMethodId = z.infer<typeof paymentMethodIdSchema>;
export type PurchaseStatus = z.infer<typeof purchaseStatusSchema>;
export type PackTag = z.infer<typeof packTagSchema>;

export type DemoAccount = z.infer<typeof demoAccountSchema>;
export type Series = z.infer<typeof seriesSchema>;
export type HeroSlide = z.infer<typeof heroSlideSchema>;
export type ContinueEntry = z.infer<typeof continueEntrySchema>;
export type Episode = z.infer<typeof episodeSchema>;
export type Panel = z.infer<typeof panelSchema>;
export type NovelBlock = z.infer<typeof novelBlockSchema>;
export type NovelBlockType = NovelBlock["type"];
export type Comment = z.infer<typeof commentSchema>;
export type CoinPack = z.infer<typeof coinPackSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type Purchase = z.infer<typeof purchaseSchema>;
export type FaqItem = z.infer<typeof faqItemSchema>;
export type AuthQuote = z.infer<typeof authQuoteSchema>;
export type AuthStrings = z.infer<typeof authStringsSchema>;
export type DemoData = z.infer<typeof demoDataSchema>;
export type DemoAccountV2 = z.infer<typeof demoAccountV2Schema>;
export type DemoAccountRole = z.infer<typeof demoAccountRoleSchema>;
export type Brand = z.infer<typeof brandSchema>;
export type NotificationKind = z.infer<typeof notificationKindSchema>;
export type NotificationGroup = z.infer<typeof notificationGroupSchema>;
export type DemoNotification = z.infer<typeof notificationSchema>;
export type WorkStatus = z.infer<typeof workStatusSchema>;
export type MyWork = z.infer<typeof myWorkSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
export type ReportTarget = keyof z.infer<typeof reportReasonsSchema>;
export type ThreadReply = z.infer<typeof threadReplySchema>;
export type CommentThread = z.infer<typeof commentThreadSchema>;
export type HelpTopic = z.infer<typeof helpTopicSchema>;
export type HelpArticle = z.infer<typeof helpArticleSchema>;
export type PolicyId = z.infer<typeof policyIdSchema>;
export type Policy = z.infer<typeof policySchema>;
export type AdminSeriesItem = z.infer<typeof adminSeriesItemSchema>;
export type AdminReportItem = z.infer<typeof adminReportItemSchema>;
