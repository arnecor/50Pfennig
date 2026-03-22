# Concept: Guest / Anonymous User Mode

## Goal

Let users open the app, enter a name, and immediately use core features — no registration
required. When they want to keep their data safe or access gated features, they can upgrade
to a real account. All existing data is preserved on upgrade.

---

## Technical Foundation: Supabase Anonymous Auth

Supabase supports `supabase.auth.signInAnonymously()` natively. An anonymous user is a **real
row in `auth.users`** with `is_anonymous = true`. Consequences:

- `auth.uid()` is valid → all 26 existing RLS policies work unchanged
- All 11 RPC functions (`create_group`, `create_expense`, etc.) work unchanged
- All 8 table FKs to `auth.users` are satisfied — no schema refactor needed
- `handle_new_user()` trigger fires → `profiles` row is created automatically
- Upgrade via `supabase.auth.linkIdentity(provider)` — the `user.id` stays the same,
  so **all data is preserved automatically** after linking email/Google

The repository layer, domain layer, and TanStack Query keys require **no changes**.

---

## What Needs to Be Built

### 1. DB Migration — `supabase/migrations/0006_anonymous_users.sql`

```sql
-- Add is_anonymous flag to profiles for easy querying without touching auth schema
ALTER TABLE public.profiles
  ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;

-- Update trigger to populate is_anonymous and handle missing email for anonymous users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, is_anonymous)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1),  -- empty string for anonymous (no email)
      ''
    ),
    COALESCE((new.raw_app_meta_data->>'is_anonymous')::boolean, false)
  );
  RETURN new;
END;
$$;

-- Block anonymous users from creating friend invites (email-dependent feature)
DROP POLICY IF EXISTS "friend_invites: users can create own" ON public.friend_invites;
CREATE POLICY "friend_invites: users can create own"
  ON public.friend_invites FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_anonymous = true
    )
  );
```

> Note: `search_user_by_email` RPC should also filter out anonymous users
> (`AND p.is_anonymous = false`) so guests don't appear in search results.

---

### 2. Auth Store & Hook — `src/features/auth/`

**`src/features/auth/authStore.ts`** — no structural change, `session.user.is_anonymous`
is already present on the Supabase User object.

**`src/features/auth/hooks/useAuth.ts`** — add:
```typescript
isAnonymous: session?.user?.is_anonymous ?? false,
signInAsGuest: async (displayName: string) => {
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  await supabase.auth.updateUser({ data: { display_name: displayName } });
},
```

---

### 3. Onboarding Screen — `src/pages/OnboardingPage.tsx` (new file)

Shown when there is no session. Replaces the current redirect-to-login flow for first-time
users.

#### UX Design Rationale

The screen must resolve two competing goals: push toward account creation (business) while
keeping the first interaction frictionless (conversion). The solution is **progressive
commitment** — the user makes one small decision first (their name), then is shown two clear
paths. By the time the CTA appears, they are already invested.

Key principles applied:
- **Name first** — typing a name is a low-stakes micro-commitment that primes the user to
  continue. It also pre-fills the account creation flow, reducing that friction.
- **Account creation is the primary path** — visually dominant CTA, but framed positively
  as "sicher starten" (start securely), not "register" or "sign up". This feels like a
  benefit, not a barrier.
- **Guest is visible, not hidden** — hiding the guest option creates distrust. Showing it
  clearly, but as the secondary path, lets the user feel in control while still nudging
  toward the preferred outcome.
- **"oder" separator** — a visual divider between primary and secondary paths removes
  ambiguity. The user knows exactly what each option means.
- **No overwhelming copy** — one headline, one input, two actions. Nothing else.

#### Layout (top → bottom, full-screen, centered vertically)

```
[App logo — centered, ~120px from top]

[Tagline — centered, muted color]
"Gemeinsam abrechnen, ganz einfach."

[Headline — left-aligned, bold]
"Wie heißt du?"

[Text input — full width, autofocused]
placeholder: "Dein Name"

[Primary button — full width, prominent]
"Sicher starten – Account erstellen"

──────── oder ────────

[Secondary text link — centered, muted]
"Als Gast fortfahren (ohne Registrierung)"

[Bottom — small text link]
"Bereits einen Account? Anmelden"
```

