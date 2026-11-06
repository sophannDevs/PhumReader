"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";

export type ReasonAsk = {
  title: string;
  description: string;
  confirm: string;
  /** The reason is stored in the audit log; required for ban, hide and refund. */
  required: boolean;
  destructive?: boolean;
  run: (reason: string) => Promise<unknown>;
  /** Toast after success. */
  done: string;
};

/** The message for an error code the API can answer (409 coins_spent, …), else a general one. */
export function useAdminError() {
  const t = useTranslations("admin");
  return (error: unknown): string => {
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      t.has(`error_${error.code}`)
    )
      return t(`error_${error.code}` as "error_coins_spent");
    if (error instanceof ApiError && error.status === 403)
      return t("forbidden");
    return t("error");
  };
}

function ReasonForm({ ask, onClose }: { ask: ReasonAsk; onClose: () => void }) {
  const t = useTranslations("admin");
  const message = useAdminError();
  const id = useId();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const missing = ask.required && reason.trim() === "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missing) return setError(t("reasonRequired"));
    setBusy(true);
    setError(null);
    try {
      await ask.run(reason.trim());
      toast.success(ask.done);
      onClose();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{ask.title}</DialogTitle>
        <DialogDescription>{ask.description}</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id}>{ask.required ? t("reason") : t("note")}</Label>
        <Textarea
          id={id}
          value={reason}
          maxLength={500}
          rows={3}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => setReason(e.target.value)}
        />
        {error ? (
          <p
            id={`${id}-error`}
            role="alert"
            className="text-[13px] text-destructive"
          >
            {error}
          </p>
        ) : (
          <p className="type-small font-normal text-muted-foreground">
            {t("auditHint")}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          variant={ask.destructive ? "destructive" : "brand"}
          loading={busy}
        >
          {ask.confirm}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Asks for the reason (or a note) before an admin action; the answer goes to the audit log. */
export function ReasonDialog({
  ask,
  onClose,
}: {
  ask: ReasonAsk | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={ask !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {ask ? <ReasonForm ask={ask} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}
