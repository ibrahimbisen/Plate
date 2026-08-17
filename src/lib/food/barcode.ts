/**
 * GTIN handling.
 *
 * Open Food Facts normalises leading zeros server-side and canonicalises to the
 * 13-digit form, so we pad UPC-A to match. EAN-8 is a genuinely distinct code,
 * NOT a truncated EAN-13 — padding `20724696` to 13 digits would miss it or,
 * worse, collide with a different product.
 */

export function normalizeBarcode(raw: string): string | null {
  const d = String(raw).replace(/\D/g, '')
  if (d.length === 8) return d // EAN-8 / expanded UPC-E — never pad
  if (d.length === 12) return `0${d}` // UPC-A -> EAN-13
  if (d.length === 13) return d
  if (d.length === 14) return d.startsWith('0') ? d.slice(1) : d // GTIN-14
  if (d.length > 8 && d.length < 12) return d.padStart(13, '0') // stripped zeros
  return null
}

/** Forms worth trying against a locally-built index of mixed provenance. */
export function lookupKeys(raw: string): string[] {
  const n = normalizeBarcode(raw)
  if (!n) return []
  const keys = [n]
  if (n.length === 13 && n.startsWith('0')) keys.push(n.slice(1))
  return keys
}

/** One algorithm covers EAN-8, UPC-A, EAN-13 and GTIN-14. */
export function gtinCheckDigit(dataDigits: string): number {
  let total = 0
  const reversed = [...dataDigits].reverse()
  for (let i = 0; i < reversed.length; i++) {
    total += Number(reversed[i]) * (i % 2 === 0 ? 3 : 1)
  }
  return (10 - (total % 10)) % 10
}

/**
 * Structural validity only — it does not prove the product exists. Use it to
 * reject scanner misreads before spending one of the 15 requests/minute, but
 * WARN rather than hard-reject: in-store, PLU and private-label codes are
 * frequently non-compliant.
 */
export function isValidBarcode(code: string): boolean {
  const d = String(code).replace(/\D/g, '')
  if (![8, 12, 13, 14].includes(d.length)) return false
  return gtinCheckDigit(d.slice(0, -1)) === Number(d.at(-1))
}