#### Behavior

**Primary path — "Sicher starten – Account erstellen":**
- Requires name field to be non-empty (button disabled otherwise)
- Tapping expands an email input directly below the name field (inline, no new screen)
  with label: `"Deine E-Mail"` and a new button: `"Magic Link senden"`
- On submit: calls existing `signInWithMagicLink(email)` → navigates to `/auth/check-email`
- The name entered is stored temporarily in local state and applied via `auth.updateUser`
  after the magic link is confirmed (in the auth callback in `App.tsx`)
- Google Sign-In button shown below Magic Link button if `VITE_ENABLE_GOOGLE_LOGIN` is true

**Secondary path — "Als Gast fortfahren":**
- Requires name field to be non-empty (link is visually inactive / gray otherwise)
- Calls `signInAsGuest(name)` → navigates to `/home`

**Validation:** name must be non-empty and ≤ 80 chars (matches `profiles.display_name`).
Show inline error below the input if name exceeds 80 chars. No error on empty — just keep
buttons disabled.

#### Storing the name across the magic link flow

The magic link flow leaves the app and returns via deep link. The display name must survive
this. Store it in `localStorage` (key: `pending_display_name`) before navigating to
`/auth/check-email`. In `App.tsx`, in the auth callback after `exchangeCodeForSession`,
read `pending_display_name` and call `auth.updateUser({ data: { display_name: name } })`,
then remove the key.

#### i18n keys to add

```json
"onboarding": {
  "tagline": "Gemeinsam abrechnen, ganz einfach.",
  "headline": "Wie heißt du?",
  "name_placeholder": "Dein Name",
  "cta_account": "Sicher starten – Account erstellen",
  "cta_guest": "Als Gast fortfahren (ohne Registrierung)",
  "already_have_account": "Bereits einen Account? Anmelden",
  "email_label": "Deine E-Mail",
  "email_cta": "Magic Link senden"
}
```

**Router change (`src/router/index.tsx`):**
- The `/` root route and the current login redirect logic must be updated:
  - No session → `/onboarding` (new route, no auth guard)
  - Has session → `/home`
- `/login` remains as explicit sign-in route (with `requireGuest` guard), navigable from
  the onboarding screen's "Bereits einen Account? Anmelden" link
- Add `/onboarding` route pointing to `OnboardingPage`

---

### 4. Guest Display Name Badge

Wherever a user's own display name is shown, append `" (Gast)"` (de) / `" (Guest)"` (en)
when `isAnonymous === true`.

Affected locations (read these files before implementing):
- `src/pages/AccountPage.tsx` — profile header shows display name
- Any component rendering the current user's own name in a header or profile context

Implementation: in the component, check `isAnonymous` from `useAuth()` and append the
i18n key `auth.guest_suffix` (`" (Gast)"` / `" (Guest)"`). Do NOT store the suffix in the
DB — only display it.

---

### 5. Feature Gating — Gated Route & Shared Dialog Component

#### Gated feature (technically broken for anonymous users):
- **Invite friends** (`/friends/add` and all sub-routes) — requires email identity

#### What NOT to gate (works fine for anonymous users):
- Create group, add expense, view balances, view friends list, record settlements

#### Router guard — `src/router/guards.tsx`

Add a new guard:
```typescript
export const requireRealAccount = (): void => {
  const session = useAuthStore.getState().session;
  if (session?.user?.is_anonymous) {
    // Do NOT redirect — instead, the page/component renders the GuestGateDialog
    // This guard is used as a soft gate, not a hard redirect
  }
};
```

> Preferred pattern: rather than a hard router redirect, the gated pages check `isAnonymous`
> from `useAuth()` and immediately render `<GuestGateDialog>` in place of the page content.
> This gives a smoother UX (dialog over current page, not a redirect).

**Implementation in `/friends/add` routes:**
- At the top of the `FriendsAddPage` component (and all sub-route pages), add:
  ```typescript
  const { isAnonymous } = useAuth();
  if (isAnonymous) return <GuestGateDialog variant="gate" />;
  ```

---

### 6. Shared Dialog Component — `src/features/auth/components/GuestUpgradeDialog.tsx`

One component, two variants controlled by a `variant` prop:

