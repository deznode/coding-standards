---
paths: apps/web/**
---

# Component Patterns

> Full reference: `docs/frontend/02-component-patterns.md`

## forwardRef Pattern

All reusable UI components use `forwardRef` with `displayName`:

```tsx
import * as React from "react";
import { clsx } from "clsx";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, hoverable = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        "rounded-card border-hairline bg-surface shadow-subtle border",
        hoverable && "hover:shadow-lift transition-all duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = "Card";
```

Rules:
- Always set `displayName`
- Always spread `{...props}`
- Always accept `className` and merge last via `clsx()`

## Named Exports

All components use named exports with TypeScript `interface` for props:

```tsx
interface FeatureCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

export function FeatureCard({ title, description, icon }: FeatureCardProps) { ... }
```

- Named exports (not default)
- Props as `interface` (not inline or `type`)
- JSDoc comments on components

## Conditional Classes

Use `clsx()` -- never template literals:

```tsx
// GOOD
className={clsx("rounded-card border", isActive && "ring-2 ring-primary", className)}

// BAD
className={`rounded-card border ${isActive ? "ring-2" : ""}`}
```

## Loading States

- **Spinner**: `<LoadingSpinner size="md" text="Loading..." />`
- **Skeleton**: show skeleton component while `isLoading`, swap to real content
- **Empty state**: show fallback message when `items.length === 0 && !isLoading`

## Image Handling

Use Next.js `<Image>` with `fill` + `sizes` + `object-cover`. Add `priority` for above-fold images.

## Import Organization

4 groups separated by blank lines:

```tsx
// 1. React / Next.js
import { useRef } from "react";
import Image from "next/image";

// 2. External libraries
import { clsx } from "clsx";
import { useQuery } from "@tanstack/react-query";

// 3. Internal (@ alias)
import { Card } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";

// 4. Types (last)
import type { Resource } from "@/types/resource";
```

Use `import type { ... }` for type-only imports.
