---
paths: apps/web/**
standard_type: aspirational
---

# State Management

> **Standard note:** This rule describes the _target_ coding standard. The project may
> currently use different patterns. When editing existing code, follow the patterns
> established in the codebase. When writing new code, prefer these patterns.

> Full reference: `docs/frontend/03-state-management.md`

## Overview

| State Type | Tool |
|-----------|------|
| Client UI state | Zustand (auth, filters, preferences) |
| Server/async state | TanStack React Query |
| Form validation | Zod schemas |
| Simple shared state | React Context + hooks |

## Zustand Store Pattern

Stores use `create` with `devtools` wrapper (optionally `persist`):

```typescript
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        setUser: (user) => set({ user }),
        logout: () => set({ user: null, session: null }),
      }),
      { name: "auth-storage", partialize: (s) => ({ user: s.user }) }
    ),
    { name: "AuthStore" }
  )
);
```

Export individual selectors -- never access the entire store:

```typescript
// GOOD -- granular selectors
export const useUser = () => useAuthStore((s) => s.user);
export const useIsAuthenticated = () => useAuthStore((s) => s.user !== null);

// BAD -- subscribes to ALL state changes
const store = useAuthStore();
```

## TanStack Query Key Factory

Each hook file exports a key factory for hierarchical cache invalidation:

```typescript
export const resourceKeys = {
  all: ["resources"] as const,
  lists: () => [...resourceKeys.all, "list"] as const,
  list: (filters: Filters) => [...resourceKeys.lists(), filters] as const,
  details: () => [...resourceKeys.all, "detail"] as const,
  detail: (slug: string) => [...resourceKeys.details(), slug] as const,
};
```

Invalidation at any level:

```typescript
queryClient.invalidateQueries({ queryKey: resourceKeys.all });       // All
queryClient.invalidateQueries({ queryKey: resourceKeys.lists() });   // Lists only
queryClient.invalidateQueries({ queryKey: resourceKeys.detail("x") }); // Specific
```

## Custom Query Hooks

One file per domain, exporting key factory + hooks:

```typescript
export function useResources(filters: Filters) {
  return useQuery({
    queryKey: resourceKeys.list(filters),
    queryFn: () => api.get("/resources", { params: filters }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useResource(slug: string) {
  return useQuery({
    queryKey: resourceKeys.detail(slug),
    queryFn: () => api.get(`/resources/${slug}`),
    enabled: !!slug,
  });
}
```

## Zod Schemas

```typescript
export const formSchema = z.object({
  email: z.string().trim().min(1, "Required").email("Invalid email"),
  message: z.string().trim().min(10, "Min 10 chars"),
});

export type FormInput = z.infer<typeof formSchema>;
```

Rules:
- `z.infer<typeof schema>` to derive TypeScript types
- Compose with `.extend()` and `.merge()`
- `.refine()` for cross-field validation
- Always `.trim()` string inputs

## File Organization

```
src/
  stores/        # Zustand stores (auth-store.ts, filter-store.ts)
  hooks/         # Query hooks (use-resources.ts, use-profile.ts)
  lib/
    query-client.ts     # QueryClient config
    validation/         # Zod schemas
  types/                # TypeScript definitions
```
