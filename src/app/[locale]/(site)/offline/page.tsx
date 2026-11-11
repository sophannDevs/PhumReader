import type { Metadata } from "next"
import { setRequestLocale } from "next-intl/server"
import { getTranslations } from "@/i18n/translations-server"
import { OfflineView } from "@/components/pr/offline-view"

export async function generateMetadata({ params }: PageProps<"/[locale]/offline">): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "errors" })
  return { title: t("offline.title"), robots: { index: false } }
}

/**
 * The service worker (public/sw.js) caches this page's HTML and styles, not its JavaScript, and shows it in place of
 * any page that can't load. This small script keeps the page working then: it goes back when the connection
 * returns, and Try again / English / ខ្មែរ still respond. It stands down once React runs (`__prOfflineReady`).
 */
const OFFLINE_FALLBACK = `(function(){
if(window.__prOfflineFallback)return;window.__prOfflineFallback=true;
var p=location.pathname,km=p==="/km"||p.indexOf("/km/")===0,bare=km?(p.slice(3)||"/"):p;
function ready(){return !!window.__prOfflineReady}
function back(){if(bare==="/offline")location.href=km?"/km":"/";else location.reload()}
window.addEventListener("online",function(){if(!ready())back()});
document.addEventListener("click",function(e){
if(ready()||!e.target||!e.target.closest)return;
if(e.target.closest("[data-offline-retry]")){back();return}
var s=e.target.closest("[data-locale-switch]");if(!s)return;
var toKm=s.getAttribute("data-locale-switch")==="km";if(toKm===km)return;
location.href=(toKm?"/km"+(bare==="/"?"":bare):bare)+location.search;
});
})();`

export default async function Page({ params }: PageProps<"/[locale]/offline">) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <>
      <OfflineView />
      <script dangerouslySetInnerHTML={{ __html: OFFLINE_FALLBACK }} />
    </>
  )
}
