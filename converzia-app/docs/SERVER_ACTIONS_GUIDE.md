# Server Actions Guide

## Overview

Server Actions are a Next.js 14+ feature that allows you to define server-side functions that can be called directly from client components. They provide type-safe, secure mutations without the need for API routes.

## When to Use Server Actions

### Use Server Actions For:
- Form submissions
- Data mutations (create, update, delete)
- Simple operations that don't need complex error handling
- Operations that benefit from progressive enhancement

### Keep Using API Routes For:
- Webhook handlers (external systems calling your app)
- Complex operations with multiple steps
- Operations that need to return complex data
- Real-time or streaming responses

## Current API Routes to Consider Migrating

### High Priority (Forms):
1. **Login/Register** - `POST /api/auth/*`
2. **Offer CRUD** - `POST/PUT/DELETE /api/portal/offers`
3. **Team Management** - `POST /api/portal/team/invite`
4. **Settings Update** - `PUT /api/portal/settings`

### Medium Priority:
1. **Credit Purchase** - Initiate purchase flow
2. **RAG Sources** - Upload and manage knowledge base
3. **Integration Setup** - Connect Meta/Google/etc.

## Example Implementation

### Before (API Route):

```typescript
// pages/api/portal/offers/route.ts
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const body = await request.json();
  // ... validation and creation
  
  return NextResponse.json({ offer });
}

// In component:
const handleSubmit = async (data) => {
  const response = await fetch("/api/portal/offers", {
    method: "POST",
    body: JSON.stringify(data),
  });
  // handle response
};
```

### After (Server Action):

```typescript
// lib/actions/offers.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const CreateOfferSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function createOffer(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return { error: "Unauthorized" };
  }
  
  const rawData = {
    name: formData.get("name"),
    description: formData.get("description"),
  };
  
  const validated = CreateOfferSchema.safeParse(rawData);
  if (!validated.success) {
    return { error: validated.error.flatten() };
  }
  
  const { data: offer, error } = await supabase
    .from("offers")
    .insert({
      ...validated.data,
      tenant_id: user.tenant_id,
    })
    .select()
    .single();
  
  if (error) {
    return { error: error.message };
  }
  
  revalidatePath("/portal/offers");
  return { success: true, offer };
}

// In component:
"use client";

import { createOffer } from "@/lib/actions/offers";
import { useFormState } from "react-dom";

export function CreateOfferForm() {
  const [state, formAction] = useFormState(createOffer, null);
  
  return (
    <form action={formAction}>
      <input name="name" required />
      <textarea name="description" />
      <button type="submit">Create Offer</button>
      {state?.error && <p>{state.error}</p>}
    </form>
  );
}
```

## Best Practices

### 1. Always Validate Input
```typescript
import { z } from "zod";

const schema = z.object({...});
const result = schema.safeParse(data);
if (!result.success) {
  return { error: result.error.flatten() };
}
```

### 2. Return Typed Responses
```typescript
type ActionResult = 
  | { success: true; data: SomeType }
  | { success: false; error: string };

export async function myAction(): Promise<ActionResult> {
  // ...
}
```

### 3. Use revalidatePath or revalidateTag
```typescript
import { revalidatePath, revalidateTag } from "next/cache";

// After mutation
revalidatePath("/portal/offers");
// or
revalidateTag("offers");
```

### 4. Handle Loading States
```typescript
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>
    {pending ? "Saving..." : "Save"}
  </button>;
}
```

### 5. Colocate Actions with Features
```
lib/
├── actions/
│   ├── auth.ts
│   ├── offers.ts
│   ├── leads.ts
│   └── billing.ts
```

## Security Considerations

1. **Authentication**: Always verify user is authenticated
2. **Authorization**: Check user has permission for the operation
3. **Validation**: Validate all input with Zod or similar
4. **Rate Limiting**: Consider rate limiting for sensitive actions
5. **CSRF**: Server Actions are CSRF-protected by default

## Migration Checklist

For each API route being migrated:

- [ ] Create new action file in `lib/actions/`
- [ ] Add "use server" directive at top
- [ ] Implement authentication check
- [ ] Add input validation with Zod
- [ ] Return typed response
- [ ] Add revalidation calls
- [ ] Update component to use useFormState
- [ ] Test form submission
- [ ] Test error handling
- [ ] Remove old API route (if no longer needed)

## Files Created

When implementing Server Actions, create:

1. `src/lib/actions/` directory for all server actions
2. Individual files by feature (auth.ts, offers.ts, etc.)
3. Shared types in `src/types/actions.ts`
