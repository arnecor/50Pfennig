/**
 * features/expenses/components/SplitEditor/index.tsx
 *
 * The split configuration UI — rendered inside ExpenseForm.
 *
 * Renders one of three sub-editors based on the selected split type:
 *   EqualSplit.tsx      → no user input needed; shows preview of each share
 *   ExactSplit.tsx      → one amount input per participant; validates sum === total
 *   PercentageSplit.tsx → one percentage input per participant; validates sum === 100%
 *
 * The sub-editors are controlled components: they receive the current split
 * config and call onChange when the user edits.
 *
 * The total amount (from the parent form) is passed as a prop so each
 * sub-editor can show a live preview of the resulting per-person amounts.
 *
 * Error state: shown inline if split amounts do not sum to total.
 */

// TODO: Implement SplitEditor and its sub-components:
//   SplitEditor/EqualSplit.tsx
//   SplitEditor/ExactSplit.tsx
//   SplitEditor/PercentageSplit.tsx

export default function SplitEditor() {
  return null;
}
