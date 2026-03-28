# API Client Architecture

Patterns for API client design in Next.js applications, supporting both server components and client-side data fetching.

**Why the factory pattern?** Separating the API contract (interface) from the implementation allows swapping between a real backend client and a mock client without changing any consuming code. This enables frontend development before the backend is ready, simplifies testing, and provides a single import path (`@/lib/api`) for all API access.

## Architecture Overview

```
api-contracts.ts  ->  api-factory.ts  ->  api.ts (unified export)
  (interface)          (strategy)         |
                                       backend-api.ts  /  mock-api.ts
                                         (implementations)
```

## Factory Pattern

### Contract Interface

Define the API surface as a TypeScript interface:

```typescript
// lib/api-contracts.ts
export interface ApiClient {
  getResources(filters?: ResourceFilters): Promise<PaginatedResult<Resource>>;
  getResource(slug: string): Promise<Resource>;
  createResource(data: CreateResourceInput): Promise<Resource>;
  updateResource(id: string, data: UpdateResourceInput): Promise<Resource>;
  deleteResource(id: string): Promise<void>;
}
```

### Factory

The factory selects the implementation based on environment configuration:

```typescript
// lib/api-factory.ts
let apiClientInstance: ApiClient | null = null;

export const getApiClient = (): ApiClient => {
  if (!apiClientInstance) {
    apiClientInstance = env.useMockApi
      ? new MockApiClient()
      : new BackendApiClient();
  }
  return apiClientInstance;
};
```

### Implementations

```typescript
// lib/backend-api.ts
export class BackendApiClient implements ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL!;
  }

  async getResource(slug: string): Promise<Resource> {
    const response = await fetch(`${this.baseUrl}/api/v1/resources/${slug}`, {
      next: CacheConfig.INDIVIDUAL_ENTRY,
    });
    return this.handleResponse<Resource>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new ApiError(response.statusText, response.status);
    }
    return response.json();
  }
}

// lib/mock-api.ts
export class MockApiClient implements ApiClient {
  async getResource(slug: string): Promise<Resource> {
    return { id: "1", slug, title: "Mock Resource", /* ... */ };
  }
}
```

### Unified Export

```typescript
// lib/api.ts
import { getApiClient } from "./api-factory";

const apiClient = getApiClient();

export async function getResources(
  filters?: ResourceFilters
): Promise<PaginatedResult<Resource>> {
  return apiClient.getResources(filters);
}

export async function getResource(slug: string): Promise<Resource> {
  return apiClient.getResource(slug);
}
```

## Import Rule

**Always** import from `@/lib/api` -- never from implementation files directly:

```typescript
// GOOD
import { getResources, getResource } from "@/lib/api";

// BAD
import { BackendApiClient } from "@/lib/backend-api";
```

## Adding New API Methods

1. Add method signature to `ApiClient` interface in `api-contracts.ts`
2. Implement in `BackendApiClient` (`backend-api.ts`)
3. Implement in `MockApiClient` (`mock-api.ts`) -- can return stub data
4. Export wrapper function from `api.ts`

```typescript
// 1. api-contracts.ts
export interface ApiClient {
  getFeature(id: string): Promise<Feature>;
}

// 2. backend-api.ts
async getFeature(id: string): Promise<Feature> {
  const response = await fetch(`${this.baseUrl}/api/v1/features/${id}`, {
    next: CacheConfig.INDIVIDUAL_ENTRY,
  });
  return this.handleResponse<Feature>(response);
}

// 3. mock-api.ts
async getFeature(id: string): Promise<Feature> {
  return { id, name: "Mock Feature" };
}

// 4. api.ts
export async function getFeature(id: string): Promise<Feature> {
  return apiClient.getFeature(id);
}
```

## Server-Side API Client

For React Server Components, use a dedicated server-side client that runs only on the server:

```typescript
// lib/api-server.ts
import "server-only";

export async function serverApi<T>(endpoint: string): Promise<T> {
  const baseUrl = process.env.API_URL; // Server-only env var (not NEXT_PUBLIC_)
  const token = await getServerAuthToken(); // e.g., from cookies
  const locale = detectLocale(); // From cookies or Accept-Language header

  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Accept-Language": locale,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new ApiError(response.statusText, response.status);
  }

  return response.json();
}
```

