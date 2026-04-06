# Add Friends — UX Concept

## Overview

Three methods to add friends, designed for maximum ease of use:

1. **Invite link** — share via any messenger (WhatsApp, SMS, etc.)
2. **QR code** — show/scan in person (encodes the same invite link)
3. **Email search** — find users already registered on 50Pfennig

Phone contacts matching is deferred to a later iteration.

## Design Decisions

- **Auto-accept**: clicking an invite link immediately creates an accepted friendship (no pending/confirm flow). Fits the trust-based small-group model.
- **New user support**: invite links work for people who don't have the app yet. Play Store Referrer API (Android) passes the invite token through installation. Fallback: tap the link again after installing.
- **QR = invite link**: the QR code simply encodes the invite URL. One mechanism, two delivery methods.
- **Token expiry**: invite tokens expire after 7 days as a security measure. Users can always generate a new one.

## Entry Point

From the FriendsPage, tap the "+" / "Add Friend" button in the header (or the empty-state CTA). This navigates to `/friends/add`.

---

## Screens

### 1. Add Friend Page (`/friends/add`)

Four action cards, each with an icon, title, and subtitle.

```
+------------------------------------------+
|  <  Freund hinzufuegen                   |
+------------------------------------------+
|                                          |
|  +--------------------------------------+
|  | [Link]  Einladungslink teilen        |
|  | Teile einen Link per WhatsApp,       |
|  | SMS oder andere Apps.                |
|  +--------------------------------------+
|                                          |
|  +--------------------------------------+
|  | [QR]  QR-Code anzeigen              |
|  | Lass deinen Freund den Code scannen. |
|  +--------------------------------------+
|                                          |
|  +--------------------------------------+
|  | [Camera]  QR-Code scannen            |
|  | Scanne den Code eines Freundes.      |
|  +--------------------------------------+
|                                          |
|  +--------------------------------------+
|  | [Search]  Per E-Mail suchen          |
|  | Finde Freunde die schon registriert  |
|  | sind.                                |
|  +--------------------------------------+
|                                          |
+------------------------------------------+
```

### 2. Share Invite Link (inline on Add Friend Page)

Tapping "Einladungslink teilen":
1. Creates an invite token via RPC
2. Opens native Share Sheet with the invite URL + message text
3. After sharing, shows inline success text

```
After share sheet closes:
+------------------------------------------+
|  <  Freund hinzufuegen                   |
+------------------------------------------+
|                                          |
|  [Check]  Link geteilt!                 |
|  Der Link ist 7 Tage gueltig.           |
|                                          |
|  [Erneut teilen]                         |
|                                          |
+------------------------------------------+
```

### 3. QR Code Display (`/friends/add/qr`)

Shows the invite URL as a QR code for in-person adding.

```
+------------------------------------------+
|  <  QR-Code                              |
+------------------------------------------+
|                                          |
|           +------------------+           |
|           |                  |           |
|           |   [QR CODE]      |           |
|           |                  |           |
|           +------------------+           |
|                                          |
|   Lass deinen Freund diesen Code         |
|   mit seiner Kamera scannen.             |
|                                          |
|   [Link teilen stattdessen]             |
|                                          |
|   Gueltig fuer 7 Tage.                  |
+------------------------------------------+
```

### 4. QR Scanner (`/friends/add/scan`)

Full-screen camera viewfinder. Only available on native (hidden on web).

```
+------------------------------------------+
|  [X]                    Kamera           |
+------------------------------------------+
|                                          |
|        +--------------------+            |
|        |  CAMERA VIEWFINDER |            |
|        |  with scan frame   |            |
|        +--------------------+            |
|                                          |
|   Richte die Kamera auf einen            |
|   QR-Code eines Freundes.               |
+------------------------------------------+

On success -> navigate to /friends with success message:
"{{name}} als Freund hinzugefuegt!"
```

### 5. Email Search (`/friends/add/email`)

Input field with search. Exact email match against registered users.

```
+------------------------------------------+
|  <  Per E-Mail suchen                    |
+------------------------------------------+
|                                          |
|  +--------------------------------------+
|  | [Search] anna@beispiel.de         [X]|
|  +--------------------------------------+
|                                          |
|  Found:                                  |
|  +--------------------------------------+
|  | [A]  Anna Mueller                   |
|  |      anna@beispiel.de               |
|  |                     [Hinzufuegen]    |
|  +--------------------------------------+
+------------------------------------------+

States:
- Empty: no results shown
- Not found: "Kein Nutzer mit dieser E-Mail gefunden."
- Already friends: "Ihr seid bereits befreundet."
- Added: "[Check] Anna als Freund hinzugefuegt!"
```

### 6. Landing Page (Edge Function — for users without the app)

Served by Supabase Edge Function when invite link is opened in browser.

```
+------------------------------------------+
|                                          |
|         [50Pfennig Logo]                 |
|                                          |
|   {{name}} hat dich eingeladen!          |
|                                          |
|   Mit 50Pfennig teilst du Ausgaben       |
|   einfach mit Freunden und Gruppen.      |
|                                          |
|   [Jetzt installieren (Play Store)]      |
|                                          |
|   Hast du die App bereits?               |
|   [In der App oeffnen]                   |
+------------------------------------------+
```

---

## New User Flow

```
1. User B taps invite link in WhatsApp/SMS
2. Edge Function landing page opens in browser
3. User B taps "Jetzt installieren"
4. Play Store opens (URL includes referrer=invite_token%3D{token})
5. User B installs app, opens it, signs up
6. App checks Play Install Referrer API on first launch
7. Finds invite_token in referrer string
8. Calls acceptInvite(token) -> friendship auto-created

Fallback (if referrer doesn't work):
- User B goes back to WhatsApp, taps link again
- App is now installed, deep link fires
- acceptInvite called -> friendship created
```

---

## Technical Overview

### Database
- New `friend_invites` table (token, inviter_id, used_by, expires_at)
- RPC: `create_friend_invite()`, `accept_friend_invite(token)`, `search_user_by_email(email)`, `add_friend_by_id(user_id)`

### Dependencies
- `@capacitor/share` — native Share Sheet
- `@capacitor-mlkit/barcode-scanning` — QR scanner
- `qrcode` — QR code generation
- `capacitor-plugin-play-install-referrer` — deferred deep links on Android

### New Routes
- `/friends/add` — method selection
- `/friends/add/qr` — QR display
- `/friends/add/scan` — QR scanner
- `/friends/add/email` — email search

### Deep Links
- Extend existing `com.pfennig50.app://` handler for `invite/{token}` path
- Zustand store for pending tokens (user not logged in yet)
- Play Install Referrer check on first app launch
