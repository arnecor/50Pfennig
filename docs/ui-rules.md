## UI Components
When implementing or changing UIs, you must consider [docs/ui-rules.md](docs/ui-rules.md)
Installed shadcn/ui components: `badge`, `button`, `card`, `dialog`, `input`, `label`.
No toast / sonner / select. Use inline error state for form errors. If you want to add more components, ask the user.
 
 ## UI Designs & Creating new UIs
 This is a Capacitor mobile app targeting Android. Always test UI fixes against safe area insets, nav bar overlap, and keyboard behavior. Status bar config uses Capacitor's Style enum.
 Prefer:
- Best Practice UX concepts for that given context
- minimal layouts
- clear hierarchy
- no hidden interactions
- mobile-first spacing

## Safe Area Insets — Bottom Sheets

Every bottom sheet / overlay that is fixed to the bottom of the screen MUST clear the Android navigation bar.

**Rule:** Apply `pb-safe` to the innermost content div or footer of every bottom sheet.  
Defined in `src/index.css`: `padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px))`.

```tsx
// ✅ correct
<div className="px-5 pt-4 pb-safe">…</div>

// ❌ wrong — pb-safe-bottom does not exist (silently ignored by Tailwind)
<div className="pb-safe-bottom">…</div>

// ❌ wrong — ad-hoc inline styles or arbitrary Tailwind max()/calc() values
<div style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
```