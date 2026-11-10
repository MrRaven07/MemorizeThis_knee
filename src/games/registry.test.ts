import { describe, expect, it } from 'vitest'
import { games, getGame } from './registry'

describe('registry', () => {
  it('lists the games in menu order', () => {
    expect(games.map((g) => g.id)).toEqual(['long-number', 'number-flash', 'plates', 'maze'])
  })

  it('ids are unique and resolvable', () => {
    const ids = games.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(getGame(id)?.id).toBe(id)
  })

  it('every module has defaults that match its fields', () => {
    for (const g of games) {
      for (const f of g.settingsFields) expect(g.defaultSettings).toHaveProperty(f.key)
    }
  })
})
