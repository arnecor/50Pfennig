/**
 * components/shared/EmptyState.tsx
 *
 * Generic empty state component used across lists.
 *
 * Props:
 *   icon?:        ReactNode  — illustration or icon
 *   title:        string     — primary message
 *   description?: string     — secondary message
 *   action?:      ReactNode  — CTA button (e.g. "Create your first group")
 */

import type { ReactNode } from 'react';

type Props = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 text-muted-foreground">{icon}</div>
      )}
      <p className="text-base font-semibold">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
