# components/ui/

This directory contains shadcn/ui components.

**DO NOT edit these files manually.**

Components are added and updated exclusively via the shadcn CLI:

```bash
# Add a new component
npx shadcn@latest add button
npx shadcn@latest add sheet
npx shadcn@latest add input
# etc.
```

The CLI generates the component source into this directory so you can
read and customise the implementation if needed — but treat CLI-generated
files as the baseline and make targeted edits rather than full rewrites.

## Components used in this project

| Component | Used by |
|---|---|
| Button | everywhere |
| Sheet | add-expense flow, record-settlement flow |
| Input | forms |
| Select | paid-by selector, split-type selector |
| Avatar | member display |
| Badge | balance indicators |
| Skeleton | loading states |
| Alert | error messages |
| Separator | list dividers |
