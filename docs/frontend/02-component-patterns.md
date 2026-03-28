# Component Patterns

Standards for building React components in Next.js applications.

## forwardRef Pattern

All reusable UI components use `forwardRef` with `displayName`, spread props, and accept `className`:

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

**Rules**:
- Always set `displayName` for DevTools debugging
- Always spread `{...props}` to allow parent overrides
- Always accept `className` prop and merge it last via `clsx()`

## Named Exports with TypeScript Interfaces

All components use named exports with explicit TypeScript interfaces for props:

```tsx
interface FeatureCardProps {
  /** Card title displayed as heading */
  title: string;
  /** Description text below the title */
  description: string;
  /** Optional icon component */
  icon?: React.ReactNode;
  /** Whether to highlight this card */
  featured?: boolean;
}

/**
 * Displays a feature with icon, title, and description.
 * Used on marketing pages and dashboard overviews.
 */
export function FeatureCard({
  title,
  description,
  icon,
  featured = false,
}: FeatureCardProps) {
  return (
    <div
      className={clsx(
        "rounded-card border p-6",
        featured ? "border-primary bg-surface-alt" : "border-hairline bg-surface"
      )}
    >
      {icon && <div className="mb-4">{icon}</div>}
      <h3 className="text-body font-semibold">{title}</h3>
      <p className="text-muted mt-2">{description}</p>
    </div>
  );
}
```

**Rules**:
- Named exports (not default exports)
- Props defined as TypeScript `interface` (not inline or `type`)
- JSDoc comments explaining purpose and key features
- Sub-components colocated in the same file when tightly coupled

## Conditional Classes

Use `clsx()` -- never template literals for conditional classes:

```tsx
import { clsx } from "clsx";

// GOOD
className={clsx(
  "rounded-card border",
  isActive && "ring-2 ring-primary",
  disabled && "opacity-50 cursor-not-allowed",
  className
)}

// GOOD -- with size mapping
const sizeClasses = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };
className={clsx("relative", sizeClasses[size])}

// BAD -- template literals
className={`rounded-card border ${isActive ? "ring-2 ring-primary" : ""}`}
```

## Toast Notifications

Fluent API pattern via `useToast()`:

```tsx
const toast = useToast();

toast.success("Profile updated").show();
toast.error("Failed to save").show();
toast.info("Processing...").duration(8000).show();
toast.success("Item added").action("Undo", handleUndo).show();
toast.warning("Session expiring").id("session-warning").show();
toast.clearAll();
```

Default durations: success/info 4s, warning 6s, error 10s.

## Loading States

### Spinner

```tsx
import { LoadingSpinner } from "@/components/ui/loading-spinner";

<LoadingSpinner size="md" text="Loading resources..." />
```

### Skeleton

```tsx
import { ResourceGridSkeleton } from "@/components/ui/resource-grid-skeleton";

{isLoading ? <ResourceGridSkeleton /> : <ResourceGrid items={items} />}
```

### Empty State

```tsx
{items.length === 0 && !isLoading && (
  <div className="flex flex-col items-center justify-center py-12">
    <span className="text-muted">No items found</span>
  </div>
)}
```

## Image Handling

Use Next.js `<Image>` with `fill` and responsive `sizes`:

```tsx
import Image from "next/image";

// Card image
<div className="relative h-48 w-full overflow-hidden">
  {item.imageUrl ? (
    <Image
      src={item.imageUrl}
      alt={`Photo of ${item.name}`}
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className="object-cover"
    />
  ) : (
    <div className="bg-surface-alt flex h-full items-center justify-center">
      <span className="text-muted">No image available</span>
    </div>
  )}
</div>

// Hero image (above fold -- add priority)
<Image src={src} alt={alt} fill priority sizes="100vw" className="object-cover" />
```

**Rules**:
- Always use `fill` with a sized container (not `width`/`height` for responsive images)
- Always provide `sizes` for responsive loading
- Add `priority` for above-the-fold hero images
- Provide meaningful `alt` text
- Use `object-cover` for consistent aspect ratios

## Auth Guards

Guard authenticated actions in client components:

```tsx
const isAuthenticated = useIsAuthenticated();
const session = useSession();

const handleAction = async () => {
  if (!isAuthenticated || !session?.access_token) {
    toast.error("Please sign in").duration(5000).show();
    return;
  }
  // Proceed with authenticated action
};
```

## Import Organization

Imports follow 4 groups, separated by blank lines:

```tsx
// 1. React / Next.js
import type { Metadata } from "next";
import { useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

// 2. External libraries
import { motion } from "framer-motion";
import { clsx } from "clsx";
import { ChevronDown, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// 3. Internal -- components, utils, hooks (@ alias)
import { Card } from "@/components/ui/card";
import { fetchResources } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

// 4. Types (last)
import type { Resource } from "@/types/resource";
```

**Rules**:
- React/Next.js imports first
- External library imports second
- Internal imports third (using `@/` path alias)
- Type-only imports last
- Blank line between each group
- `type` keyword for type-only imports (`import type { ... }`)

## Component Checklist

When building new components, ensure:

- [ ] Uses semantic color tokens (not raw hex or color scale values)
- [ ] Uses shape tokens (`rounded-card`, `rounded-button`, etc.)
- [ ] Uses shadow tokens (`shadow-subtle`, `shadow-lift`, etc.)
- [ ] Uses standard easing for transitions
- [ ] Mobile-first responsive design
- [ ] Focus states visible (keyboard accessibility)
- [ ] Touch targets 44x44px minimum
- [ ] Works in both light and dark modes
- [ ] `displayName` set (for `forwardRef` components)
- [ ] `className` prop accepted and merged via `clsx()`
- [ ] Props defined as TypeScript `interface`
- [ ] JSDoc comment on the component
