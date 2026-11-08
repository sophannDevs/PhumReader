"use client";

import { SearchXIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";

/** 404: muted icon tile, "Page not found", copy, "Back to Home" and "Browse genres". */
export function NotFoundView() {
  const t = useTranslations("notFound");
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <div className="container flex flex-1 flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="flex size-14 items-center justify-center rounded-card bg-muted text-muted-foreground">
        <SearchXIcon className="size-7" aria-hidden />
      </span>
      <div className="flex max-w-md flex-col gap-1.5">
        <h1 className="type-h1">{t("title")}</h1>
        <p className="type-lead">{t("body")}</p>
      </div>
      <form
        role="search"
        className="flex w-full max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(
            q.trim() ? `/search?q=${encodeURIComponent(q.trim())}` : "/search",
          );
        }}
      >
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t("searchLabel")}
          placeholder={t("searchLabel")}
        />
        <Button type="submit" variant="outline">
          {t("searchSubmit")}
        </Button>
      </form>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="brand" size="lg">
          <Link href="/">{t("home")}</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/genres">{t("genres")}</Link>
        </Button>
      </div>
    </div>
  );
}
