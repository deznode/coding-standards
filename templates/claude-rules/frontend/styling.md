---
paths: apps/web/**
---

# Styling with Tailwind CSS 4

> Full reference: `docs/frontend/04-styling.md`

## 3-Tier Token Architecture

```
Core Layer       ->  Semantic Layer     ->  Component Layer
(raw values)         (intent-based)         (usage in JSX)

gray-400         ->  text-muted         ->  <p className="text-muted">
gray-100         ->  bg-surface-alt     ->  <section className="bg-surface-alt">
```

**DO**: Use semantic tokens (`bg-surface`, `text-body`, `border-hairline`).
**DON'T**: Use raw hex, OKLCH values, or color scale classes in components.

## Semantic Token Categories

### Backgrounds

| Token | Usage |
|-------|-------|
| `bg-canvas` | Page background |
| `bg-surface` | Cards, sidebars, panels |
| `bg-surface-alt` | Hover states, tertiary backgrounds |

### Text

| Token | Usage |
|-------|-------|
| `text-body` | Main reading text |
| `text-muted` | Secondary text, metadata |
| `text-brand` | Brand-colored text, links |

### Borders

| Token | Usage |
|-------|-------|
| `border-hairline` | Light dividers |
| `border-edge` | Strong borders, input outlines |

### Status

`status-error`, `status-success`, `status-warning`, `status-info`

## Shape Tokens

| Token | Usage |
|-------|-------|
| `rounded-badge` (8px) | Tags, badges, toasts |
| `rounded-button` (12px) | Buttons, inputs |
| `rounded-card` (12px) | Standard cards |
| `rounded-container` (16px) | Modals, dialogs |

### Shadows

| Token | Usage |
|-------|-------|
| `shadow-subtle` | Default cards, inputs |
| `shadow-medium` | Hover states |
| `shadow-elevated` | Dropdowns, popovers |
| `shadow-floating` | Modals, toasts |
| `shadow-lift` | Card hover lift effect |

## Dark Mode

Strategy: `.dark` class on `<html>` with CSS variable overrides. Semantic tokens change values per theme -- components remain theme-agnostic.

```tsx
// BAD: Scattered dark mode
<p className="text-gray-600 dark:text-gray-300">

// GOOD: Semantic token handles it
<p className="text-muted">
```

`dark:` prefix should be rare exceptions for one-off visual effects, not standard practice.

## Tailwind v4 Setup

```css
@theme inline {
  --color-canvas: var(--bg-canvas);
  --color-surface: var(--bg-surface);
  --color-body: var(--text-body);
  --color-muted: var(--text-muted);
  --color-hairline: var(--border-hairline);
  --ease-calm: cubic-bezier(0.16, 1, 0.3, 1);
}
```

## Component Checklist

- Uses semantic color tokens (not raw hex or scale values)
- Uses shape tokens (`rounded-card`, `rounded-button`)
- Uses shadow tokens (`shadow-subtle`, `shadow-lift`)
- Uses `ease-calm` for transitions
- Mobile-first responsive design
- Focus states visible (`.focus-ring`)
- Touch targets 44x44px minimum (`.touch-target`)
- Works in both light and dark modes
- No scattered `dark:` prefixes
