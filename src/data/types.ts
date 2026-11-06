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
export const seriesStatusSchema = z.enum(["ongoing", "completed"]);
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
  /** Public path, e.g. "/covers/<id>.svg" */
  cover: z.string().startsWith("/covers/"),
  /** Pre-formatted count such as "1.6M" */
  views: z.string(),
  /** Pre-formatted count such as "871K" */
  likes: z.string(),
  freeEpisodes: positiveInt,
  fastPassEpisodes: nonNegativeInt,
  totalEpisodes: positiveInt,
  /** null for a series without a schedule (the real API); demo series always have one */
  updateDay: weekdaySchema.nullable(),
  /** Human schedule such as "Every Sun"; "" without a schedule */
  schedule: z.string(),
  badges: z.strictObject({ up: z.boolean(), isNew: z.boolean() }),
  status: seriesStatusSchema,
  language: z.array(localeSchema).min(1),
  ageRating: z.string(),
});

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

export const demoDataSchema = z.strictObject({
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
