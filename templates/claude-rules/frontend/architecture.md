---
paths: apps/web/**
---

# Next.js Architecture

> Full reference: `docs/frontend/01-architecture.md`

## Directory Structure

Feature-based organization with route groups:

```
src/
  app/
    (auth)/              # Auth routes (login, register)
    (app)/               # Authenticated pages
    (admin)/             # Admin dashboard
    (marketing)/         # Public pages (landing, pricing)
    api/                 # API routes
  components/
    shared/              # Cross-feature components
    {feature}/           # Feature-grouped components
  hooks/                 # Custom React hooks
  lib/                   # Utilities, API clients, validation
  stores/                # Zustand client state stores
  types/                 # Centralized TypeScript definitions
```

Route groups use parentheses -- logical organization without affecting URLs.

## Server Components First

Components are **server components by default**. Add `"use client"` only when the component:

1. Uses React hooks (`useState`, `useEffect`, `useContext`)
2. Uses browser APIs (`document`, `window`, `localStorage`)
3. Uses event handlers (`onClick`, `onChange`)
4. Uses client-only libraries (TanStack Query, animation libs)

If none apply, keep it as a server component.

## Donut Pattern

```
Server layout
  -> Client providers (theme, auth, query client)
    -> Server pages (data fetching, SEO)
      -> Client islands (interactive UI pieces)
```

Maximizes server rendering while isolating interactivity.

## Client Islands

Interactive pieces in `"use client"` components receiving server-fetched data as props:

```
src/app/(app)/resources/[slug]/
  page.tsx                     # Server component (fetches data)
  _components/
    resource-tabs.tsx          # Client island (interactive tabs)
    action-toolbar.tsx         # Client island (buttons, handlers)
```

Rules:
- Colocate in `_components/` next to their page
- Pass server-fetched data as props (no client-side re-fetching of same data)
- Keep small and focused on a single interactive concern

## Caching Strategy

```tsx
import { cacheLife, cacheTag } from "next/cache";

export default async function ResourceListPage() {
  "use cache";
  cacheLife("content");       // 1 hour revalidation
  cacheTag("resources");      // Tag for targeted invalidation
  const resources = await fetchResources();
  return <ResourceList resources={resources} />;
}
```

| Profile | Revalidate | Usage |
|---------|-----------|-------|
| `content` | 1 hour | List pages, feeds |
| `entry` | 30 min | Detail pages |
| `longLived` | 2 hours | Rarely changing content |
| `"max"` | 30 days | Static pages (about, terms) |

## File Naming

- Components: `kebab-case.tsx` with PascalCase named exports
- Hooks: `use-{name}.ts`
- Utilities: `kebab-case.ts`
- Types: `kebab-case.ts` in `src/types/`

## Testing

CI: `tsc --noEmit` + `pnpm lint` + `pnpm build`
Local: `pnpm test:e2e` (Playwright) + `pnpm test:unit` (Vitest)
