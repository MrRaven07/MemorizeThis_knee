import { ro } from './ro'
import type { NameSet } from './types'

/** Every implemented name country. Add new ones here. */
export const nameSets: NameSet[] = [ro]

export function getNameSet(id: string): NameSet {
  return nameSets.find((n) => n.id === id) ?? ro
}

export type { NameSet } from './types'