**Usage in server components**:

```tsx
// app/(app)/resources/page.tsx (server component)
import { serverApi } from "@/lib/api-server";
import type { Resource } from "@/types/resource";

export default async function ResourcesPage() {
  const resources = await serverApi<Resource[]>("/resources");
  return <ResourceList resources={resources} />;
}
```

**Key points**:
- Uses `process.env.API_URL` (server-only, not `NEXT_PUBLIC_`)
- Injects auth token from server-side session (cookies)
- Detects locale from cookies or request headers
- Import `"server-only"` to prevent accidental client-side usage

## Client API Client

For client components, use a client that auto-injects the auth token:

```typescript
// lib/api-client.ts

class ClientApi {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL!;
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("GET", endpoint, options);
  }

  async post<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", endpoint, { body });
  }

  async put<T>(endpoint: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", endpoint, { body });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>("DELETE", endpoint);
  }

  private async request<T>(
    method: string,
    endpoint: string,
    options?: RequestOptions
  ): Promise<T> {
    const token = await getClientAuthToken(); // e.g., from auth provider

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      throw new ApiError(response.statusText, response.status);
    }

    return response.json();
  }
}

export const api = new ClientApi();
```

**Usage with TanStack Query**:

```typescript
// hooks/use-resources.ts
import { api } from "@/lib/api-client";

export function useResources() {
  return useQuery({
    queryKey: resourceKeys.lists(),
    queryFn: () => api.get<Resource[]>("/resources"),
  });
}
```

## Dual Data Fetching

Server and client components use different API clients for the same data:

| Context | Client | Auth | Usage |
|---------|--------|------|-------|
| Server components | `serverApi<T>()` | Server-side token (cookies) | Initial page render, SEO content |
| Client components | `api.get<T>()` + TanStack Query | Client-side token (session) | Interactive data, mutations, real-time |

```tsx
// Server component -- uses serverApi()
export default async function ResourcePage({ params }: Props) {
  const resource = await serverApi<Resource>(`/resources/${params.slug}`);
  return (
    <div>
      <ResourceHeader resource={resource} />
      {/* Client island receives server-fetched data as props */}
      <ResourceActions resource={resource} />
    </div>
  );
}

// Client island -- uses TanStack Query for mutations and live data
"use client";
export function ResourceActions({ resource }: { resource: Resource }) {
  const { mutate: toggleFavorite } = useMutation({
    mutationFn: () => api.post(`/resources/${resource.id}/favorite`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: resourceKeys.detail(resource.slug) });
    },
  });

  return <button onClick={() => toggleFavorite()}>Favorite</button>;
}
```

## Cache Configuration

### ISR Revalidation Durations

```typescript
// lib/api-contracts.ts
export const CacheConfig = {
  LIST_PAGES: { revalidate: 3600 },       // 1 hour
  INDIVIDUAL_ENTRY: { revalidate: 1800 },  // 30 minutes
  REFERENCE_DATA: { revalidate: 3600 },    // 1 hour
  REAL_TIME_DATA: { cache: "no-store" as const }, // Always fresh
  FREQUENT_UPDATES: { revalidate: 300 },   // 5 minutes
} as const;
```

Usage in page components:

```typescript
export const revalidate = 3600; // 1 hour ISR
```

## Response Type Mapping

Map backend API response types to frontend types:

```typescript
// Backend returns ApiResult<T> / PagedApiResult<T>
// Frontend uses:
export interface PaginatedResult<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}
```

## File Organization

```
src/lib/
├── api.ts               # Unified export (factory pattern)
├── api-contracts.ts     # ApiClient interface + CacheConfig
├── api-factory.ts       # Implementation selection
├── api-server.ts        # Server-side API client (server components)
├── api-client.ts        # Client-side API client (client components)
├── backend-api.ts       # Backend implementation
├── mock-api.ts          # Mock implementation (development/testing)
└── env.ts               # Environment configuration
```
