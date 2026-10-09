import type { CardEntry } from '../types'

export async function loadCards(): Promise<CardEntry[]> {
  const res = await fetch('/api/cards')
  return res.json() as Promise<CardEntry[]>
}

export async function saveCards(cards: CardEntry[]): Promise<void> {
  await fetch('/api/cards', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cards),
  })
}

export async function addCard(cards: CardEntry[], card: CardEntry): Promise<CardEntry[]> {
  const existing = cards.find((c) => c.name === card.name && c.setCode === card.setCode)
  const updated = existing
    ? cards.map((c) => c.id === existing.id ? { ...c, count: c.count + 1 } : c)
    : [...cards, { ...card, count: 1 }]
  await saveCards(updated)
  return updated
}

export async function removeCard(cards: CardEntry[], id: string): Promise<CardEntry[]> {
  const updated = cards
    .map((c) => c.id === id ? { ...c, count: c.count - 1 } : c)
    .filter((c) => c.count > 0)
  await saveCards(updated)
  return updated
}

export async function addMultiple(cards: CardEntry[], id: string, amount: number): Promise<CardEntry[]> {
  const updated = cards.map((c) => c.id === id ? { ...c, count: c.count + amount } : c)
  await saveCards(updated)
  return updated
}
