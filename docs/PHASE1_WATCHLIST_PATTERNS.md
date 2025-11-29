# Phase 1 Watchlist Enhancement Patterns

**Last Updated:** 2025-11-28
**Phase:** 1 - Core UX Improvements
**Status:** Task 1.1 Complete ✅

---

## Overview

This document codifies patterns established during Phase 1 of the watchlist enhancement project. These patterns build on Phase 0 foundations and add new best practices for React component design, dialog patterns, and backend validation.

**Key Achievement:** Successfully implemented price alert creation from watchlist without navigation, following all Phase 0 patterns.

---

## Pattern 1: Dialog Component Design

**When:** Creating modal dialogs for user input

### Anti-Pattern (Don't Do This)
```typescript
// ❌ WRONG - No validation, no loading states, no error handling
function CreateDialog({ open, onClose }) {
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    await fetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify({ value })
    });
    onClose();
  };

  return <Dialog open={open}>...</Dialog>;
}
```

### Correct Pattern
```typescript
// ✅ CORRECT - Complete dialog pattern
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CreateDialogProps {
  // Specific, well-typed props
  resourceId: number;
  resourceName: string;
  currentValue: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreateInput {
  resourceId: number;
  value: number;
}

export function CreateDialog({
  resourceId,
  resourceName,
  currentValue,
  open,
  onOpenChange
}: CreateDialogProps) {
  // Smart defaults
  const defaultValue = Math.round(currentValue * 0.9 * 100) / 100;
  const [value, setValue] = useState<number>(defaultValue);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // React Query mutation with proper error handling
  const createMutation = useMutation({
    mutationFn: async (data: CreateInput) => {
      return apiRequest<{ id: number }>('/api/resources', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate ALL relevant queries
      void queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
      void queryClient.invalidateQueries({ queryKey: ['/api/stats'] });

      toast({
        title: "Success",
        description: `Resource created for ${resourceName}`,
      });

      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create",
        description: error.message || "Please try again later",
        variant: "destructive",
      });
    },
  });

  // Client-side validation
  const handleCreate = () => {
    if (value <= 0) {
      toast({
        title: "Invalid value",
        description: "Value must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (value >= currentValue) {
      toast({
        title: "Invalid value",
        description: "Value should be lower than current",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      resourceId,
      value,
    });
  };

  // Reset to default when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setValue(defaultValue);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create Resource
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Name - Read-only display */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Resource
            </Label>
            <p className="text-sm font-medium mt-1 line-clamp-2">
              {resourceName}
            </p>
          </div>

          {/* Current Value - Read-only display */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Current Value
            </Label>
            <p className="text-lg font-bold mt-1">
              ${currentValue.toFixed(2)}
            </p>
          </div>

          {/* Input with constraints */}
          <div>
            <Label htmlFor="value" className="text-sm font-medium">
              Target Value:
            </Label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl font-medium text-muted-foreground">$</span>
              <Input
                id="value"
                type="number"
                step="0.01"
                min="0.01"
                max={currentValue}
                value={value}
                onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
                className="text-lg font-semibold"
                autoFocus
              />
            </div>
            {/* Real-time calculation display */}
            <p className="text-xs text-muted-foreground mt-1">
              {value > 0 && value < currentValue
                ? `Save $${(currentValue - value).toFixed(2)} (${Math.round(((currentValue - value) / currentValue) * 100)}% off)`
                : '\u00A0' // Non-breaking space to maintain layout
              }
            </p>
          </div>
        </div>

        {/* Actions with disabled states */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending || value <= 0 || value >= currentValue}
          >
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Key Elements:**
1. ✅ Well-typed props interface
2. ✅ Smart default values
3. ✅ React Query mutation with error handling
4. ✅ Query invalidation (ALL relevant queries)
5. ✅ Toast notifications for feedback
6. ✅ Client-side validation
7. ✅ Disabled states during mutation
8. ✅ Reset state when dialog opens
9. ✅ Real-time calculations
10. ✅ Accessible (labels, focus, semantic HTML)

**Check:** Dialog components should have ALL these elements.

---

## Pattern 2: Conditional UI Rendering

**When:** Showing/hiding UI elements based on state

### Anti-Pattern
```typescript
// ❌ WRONG - UI always present, just hidden
<Button style={{ display: hasAlert ? 'none' : 'block' }}>
  Set Alert
