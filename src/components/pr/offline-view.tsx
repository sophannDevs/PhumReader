"use client";

import { WifiOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** What the installed app shows when a page cannot be loaded without a connection. */
export function OfflineView() {
  const t = useTranslations("legal.offline");
  return (
    <main className="container flex min-h-svh flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-card bg-muted text-muted-foreground">
        <WifiOffIcon className="size-7" aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h1 className="type-h1">{t("title")}</h1>
        <p className="type-lead">{t("body")}</p>
      </div>
      <Button
        variant="brand"
        size="lg"
        onClick={() => window.location.reload()}
      >
        {t("retry")}
      </Button>
    </main>
  );
}
