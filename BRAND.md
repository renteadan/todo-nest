# Todo brand specification

All frontend work follows this spec. If a change needs something the spec does
not cover, add it here in the same PR. Do not invent a one-off.

Product facts (audience, voice, what may be claimed) are in `PRODUCT.md`.
This file covers how the product looks, moves and sounds.

## 1. Personality

**Bright, friendly, a little cheeky.** Todo should feel like a sticker sheet
and a pack of felt-tip pens: bold colour, round shapes, small rewards. It is
never cold, grey, corporate or "premium-quiet". An empty screen is never just
beige.

| We are | We are not |
| --- | --- |
| Vibrant: saturated pop colours on a warm cream ground | Muted, desaturated, "tasteful" greige |
| Playful: bounces, tilts, chunky outlines | Childish: no mascots, emoji confetti or comic fonts |
| Tactile: things look like stickers you can press | Flat-and-floaty: blurred drop shadows, glassmorphism |
| Clear: one obvious action per screen | Noisy: colour for its own sake on every element |

The order of priority is clear first, playful second. If a playful detail makes
something harder to read or use, drop the detail.

## 2. Colour

All colours are tokens in `frontend/app/tokens.css`, written as
`light-dark(light, dark)` in OKLCH. **Never put a raw colour in a component.**
Use a token, or `color-mix()` of tokens.

### Grounds and ink

| Token | Role |
| --- | --- |
| `--color-paper` | Page ground. Cream by day, deep plum by night. |
| `--color-paper-2` / `-3` | Lilac-tinted secondary grounds (auth panel, dialog footers). |
| `--color-card` | Sticker surface. Pure white by day, raised plum by night. |
| `--color-ink` | Text, outlines and hard shadows. Deep plum, never pure black. |
| `--color-ink-2`, `--color-muted`, `--color-pencil` | Secondary, helper and placeholder text, in that order. |
| `--color-rule` | Hairline dividers inside a card. |

### Pop colours

| Token | Role |
| --- | --- |
| `--color-grape` | **The brand colour.** The primary action, the wordmark, focus, links, the Inbox. |
| `--color-tangerine` | List colour; the wordmark's dot; "today" in the date picker. |
| `--color-sky` | List colour; the default for any `.section` with no list hue. |
| `--color-bubblegum` | List colour; notification count. |
| `--color-lime` | List colour; the "done" tick in the login demo. |
| `--color-sunshine` | List colour; the create-task card; hover on chips and the profile button. |
| `--color-on-pop` | Text and icons on any pop colour except grape. Dark plum in both themes. |
| `--color-accent-ink` | Text on grape or on the error red. Near-white. |

Rules:

- **Grape is the only fill for a primary action.** One grape-filled button per
  screen region. Other buttons are white stickers (`.btn-quiet`) or text
  (`.btn-text`).
- **Each list owns one pop colour**, set by `hue-N` (list id mod 5) in
  `tasks/page.tsx`. That colour is the list's header band, its sticker shadow,
  its row hover tint and its ticks. Do not use a list's colour anywhere else.
- **Text on a pop colour is always `--color-on-pop`** (dark), in both themes.
  The only exceptions are grape and error red, which take `--color-accent-ink` (light).
- Pop colours are for surfaces, bands, dots and ticks. Body text is never
  set in a pop colour. The exceptions are links and the wordmark, which are grape.
- Red (`--color-error`) means destructive or failed, nothing else.
- Confetti (`--confetti`) is for large empty grounds only, such as the auth
  panel. Dots never sit on top of text.

### Dark mode

Dark mode is a first-class theme, not an inverted afterthought. The ground is
deep plum (not black), cards are a step lighter, and the pop colours get a
little lighter and softer so they glow instead of buzz. Every new token needs
both values. Never hard-code a colour that only works in one theme.

## 3. Type

| Role | Face | Weights |
| --- | --- | --- |
| Display: page titles, list names, the wordmark, the capture field | **Fredoka** (`--font-display`, `.display`) | 600 titles, 700 wordmark, 500 capture field |
| Everything else | **Nunito** (`--font-body`) | 400 text, 600–700 labels, 800 buttons and tags |

Both are loaded in `frontend/app/layout.tsx` through `next/font/google`. Do not
add a third family.

- Titles are big and bold: the page `h1` is `text-5xl`/`text-6xl`, and list names
  are `text-2xl`/`text-3xl`. Tighten them slightly (`--tracking-display`).
