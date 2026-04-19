import { cn } from '@/lib/utils';
import { UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
} as const;

const iconSizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-8 w-8',
} as const;

/**
 * Deterministic background color from a name string.
 * Uses oklch hue rotation so colors are always well-saturated.
 */
function nameToColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `oklch(0.55 0.08 ${hue})`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    // biome-ignore lint/style/noNonNullAssertion: guarded by parts.length >= 2
    return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  }
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

type UserAvatarProps = {
  name: string;
  avatarUrl?: string | undefined;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showName?: boolean;
  className?: string;
  /**
   * When true, renders a neutral grey placeholder with a UserX icon instead
   * of initials/avatar, and shows the localised "Gelöschter Nutzer" label
   * when showName is set. Used for accounts that have been hard-deleted.
   */
  isDeleted?: boolean;
};

export function UserAvatar({
  name,
  avatarUrl,
  size = 'md',
  showName = false,
  className,
  isDeleted = false,
}: UserAvatarProps) {
  const { t } = useTranslation();

  if (isDeleted) {
    const label = t('common.deleted_user');
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div
          className={cn(
            'rounded-full flex items-center justify-center bg-muted text-muted-foreground shrink-0',
            sizeClasses[size],
          )}
          aria-label={label}
          title={label}
        >
          <UserX className={iconSizeClasses[size]} />
        </div>
        {showName && <span className="font-medium text-muted-foreground italic">{label}</span>}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'rounded-full flex items-center justify-center font-semibold text-white shrink-0',
          sizeClasses[size],
        )}
        style={{ backgroundColor: nameToColor(name) }}
        aria-label={name}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full rounded-full object-cover" />
        ) : (
          getInitials(name)
        )}
      </div>
      {showName && <span className="font-medium text-foreground">{name}</span>}
    </div>
  );
}

type AvatarGroupProps = {
  users: Array<{ name: string; avatarUrl?: string }>;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

export function AvatarGroup({ users, max = 3, size = 'sm', className }: AvatarGroupProps) {
  const displayUsers = users.slice(0, max);
  const remainingCount = users.length - max;

  return (
    <div className={cn('flex items-center -space-x-2', className)}>
      {displayUsers.map((user) => (
        <div
          key={user.name}
          className={cn(
            'rounded-full flex items-center justify-center font-semibold text-white border-2 border-background shrink-0',
            sizeClasses[size],
          )}
          style={{ backgroundColor: nameToColor(user.name) }}
          title={user.name}
        >
          {getInitials(user.name)}
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-semibold bg-muted text-muted-foreground border-2 border-background shrink-0',
            sizeClasses[size],
          )}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
