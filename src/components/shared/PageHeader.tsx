import { cn } from '@/lib/utils';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  actionLabel?: string;
  variant?: 'default' | 'large';
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  onBack,
  onAction,
  actionIcon,
  actionLabel = 'More options',
  variant = 'default',
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('sticky top-0 bg-background/95 backdrop-blur-sm z-40', className)}>
      <div className={cn('flex items-center gap-3 px-4', variant === 'large' ? 'py-4' : 'py-3')}>
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-muted rounded-full transition-colors"
            aria-label="Go back"
            type="button"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <h1
            className={cn(
              'font-bold text-foreground truncate',
              variant === 'large' ? 'text-2xl' : 'text-lg',
            )}
          >
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
        </div>

        {onAction && (
          <button
            onClick={onAction}
            className="p-2 -mr-2 hover:bg-muted rounded-full transition-colors"
            aria-label={actionLabel}
            type="button"
          >
            {actionIcon || <MoreVertical className="w-5 h-5 text-foreground" />}
          </button>
        )}
      </div>
    </header>
  );
}

type GreetingHeaderProps = {
  name: string;
  greeting?: string;
  className?: string;
};

export function GreetingHeader({ name, greeting, className }: GreetingHeaderProps) {
  const { t } = useTranslation();
  return (
    <header className={cn('px-5 pt-6 pb-2', className)}>
      <h1 className="text-2xl font-bold text-foreground">
        {greeting ?? t('home.greeting', { name })}
      </h1>
    </header>
  );
}

type SectionHeaderProps = {
  title: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
};

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between px-5 py-3', className)}>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          type="button"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