- Buttons and tags are Nunito 800, sentence case. Do not use ALL CAPS.
- Numbers that update (counts, dates) use `tabular-nums`.

## 4. Shape and depth: "stickers"

The signature of the UI is the **sticker**: a white card with a 2px ink
outline (`--edge`), a big radius and a **hard, offset, unblurred shadow**.

| Token | Value | Used for |
| --- | --- | --- |
| `--edge` | 2px | Every outline: cards, buttons, fields, checks, the navbar rule |
| `--radius-card` | 20px | Cards, dialogs, popovers |
| `--radius-field` | 14px | Text fields |
| `--radius-pill` | full | Buttons, chips, tags, switches, the create-list field |
| `--shadow-card` | `4px 4px 0 ink` | Resting stickers |
| `--shadow-float` | `6px 6px 0 ink` | Menus, pickers, anything floating |

Rules:

- **Shadows are never blurred.** A list's shadow takes the list colour; every
  other shadow is ink.
- A list is a `.section`: a sticker with a coloured header band
  (`.section-head`) and a 2px ink rule under the band. The Inbox's band is grape.
- Inside a card, dividers are 1px `--color-rule` hairlines, and they stay straight.
- Corners are round everywhere. Do not add a square corner.

## 5. Motion

Motion is how the app says "nice one". It is quick, springy and always optional.

| Token | Use |
| --- | --- |
| `--ease-pop` | Overshoot spring: ticks, knobs, bouncing in, hover lifts |
| `--ease-out` | Colour and opacity changes |
| `--dur-micro` 120ms / `--dur-short` 220ms / `--dur-long` 420ms | Hover / state change / arrival |

The standard moves are in `globals.css`. Reuse them before you invent a new one:

- **Press:** buttons lift 1px on hover and squash into their shadow on press.
- **Tick:** a completed check fills with the list colour and pops
  (`tick-pop`).
- **Arrive:** dialogs, pickers, the notification count and dropped tasks
  `pop-in`.
- **Drop target:** the list you are dragging over gets a dashed outline in its
  colour and wiggles once.
- **Wordmark:** its tangerine dot hops on hover.

Rules: never loop an animation forever, never animate layout on scroll, and
keep each move under 700ms. Every animation and transition has a
`prefers-reduced-motion: reduce` fallback that shows the end state. Add your
selector to the reduced-motion block at the end of `globals.css`.

## 6. Components

Use the existing classes before you write new CSS. All of them are in
`frontend/app/globals.css`.

| Need | Class |
| --- | --- |
| Primary action | `.btn` (grape) |
| Secondary action | `.btn-quiet` (white sticker) |
| Confirmed destructive action | `.btn-delete` (red, inside a confirm dialog only) |
| Low-key text action | `.btn-text`, `.btn-danger` |
| Card, dialog | `.stock` |
| Create form container | `.well` |
| A list | `.section` + `.section-head` + `hue-N` |
| Text input | `.field` (`.field-label` wraps it with its label) |
| Toggle | `.switch` inside `.switch-label` |
| Small label | `.tag` |
| Icon button | `.icon-quiet`, `.icon-danger` |

If you need a new component, build it from the tokens and the sticker rules
above, give it a short comment saying what it is for, and add it to this table.

## 7. Voice

Voice is set in `PRODUCT.md`: plain, short and direct. Playfulness lives in
the visuals, not in the copy. Write "Add task", not "Let's gooo!". Empty states
say what to do next in one sentence. Do not use exclamation marks, puns or emoji
in UI copy.

## 8. Accessibility (non-negotiable)

- Text contrast is at least 4.5:1 and graphics are at least 3:1, in **both**
  themes. The e2e suite checks the tick against its disc.
- Every interactive element has a visible focus state. The default is a 2px
  grape outline.
- On touch screens, targets are 44px or larger. Small controls get the invisible
  tap area in `globals.css` (`@media (pointer: coarse)`).
- Colour is never the only signal. Done tasks are also struck through, and
  shared lists also carry the "Shared" tag.

## 9. Checklist for any frontend PR

1. Did you use only tokens, with no raw colours, radii or shadows in components?
2. Does it look right in **light, dark and at 390px wide**?
3. Is there at most one grape-filled action per region?
4. Does every animation have a reduced-motion fallback?
5. Do the e2e tests still pass? `theme.spec.ts` and `tasks.spec.ts` check
   theme luminance, tick contrast and row heights.
6. If you added a pattern, did you add it to this file?