```typescript
type GuestUpgradeDialogVariant = 'gate' | 'reminder';

interface GuestUpgradeDialogProps {
  variant: GuestUpgradeDialogVariant;
  onDismiss?: () => void; // called when "Später" is tapped
}
```

**`variant="gate"` — shown when anonymous user opens a gated page:**

> "Du nutzt Sharli aktuell als Gast. Um diese Funktion nutzen zu können, benötigst du einen
> (kostenlosen) Account. Du musst dafür nur deine E-Mail Adresse angeben."

Buttons (left to right):
- `"Später"` — secondary, calls `onDismiss()` (which navigates back or closes)
- `"Account erstellen"` — primary/highlighted, navigates to `/account` (AccountPage shows
  the upgrade flow for anonymous users)

**`variant="reminder"` — shown as soft prompt after key actions or on app open:**

> "Du nutzt Sharli aktuell als Gast. Damit deine Daten nicht verloren gehen, solltest du
> einen Account erstellen. Du musst dafür nur deine E-Mail Adresse angeben."

Buttons (left to right):
- `"Später"` — secondary, dismisses dialog
- `"Account erstellen"` — primary/highlighted, navigates to `/account`

**Styling:** Full-screen modal overlay (not a bottom sheet). Centered card with the message
text and two buttons in a row at the bottom. Use existing `Button` component from shadcn/ui.
No close-X icon — force the user to choose Später or Account erstellen.

**i18n keys to add** (`public/locales/de/translation.json` and `en/`):
```json
"auth": {
  "guest_suffix": " (Gast)",
  "guest_gate_title": "Funktion nicht verfügbar",
  "guest_gate_body": "Du nutzt Sharli aktuell als Gast. Um diese Funktion nutzen zu können, benötigst du einen (kostenlosen) Account. Du musst dafür nur deine E-Mail Adresse angeben.",
  "guest_reminder_body": "Du nutzt Sharli aktuell als Gast. Damit deine Daten nicht verloren gehen, solltest du einen Account erstellen. Du musst dafür nur deine E-Mail Adresse angeben.",
  "guest_later": "Später",
  "guest_create_account": "Account erstellen"
}
```

---

### 7. Upgrade Reminder Hook — `src/features/auth/hooks/useGuestUpgradeReminder.ts`

A custom hook that tracks whether the reminder dialog should be shown.

**Trigger points** (call this hook or its returned `triggerReminder()` in these locations):

| Trigger | Where to call |
|---|---|
| App opened after being fully closed | `App.tsx` — on `SIGNED_IN` auth event when `isAnonymous` |
| Group created | mutation `onSuccess` in `useCreateGroup` hook |
| Expense added | mutation `onSuccess` in `useCreateExpense` hook |
| Friend added | mutation `onSuccess` in `useAddFriend` / `useAcceptInvite` hooks |

**Reminder frequency:** Show at most once per session per trigger (not every single time).
Use a Zustand `uiStore` flag `guestReminderShownThisSession: boolean` to track this.
Reset on each app open.

**Hook interface:**
```typescript
// src/features/auth/hooks/useGuestUpgradeReminder.ts
export const useGuestUpgradeReminder = () => {
  const { isAnonymous } = useAuth();
  const [show, setShow] = useState(false);

  const triggerReminder = useCallback(() => {
    if (!isAnonymous) return;
    const alreadyShown = useUiStore.getState().guestReminderShownThisSession;
    if (alreadyShown) return;
    useUiStore.getState().setGuestReminderShown(true);
    setShow(true);
  }, [isAnonymous]);

  return { showReminder: show, dismissReminder: () => setShow(false), triggerReminder };
};
```

**Usage pattern in mutation hooks:**
```typescript
const { triggerReminder } = useGuestUpgradeReminder();

const mutation = useMutation({
  mutationFn: ...,
  onSuccess: () => {
    queryClient.invalidateQueries(...);
    triggerReminder(); // triggers reminder if guest
  },
});
```

Render the dialog in the relevant page component:
```typescript
const { showReminder, dismissReminder, triggerReminder } = useGuestUpgradeReminder();

// After mutation success, triggerReminder() is called from the hook
// Render:
{showReminder && <GuestUpgradeDialog variant="reminder" onDismiss={dismissReminder} />}
```

