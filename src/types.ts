export interface CardEntry {
  id: string
  name: string
  setCode: string
  setName: string
  addedAt: string
  // cached from Scryfall
  scryfallId?: string
  imageUrl?: string
  priceUsd?: number
  colors?: string[]
  typeLine?: string
  cmc?: number
  count: number
}

export type ViewMode = 'tracker' | 'prices' | 'builder'

export interface DeckBuilderParams {
  colors: string[]
  types: string[]
}

export const MTG_COLORS = ['W', 'U', 'B', 'R', 'G'] as const
export const MTG_COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
}
