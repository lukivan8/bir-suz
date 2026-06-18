# Бір сөз — Popup Design Notes

This document describes the current in-page challenge popup design implemented in:

- `src/content.tsx`
- `src/content.css`

The popup is the small browser-extension challenge card injected into eligible web pages. It is separate from the browser action popup in `src/App.tsx`.

## Design direction

The popup should feel like a printed bookmark or editorial note, not a notification. It should be calm, quiet, and low-pressure.

Core metaphor:

> A bookmark that fell out of an editorial magazine.

The user has already agreed to see the task, so the design should avoid alarm patterns such as bright fills, large shadows, progress bars, countdowns, bouncy animation, or modal backdrops.

## Canvas and placement

Implemented in `.bir-soz-stage` and `.bir-soz-card`.

- Fixed width: `340px`
- Approximate height: `200–220px`
- Position: bottom-right of the page
- Pointer behavior:
  - outer stage is `pointer-events: none`
  - card itself is `pointer-events: auto`
- Corners: sharp, `border-radius: 0`
- Border: `1px solid rgba(26, 22, 18, 0.18)`
- Shadow: `0 2px 12px rgba(26, 22, 18, 0.12)`

## Motion

Only vertical slide motion is used.

- Enter: translate from bottom, `160ms ease-out`
- Exit: translate to bottom, `120ms ease-out`
- No fade
- No bounce
- No spring
- No scale

Implemented with:

- `@keyframes bir-soz-slide-in`
- `@keyframes bir-soz-slide-out`
- `.bir-soz-card.is-exiting`

## Colors

Use only the handoff palette inside the challenge popup.

```css
paper:        #f2ebdc
paper-deep:   #ebe2cf
ink:          #1a1612
ink-soft:     #4a4338
ink-faded:    #7a7060
accent:       #a8531c
accent-deep:  #7a3a10
rule:         rgba(26, 22, 18, 0.18)
rule-soft:    rgba(26, 22, 18, 0.08)
```

Important rule:

- `#a8531c` is used only for text and borders.
- Never use the accent color as a filled background.

## Paper texture

Implemented in `.bir-soz-paper-layer`.

The card background is `#f2ebdc`.

On top of it, the design adds:

1. SVG turbulence grain using `feTurbulence`
2. Top-left warm radial gradient
3. Bottom-right warm radial gradient
4. Multiply blend mode

This creates the paper-like material quality. Without the grain layer, the popup feels too much like a screen UI.

## Typography

Fonts are loaded in `src/content.css` via Google Fonts:

```css
@import url("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@1,144,300,80&family=JetBrains+Mono:wght@400;500;700&family=Newsreader:ital,opsz,wght@0,16,400;1,16,400&display=swap");
```

### Fraunces

Used for the source word.

Class: `.bir-soz-word`

- Size: `52px`
- Weight: `300`
- Style: italic
- Line height: `0.92`
- Letter spacing: `-0.04em`
- Color: `#1a1612`
- Variable settings:

```css
font-variation-settings:
  "SOFT" 80,
  "opsz" 144;
```

The source word is the main visual element.

### Newsreader

Used for prompt text and answer options.

Classes:

- `.bir-soz-prompt`
- `.bir-soz-option`

Typical settings:

- Size: `15px`
- Weight: `400`
- Line height: `1.2–1.5`
- Prompt color: `#4a4338`
- Option color: `#1a1612`

### JetBrains Mono

Used for labels, metadata, glyphs, and skip button.

Classes:

- `.bir-soz-topline`
- `.bir-soz-bottom`
- `.bir-soz-skip`
- `.bir-soz-glyph`

Typical settings:

- Size: `11px`
- Weight: `500`
- Letter spacing: `0.14em`
- Uppercase
- Metadata color: `#7a7060`
- Label/accent color: `#a8531c`

## Layout

The card uses a single vertical flow.

Main structure in `src/content.tsx`:

```tsx
<article class="bir-soz-card">
  <div class="bir-soz-paper-layer" />
  <div class="bir-soz-content">
    <header class="bir-soz-topline" />
    <section>
      <h2 class="bir-soz-word" />
      <p class="bir-soz-prompt" />
    </section>
    <div class="bir-soz-rule" />
    <div class="bir-soz-options" />
    <footer class="bir-soz-bottom" />
  </div>
</article>
```

Spacing:

- Card padding: `18px 20px`
- Topline to word: `14px`
- Word to prompt: `6px`
- Prompt to rule: `16px`
- Rule to options: `14px`
- Options to bottom row: `14px`

## Answer options

Answer options are vertical, not a grid.

Class: `.bir-soz-option`

Default:

- Transparent background
- No outer border
- Left border: `2px solid transparent`
- Text: `#1a1612`
- Padding: `7px 0 7px 10px`

Hover:

- Left border becomes `rgba(26, 22, 18, 0.18)`
- No background fill

Correct state:

```css
.bir-soz-option.is-correct {
  color: #a8531c;
  border-left-color: #a8531c;
}
```

Wrong and muted states:

```css
.bir-soz-option.is-wrong,
.bir-soz-option.is-muted {
  color: #7a7060;
}
```

No green, no red, no strikethrough.

## Interaction states

### Question

- Word is prominent.
- Four answer options are neutral.
- Skip is always visible.

### Correct answer

- Correct option text becomes `#a8531c`.
- Correct option left border becomes `#a8531c`.
- A small `+` glyph appears after the word in `#a8531c`.
- Card auto-dismisses after `1200ms`.

### Wrong answer

- Selected wrong option fades to `#7a7060`.
- Correct option immediately highlights in `#a8531c`.
- Card auto-dismisses after `1200ms`.

### Skip / Escape

- Card exits immediately.
- No toast.
- No message.
- No extra animation beyond slide-out.

### Auto-dismiss

The popup currently auto-dismisses after `5000ms` and records the result as skipped.

Constants in `src/content.tsx`:

```ts
const AUTO_DISMISS_MS = 5000
const ANSWER_DISMISS_MS = 1200
const EXIT_MS = 120
```

Note: earlier checklist guidance removed hard timeout failure behavior. This implementation treats auto-dismiss as a skipped review, not as a timed-out failure, and does not show a countdown.

## Implementation notes

- Shadow DOM is used to isolate popup styles from the host page.
- `content.css` is imported inline with `?inline` and injected into the shadow root.
- Escape key listener is removed on submit and on Solid cleanup.
- Existing overlays are removed before rendering a new one.
- No full-page backdrop is used.

## What not to add

Do not add:

- progress bars
- countdown text
- full-screen dimming backdrop
- rounded modern cards
- green/red success/error colors
- large shadows
- icons or illustrations
- filled accent buttons
- bounce/spring/fade animations
- more than one word per popup
