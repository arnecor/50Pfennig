/**
 * features/expenses/components/ExpenseForm.tsx
 *
 * The main form for creating and editing an expense.
 * Used by both ExpenseFormPage (new) and ExpenseFormPage (edit).
 *
 * Fields:
 *   - Description (text)
 *   - Total amount (numeric, converted to cents)
 *   - Paid by (member selector)
 *   - Split type selector (equal / exact / percentage)
 *   - SplitEditor sub-component (renders based on selected split type)
 *
 * Form state: React Hook Form
 * Validation: Zod schema (co-located below the component)
 * On submit: calls useCreateExpense() or useUpdateExpense()
 *
 * The SplitEditor validates that split amounts/percentages sum to the total.
 * This validation mirrors the server-side check in the create_expense RPC.
 */

// TODO: Implement

export default function ExpenseForm() {
  return null;
}
