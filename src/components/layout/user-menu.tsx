'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Monitor, Moon, Settings, Sun, UserCog } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { roleMeta } from '@/lib/constants';
import { useSession } from '@/hooks/use-session';

export function UserMenu() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { profile } = useSession();

  async function signOut() {
    await createClient().auth.signOut();
    queryClient.clear();
    router.replace('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Menu do usuário">
          <UserAvatar
            userId={profile?.id}
            name={profile?.full_name}
            src={profile?.avatar_url}
            className="size-8"
          />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <div className="flex items-center gap-3 py-1">
            <UserAvatar userId={profile?.id} name={profile?.full_name} src={profile?.avatar_url} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{profile?.full_name ?? '—'}</p>
              <p className="truncate text-xs font-normal text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          {profile && (
            <Badge variant="soft" className="mt-1 bg-gradient-brand-soft text-foreground">
              {roleMeta(profile.role).label}
            </Badge>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/configuracoes">
            <UserCog />
            Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/configuracoes">
            <Settings />
            Configurações
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="mr-2 size-4" /> Claro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="mr-2 size-4" /> Escuro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="mr-2 size-4" /> Sistema
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem destructive onSelect={signOut}>
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
