# Performance Optimization

Performance patterns for Next.js and React applications, prioritized by impact.

**Why these patterns?** Performance directly impacts user experience, SEO rankings, and conversion rates. Waterfalls and bloated bundles are the biggest offenders -- eliminating them yields the largest gains. Server-side optimizations reduce response times and infrastructure costs. These rules are adapted from Vercel Engineering best practices and prioritized by measurable impact.

> **Client-side data fetching**: TanStack Query handles request deduplication, caching, and stale-while-revalidate natively. See [State Management](03-state-management.md) for patterns.

---

## Eliminating Waterfalls

**Impact: CRITICAL** -- Waterfalls are the #1 performance killer. Each sequential `await` adds full network round-trip latency.

### Parallel Execution with Promise.all

When async operations have no interdependencies, execute them concurrently:

```typescript
// Bad: sequential when operations are independent (time = sum of all calls)
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();

// Good: parallel execution (time = slowest call)
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments(),
]);
```

**Rules**:
- MUST use `Promise.all()` for independent async operations
- MUST apply in server components, API routes, and server actions

### Defer Await Until Needed

Move `await` into the branch where the value is actually used:

```typescript
// Bad: always fetches even when skipping
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId);
  if (skipProcessing) return { skipped: true };
  return processUserData(userData);
}

// Good: fetches only when needed
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) return { skipped: true };
  const userData = await fetchUserData(userId);
  return processUserData(userData);
}
```

**Rules**:
- SHOULD move `await` into the branch where the result is consumed
- SHOULD order checks from cheapest (sync) to most expensive (network)

### Check Cheap Conditions Before Awaiting

When a branch requires both a sync condition and an async flag, evaluate the sync condition first:

```typescript
// Bad: always hits the network
const someFlag = await getFlag();
if (someFlag && someCondition) { /* ... */ }

// Good: skips network call when sync condition is false
if (someCondition) {
  const someFlag = await getFlag();
  if (someFlag) { /* ... */ }
}
```

### Dependency-Based Parallelization

When operations have partial dependencies, start independent work immediately and chain dependent operations:

```typescript
// Suboptimal: config and profile could run in parallel but don't
const [user, config] = await Promise.all([fetchUser(), fetchConfig()]);
const profile = await fetchProfile(user.id);

// Good: config and profile run in parallel
const userPromise = fetchUser();
const profilePromise = userPromise.then((user) => fetchProfile(user.id));
const [user, config, profile] = await Promise.all([
  userPromise,
  fetchConfig(),
  profilePromise,
]);
```

### Start Promises Early in API Routes

In API routes and server actions, start independent operations immediately, await later:

```typescript
// Bad: sequential chain
export async function GET(request: Request) {
  const session = await auth();
  const config = await fetchConfig();
  const data = await fetchData(session.user.id);
  return Response.json({ data, config });
}

// Good: auth and config start immediately
export async function GET(request: Request) {
  const sessionPromise = auth();
  const configPromise = fetchConfig();
  const session = await sessionPromise;
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id),
  ]);
  return Response.json({ data, config });
}
```

### Suspense Boundaries for Streaming

Use `<Suspense>` to stream page shell immediately while data-dependent sections load:

```tsx
// Bad: entire page blocked by data fetch
async function Page() {
  const data = await fetchData();
  return (
    <div>
      <Sidebar />
      <Header />
      <DataDisplay data={data} />
      <Footer />
    </div>
  );
}

// Good: shell renders immediately, data streams in
function Page() {
  return (
    <div>
      <Sidebar />
      <Header />
      <Suspense fallback={<Skeleton />}>
        <DataDisplay />
      </Suspense>
      <Footer />
    </div>
  );
}

async function DataDisplay() {
  const data = await fetchData();
  return <div>{data.content}</div>;
}
```

**Rules**:
- SHOULD wrap data-dependent sections in `<Suspense>` boundaries
- MUST NOT use Suspense for SEO-critical content above the fold
- SHOULD consider layout shift trade-offs (loading to content jump)

---

## Bundle Size Optimization

**Impact: CRITICAL** -- Reducing initial bundle size improves Time to Interactive (TTI) and Largest Contentful Paint (LCP).

### Avoid Barrel File Imports

Import directly from source files or use `optimizePackageImports`. Barrel files (index.js re-exports) force loading thousands of unused modules.

```tsx
// Bad: loads entire library (200-800ms import cost)
import { Check, X, Menu } from "lucide-react";
```

