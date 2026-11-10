/**
 * 18 original card symbols, drawn in a 24×24 viewBox. They are told apart by
 * SHAPE alone (colour is extra help, for colour-blind players).
 * Each entry is SVG markup for the inside of the <svg>, filled with currentColor.
 */
export const SYMBOLS: readonly { name: string; svg: string }[] = [
  { name: 'circle', svg: '<circle cx="12" cy="12" r="8"/>' },
  { name: 'square', svg: '<rect x="5" y="5" width="14" height="14" rx="1"/>' },
  { name: 'triangle', svg: '<path d="M12 4 L20 19 H4 Z"/>' },
  { name: 'diamond', svg: '<path d="M12 3 L20 12 L12 21 L4 12 Z"/>' },
  {
    name: 'star',
    svg: '<path d="M12 3 L14.6 9 L21 9.6 L16.2 13.8 L17.6 20.2 L12 16.8 L6.4 20.2 L7.8 13.8 L3 9.6 L9.4 9 Z"/>',
  },
  {
    name: 'heart',
    svg: '<path d="M12 20 C4 14 3 10 5 7 C7 4.5 10.5 5 12 8 C13.5 5 17 4.5 19 7 C21 10 20 14 12 20 Z"/>',
  },
  { name: 'moon', svg: '<path d="M15 3 A9 9 0 1 0 21 15 A7 7 0 1 1 15 3 Z"/>' },
  { name: 'plus', svg: '<path d="M10 4 H14 V10 H20 V14 H14 V20 H10 V14 H4 V10 H10 Z"/>' },
  {
    name: 'cross',
    svg: '<path d="M6.3 3.5 L12 9.2 L17.7 3.5 L20.5 6.3 L14.8 12 L20.5 17.7 L17.7 20.5 L12 14.8 L6.3 20.5 L3.5 17.7 L9.2 12 L3.5 6.3 Z"/>',
  },
  { name: 'hexagon', svg: '<path d="M12 3 L19.8 7.5 V16.5 L12 21 L4.2 16.5 V7.5 Z"/>' },
  { name: 'pentagon', svg: '<path d="M12 3 L21 9.5 L17.5 20 H6.5 L3 9.5 Z"/>' },
  {
    name: 'ring',
    svg: '<path fill-rule="evenodd" d="M12 3 A9 9 0 1 1 11.99 3 Z M12 7.5 A4.5 4.5 0 1 0 12.01 7.5 Z"/>',
  },
  { name: 'arrow', svg: '<path d="M3 10 H13 V5 L21 12 L13 19 V14 H3 Z"/>' },
  { name: 'bolt', svg: '<path d="M14 2 L5 14 H11 L9 22 L19 9 H13 Z"/>' },
  { name: 'drop', svg: '<path d="M12 3 C12 3 5 11 5 15 A7 7 0 0 0 19 15 C19 11 12 3 12 3 Z"/>' },
  { name: 'half circle', svg: '<path d="M3 15 A9 9 0 0 1 21 15 Z"/>' },
  {
    name: 'bars',
    svg: '<rect x="4" y="5" width="16" height="3" rx="1"/><rect x="4" y="10.5" width="16" height="3" rx="1"/><rect x="4" y="16" width="16" height="3" rx="1"/>',
  },
  { name: 'flag', svg: '<path d="M5 3 H7 V21 H5 Z M7 4 H19 L16 8.5 L19 13 H7 Z"/>' },
]

export const SYMBOL_NAMES: readonly string[] = SYMBOLS.map((s) => s.name)
