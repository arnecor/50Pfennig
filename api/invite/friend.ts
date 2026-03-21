/**
 * api/invite/friend.ts
 *
 * Vercel Serverless Function — serves the friend invite landing page.
 * URL pattern (via vercel.json rewrite): invite.sharli.app/f/{token}
 *
 * Behavior:
 *   - Validates the 6-char token against the friend_invites table
 *   - Renders a branded HTML landing page with the inviter's name
 *   - Google Play button: includes referrer param for deferred deep link
 *   - Apple App Store button: shows an overlay (iOS app not yet available)
 *   - "Already have the app" link: opens com.arco.sharli://invite/f/{token}
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
    return res.status(405).send('Method not allowed');
  }

  const token = req.query.token as string;
  if (!token || !/^[A-Z0-9]{6}$/.test(token)) {
    return res.status(400).send('Invalid invite link');
  }

  const { data: invite } = await supabase
    .from('friend_invites')
    .select('inviter_id, expires_at, used_by, profiles:inviter_id(display_name)')
    .eq('token', token)
    .single();

  let inviterName = 'Jemand';
  let isValid = true;
  let errorMessage = '';

  if (!invite) {
    isValid = false;
    errorMessage = 'Diese Einladung existiert nicht.';
  } else if (invite.used_by) {
    isValid = false;
    errorMessage = 'Diese Einladung wurde bereits verwendet.';
  } else if (new Date(invite.expires_at as string) < new Date()) {
    isValid = false;
    errorMessage = 'Diese Einladung ist abgelaufen.';
  } else {
    const profile = (invite.profiles as unknown) as { display_name: string } | null;
    inviterName = profile?.display_name || 'Jemand';
  }

  const deepLink = `${APP_SCHEME}://invite/f/${token}`;
  const playStoreUrl = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}&referrer=${encodeURIComponent(`invite_token=f:${token}`)}`;
  const playStoreGeneric = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;

  const ogTitle = isValid
    ? `Sharli — Einladung von ${escapeHtml(inviterName)}`
    : 'Sharli — Einladung';

  const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Sharli — Einladung</title>
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

    .logo-wrap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3.5rem;
      height: 3.5rem;
      background: oklch(0.45 0.03 250);
      border-radius: 1rem;
      margin-bottom: 0.75rem;
    }

    .logo-text {
      font-size: 1.1rem;
      font-weight: 800;
      color: oklch(0.98 0.005 240);
      letter-spacing: -0.02em;
    }

    .app-name {
      font-size: 1rem;
      font-weight: 700;
      color: oklch(0.5 0.02 250);
      margin-bottom: 1.75rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 0.75rem;
    }

    .invite-heading {
      font-size: 1.25rem;
      font-weight: 800;
      color: oklch(0.35 0.025 250);
      line-height: 1.3;
      margin-bottom: 0.5rem;
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
      display: flex;
      flex-direction: column;
      gap: 0.625rem;
      margin-bottom: 1.25rem;
    }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.625rem;
      width: 100%;
      padding: 0.875rem 1.25rem;
      border-radius: 0.75rem;
      font-family: inherit;
      font-weight: 700;
      font-size: 0.95rem;
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

    .already-link {
      display: block;
      color: oklch(0.5 0.02 250);
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
      margin-bottom: 1.25rem;
    }
    .already-link:hover { color: oklch(0.45 0.03 250); text-decoration: underline; }

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
    <div class="logo-wrap">
      <span class="logo-text">50</span>
    </div>
    <p class="app-name">Sharli</p>

    ${isValid ? `
      <h1 class="invite-heading">${escapeHtml(inviterName)} hat dich eingeladen!</h1>
      <p class="invite-subtitle">Teile Ausgaben einfach und fair mit Freunden und Gruppen.</p>

      <div class="store-buttons">
        <a href="${escapeHtml(playStoreUrl)}" class="btn btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.18 23.76c.3.17.64.24.99.2L15.95 12 12.07 8.12 3.18 23.76Zm16.4-12.85-3.07-1.76L13 12l3.5 3.5 3.08-1.77a1.5 1.5 0 0 0 0-2.82ZM3.07.25a1.25 1.25 0 0 0-.64 1.1v21.3c0 .46.24.87.64 1.1l.1.06 11.93-11.93v-.29L3.17.19l-.1.06Z"/>
          </svg>
          Im Play Store laden
        </a>
        <button class="btn btn-secondary" onclick="document.getElementById('apple-overlay').classList.add('active')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04l-.08.27ZM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z"/>
          </svg>
          Im App Store laden
        </button>
      </div>

      <a href="${escapeHtml(deepLink)}" class="already-link">Ich habe die App bereits</a>
      <p class="hint">Nach der Installation wird die Freundschaft automatisch hergestellt.</p>
    ` : `
      <p class="error-msg">${escapeHtml(errorMessage)}</p>
      <p class="invite-subtitle">Bitte deinen Freund, dir eine neue Einladung zu senden.</p>
      <div class="store-buttons">
        <a href="${escapeHtml(playStoreGeneric)}" class="btn btn-primary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3.18 23.76c.3.17.64.24.99.2L15.95 12 12.07 8.12 3.18 23.76Zm16.4-12.85-3.07-1.76L13 12l3.5 3.5 3.08-1.77a1.5 1.5 0 0 0 0-2.82ZM3.07.25a1.25 1.25 0 0 0-.64 1.1v21.3c0 .46.24.87.64 1.1l.1.06 11.93-11.93v-.29L3.17.19l-.1.06Z"/>
          </svg>
          App im Play Store ansehen
        </a>
        <button class="btn btn-secondary" onclick="document.getElementById('apple-overlay').classList.add('active')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04l-.08.27ZM13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11Z"/>
          </svg>
          Im App Store laden
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
