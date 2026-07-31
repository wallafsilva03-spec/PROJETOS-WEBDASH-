'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';

import { avatarTint, cn, initials } from '@/lib/utils';

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('relative flex size-9 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('aspect-square size-full object-cover', className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn('flex size-full items-center justify-center rounded-full text-xs font-semibold', className)}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

interface UserAvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  name?: string | null;
  src?: string | null;
  userId?: string | null;
}

/** Avatar do usuário com fallback por iniciais e cor derivada do id. */
function UserAvatar({ name, src, userId, className, ...props }: UserAvatarProps) {
  return (
    <Avatar className={className} {...props}>
      {src && <AvatarImage src={src} alt={name ?? 'Usuário'} />}
      <AvatarFallback className={avatarTint(userId ?? name)}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Pilha de avatares para equipes. */
function AvatarStack({
  people,
  max = 4,
  size = 'size-8',
}: {
  people: { id?: string | null; full_name?: string | null; avatar_url?: string | null }[];
  max?: number;
  size?: string;
}) {
  const visible = people.slice(0, max);
  const rest = people.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((person, index) => (
        <UserAvatar
          key={person.id ?? index}
          userId={person.id}
          name={person.full_name}
          src={person.avatar_url}
          className={cn(size, 'ring-2 ring-card')}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            size,
            'flex items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground ring-2 ring-card',
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback, UserAvatar, AvatarStack };
