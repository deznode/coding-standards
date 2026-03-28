# State Management

Patterns for managing client and server state in Next.js applications.

**Why separate client and server state?** Mixing API data into client stores leads to stale data, manual cache invalidation, and duplicated fetch logic. TanStack Query handles server state (caching, revalidation, background updates) while Zustand handles pure client state (UI preferences, filters). This separation keeps each tool focused on what it does best.

## Overview

| State Type | Tool | When to Use |
|-----------|------|-------------|
| Client UI state | Zustand | Global client state (auth, filters, preferences) |
| Server/async state | TanStack React Query | API data fetching, caching, synchronization |
| Form validation | Zod | Schema validation for forms and API responses |
| Simple shared state | React Context + hooks | Small apps or isolated feature state |

## Zustand Store Pattern

Stores use `create` with `devtools` wrapper, and optionally `persist`:

```typescript
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// ---- With persist (e.g., auth state) ----

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        session: null,
        isLoading: true,
        setUser: (user) => set({ user }),
        setSession: (session) => set({ session }),
        logout: () => set({ user: null, session: null, isLoading: false }),
      }),
      {
        name: "auth-storage",
        partialize: (state) => ({
          user: state.user, // Only persist user, not session (security)
        }),
      }
    ),
    { name: "AuthStore" }
  )
);

// ---- Without persist (e.g., filter state) ----

interface FilterState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  hasActiveFilters: () => boolean;
}

export const useFilterStore = create<FilterState>()(
  devtools(
    (set, get) => ({
      searchQuery: "",
      setSearchQuery: (query) => set({ searchQuery: query }),
      hasActiveFilters: () => !!get().searchQuery,
    }),
    { name: "FilterStore" }
  )
);
```

### Selector Exports

Export individual selectors for optimized re-renders -- never access the entire store:

```typescript
// GOOD -- granular selectors (components only re-render when their slice changes)
export const useUser = () => useAuthStore((state) => state.user);
export const useSession = () => useAuthStore((state) => state.session);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.user !== null);

// BAD -- subscribes to ALL state changes, causes unnecessary re-renders
const store = useAuthStore();
```

## TanStack React Query

### Query Client Configuration

```typescript
// lib/query-client.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1 minute
      gcTime: 5 * 60 * 1000,       // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
```

### Query Key Factory Pattern

Each data hook file exports a key factory object for hierarchical cache invalidation:

```typescript
// hooks/use-resources.ts

export const resourceKeys = {
  all: ["resources"] as const,
  lists: () => [...resourceKeys.all, "list"] as const,
  list: (filters: ResourceFilters) => [...resourceKeys.lists(), filters] as const,
  details: () => [...resourceKeys.all, "detail"] as const,
  detail: (slug: string) => [...resourceKeys.details(), slug] as const,
};
```

**Why**: Keys build hierarchically so you can invalidate at any level:

```typescript
// Invalidate all resource queries
queryClient.invalidateQueries({ queryKey: resourceKeys.all });

// Invalidate only list queries (keeps detail cache)
queryClient.invalidateQueries({ queryKey: resourceKeys.lists() });

// Invalidate a specific detail
queryClient.invalidateQueries({ queryKey: resourceKeys.detail("my-slug") });
```

### Custom Query Hooks

One file per domain, exporting the key factory and hook functions:

```typescript
// hooks/use-resources.ts
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Resource, ResourceFilters } from "@/types/resource";

export const resourceKeys = {
  all: ["resources"] as const,
  lists: () => [...resourceKeys.all, "list"] as const,
  list: (filters: ResourceFilters) => [...resourceKeys.lists(), filters] as const,
  details: () => [...resourceKeys.all, "detail"] as const,
  detail: (slug: string) => [...resourceKeys.details(), slug] as const,
};

export function useResources(
  filters: ResourceFilters,
  options?: Omit<UseQueryOptions<Resource[], Error>, "queryKey" | "queryFn">
) {
  return useQuery<Resource[], Error>({
    queryKey: resourceKeys.list(filters),
    queryFn: () => api.get<Resource[]>("/resources", { params: filters }),
    staleTime: 5 * 60 * 1000, // 5 minutes for relatively static data
    ...options,
  });
}

export function useResource(slug: string) {
  return useQuery<Resource, Error>({
    queryKey: resourceKeys.detail(slug),
    queryFn: () => api.get<Resource>(`/resources/${slug}`),
    enabled: !!slug, // Don't fetch without a slug
  });
}

export function useUserContributions(
  options?: Omit<UseQueryOptions<Contribution[], Error>, "queryKey" | "queryFn">
) {
  const isAuthenticated = useIsAuthenticated();

  const query = useQuery<Contribution[], Error>({
    queryKey: ["user", "contributions"],
    queryFn: () => api.get<Contribution[]>("/user/contributions"),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: isAuthenticated, // Conditional fetching
    ...options,
  });

  return {
    contributions: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

## React Context Alternative

For simpler projects that don't need Zustand, colocate provider and hook in one file:

```typescript
// contexts/user-context.tsx
import { createContext, useContext, ReactNode, useState } from "react";

interface UserContextValue {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthenticated: boolean;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within UserProvider");
  }
  return context;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        isAuthenticated: user !== null,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}
```

**When to use Context vs Zustand**:
- **Context**: Small apps, 1-2 global state slices, no complex selectors needed
- **Zustand**: Multiple stores, selector-based optimization, middleware (persist, devtools)

## Zod Schemas

Schemas live in `src/lib/validation/` or colocated with their feature:

```typescript
import { z } from "zod";

// Simple form schema
export const contactFormSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Invalid email"),
  message: z.string().trim().min(10, "Message must be at least 10 characters"),
  website: z.string().optional(), // Honeypot field
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

// Composable schemas
export const BaseContentSchema = z.object({
  slug: z.string().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(1).max(100),
  tags: z.array(z.string().min(2).max(30)).min(1).max(10),
});

export const ArticleSchema = BaseContentSchema.extend({
  series: z.string().optional(),
  seriesOrder: z.number().int().positive().optional(),
}).refine(
  (data) => !(data.series && !data.seriesOrder),
  { message: "Both series and seriesOrder must be provided together" }
);

export type Article = z.infer<typeof ArticleSchema>;
```

**Rules**:
- Use `z.infer<typeof schema>` to derive TypeScript types from schemas
- Compose schemas with `.extend()` and `.merge()` for DRY definitions
- Use `.refine()` for cross-field validation
- Always `.trim()` string inputs in form schemas

## File Organization

```
src/
├── stores/                    # Zustand stores
│   ├── auth-store.ts          # Auth state + selectors
│   ├── filter-store.ts        # Filter/search state
│   └── preferences-store.ts   # User preferences (persisted)
├── hooks/                     # Custom hooks (including query hooks)
│   ├── use-resources.ts       # Query key factory + resource hooks
│   ├── use-profile.ts         # Profile query hooks
│   └── use-auth.ts            # Auth utility hooks
├── contexts/                  # React Context providers (if used)
│   └── toast-context.tsx
├── lib/
│   ├── query-client.ts        # QueryClient configuration
│   └── validation/            # Zod schemas
│       ├── auth.ts
│       └── content.ts
└── types/                     # TypeScript type definitions
    ├── resource.ts
    └── api.ts
```
