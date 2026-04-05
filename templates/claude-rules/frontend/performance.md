---
paths: apps/web/**
---

# Performance Optimization

> Full reference: `docs/frontend/06-performance.md`

## Eliminating Waterfalls (CRITICAL)

- `Promise.all()` for independent async operations (never sequential awaits)
- Defer `await` into the branch where the value is consumed
- Check cheap sync conditions before async flags
- Chain partial dependencies: start promises early, await late
- `<Suspense>` boundaries to stream page shell while data loads

```typescript
// Good: parallel execution
const [user, posts] = await Promise.all([fetchUser(), fetchPosts()]);

// Good: start early, await late in API routes
const sessionPromise = auth();
const configPromise = fetchConfig();
const session = await sessionPromise;
const [config, data] = await Promise.all([configPromise, fetchData(session.user.id)]);
```

## Bundle Size (CRITICAL)

- `optimizePackageImports` in `next.config.js` for icon/component libraries
- `next/dynamic` with `ssr: false` for heavy components (editors, charts, maps)
- Defer analytics/logging to load after hydration
- Conditional `import()` for feature-gated modules
- Preload on `onMouseEnter`/`onFocus` for perceived speed

```js
// next.config.ts
const nextConfig = {
  optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
};
```

```tsx
// Dynamic import for heavy components
const MonacoEditor = dynamic(
  () => import("./monaco-editor").then((m) => m.MonacoEditor),
  { ssr: false }
);
```

## Server-Side Performance (HIGH)

- Authenticate and authorize inside every server action (they are public endpoints)
- `React.cache()` for per-request dedup (auth, DB queries) -- use primitive args
- LRU cache for cross-request data (set `max` and `ttl`)
- Hoist static I/O (fonts, config, templates) to module level
- Never use mutable module-level variables for request-scoped data
- Pass only needed fields from server to client components (minimize serialization)
- Structure async server components as siblings for parallel fetching
- Chain nested fetches per item with `.then()` inside `Promise.all()`
- `after()` for non-blocking logging, analytics, and side effects

```tsx
// Good: sibling components fetch in parallel
export default function Page() {
  return (
    <div>
      <Header />   {/* async, fetches own data */}
      <Sidebar />  {/* async, fetches own data */}
    </div>
  );
}

// Good: narrow props at RSC boundary
<Profile name={user.name} avatarUrl={user.avatarUrl} />
```

## Client-Side Data Fetching

TanStack Query handles request deduplication natively. See `docs/frontend/03-state-management.md`.
