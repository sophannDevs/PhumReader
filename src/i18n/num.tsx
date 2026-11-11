import { useDigits } from "./local-digits"

/** A number shown outside a message (count, rank, step): Khmer digits in Khmer (T44). `<Num>{series.likes}</Num>` */
export function Num({ children }: { children: number | string }) {
  const digits = useDigits()
  return <>{digits(children)}</>
}
