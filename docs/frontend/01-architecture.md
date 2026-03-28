# Next.js Architecture

Next.js App Router architecture patterns for production applications.

**Why these patterns?** Server components reduce client-side JavaScript, improve SEO, and simplify data fetching. The donut pattern and client islands approach keep the interactive boundary explicit, preventing accidental client-side bloat. Route groups organize code by concern without leaking into URLs.

## Directory Structure

**Why feature-based?** Grouping by feature (not by type) keeps related files together, reduces cognitive load when navigating the codebase, and makes it obvious where new code belongs.

Feature-based organization with route groups:

```
src/app/
├── (auth)/              # Auth routes (login, register, password reset)
├── (app)/               # Authenticated application pages
│   ├── dashboard/
│   ├── settings/
│   └── [resource]/
├── (admin)/             # Admin dashboard
├── (marketing)/         # Public marketing pages (landing, pricing, about)
└── api/                 # API routes
```

Route groups use parentheses for logical organization without affecting URLs.

```
src/
├── app/                 # App Router pages and layouts
├── components/          # Feature-grouped components
│   ├── shared/          # Cross-feature components
│   ├── dashboard/       # Dashboard feature components
│   └── {feature}/       # Other feature directories
├── hooks/               # Custom React hooks
├── lib/                 # Utilities, API clients, validation
├── stores/              # Client state stores
├── types/               # Centralized TypeScript definitions
└── locales/             # i18n translations (if applicable)
```

## Server Components First

Components are **server components by default**. Add `"use client"` only when the component:

1. **Uses React hooks** (`useState`, `useEffect`, `useContext`, etc.)
2. **Uses browser APIs** (`document`, `window`, `localStorage`)
3. **Uses event handlers** (`onClick`, `onChange`, etc.)
4. **Uses client-only libraries** (TanStack Query, animation libraries, etc.)

If none of these apply, keep it as a server component.

## Donut Pattern

Server layout wraps client providers, which wrap server pages containing client islands:

```
Server layout
  └── Client providers (theme, auth, query client)
        └── Server pages (data fetching, SEO)
              └── Client islands (interactive UI pieces)
```

This maximizes server rendering while isolating interactivity to small client boundaries.

## Client Islands

Interactive pieces extracted into `"use client"` components that receive server-fetched data as props:

```
src/app/(app)/resources/[slug]/
├── page.tsx                          # Server component (fetches data)
└── _components/
    ├── resource-tabs.tsx             # Client island (interactive tabs)
    ├── action-toolbar.tsx            # Client island (buttons, handlers)
    └── comment-section.tsx           # Client island (form + state)
```

**Rules**:
- Colocate client islands in `_components/` directory next to their page
- Pass server-fetched data as props -- no client-side re-fetching of the same data
- Keep client islands small and focused on a single interactive concern

## Caching Strategy

Use `"use cache"` directive with `cacheLife()` for server component caching:

```tsx
import { cacheLife, cacheTag } from "next/cache";

export default async function ResourceListPage() {
  "use cache";
  cacheLife("content");
  cacheTag("resources");
  const resources = await fetchResources();
  return <ResourceList resources={resources} />;
}
```

### Custom Cache Profiles

Define profiles in `next.config.ts`:

| Profile | Revalidate | Usage |
|---------|-----------|-------|
| `content` | 1 hour | List pages, feeds |
| `entry` | 30 minutes | Individual detail pages |
| `longLived` | 2 hours | Rarely changing content |
| `"max"` (built-in) | 30 days | Static pages (about, privacy, terms) |

```tsx
// Static pages that rarely change
export default async function AboutPage() {
  "use cache";
  cacheLife("max");
  // ...
}
```

## Dynamic Routing

```tsx
// src/app/(app)/resources/[category]/page.tsx
export default async function CategoryPage({
  params,
}: {
  params: { category: string };
}) {
  const { category } = params;
  const resources = await fetchByCategory(category);
  return <ResourceGrid resources={resources} />;
}

// Nested: src/app/(app)/resources/[category]/[slug]/page.tsx
export default async function DetailPage({
  params,
}: {
  params: { category: string; slug: string };
}) {
  const { category, slug } = params;
  const resource = await fetchResource(category, slug);
  return <ResourceDetail resource={resource} />;
}
```

## File Naming

- **Component files**: `kebab-case.tsx` (e.g., `hero-section.tsx`, `toast-provider.tsx`)
- **Exports**: PascalCase named exports (e.g., `export function HeroSection()`)
- **Hook files**: `use-{name}.ts` (e.g., `use-auth.ts`, `use-resources.ts`)
- **Utility files**: `kebab-case.ts` (e.g., `format-date.ts`, `api-client.ts`)
- **Type files**: `kebab-case.ts` in `src/types/` (e.g., `resource.ts`, `api.ts`)

## Testing Approach

### CI/CD (Automated)

```bash
npx tsc --noEmit     # TypeScript type checking
pnpm run lint        # ESLint
pnpm run build       # Next.js production build
```

### Local Development (Manual)

```bash
pnpm run test:e2e    # Playwright E2E tests
pnpm run test:unit   # Vitest unit tests
```

### Pre-Release Checklist

- [ ] Run E2E tests locally
- [ ] Test on mobile devices (iOS Safari + Android Chrome)
- [ ] Lighthouse audit on key pages (optional)

## Key Patterns Summary

| Pattern | When to Use |
|---------|------------|
| Server component | Default for all components |
| `"use client"` | Hooks, browser APIs, event handlers, client libraries |
| Donut pattern | Marketing/public pages with isolated interactivity |
| Client islands | Interactive pieces inside server-rendered pages |
| `"use cache"` | Server components that fetch data |
| Route groups | Logical page organization without URL impact |
| `_components/` | Page-colocated client islands |
