/**
 * main.tsx
 *
 * Application entry point. Mounts <App /> into the DOM.
 * Keep this file minimal — all setup belongs in App.tsx or dedicated modules.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Tailwind base styles + shadcn CSS variables
import { initI18n } from './lib/i18n';

initI18n().then(() => {
  // biome-ignore lint/style/noNonNullAssertion: root element is guaranteed present in index.html
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
