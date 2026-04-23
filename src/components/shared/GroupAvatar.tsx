/**
 * components/shared/GroupAvatar.tsx
 *
 * Renders the visual identity of a group — either a predefined icon or a
 * custom uploaded image. Mirrors the shape of UserAvatar for consistency.
 *
 * Predefined icons:
 *   'default' / undefined → Users  (generic group)
 *   'camping'             → Tent
 *   'plane'               → Plane
 *   'vacation'            → Palmtree
 */

import { parseGroupImage } from '@domain/groupImage';
import { cn } from '@lib/utils';
import { Plane, Tent, TreePalm, Users } from 'lucide-react';

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
} as const;

const iconSizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-8 h-8',
} as const;

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  default: Users,
  group: Users,
  camping: Tent,
  plane: Plane,
  vacation: TreePalm,
};

type GroupAvatarProps = {
  imageUrl?: string | undefined;
  groupName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Extra classes on the root element */
  className?: string;
};

export function GroupAvatar({ imageUrl, groupName, size = 'md', className }: GroupAvatarProps) {
  const image = parseGroupImage(imageUrl);

  const containerClass = cn(
    'rounded-xl bg-muted flex items-center justify-center shrink-0 overflow-hidden',
    sizeClasses[size],
    className,
  );

  if (image.type === 'url') {
    return (
      <div className={containerClass}>
        <img src={image.url} alt={groupName} className="w-full h-full object-cover" />
      </div>
    );
  }

  const Icon = iconMap[image.key] ?? iconMap.default ?? Users;
  return (
    <div className={containerClass}>
      <Icon className={cn('text-primary', iconSizeClasses[size])} />
    </div>
  );
}
