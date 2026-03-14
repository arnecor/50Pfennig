import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type FloatingActionButtonProps = {
  onClick?: () => void;
  label?: string;
  className?: string;
};

export function FloatingActionButton({
  onClick,
  label,
  className,
}: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-24 right-4 flex items-center gap-2 bg-accent text-accent-foreground px-5 py-3.5 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-semibold z-40',
        className,
      )}
      aria-label={label}
      type="button"
    >
      <Plus className="w-5 h-5" strokeWidth={2.5} />
      {label && <span>{label}</span>}
    </button>
  );
}

type SmallFabProps = {
  onClick?: () => void;
  icon?: React.ReactNode;
  label?: string;
  className?: string;
};

export function SmallFab({
  onClick,
  icon,
  label = 'Add',
  className,
}: SmallFabProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-14 h-14 flex items-center justify-center bg-accent text-accent-foreground rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95',
        className,
      )}
      aria-label={label}
      type="button"
    >
      {icon || <Plus className="w-6 h-6" strokeWidth={2.5} />}
    </button>
  );
}
