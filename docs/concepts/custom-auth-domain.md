# Custom Domain for Email Verification Links

> **Status**
> - ✅ Cloudflare Worker `sharli-verify` already created and deployed
> - ⏳ **DNS transfer to Cloudflare still required** — `sharli.app` must be managed by Cloudflare before the custom domain `auth.sharli.app` can be assigned to the Worker
> - Steps 3 + 4 (email templates) can be done any time, independent of DNS

## Why

Email verification links currently show `https://jjvguntlrsjcugdmuzuk.supabase.co/...`, which looks technical and erodes user trust. The goal is `https://auth.sharli.app/...`.

Supabase custom domains require a Pro plan (€25/month). This approach achieves the same result for free via a Cloudflare Worker redirect.

## How it works

A tiny Cloudflare Worker at `auth.sharli.app/verify` receives the verification click, then redirects to the real Supabase verify endpoint. Users only ever see `auth.sharli.app`.

```
User taps email link
  → https://auth.sharli.app/verify?token=<hash>&type=signup
  → Worker 302 → https://jjvguntlrsjcugdmuzuk.supabase.co/auth/v1/verify?token=<hash>&type=signup&redirect_to=com.arco.sharli://auth/callback
  → Supabase verifies, browser redirected to com.arco.sharli://auth/callback#access_token=...
  → Android opens app → user is logged in
```

---

## Step 1 — Cloudflare DNS transfer

Transfer `sharli.app` nameservers to Cloudflare (done once in your domain registrar's control panel). After transfer, Cloudflare manages DNS and can route `auth.sharli.app` to the Worker.

## Step 2 — Assign custom domain to Worker

In the Cloudflare dashboard → Workers & Pages → `sharli-verify` → Settings → Custom Domains → add `auth.sharli.app`. Cloudflare adds the DNS record automatically.

## Step 3 — Worker code

Track the Worker source in the repo at `cloudflare/verify-redirect/worker.js`:

```js
/**
 * Cloudflare Worker: auth.sharli.app/verify
 *
 * Rewrites Sharli email verification links so they show auth.sharli.app
 * instead of the raw Supabase project URL. After verifying ownership,
 * it redirects to the real Supabase verify endpoint, which then redirects
 * back into the app via the custom URI scheme.
 *
 * Query params expected (set by Supabase email templates):
 *   token  - The token hash from {{ .TokenHash }}
 *   type   - "signup" | "magiclink"
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    const type = url.searchParams.get('type');

    if (!token || !type) {
      return new Response('Missing token or type parameter.', { status: 400 });
    }

    const supabaseVerify = new URL(
      'https://jjvguntlrsjcugdmuzuk.supabase.co/auth/v1/verify'
    );
    supabaseVerify.searchParams.set('token', token);
    supabaseVerify.searchParams.set('type', type);
    supabaseVerify.searchParams.set('redirect_to', 'com.arco.sharli://auth/callback');

    return Response.redirect(supabaseVerify.toString(), 302);
  },
};
```

## Step 4 — Update email templates

Replace `{{ .ConfirmationURL }}` in **both places** (button `href` + fallback text) in each template.

### `supabase/mailtemplates/confirmsignup.html`

```html
<!-- button href (line 67) -->
<a href="https://auth.sharli.app/verify?token={{ .TokenHash }}&type=signup"

<!-- fallback text (line 88) -->
https://auth.sharli.app/verify?token={{ .TokenHash }}&type=signup
```

### `supabase/mailtemplates/magiclink.html`

```html
<!-- button href (line 67) -->
<a href="https://auth.sharli.app/verify?token={{ .TokenHash }}&type=magiclink"

<!-- fallback text (line 88) -->
https://auth.sharli.app/verify?token={{ .TokenHash }}&type=magiclink
```

## Step 5 — Upload templates to Supabase remote

Local template files only affect the local Docker instance. For production, paste the updated HTML into:

**Supabase Dashboard → Authentication → Email Templates**
- "Confirm signup"
- "Magic Link"

---

## Files to create/change

| File | Action |
|------|--------|
| `cloudflare/verify-redirect/worker.js` | Create — Worker source |
| `supabase/mailtemplates/confirmsignup.html` | Edit — replace `{{ .ConfirmationURL }}` ×2 |
| `supabase/mailtemplates/magiclink.html` | Edit — replace `{{ .ConfirmationURL }}` ×2 |
| Supabase dashboard | Paste updated templates |

No changes to `src/`, `android/`, `.env.*`, or `supabase/config.toml`.

## Verification

1. Open `https://auth.sharli.app/verify?token=test&type=signup` in a browser — should redirect to Supabase (which returns an error for `token=test` — expected)
2. Sign up with a real email → link in inbox should start with `https://auth.sharli.app/...`
3. Tap the link on Android → app opens and user is logged in
4. Repeat for magic link
