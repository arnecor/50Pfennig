/**
 * Edge Function: invite
 *
 * Serves a web landing page for friend invite links.
 * URL pattern: /functions/v1/invite/{token}
 *
 * Behavior:
 *   - Looks up the invite token to get the inviter's display name
 *   - On mobile: tries to open the app via deep link, shows landing page as fallback
 *   - Landing page offers "Install from Play Store" (with referrer param for
 *     deferred deep link) and "Open in app" (direct deep link)
 *   - On desktop: shows the landing page with both options
 *
 * The Play Store URL includes &referrer=invite_token%3D{token} so the app
 * can read the token via the Play Install Referrer API after installation.
 *
 * Required environment variables (auto-injected by Supabase):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const APP_SCHEME = 'com.pfennig50.app';
const APP_PACKAGE = 'com.pfennig50.app';

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Parse token from URL path: /invite/{token}
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  // Path is /invite/{token} or /functions/v1/invite/{token}
  const token = pathParts[pathParts.length - 1];

  if (!token || !/^[a-f0-9]{32}$/.test(token)) {
    return new Response('Invalid invite link', { status: 400 });
  }

  // Look up invite to get inviter name
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data: invite } = await supabase
    .from('friend_invites')
    .select('inviter_id, expires_at, used_by, profiles:inviter_id(display_name)')
    .eq('token', token)
    .single();

  // Determine invite state
  let inviterName = 'Jemand';
  let isValid = true;
  let errorMessage = '';

  if (!invite) {
    isValid = false;
    errorMessage = 'Diese Einladung existiert nicht.';
  } else if (invite.used_by) {
    isValid = false;
    errorMessage = 'Diese Einladung wurde bereits verwendet.';
  } else if (new Date(invite.expires_at) < new Date()) {
    isValid = false;
    errorMessage = 'Diese Einladung ist abgelaufen.';
  } else {
    const profile = invite.profiles as { display_name: string } | null;
    inviterName = profile?.display_name || 'Jemand';
  }

  const deepLink = `${APP_SCHEME}://invite/${token}`;
  const playStoreUrl =
    `https://play.google.com/store/apps/details?id=${APP_PACKAGE}&referrer=${encodeURIComponent(`invite_token=${token}`)}`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>50Pfennig — Einladung</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .card {
      background: white;
      border-radius: 1rem;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      padding: 2rem;
      max-width: 400px;
      width: 100%;
      text-align: center;
    }
    .logo {
      font-size: 3rem;
      margin-bottom: 0.5rem;
    }
    .app-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 1.5rem;
    }
    .invite-text {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    .subtitle {
      color: #64748b;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }
    .error {
      color: #dc2626;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 0.875rem 1.5rem;
      border-radius: 0.75rem;
      text-decoration: none;
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 0.75rem;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.9; }
    .btn-primary {
      background: #0f172a;
      color: white;
    }
    .btn-secondary {
      background: transparent;
      color: #0f172a;
      border: 2px solid #e2e8f0;
    }
    .hint {
      color: #94a3b8;
      font-size: 0.8rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">50</div>
    <div class="app-name">50Pfennig</div>
    ${
    isValid
      ? `
      <div class="invite-text">${escapeHtml(inviterName)} hat dich eingeladen!</div>
      <div class="subtitle">Teile Ausgaben einfach und fair mit Freunden und Gruppen.</div>
      <a href="${playStoreUrl}" class="btn btn-primary">Jetzt installieren</a>
      <a href="${deepLink}" class="btn btn-secondary">Ich habe die App bereits</a>
      <div class="hint">Nach der Installation wird die Freundschaft automatisch hergestellt.</div>
    `
      : `
      <div class="error">${escapeHtml(errorMessage)}</div>
      <div class="subtitle">Bitte deinen Freund, dir eine neue Einladung zu senden.</div>
      <a href="https://play.google.com/store/apps/details?id=${APP_PACKAGE}" class="btn btn-primary">App im Play Store ansehen</a>
    `
  }
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
