/**
 * api/invite/group.ts
 *
 * Vercel Serverless Function — serves the group invite landing page.
 * URL pattern (via vercel.json rewrite): invite.sharli.app/g/{token}
 *
 * Behavior:
 *   - Validates the 6-char token against the group_invites table
 *   - Renders a branded HTML landing page with group name, inviter, and member count
 *   - Google Play button: includes referrer param for deferred deep link
 *   - Apple App Store button: shows an overlay (iOS app not yet available)
 *   - "Already have the app" button: opens com.arco.sharli://invite/g/{token}
 *
 * Environment variables (set in Vercel dashboard):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const APP_SCHEME = 'com.arco.sharli';
const APP_PACKAGE = 'com.arco.sharli';

const supabase = createClient(
  process.env.SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed.');
  }

  const token = req.query.token as string;
  if (!token || !/^[A-Z0-9]{6}$/.test(token)) {
    return res.status(400).send('Invalid invite link.');
  }

  const { data: invite } = await supabase
    .from('group_invites')
    .select(`
      group_id,
      expires_at,
      revoked_at,
      profiles:created_by(display_name),
      groups:group_id(name)
    `)
    .eq('token', token)
    .single();

  let inviterName = 'Jemand';
  let groupName = 'einer Gruppe';
  let memberCount = 0;
  let isValid = true;
  let errorMessage = '';

  if (!invite) {
    isValid = false;
    errorMessage = 'Diese Einladung existiert nicht.';
  } else if (invite.revoked_at) {
    isValid = false;
    errorMessage = 'Diese Einladung wurde widerrufen.';
  } else if (new Date(invite.expires_at as string) < new Date()) {
    isValid = false;
    errorMessage = 'Diese Einladung ist abgelaufen.';
  } else {
    const profile = (invite.profiles as unknown) as { display_name: string } | null;
    const group = (invite.groups as unknown) as { name: string } | null;
    inviterName = profile?.display_name ?? 'Jemand';
    groupName = group?.name ?? 'einer Gruppe';

    const { count } = await supabase
      .from('group_members')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', invite.group_id as string);
    memberCount = count ?? 0;
  }

  const deepLink = `${APP_SCHEME}://invite/g/${token}`;
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}&referrer=${encodeURIComponent(`invite_token=g:${token}`)}`;
  const playStoreGeneric = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;

  const ogTitle = isValid
    ? `Sharli — Du wurdest zu ${escapeHtml(groupName)} eingeladen`
    : 'Sharli — Einladung';

  const playStoreIcon = `<svg width="28" height="28" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path fill="#EA4335" d="M6,3 L18,24 L6,45 Z"/>
    <path fill="#4285F4" d="M6,3 L18,24 L24,13.5 Z"/>
    <path fill="#34A853" d="M6,45 L18,24 L24,34.5 Z"/>
    <path fill="#FBBC04" d="M24,13.5 L18,24 L24,34.5 L42,24 Z"/>
  </svg>`;

  const appleIcon = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04l-.08.27ZM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z"/>
  </svg>`;

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sharli — Gruppeneinladung</title>
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="Teile Ausgaben einfach und fair mit Freunden und Gruppen." />
  <meta property="og:type" content="website" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: oklch(0.98 0.005 240);
      color: oklch(0.35 0.025 250);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1.5rem 1rem;
    }

    .card {
      background: oklch(0.995 0.002 240);
      border: 1px solid oklch(0.9 0.008 250);
      border-radius: 1rem;
      box-shadow: 0 4px 32px oklch(0.35 0.025 250 / 0.06);
      padding: 2rem 1.75rem;
      max-width: 380px;
      width: 100%;
      text-align: center;
    }

    .logo-img {
      width: 80px;
      height: 80px;
      border-radius: 1.125rem;
      display: block;
      margin: 0 auto 0.625rem;
    }

    .app-name {
      font-size: 1.15rem;
      font-weight: 800;
      color: oklch(0.35 0.025 250);
      letter-spacing: -0.01em;
      margin-bottom: 0.2rem;
    }

    .app-slogan {
      font-size: 0.82rem;
      color: oklch(0.55 0.018 250);
      line-height: 1.4;
      margin-bottom: 1.75rem;
    }

    .invite-heading {
      font-size: 1.25rem;
      font-weight: 800;
      color: oklch(0.35 0.025 250);
      line-height: 1.3;
      margin-bottom: 0.5rem;
    }

    .invite-meta {
      color: oklch(0.5 0.02 250);
      font-size: 0.85rem;
      line-height: 1.5;
      margin-bottom: 0.25rem;
    }

    .invite-subtitle {
      color: oklch(0.5 0.02 250);
      font-size: 0.9rem;
      line-height: 1.5;
      margin-bottom: 2rem;
    }

    .error-msg {
      color: oklch(0.58 0.16 20);
      font-weight: 700;
      font-size: 1rem;
      margin-bottom: 0.5rem;
    }

    .store-buttons {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.625rem;
      margin-bottom: 0.75rem;
    }

    .btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      width: 100%;
      padding: 0.875rem 0.5rem;
      border-radius: 0.75rem;
      font-family: inherit;
      font-weight: 700;
      font-size: 0.82rem;
      line-height: 1.2;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: opacity 0.15s, transform 0.1s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn:active { transform: scale(0.98); opacity: 0.9; }

    .btn-primary {
      background: oklch(0.45 0.03 250);
      color: oklch(0.98 0.005 240);
    }
    .btn-primary:hover { opacity: 0.9; }

    .btn-secondary {
      background: transparent;
      color: oklch(0.35 0.025 250);
      border: 1.5px solid oklch(0.9 0.008 250);
    }
    .btn-secondary:hover { background: oklch(0.94 0.008 250); }

    .btn-ghost {
      display: block;
      width: 100%;
      padding: 0.875rem 1.25rem;
      border-radius: 0.75rem;
      font-family: inherit;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      text-decoration: none;
      background: transparent;
      color: oklch(0.45 0.025 250);
      border: 1.5px solid oklch(0.88 0.008 250);
      margin-bottom: 1.25rem;
      text-align: center;
      transition: background 0.15s, transform 0.1s;
      -webkit-tap-highlight-color: transparent;
    }
    .btn-ghost:hover { background: oklch(0.96 0.005 250); }
    .btn-ghost:active { transform: scale(0.98); }

    .hint {
      color: oklch(0.6 0.015 250);
      font-size: 0.78rem;
      line-height: 1.5;
    }

    /* Apple overlay */
    .overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: oklch(0.35 0.025 250 / 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 100;
      align-items: flex-end;
      justify-content: center;
      padding: 1rem;
    }
    .overlay.active { display: flex; }

    .overlay-card {
      background: oklch(0.995 0.002 240);
      border-radius: 1rem;
      padding: 1.5rem;
      max-width: 380px;
      width: 100%;
      text-align: left;
    }

    .overlay-title {
      font-weight: 800;
      font-size: 1rem;
      color: oklch(0.35 0.025 250);
      margin-bottom: 0.75rem;
      line-height: 1.4;
    }

    .overlay-consent {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
    }
    .overlay-consent input[type="checkbox"] {
      margin-top: 0.15rem;
      width: 1rem;
      height: 1rem;
      flex-shrink: 0;
      accent-color: oklch(0.45 0.03 250);
    }
    .overlay-consent label {
      font-size: 0.82rem;
      color: oklch(0.5 0.02 250);
      line-height: 1.5;
    }

    .overlay-close {
      display: block;
      width: 100%;
      padding: 0.75rem;
      border-radius: 0.75rem;
      background: oklch(0.45 0.03 250);
      color: oklch(0.98 0.005 240);
      font-family: inherit;
      font-weight: 700;
      font-size: 0.9rem;
      border: none;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
  </style>
</head>
<body>
  <div class="card">
    <img src="/icon.png" alt="Sharli" class="logo-img">
    <p class="app-name">Sharli</p>
    <p class="app-slogan">Ausgaben teilen – einfach und fair.</p>

    ${isValid ? `
      <h1 class="invite-heading">Du wurdest zu<br>${escapeHtml(groupName)} eingeladen</h1>
      <p class="invite-meta">Eingeladen von ${escapeHtml(inviterName)}</p>
      <p class="invite-subtitle">${memberCount} ${memberCount === 1 ? 'Mitglied ist' : 'Mitglieder sind'} bereits dabei.</p>

      <div class="store-buttons">
        <a href="${escapeHtml(playStoreUrl)}" class="btn btn-primary">
          ${playStoreIcon}
          <span>Google Play</span>
        </a>
        <button class="btn btn-secondary" onclick="document.getElementById('apple-overlay').classList.add('active')">
          ${appleIcon}
          <span>App Store</span>
        </button>
      </div>

      <a href="${escapeHtml(deepLink)}" class="btn-ghost">Ich habe die App bereits</a>
      <p class="hint">Nach der Installation wirst du automatisch der Gruppe hinzugefügt.</p>
    ` : `
      <p class="error-msg">${escapeHtml(errorMessage)}</p>
      <p class="invite-subtitle">Bitte ein Gruppenmitglied, dir eine neue Einladung zu senden.</p>
      <div class="store-buttons">
        <a href="${escapeHtml(playStoreGeneric)}" class="btn btn-primary">
          ${playStoreIcon}
          <span>Google Play</span>
        </a>
        <button class="btn btn-secondary" onclick="document.getElementById('apple-overlay').classList.add('active')">
          ${appleIcon}
          <span>App Store</span>
        </button>
      </div>
    `}
  </div>

  <!-- Apple "not yet available" overlay -->
  <div id="apple-overlay" class="overlay" onclick="if(event.target===this)this.classList.remove('active')">
    <div class="overlay-card">
      <p class="overlay-title">Die iPhone-Variante ist derzeit noch in Arbeit. Möchtest du solange die Web-Version nutzen?</p>
      <div class="overlay-consent">
        <input type="checkbox" id="ios-consent">
        <label for="ios-consent">Benachrichtige mich, wenn die iOS-App verfügbar ist. Ich bin damit einverstanden, zu diesem Zweck kontaktiert zu werden.</label>
      </div>
      <button class="overlay-close" onclick="document.getElementById('apple-overlay').classList.remove('active')">Schließen</button>
    </div>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
