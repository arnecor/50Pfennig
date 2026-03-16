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
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(mascotSizes[size], className)}
      role="img"
      aria-label="Sharli"
    >
      {/* Body */}
      <ellipse cx="40" cy="48" rx="24" ry="22" className="fill-primary/20" />
      {/* Head */}
      <circle cx="40" cy="30" r="20" className="fill-primary/30" />
      {/* Eyes */}
      <circle cx="33" cy="28" r="6" className="fill-card" />
      <circle cx="47" cy="28" r="6" className="fill-card" />
      <circle cx="34" cy="28" r="3" className="fill-foreground" />
      <circle cx="48" cy="28" r="3" className="fill-foreground" />
      {/* Beak */}
      <path d="M40 34 L37 38 L43 38 Z" className="fill-accent" />
      {/* Ear tufts */}
      <path d="M22 18 L28 24 L24 26 Z" className="fill-primary/40" />
      <path d="M58 18 L52 24 L56 26 Z" className="fill-primary/40" />
      {/* Wings */}
      <ellipse cx="20" cy="48" rx="8" ry="12" className="fill-primary/25" />
      <ellipse cx="60" cy="48" rx="8" ry="12" className="fill-primary/25" />
      {/* Feet */}
      <ellipse cx="34" cy="68" rx="4" ry="2" className="fill-accent" />
      <ellipse cx="46" cy="68" rx="4" ry="2" className="fill-accent" />
    </svg>
  );
}