**`uiStore` changes (`src/store/uiStore.ts`):**
Add `guestReminderShownThisSession: boolean` and `setGuestReminderShown(val: boolean)`.

---

### 8. AccountPage Upgrade Flow — `src/pages/AccountPage.tsx`

When `isAnonymous === true`, show an upgrade section at the top instead of the normal profile
settings:

**Upgrade section:**
- Headline: `"Account erstellen"` / `"Create your account"`
- Body: `"Gib deine E-Mail Adresse an, um deine Daten dauerhaft zu sichern."`
- Buttons (stacked vertically): Magic Link, Google Sign-In (if enabled via feature flag)
- These call `supabase.auth.linkIdentity(provider)` — NOT a new sign-in.
  This links credentials to the existing anonymous session, preserving the `user.id`.
- On success: `is_anonymous` becomes `false` → display name badge disappears, full features unlocked

---

## Files to Create / Modify

| File | Action | What changes |
|---|---|---|
| `supabase/migrations/0006_anonymous_users.sql` | **Create** | `is_anonymous` column on profiles, trigger update, RLS for friend_invites, filter in search_user_by_email |
| `src/features/auth/hooks/useAuth.ts` | **Modify** | Add `isAnonymous`, `signInAsGuest()` |
| `src/features/auth/hooks/useGuestUpgradeReminder.ts` | **Create** | Reminder trigger hook |
| `src/features/auth/components/GuestUpgradeDialog.tsx` | **Create** | Shared dialog, 2 variants |
| `src/pages/OnboardingPage.tsx` | **Create** | Name-entry onboarding screen |
| `src/router/index.tsx` | **Modify** | Add `/onboarding` route, update root redirect logic |
| `src/router/guards.tsx` | **Modify** | Document soft-gate pattern (no hard redirect) |
| `src/store/uiStore.ts` | **Modify** | Add `guestReminderShownThisSession` flag |
| `src/pages/AccountPage.tsx` | **Modify** | Upgrade flow for anonymous users |
| `src/pages/FriendsAddPage.tsx` (+ sub-routes) | **Modify** | Render `<GuestUpgradeDialog variant="gate">` when `isAnonymous` |
| `src/features/groups/hooks/useCreateGroup.ts` | **Modify** | Call `triggerReminder()` on success |
| `src/features/expenses/hooks/useCreateExpense.ts` | **Modify** | Call `triggerReminder()` on success |
| `src/features/friends/hooks/useAddFriend.ts` | **Modify** | Call `triggerReminder()` on success |
| `src/App.tsx` | **Modify** | Trigger reminder on `SIGNED_IN` when `isAnonymous` |
| `public/locales/de/translation.json` | **Modify** | Add `auth.*` keys (see above) |
| `public/locales/en/translation.json` | **Modify** | Add `auth.*` keys (English) |

## Files NOT to change

- All repository files (`src/repositories/`)
- All domain files (`src/domain/`)
- All SQL migrations 0001–0005
- TanStack Query files (query keys, query options)

---

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Anonymous session lost on reinstall | Medium | Reminder dialog after first key action |
| Anonymous user appears in friend search | Low | Filter `is_anonymous = false` in `search_user_by_email` RPC |
| `linkIdentity` fails if provider already has an account | Medium | Handle error: show "This email already has an account — sign in instead" |
| Existing real users affected | None | Fully additive — existing rows get `is_anonymous = false` by default |

---

## Verification Checklist

- [ ] Anonymous sign-in creates `auth.users` row with `is_anonymous = true` and fires profile trigger
- [ ] `profiles.is_anonymous` is `true` for new guest users
- [ ] Guest display name shows `" (Gast)"` suffix in all relevant UI locations
- [ ] `/friends/add` shows `GuestUpgradeDialog variant="gate"` for guest users
- [ ] Reminder dialog appears after: create group, add expense, add friend, app open
- [ ] Reminder only shows once per session (not on every action)
- [ ] Tapping "Account erstellen" in dialog navigates to AccountPage
- [ ] AccountPage shows upgrade section (not normal profile) for anonymous users
- [ ] After `linkIdentity` succeeds: `is_anonymous` is `false`, badge disappears, friends/add is accessible
- [ ] Existing real users see no changes
