// The staff console palette, in daylight.
//
// The console used to be near-black (#0a0a0b) with gold on top — the same look
// as the rider-facing site. It read as moody, which is right for a night out
// and wrong for a crew trying to find the door list in a hurry. This is the
// same brand (warm paper, brand gold) turned up: cream page, white cards, ink
// that actually reads, and gold used for the one thing that matters on screen.
//
// Two rules the old hardcoded hexes kept getting wrong, now split into tokens:
//
//   1. Gold as a FILL and gold as TEXT are different colours. #d4a333 on cream
//      is 2:1 — unreadable. GOLD fills things; GOLD_TXT writes words.
//   2. Anything sitting ON a gold fill is near-black (ON_GOLD), never white.
//
// Same for green/red: the saturated value fills a chip, the darker one is text.

export const T = {
  // surfaces
  PAPER:    '#faf5ea',   // page
  CARD:     '#ffffff',   // panels, table bodies
  CARD_ALT: '#fdfaf3',   // striped rows, headers, inputs
  SUNK:     '#f3ecdd',   // wells, tracks, disabled

  // structure
  LINE:     '#e8ddc8',
  LINE_HI:  '#d7c6a4',

  // type
  INK:      '#17130f',
  INK_2:    '#3b322a',
  DIM:      '#6e6154',
  FAINT:    '#7d7060',

  // brand gold
  GOLD:     '#d4a333',   // fills, bars, active pills, focus rings
  GOLD_HI:  '#f0c24a',   // gradient top / hover
  GOLD_TXT: '#8a5f0a',   // gold as words
  GOLD_BG:  '#fdf3d9',   // gold tint behind content
  ON_GOLD:  '#231903',   // text sitting on a gold fill

  // status
  GREEN:    '#2fa36b',
  GREEN_TXT:'#0f7a4e',
  GREEN_BG: '#e4f6ec',
  RED:      '#d8543f',
  RED_TXT:  '#b3311f',
  RED_BG:   '#fdeae6',
  BLUE_TXT: '#2457b8',

  // type stacks
  SANS: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, sans-serif',
  MONO: 'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
}

export default T
