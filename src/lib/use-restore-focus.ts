import { useRef } from "react"

/**
 * Dialogs opened from state (no `DialogTrigger`) can't get focus back from
 * Radix. Spread the result on `DialogContent`: it remembers the focused element
 * when the dialog opens and refocuses it when it closes.
 */
export function useRestoreFocus() {
  const openerRef = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: () => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    },
    onCloseAutoFocus: (e: Event) => {
      e.preventDefault()
      if (openerRef.current?.isConnected) openerRef.current.focus()
    },
  }
}
