"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { WalletIcon as CoinsIcon } from "@/components/animate-ui/icons/wallet";
import { AnimateIcon } from "@animate-ui/react/icons";
import { BookOpenIcon } from "@/components/animate-ui/icons/book-open";
import { HouseIcon as HomeIcon } from "@/components/animate-ui/icons/house";
import { SearchIcon } from "@/components/animate-ui/icons/search";
import { UserIcon } from "@/components/animate-ui/icons/user";
import {
  Highlight,
  HighlightItem,
} from "@animate-ui/react/primitives/effects/highlight";
import { useTranslations } from "@/i18n/translations";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const itemClass =
  "flex w-full min-w-0 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-center text-[11px] leading-[14px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * Phone bottom tab bar (< 768 px, spec §0 "Phone tab bar"): Home, Search, Library, Coins, Me (or Log in).
 * Sticky at the bottom, white at 96% with blur. Search opens the search page; Me goes to Settings.
 */
export function MobileTabBar({
  loggedIn,
  onLogin,
}: {
  loggedIn: boolean;
  /** Called before navigating to Log in (saves `returnTo`). */
  onLogin?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const reduced = useReducedMotion() ?? false;
  // Animate UI "minimize": after 6 px of downward scroll the labels fold away; they come back on scroll up,
  // at the top, or when a tab gets keyboard focus or is tapped.
  const [minimized, setMinimized] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (y <= 0 || dy < -6) {
        setMinimized(false);
        lastY.current = y;
      } else if (dy > 6) {
        setMinimized(true);
        lastY.current = y;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const spring = reduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 35 };
  const is = (p: string) => pathname === p || pathname.startsWith(`${p}/`);

  const tabs = [
    {
      key: "home",
      href: "/",
      icon: HomeIcon,
      label: t("home"),
      current: pathname === "/",
    },
    {
      key: "search",
      href: "/search",
      icon: SearchIcon,
      label: t("search"),
      current: is("/search"),
    },
    {
      key: "library",
      href: "/library",
      icon: BookOpenIcon,
      label: t("tabLibrary"),
      current: is("/library"),
    },
    {
      key: "coins",
      href: "/coins",
      icon: CoinsIcon,
      label: t("tabCoins"),
      current: is("/coins"),
    },
    loggedIn
      ? {
          key: "me",
          href: "/settings",
          icon: UserIcon,
          label: t("tabMe"),
          current: is("/settings"),
        }
      : {
          key: "me",
          href: "/login",
          icon: UserIcon,
          label: t("logIn"),
          current: is("/login"),
        },
  ];

  return (
    <nav
      aria-label={t("tabs")}
      className="pointer-events-none sticky bottom-0 z-40 px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden"
    >
      {/* Animate UI Highlight: one pill slides behind the current tab (it lives inside each <li>). */}
      <Highlight
        controlledItems
        click={false}
        value={tabs.find((x) => x.current)?.key ?? null}
        className="inset-0 rounded-full bg-accent"
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <ul className="pointer-events-auto mx-auto flex w-full max-w-sm items-stretch justify-around rounded-full bg-background/90 p-1 shadow-lg ring-1 ring-border backdrop-blur-[10px]">
          {tabs.map(({ key, href, icon: Icon, label, current }) => (
            <HighlightItem
              key={key}
              as="li"
              value={key}
              className="flex min-w-0 flex-1 justify-center"
            >
              <AnimateIcon asChild animateOnHover>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  onClick={() => {
                    setMinimized(false);
                    if (key === "me" && !loggedIn) onLogin?.();
                  }}
                  onFocus={() => setMinimized(false)}
                  data-minimized={minimized ? "" : undefined}
                  className={cn(
                    itemClass,
                    "active:scale-[0.97] motion-reduce:active:scale-100",
                    current ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  <motion.span
                    initial={false}
                    animate={
                      minimized
                        ? { height: 0, opacity: 0, filter: "blur(4px)" }
                        : { height: 14, opacity: 1, filter: "blur(0px)" }
                    }
                    transition={spring}
                    className="block max-w-full truncate overflow-hidden"
                  >
                    {label}
                  </motion.span>
                </Link>
              </AnimateIcon>
            </HighlightItem>
          ))}
        </ul>
      </Highlight>
    </nav>
  );
}
