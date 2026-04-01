# Group Invite — Concept

## Overview

Group invites allow existing group members to invite others to join a group via a shareable link. The invitee is added to the group AND automatically befriended with the inviter in a single flow.

URL format: `invite.sharli.app/g/{token}`

This is an extension of the friend invite system (see `docs/concepts/add-friends.md`). The same Vercel infrastructure and token format are reused; only the invite type and acceptance logic differ.

---

## User Flows

### Flow A — Invitee has the app installed
1. Invitee taps `invite.sharli.app/g/{token}` link (e.g., from WhatsApp)
2. App opens via deep link: `com.arco.sharli://invite/g/{token}`
3. App calls `accept_group_invite(token)` RPC
4. Invitee is added to the group as a member
5. Invitee and inviter become friends (if not already)
6. App navigates to the group detail page

### Flow B — Invitee does not have the app
1. Browser opens `invite.sharli.app/g/{token}`
2. Vercel function looks up token → renders landing page showing:
   - Group name
   - Inviter display name
   - "X Mitglieder sind bereits dabei"
3. Buttons: Download on Google Play / Apple App Store (same Apple overlay as friend invite)
4. After install: Play Store referrer `invite_token=g:{token}` passes the token through
5. On first launch, `installReferrer.ts` reads the referrer and stores the token
6. After login/signup, `App.tsx` auto-calls `accept_group_invite(token)`
7. Invitee lands on the group detail page

### Flow C — Invitee uses web app (no native app)
Future consideration — not in scope for initial implementation.

---

## Invite Token Design

- **Format**: 6-char uppercase alphanumeric (same as friend invites, e.g., `G4RK2P`)
- **Table**: `group_invites` (new table, separate from `friend_invites`)
- **Scope**: token is scoped to a specific group, not to a specific invitee (anyone with the link can join)
- **Expiry**: 7 days (same as friend invites)
- **Reuse**: token can be used by multiple people until expiry (multi-use, unlike friend invites which are single-use)
- **Revocation**: group admin can revoke a token (sets `revoked_at`)

**Why multi-use?** Group invites are typically shared in a chat — the same link might be tapped by 3-4 people. Generating a new token per invitee would be impractical.

---

## Database

### New table: `group_invites`
```sql
create table public.group_invites (
  id         uuid primary key default gen_random_uuid(),
  token      text unique default generate_short_token(),
  group_id   uuid not null references groups(id) on delete cascade,
  created_by uuid not null references profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS: only group members can create invite links
-- Anyone with a valid token can accept (enforced in RPC, not RLS)
```

### New RPC: `accept_group_invite(p_token text)`
Atomic transaction:
1. Validate token (exists, not expired, not revoked)
2. Look up `group_id` from token
3. Check if calling user is already a member → if yes, navigate to group (idempotent)
4. Insert into `group_members` (role: `member`)
5. Insert into `group_events` (type: `member_joined`, metadata: `{ via: 'invite' }`)
6. Create friendship between invitee and `created_by` if not already friends
   - Uses the same friendship creation logic as `accept_friend_invite`
   - Skip silently if friendship already exists
7. Return `group_id` so the app can navigate

### New RPC: `create_group_invite(p_group_id uuid)`
- Only callable by group members (enforced via RLS on `group_invites`)
- Checks if an active (non-expired, non-revoked) token already exists for this group → returns it if so (avoids token proliferation)
- Otherwise generates a new token

---

## Vercel Landing Page (`api/invite/group.ts`)

Extends the same HTML template as `api/invite/friend.ts`.

**Data fetched from DB**:
```sql
select
  gi.group_id,
  g.name as group_name,
  g.member_count,   -- or count from group_members
  p.display_name as inviter_name
from group_invites gi
join groups g on g.id = gi.group_id
join profiles p on p.id = gi.created_by
where gi.token = $1
  and gi.revoked_at is null
  and gi.expires_at > now()
```

**Landing page content (valid)**:
- Group name as headline: `"Du wurdest zu {groupName} eingeladen"`
- Inviter: `"Eingeladen von {inviterName}"`
- Member count: `"{n} Mitglieder sind bereits dabei"`
- Google Play / Apple App Store buttons (same Apple overlay as friend invite, but the design is improved)
- "Ich habe die App bereits" deep link: `com.arco.sharli://invite/g/{token}`

**Play Store referrer**: `invite_token=g:{token}` — the `g:` prefix lets `installReferrer.ts` distinguish group invites from friend invites.

---

## App Changes

### `src/lib/installReferrer.ts`
Parse the `g:` prefix in the referrer token and route accordingly:
- `invite_token=f:{token}` → pending friend invite
- `invite_token=g:{token}` → pending group invite (new store: `pendingGroupInviteStore`)

### `src/App.tsx`
Deep link handler needs to match `com.arco.sharli://invite/g/{token}` in addition to `/f/{token}`:
```typescript
const friendMatch = urlObj.pathname.match(/\/f\/([A-Z0-9]{6})$/);
const groupMatch  = urlObj.pathname.match(/\/g\/([A-Z0-9]{6})$/);
```

### New store: `src/store/pendingGroupInviteStore.ts`
Same pattern as `pendingInviteStore` (for friend invites). Holds token until user is authenticated.

### New hook: `useAcceptGroupInvite`
Calls `accept_group_invite(token)` RPC. On success, navigates to group detail page.

### `src/repositories/supabase/groupRepository.ts`
Add:
- `createGroupInvite(groupId)` → calls `create_group_invite` RPC
- `acceptGroupInvite(token)` → calls `accept_group_invite` RPC

---

## UI Entry Points

### Where can a group admin generate an invite link?
- **GroupSettingsPage** (`/groups/$groupId/settings`) — "Mitglieder einladen" button
- Opens a sheet/modal showing the invite link + share button + QR code
- Same UX pattern as the friend invite flow on the Add Friend page

---

## RLS Policies

- `group_invites` INSERT: only if `created_by = auth.uid()` AND user is a group member
- `group_invites` SELECT: members of the group can see existing tokens (to display/copy)
- `group_invites` UPDATE (revoke): only the creator or group admin
- `accept_group_invite` RPC: callable by any authenticated user (token is the authorization)

---

## Out of Scope (Future)
- Per-invitee tokens (single-use group invites)
- Invite approval flow (admin must approve before member joins)
- Web-app join flow (no native app)
- iOS deep link handling (when iOS app ships)