</Button>
```

### Correct Pattern
```typescript
// ✅ CORRECT - Conditional rendering with proper React pattern
{product.alertStatus === 'none' && (
  <div className="mt-3">
    <Button
      variant="outline"
      size="sm"
      className="w-full"
      onClick={() => setShowAlertDialog(true)}
    >
      <Bell className="w-4 h-4 mr-2" />
      Set Price Alert
    </Button>
  </div>
)}
```

**Why:**
- Only renders when condition is true (better performance)
- Clearer intent in code
- No CSS display tricks
- Better for accessibility (element not in DOM when hidden)

---

## Pattern 3: Backend Validation for Decimal Fields

**When:** Working with Drizzle decimal fields (targetPrice, currentPrice, etc.)

### Anti-Pattern
```typescript
// ❌ WRONG - Type mismatch, no validation
app.post('/api/alerts', async (req, res) => {
  const { productId, targetPrice } = req.body;

  await storage.createAlert({
    productId,
    targetPrice, // Number sent, but DB expects string
  });
});
```

### Correct Pattern
```typescript
// ✅ CORRECT - Zod validation + type conversion
import { z } from "zod";

const createAlertSchema = z.object({
  productId: z.number()
    .int('Product ID must be an integer')
    .min(1, 'Product ID must be positive'),
  targetPrice: z.number()
    .positive('Target price must be positive')
    .multipleOf(0.01, 'Price must have maximum 2 decimal places'),
  notifyForum: z.boolean().optional().default(false),
});