```js
// Good: Next.js optimizes at build time (recommended)
// next.config.ts
const nextConfig = {
  optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
};
```

```tsx
// Then keep standard imports -- Next.js transforms them automatically
import { Check, X, Menu } from "lucide-react";
```

**Commonly affected libraries**: `lucide-react`, `@radix-ui/react-*`, `@tabler/icons-react`, `react-icons`, `date-fns`, `lodash`.

**Rules**:
- MUST configure `optimizePackageImports` for icon and component libraries
- SHOULD import directly from subpaths for non-Next.js code (`import Button from "@mui/material/Button"`)

### Dynamic Imports for Heavy Components

Use `next/dynamic` to lazy-load large components not needed on initial render:

```tsx
// Bad: editor bundles with main chunk (~300KB)
import { MonacoEditor } from "./monaco-editor";

// Good: editor loads on demand
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(
  () => import("./monaco-editor").then((m) => m.MonacoEditor),
  { ssr: false }
);
```

**Rules**:
- MUST use `next/dynamic` for components over 50KB (editors, charts, maps, rich text)
- SHOULD set `ssr: false` for client-only components (avoids SSR overhead)

### Defer Non-Critical Third-Party Scripts

Analytics, logging, and error tracking do not block user interaction. Load them after hydration:

```tsx
import dynamic from "next/dynamic";

// Bad: blocks initial bundle
// import { Analytics } from "@vercel/analytics/react";

// Good: loads after hydration

const Analytics = dynamic(
  () => import("@vercel/analytics/react").then((m) => m.Analytics),
  { ssr: false }
);
```

### Conditional Module Loading

Load large data or modules only when a feature is activated:

```tsx
function AnimationPlayer({ enabled }: { enabled: boolean }) {
  const [frames, setFrames] = useState<Frame[] | null>(null);

  useEffect(() => {
    if (enabled && !frames && typeof window !== "undefined") {
      import("./animation-frames")
        .then((mod) => setFrames(mod.frames))
        .catch(() => console.error("Failed to load animation frames"));
    }
  }, [enabled, frames]);

  if (!frames) return <Skeleton />;
  return <Canvas frames={frames} />;
}
```

### Preload on User Intent

Preload heavy bundles before they are needed to reduce perceived latency:

```tsx
function EditorButton({ onClick }: { onClick: () => void }) {
  const preload = () => {
    if (typeof window !== "undefined") {
      void import("./monaco-editor");
    }
  };

  return (
    <button onMouseEnter={preload} onFocus={preload} onClick={onClick}>
      Open Editor
    </button>
  );
}
```

**Rules**:
- SHOULD preload on `onMouseEnter` and `onFocus` for dynamically imported components
- SHOULD preload when a feature flag becomes enabled

---

## Server-Side Performance

**Impact: HIGH** -- Optimizing server-side rendering and data fetching reduces response times and eliminates server-side waterfalls.

### Authenticate Server Actions

Server actions (`"use server"`) are exposed as public endpoints. Always verify authentication and authorization **inside** each server action -- do not rely solely on middleware or layout guards.

```typescript
"use server";

import { verifySession } from "@/lib/auth";
import { z } from "zod";

const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

export async function updateProfile(data: unknown) {
  const validated = updateProfileSchema.parse(data);
  const session = await verifySession();

  if (!session) throw new Error("Unauthorized");
  if (session.user.id !== validated.userId)
    throw new Error("Can only update own profile");

  await db.user.update({
    where: { id: validated.userId },
    data: { name: validated.name, email: validated.email },
  });

  return { success: true };
}
```

**Rules**:
- MUST authenticate and authorize inside every server action
- MUST validate inputs with Zod before performing mutations
- MUST NOT rely on middleware or page-level guards alone for server action security

### Per-Request Deduplication with React.cache()

Use `React.cache()` to deduplicate expensive operations within a single request. Multiple calls to the same cached function execute the query only once.

```typescript
import { cache } from "react";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return await db.user.findUnique({ where: { id: session.user.id } });
});
```

**Rules**:
- MUST use arguments with stable references -- `React.cache()` uses `Object.is` for equality (inline object literals create new references on every call)
- SHOULD wrap auth checks, database queries, and heavy computations
- Next.js `fetch` is automatically deduplicated -- `React.cache()` is for non-fetch async work

### Cross-Request LRU Caching

`React.cache()` only deduplicates within one request. For data shared across subsequent requests, use an LRU cache:

