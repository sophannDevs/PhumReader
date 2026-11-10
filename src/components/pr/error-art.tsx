/**
 * Error page illustrations (design/prototype-src/Error/body.html): 240 × 200, the prototype's own line art and fills.
 * Decorative: the page heading says what happened.
 */
export type ErrorArtKind = "notFound" | "server" | "offline" | "maintenance"

export function ErrorArt({ kind, className }: { kind: ErrorArtKind; className?: string }) {
  const svg = { viewBox: "0 0 240 200", width: 240, height: 200, fill: "none", "aria-hidden": true, className } as const
  if (kind === "server") {
    return (
      <svg {...svg}>
        <rect x="30" y="24" width="180" height="128" rx="14" fill="#FFFFFF" stroke="#09090B" strokeWidth="3" />
        <path d="M30 52h180" stroke="#09090B" strokeWidth="3" />
        <circle cx="48" cy="38" r="5" fill="#FCA5A5" />
        <circle cx="64" cy="38" r="5" fill="#FCD34D" />
        <circle cx="80" cy="38" r="5" fill="#86EFAC" />
        <path d="M128 66l-22 38h22l-12 34 36-46h-22l14-26z" fill="#FDE68A" stroke="#09090B" strokeWidth="3" strokeLinejoin="round" />
        <path d="M58 168h124" stroke="#E4E4E7" strokeWidth="8" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === "offline") {
    return (
      <svg {...svg}>
        <path
          d="M36 40h168a14 14 0 0 1 14 14v76a14 14 0 0 1-14 14h-96l-34 28v-28H36a14 14 0 0 1-14-14V54a14 14 0 0 1 14-14z"
          fill="#FFFFFF"
          stroke="#09090B"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M78 88a60 60 0 0 1 84 0M92 102a40 40 0 0 1 56 0M106 116a20 20 0 0 1 28 0" stroke="#A1A1AA" strokeWidth="6" strokeLinecap="round" />
        <circle cx="120" cy="128" r="5" fill="#09090B" />
        <path d="M80 62l80 76" stroke="#EF4444" strokeWidth="6" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === "maintenance") {
    return (
      <svg {...svg}>
        <rect x="26" y="30" width="150" height="130" rx="12" fill="#FFFFFF" stroke="#09090B" strokeWidth="3" />
        <path d="M26 70h150M100 70v90" stroke="#09090B" strokeWidth="3" />
        <rect x="40" y="84" width="46" height="62" rx="6" fill="#E8FBF0" />
        <rect x="114" y="84" width="48" height="28" rx="6" fill="#FEF3C7" />
        <path d="M180 40l26 26-58 58-30 6 6-30z" fill="#00DC64" stroke="#09090B" strokeWidth="3" strokeLinejoin="round" />
        <path d="M168 52l26 26" stroke="#09090B" strokeWidth="3" />
      </svg>
    )
  }
  return (
    <svg {...svg}>
      <rect x="20" y="20" width="96" height="74" rx="10" fill="#E8FBF0" stroke="#09090B" strokeWidth="3" />
      <circle cx="52" cy="50" r="10" fill="#00DC64" />
      <path d="M34 84l26-22 18 14 14-10 18 18" stroke="#09090B" strokeWidth="3" strokeLinejoin="round" />
      <rect x="124" y="20" width="96" height="74" rx="10" fill="#FFFFFF" stroke="#09090B" strokeWidth="3" />
      <path d="M140 46h52M140 60h36" stroke="#D4D4D8" strokeWidth="6" strokeLinecap="round" />
      <rect x="20" y="104" width="96" height="74" rx="10" fill="#FFFFFF" stroke="#09090B" strokeWidth="3" />
      <path d="M38 152c14-20 44-20 60 0" stroke="#09090B" strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="128" r="4" fill="#09090B" />
      <circle cx="86" cy="128" r="4" fill="#09090B" />
      <rect x="124" y="104" width="96" height="74" rx="10" fill="#FAFAFA" stroke="#A1A1AA" strokeWidth="3" strokeDasharray="8 7" />
      <text x="172" y="156" textAnchor="middle" fontFamily="Inter,sans-serif" fontSize="44" fontWeight="800" fill="#047A3A">
        ?
      </text>
    </svg>
  )
}
