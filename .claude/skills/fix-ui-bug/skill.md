# .claude/skills/fix-ui-bug/SKILL.md
When fixing a UI bug:
1. Read the component and any related/sibling components
2. Identify root cause before editing
3. When changing className/style, MERGE don't replace
4. Verify fix works on both web and mobile interactions
5. Run `npx tsc --noEmit` after edits