```typescript
import { LRUCache } from "lru-cache";

const cache = new LRUCache<string, any>({
  max: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
});

export async function getUser(id: string) {
  const cached = cache.get(id);
  if (cached) return cached;

  const user = await db.user.findUnique({ where: { id } });
  cache.set(id, user);
  return user;
}
```

**Rules**:
- SHOULD use LRU cache for data accessed across multiple requests within seconds
- MUST set appropriate `max` and `ttl` to prevent memory leaks

### Hoist Static I/O to Module Level

Static assets (fonts, logos, config) should be loaded once at module initialization, not on every request:

```typescript
// Bad: reads font on every request
export async function GET(request: Request) {
  const fontData = await fetch(
    new URL("./fonts/Inter.ttf", import.meta.url)
  ).then((res) => res.arrayBuffer());
  return new ImageResponse(/* ... */);
}

// Good: loads once at module init
const fontData = fetch(
  new URL("./fonts/Inter.ttf", import.meta.url)
).then((res) => res.arrayBuffer());

export async function GET(request: Request) {
  const font = await fontData;
  return new ImageResponse(/* ... */);
}
```

**Rules**:
- MUST hoist static asset loading to module level for OG images, config, templates
- MUST NOT hoist request-specific, user-specific, or sensitive data

### No Shared Module State for Request Data

Module-level mutable variables are shared across concurrent server renders. Using them for request-scoped data causes race conditions and data leaks.

```tsx
// Bad: request data leaks across concurrent renders
let currentUser: User | null = null;

export default async function Page() {
  currentUser = await auth();
  return <Dashboard />;
}

// Good: keep request data local to the render tree
export default async function Page() {
  const user = await auth();
  return <Dashboard user={user} />;
}
```

**Rules**:
- MUST NOT use mutable module-level variables for request-scoped data
- MAY use module-level immutable statics and intentional cross-request caches

### Minimize Serialization at RSC Boundaries

Only pass the fields a client component actually uses. The RSC/client boundary serializes all props into the HTML response.

```tsx
// Bad: serializes all 50 fields
async function Page() {
  const user = await fetchUser(); // 50 fields
  return <Profile user={user} />;
}

// Good: serializes only what's needed
async function Page() {
  const user = await fetchUser();
  return <Profile name={user.name} avatarUrl={user.avatarUrl} />;
}
```

**Rules**:
- MUST pass only needed fields from server to client components
- SHOULD keep client component prop interfaces narrow
- See [Client Islands](01-architecture.md#client-islands) for the broader pattern

### Parallel Component Composition

React Server Components execute sequentially within a tree. Restructure sibling components so they fetch data in parallel:

```tsx
// Bad: Sidebar waits for Header's fetch to complete
export default async function Page() {
  const header = await fetchHeader();
  return (
    <div>
      <div>{header}</div>
      <Sidebar />
    </div>
  );
}

// Good: both fetch simultaneously as sibling async components
async function Header() {
  const data = await fetchHeader();
  return <div>{data}</div>;
}

async function Sidebar() {
  const items = await fetchSidebarItems();
  return <nav>{items.map(renderItem)}</nav>;
}

export default function Page() {
  return (
    <div>
      <Header />
      <Sidebar />
    </div>
  );
}
```

**Rules**:
- MUST structure async server components as siblings, not sequential awaits in a parent
- SHOULD extract each data-dependent section into its own async component

### Chain Nested Fetches per Item

When fetching nested data in parallel, chain dependent fetches within each item so a slow item does not block the rest:

```typescript
// Bad: one slow getChat blocks all author fetches
const chats = await Promise.all(chatIds.map((id) => getChat(id)));
const authors = await Promise.all(chats.map((chat) => getUser(chat.author)));

// Good: each item chains its own nested fetch
const authors = await Promise.all(
  chatIds.map((id) => getChat(id).then((chat) => getUser(chat.author)))
);
```

### Non-Blocking Operations with after()

Use Next.js `after()` to schedule work that runs after the response is sent. Prevents logging, analytics, and side effects from blocking the response:

```typescript
import { after } from "next/server";

export async function POST(request: Request) {
  await updateDatabase(request);

  after(async () => {
    const userAgent =
      (await headers()).get("user-agent") || "unknown";
    logUserAction({ userAgent });
  });

  return Response.json({ status: "success" });
}
```

**Rules**:
- SHOULD use `after()` for analytics, audit logging, notifications, and cache invalidation
- `after()` runs even if the response fails or redirects
- Works in server actions, route handlers, and server components
