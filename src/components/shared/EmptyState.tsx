import { cn } from '@/lib/utils';
import { Button } from '@components/ui/button';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  description: string;
  icon?: ReactNode;
  /** Either a ReactNode to render directly, or { label, onClick } for a default Button. */
  action?: ReactNode | { label: string; onClick: () => void };
  className?: string;
};

export default function EmptyState({ title, description, icon, action, className }: Props) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center px-8 py-12', className)}
    >
      {icon ? (
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
          {icon}
        </div>
      ) : (
        <div className="mb-4">
          <SharliMascot size="lg" />
        </div>
      )}

      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs text-pretty">{description}</p>

      {action &&
        (typeof action === 'object' && action !== null && 'onClick' in action ? (
          <Button onClick={action.onClick} className="font-semibold">
            {action.label}
          </Button>
        ) : (
          <div className="mt-0">{action}</div>
        ))}
    </div>
  );
}

type SharliMascotProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const mascotSizes = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-24 h-24',
} as const;

export function SharliMascot({ size = 'md', className }: SharliMascotProps) {
  return (
    <img
      src="/icon.png"
      alt="Sharli"
      className={cn(mascotSizes[size], 'rounded-full object-cover', className)}
    />
  );
}
