# Styling with Tailwind CSS 4

Design token architecture and styling patterns using Tailwind CSS v4 with semantic color tokens and dark mode support.

## 3-Tier Token Architecture

The dominant pattern across modern design systems uses three tiers:

```
Core Layer        ->  Semantic Layer      ->  Component Layer
(raw values)          (intent-based)          (usage)

gray-400          ->  text-muted          ->  <p className="text-muted">
gray-700          ->  border-hairline     ->  <div className="border-hairline">
gray-100          ->  bg-surface-alt      ->  <section className="bg-surface-alt">
```

### Why Three Tiers?

1. **Core Layer**: Raw color values (OKLCH or HSL) that never change
2. **Semantic Layer**: Maps raw values to intent (changes per theme)
3. **Component Layer**: Uses semantic tokens, completely theme-agnostic

Components never need `dark:` prefixes scattered throughout -- the semantic layer handles theme switching automatically.

## Color System

Define raw color values in `:root` and `.dark` selectors, then map to Tailwind via `@theme inline`:

```css
/* Core layer: raw values */
:root {
  --color-primary: oklch(0.55 0.15 250);
  --color-primary-light: oklch(0.70 0.12 250);
  --color-secondary: oklch(0.50 0.10 150);
  --color-accent: oklch(0.65 0.18 30);
  --color-neutral-50: oklch(0.98 0 0);
  --color-neutral-100: oklch(0.95 0 0);
  --color-neutral-200: oklch(0.90 0 0);
  --color-neutral-700: oklch(0.40 0 0);
  --color-neutral-800: oklch(0.25 0 0);
  --color-neutral-900: oklch(0.15 0 0);

  /* Semantic layer: light mode */
  --bg-canvas: var(--color-neutral-50);
  --bg-surface: white;
  --bg-surface-alt: var(--color-neutral-100);
  --text-body: var(--color-neutral-900);
  --text-muted: var(--color-neutral-700);
  --text-brand: var(--color-primary);
  --border-hairline: var(--color-neutral-200);
  --border-edge: var(--color-neutral-700);
}

/* Semantic layer: dark mode overrides */
.dark {
  --bg-canvas: var(--color-neutral-900);
  --bg-surface: var(--color-neutral-800);
  --bg-surface-alt: var(--color-neutral-700);
  --text-body: var(--color-neutral-50);
  --text-muted: var(--color-neutral-200);
  --text-brand: var(--color-primary-light);
  --border-hairline: var(--color-neutral-700);
  --border-edge: var(--color-neutral-200);
}

/* Map to Tailwind (v4 syntax) */
@theme inline {
  --color-canvas: var(--bg-canvas);
  --color-surface: var(--bg-surface);
  --color-surface-alt: var(--bg-surface-alt);
  --color-body: var(--text-body);
  --color-muted: var(--text-muted);
  --color-brand: var(--text-brand);
  --color-hairline: var(--border-hairline);
  --color-edge: var(--border-edge);
}
```

**DO**: Use semantic tokens (`bg-surface`, `text-body`, `border-hairline`).
**DON'T**: Use raw color values, hex codes, or color scale classes directly in components.

### HSL Alternative

If using HSL instead of OKLCH, store values without the `hsl()` wrapper for opacity composition:

```css
:root {
  --primary: 222.2 47.4% 11.2%;
}

/* Allows opacity composition */
background-color: hsl(var(--primary) / 0.5);
```

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
| `text-muted` | Secondary text, metadata, captions |
| `text-brand` | Brand-colored text, links |

### Borders

| Token | Usage |
|-------|-------|
| `border-hairline` | Light dividers, subtle separators |
| `border-edge` | Strong borders, input outlines |

### Status Colors

| Token | Usage |
|-------|-------|
| `status-error` | Error states, destructive actions |
| `status-success` | Success confirmations |
| `status-warning` | Warnings, caution states |
| `status-info` | Informational messages |

## Shape Tokens

### Border Radius (4 levels)

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-badge` | 8px | Tags, badges, toasts |
| `rounded-button` | 12px | Buttons, inputs, chips |
| `rounded-card` | 12px | Standard cards |
| `rounded-container` | 16px | Featured cards, modals, dialogs |

### Shadows (5 levels)

| Token | Usage |
|-------|-------|
| `shadow-subtle` | Default cards, inputs |
| `shadow-medium` | Hover states |
| `shadow-elevated` | Dropdowns, popovers |
| `shadow-floating` | Modals, toasts |
| `shadow-lift` | Card hover lift effect |

### Transition Timing

Define custom easing curves for consistent motion:

```css
@theme inline {
  --ease-calm: cubic-bezier(0.16, 1, 0.3, 1);
}
```

Use `ease-calm` for calm, confident motion across all transitions.

## Dark Mode

### Strategy: `.dark` Class with CSS Variable Overrides

Dark mode is controlled by a `.dark` class on the `<html>` element. Semantic tokens change values per theme, so components remain theme-agnostic.

```tsx
// BAD: Scattered dark mode logic
<p className="text-gray-600 dark:text-gray-300">

