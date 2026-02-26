# ADR-0010: i18n Scaffolding from Day One (German + English)

- **Date:** 2026-02-25
- **Status:** Accepted

## Context

The app name "50Pfennig" is German and the primary target market is German-speaking users. However, the app may also be used by international groups (travel companions, expats). Retrofitting i18n into an app that was built with hardcoded strings is a significant, disruptive refactor — every string in every component must be touched.

Options considered:
- **English only** — fastest to build, painful to retrofit
- **German only (hardcoded)** — correct language, still painful to retrofit
- **i18n from day one** — upfront setup cost, zero retrofit cost later

## Decision

Use **i18next + react-i18next** with two locales from the start: `de` (German, default) and `en` (English).

Translation files live in `public/locales/{lang}/translation.json`. The `useTranslation` hook is used in all components — no hardcoded user-visible strings anywhere in the codebase.

```
public/
└── locales/
    ├── de/
    │   └── translation.json   ← German (default)
    └── en/
        └── translation.json   ← English
```

Language detection order: localStorage (user preference) → browser language → fallback to `de`.

## Consequences

- **Positive:** Zero retrofit cost when English-speaking users request the app. Translation files can be handed to a translator without touching code.
- **Positive:** Forces a discipline of keeping all user-visible strings in one place — useful for UX consistency even in a single-language app.
- **Negative:** Every string in every component goes through `t('key')` rather than being written inline. Slightly more verbose to write initially.
- **Negative:** Translation files must be kept in sync as features are added. A missing key falls back to the key name itself — visible to users but not a crash.
- **Convention:** Translation keys use dot notation and mirror the feature structure: `expenses.form.description_placeholder`, `groups.empty_state`, etc. Keys are English-readable so missing translations degrade gracefully.