app.post('/api/alerts', csrfProtection, withAuth(async (req, res) => {
  try {
    // PHASE 0 PATTERN: Validation at route layer
    const validatedData = createAlertSchema.parse(req.body);

    // Verify related entity exists
    const product = await storage.getProductById(validatedData.productId);
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    const alert = await storage.createAlert({
      userId: req.user.id,
      productId: validatedData.productId,
      targetPrice: validatedData.targetPrice.toFixed(2), // ← Convert to string for decimal
      notifyForum: validatedData.notifyForum,
    });

    sendSuccess(res, alert, 201);
  } catch (error: unknown) {
    sendErrorFromException(res, error, 'CreateAlert');
  }
}));
```

**Key Steps:**
1. ✅ Zod schema with `.multipleOf(0.01)` for decimal precision
2. ✅ Validate at route layer (Phase 0 pattern)
3. ✅ Verify foreign key references exist (prevents FK failures)
4. ✅ Convert number to string with `.toFixed(2)` for Drizzle decimal
5. ✅ Use standardized response helpers

**Schema Pattern for Updates:**
```typescript
const updateAlertSchema = z.object({
  targetPrice: z.number()
    .positive('Target price must be positive')
    .multipleOf(0.01, 'Price must have maximum 2 decimal places')
    .optional(),
  isActive: z.boolean().optional(),
  notifyForum: z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// In PATCH handler
const validatedData = updateAlertSchema.parse(req.body);
const updates = {
  ...validatedData,
  targetPrice: validatedData.targetPrice?.toFixed(2), // Optional chaining
};
```

---

## Pattern 4: React Query Mutation Best Practices

**When:** Using React Query mutations for API calls

### Anti-Pattern
```typescript
// ❌ WRONG - No query invalidation, no error handling
const createMutation = useMutation({
  mutationFn: async (data) => {
    await fetch('/api/resource', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
});
```

### Correct Pattern
```typescript
// ✅ CORRECT - Comprehensive mutation pattern
const createMutation = useMutation({
  mutationFn: async (data: CreateInput) => {
    return apiRequest<{ id: number }>('/api/resource', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  onSuccess: () => {
    // Invalidate ALL affected queries
    void queryClient.invalidateQueries({ queryKey: ['/api/resources'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/related'] });

    toast({
      title: "Success",
      description: "Resource created successfully",
    });

    onOpenChange(false);
  },
  onError: (error: Error) => {
    toast({
      title: "Failed",
      description: error.message || "Please try again later",
      variant: "destructive",
    });
  },
});
```

**Key Elements:**
1. ✅ Typed input/output interfaces
2. ✅ Use `apiRequest` helper (handles CSRF, auth)
3. ✅ `void` keyword for fire-and-forget invalidations (ESLint compliance)
4. ✅ Invalidate ALL affected queries (list + stats + related)
5. ✅ Toast for success/error feedback
6. ✅ Close dialog on success only
7. ✅ Error type properly defined

**Query Invalidation Strategy:**
```typescript
// When creating/updating/deleting a resource, invalidate:
void queryClient.invalidateQueries({ queryKey: ['/api/resources'] }); // List view
void queryClient.invalidateQueries({ queryKey: ['/api/resources', id] }); // Detail view
void queryClient.invalidateQueries({ queryKey: ['/api/stats'] }); // Dashboard stats
void queryClient.invalidateQueries({ queryKey: ['/api/related-resources'] }); // Related data
```

---

## Pattern 5: Component Integration Pattern

**When:** Integrating dialog components into parent components

### Anti-Pattern
```typescript
// ❌ WRONG - Prop drilling, no state management
function ParentCard({ product, showDialog, setShowDialog }) {
  return (
    <Card>
      <Button onClick={() => setShowDialog(true)}>Open</Button>
      <CreateDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        productId={product.id}
        productName={product.name}
        currentPrice={product.price}
      />
    </Card>
  );
}
```

### Correct Pattern
```typescript
// ✅ CORRECT - Local state, conditional rendering, clear separation
import { useState } from 'react';
import { CreateDialog } from '../dialogs/create-dialog';

export function ResourceCard({ resource, onRemove }: ResourceCardProps) {
  // Local state for dialog visibility
  const [showDialog, setShowDialog] = useState(false);

  return (
    <Card>
      {/* Existing card content */}

      {/* Conditional button (only when action is available) */}
      {resource.status === 'pending' && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowDialog(true)}
          >
            <Icon className="w-4 h-4 mr-2" />
            Action Label
          </Button>
        </div>
      )}

      {/* Dialog component */}
      <CreateDialog
        resourceId={resource.id}
        resourceName={resource.name}
        currentValue={resource.value}
        open={showDialog}
        onOpenChange={setShowDialog}
      />
    </Card>
  );
}
```

**Key Elements:**
1. ✅ Local state management (no prop drilling)
2. ✅ Conditional rendering based on state
3. ✅ Clear separation of concerns
4. ✅ Dialog receives only what it needs
5. ✅ Accessible button with icon + label

---

## Pattern 6: Foreign Key Validation

**When:** Creating records that reference other entities

### Anti-Pattern
```typescript
// ❌ WRONG - No FK validation, fails at DB level with 500
app.post('/api/alerts', async (req, res) => {
  const { productId, targetPrice } = req.body;

  const alert = await storage.createAlert({
    productId, // What if this product doesn't exist?
    targetPrice,
  });

  sendSuccess(res, alert, 201);
});
```

### Correct Pattern
```typescript
// ✅ CORRECT - Validate FK before insert
app.post('/api/alerts', csrfProtection, withAuth(async (req, res) => {
  try {
    const validatedData = createAlertSchema.parse(req.body);

    // Verify product exists (prevents FK constraint failure)
    const product = await storage.getProductById(validatedData.productId);
    if (!product) {
      sendError(res, 'Product not found', 404);
      return;
    }

    const alert = await storage.createAlert({
      userId: req.user.id,
      productId: validatedData.productId,
      targetPrice: validatedData.targetPrice.toFixed(2),
    });

    sendSuccess(res, alert, 201);
  } catch (error: unknown) {
    sendErrorFromException(res, error, 'CreateAlert');
  }
}));
```

**Benefits:**
- ✅ Returns clear 404 instead of generic 500
- ✅ Prevents database constraint failures
- ✅ Better error messages for clients
- ✅ Validates business logic before storage

**When to Skip FK Validation:**
- Foreign key is optional (nullable)
- Performance-critical path (acceptable to catch DB error)
- FK guaranteed to exist (e.g., user from session)

---

## Common Mistakes to Avoid

### ❌ Mistake 1: No Query Invalidation
```typescript
// Creates alert but watchlist doesn't update
const createMutation = useMutation({
  mutationFn: createAlert,
  onSuccess: () => {
    onOpenChange(false); // Dialog closes but data stale
  }
});
```
**Fix:** Always invalidate related queries

### ❌ Mistake 2: Missing Loading States
```typescript
<Button onClick={handleCreate}>Create</Button>
```
**Fix:** Disable during mutation + show loading text

### ❌ Mistake 3: No Client Validation
```typescript
// Sends invalid data to server
const handleCreate = () => {
  createMutation.mutate({ value: -5 });
};
```
**Fix:** Validate before mutation

### ❌ Mistake 4: Wrong Decimal Type
```typescript
// Sends number to decimal field
targetPrice: validatedData.targetPrice, // Type error
```
**Fix:** Convert with `.toFixed(2)`

### ❌ Mistake 5: No FK Validation
```typescript
// Creates alert for non-existent product
await createAlert({ productId: 99999 }); // FK constraint fails
```
**Fix:** Verify entity exists first

---

## Testing Checklist

**Dialog Component:**
- [ ] Opens when trigger clicked
- [ ] Closes on cancel
- [ ] Closes on successful submission
- [ ] Stays open on error
- [ ] Shows loading state during mutation
- [ ] Disables buttons during mutation
- [ ] Resets to default values when reopened
- [ ] Validates input before submission
- [ ] Shows error toast on failure
- [ ] Shows success toast on completion
- [ ] Invalidates correct queries

**Backend Validation:**
- [ ] Rejects invalid productId (negative, non-integer)
- [ ] Rejects invalid targetPrice (negative, too many decimals)
- [ ] Returns 404 when product doesn't exist
- [ ] Returns 400 for validation errors
- [ ] Returns 201 on successful creation
- [ ] Stores targetPrice as string in database
- [ ] Respects CSRF protection
- [ ] Requires authentication

---

## Files Reference

**Implementation Examples:**
- `client/src/components/watchlist/create-price-alert-dialog.tsx` - Complete dialog pattern
- `client/src/components/price-watch/WatchedProductCard.tsx` - Component integration
- `server/routes/alert-routes.ts` - Backend validation with Zod + FK checks

**Related Patterns:**
- `docs/PHASE0_WATCHLIST_PATTERNS.md` - Foundation patterns (validation layer, etc.)
- `docs/DATABASE_PATTERNS.md` - FK constraints, NULL handling
- `docs/VALIDATION_PATTERNS.md` - Zod schema patterns
- `docs/ERROR_HANDLING_PATTERNS.md` - Error responses

---

## Summary

Phase 1.1 established patterns for:
1. ✅ Complete dialog component design (10 key elements)
2. ✅ Conditional UI rendering (React best practices)
3. ✅ Backend validation for decimal fields (Zod + type conversion)
4. ✅ React Query mutations (comprehensive error handling)
5. ✅ Component integration (local state, separation of concerns)
6. ✅ Foreign key validation (prevents 500 errors)

**All patterns follow Phase 0 foundations** and add React-specific best practices for modern UI development.

**Next Phase:** Apply these patterns to remaining Phase 1 tasks (cursor pagination, target price editing, category filtering).

---

**Last Updated:** 2025-11-28 | **Phase:** 1.1 Complete