// GOOD: Semantic token handles it automatically
<p className="text-muted">
```

### When to Use `dark:` Prefix

The `dark:` prefix should be rare exceptions, not the rule:

- **Acceptable**: One-off overrides for specific visual effects (e.g., inverted badges)
- **Avoid**: Standard text colors, backgrounds, borders -- these should use semantic tokens

### Tailwind v4 `@variant dark` Syntax

```css
@theme {
  /* Core colors (unchanging) */
  --color-gray-100: #f5f5f4;
  --color-gray-400: #a8a29e;
  --color-gray-700: #44403c;

  /* Semantic tokens (reference core) */
  --color-text-muted: var(--color-gray-400);
  --color-bg-subtle: var(--color-gray-100);
  --color-border-default: var(--color-gray-200);
}

@variant dark {
  /* Override semantic tokens for dark mode */
  --color-text-muted: var(--color-gray-500);
  --color-bg-subtle: var(--color-gray-800);
  --color-border-default: var(--color-gray-700);
}
```

Components use semantic classes only -- no `dark:` prefix needed:

```tsx
<div className="bg-subtle border border-default">
  <p className="text-muted">Helper text</p>
</div>
```

## Typography

Use variable fonts for optimal performance and flexibility:

```css
@theme inline {
  --font-heading: "YourHeadingFont", serif;
  --font-body: "YourBodyFont", sans-serif;
}
```

- **Headings**: Serif or display font (variable font with optical sizing)
- **Body**: Sans-serif (geometric, modern, high readability)

Load fonts in the root layout with `next/font`:

```tsx
import { Inter, Playfair_Display } from "next/font/google";

const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const heading = Playfair_Display({ subsets: ["latin"], variable: "--font-heading" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${body.variable} ${heading.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

## Utility Classes

Define reusable utility classes for common patterns:

| Class | Effect |
|-------|--------|
| `.focus-ring` | Standard focus ring styling (keyboard accessibility) |
| `.touch-target` | Minimum 44x44px touch target |
| `.hover-surface` | Subtle hover background change |

```css
@layer utilities {
  .focus-ring {
    @apply focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary;
  }

  .touch-target {
    @apply min-h-[44px] min-w-[44px];
  }
}
```

## Component Checklist

When building or reviewing components, verify:

- [ ] Uses semantic color tokens (not raw hex, OKLCH, or color scale values)
- [ ] Uses shape tokens (`rounded-card`, `rounded-button`, etc.)
- [ ] Uses shadow tokens (`shadow-subtle`, `shadow-lift`, etc.)
- [ ] Uses standard easing (`ease-calm`) for transitions
- [ ] Mobile-first responsive design
- [ ] Focus states visible (use `.focus-ring`)
- [ ] Touch targets 44x44px minimum (use `.touch-target`)
- [ ] Works in both light and dark modes
- [ ] No scattered `dark:` prefixes (semantic tokens handle theme switching)

## Migration Checklist

When migrating an existing codebase to semantic tokens:

- [ ] Define semantic tokens in `globals.css` `@theme` block
- [ ] Add dark mode overrides in `@variant dark` block
- [ ] Replace raw color scale classes with semantic equivalents
- [ ] Remove scattered `dark:` prefixes (semantic layer handles it)
- [ ] Document intentional exclusions (syntax highlighting, status badges, etc.)
- [ ] Verify build passes
- [ ] Test light and dark mode visually

## Best Practices Summary

| Practice | Do | Don't |
|----------|-----|-------|
| **Theme switching** | Use CSS variables that change per theme | Scatter `dark:` prefixes across components |
| **Token naming** | Semantic: `text-muted`, `bg-surface` | Raw: `text-gray-400`, `bg-gray-800` |
| **Color format** | OKLCH or HSL values without wrapper | Full function: `hsl(222.2, 84%, 4.9%)` |
| **Architecture** | 3-tier: Core -> Semantic -> Component | 2-tier: Core -> Component (skipping semantic) |
| **Dark mode trigger** | `.dark` class with variable overrides | Per-component `dark:` prefixes |
| **Single source** | One location for all theme mappings | Theme logic spread across files |
