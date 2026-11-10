import { ro } from './ro'
import type { PlateFormat } from './types'

/** Every implemented country. Add new ones here (see .claude/skills/add-plate-country). */
export const plateFormats: PlateFormat[] = [ro]

export function getPlateFormat(id: string): PlateFormat {
  return plateFormats.find((f) => f.id === id) ?? ro
}

export type { Plate, PlateFormat, PlateStyle } from './types'
