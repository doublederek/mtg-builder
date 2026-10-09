export interface ScryfallCard {
  id: string
  name: string
  set: string
  set_name: string
  type_line: string
  cmc: number
  colors?: string[]
  color_identity: string[]
  image_uris?: { normal: string; small: string }
  card_faces?: Array<{ image_uris?: { normal: string; small: string } }>
  prices: { usd?: string; usd_foil?: string }
}

const BASE = 'https://api.scryfall.com'
const HEADERS = { 'User-Agent': 'mtg-builder/1.0 (local dev tool)' }

export async function fetchCardByName(
  name: string,
  setCode?: string,
): Promise<ScryfallCard> {
  const params = new URLSearchParams({ fuzzy: name })
  if (setCode) params.set('set', setCode.toLowerCase())
  const res = await fetch(`${BASE}/cards/named?${params}`, { headers: HEADERS })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { details?: string }).details ?? 'Card not found')
  }
  return res.json() as Promise<ScryfallCard>
}

export async function fetchCardByCollectorNumber(
  setCode: string,
  collectorNumber: string,
): Promise<ScryfallCard> {
  const res = await fetch(
    `${BASE}/cards/${setCode.toLowerCase()}/${parseInt(collectorNumber, 10)}`,
    { headers: HEADERS },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { details?: string }).details ?? 'Card not found')
  }
  return res.json() as Promise<ScryfallCard>
}

export function getCardImageUrl(card: ScryfallCard): string | undefined {
  return (
    card.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.normal
  )
}
