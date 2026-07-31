'use client';

import * as React from 'react';
import { UserMinus, UserPlus, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useProfiles } from '@/hooks/use-catalogs';
import { useProjectMemberMutations, useProjectMembers } from '@/hooks/use-projects';
import { ROLE_META } from '@/lib/constants';

export function TeamPanel({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { data, isLoading } = useProjectMembers(projectId);
  const people = useProfiles();
  const { add, remove } = useProjectMemberMutations(projectId);
  const [selected, setSelected] = React.useState('');

  const members = data ?? [];
  const memberIds = new Set(members.map((member) => member.user_id));
  const available = (people.data ?? []).filter((person) => !memberIds.has(person.id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4 text-primary" aria-hidden />
          Equipe do projeto
          <Badge variant="secondary">{members.length}</Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !members.length ? (
          <EmptyState
            icon={Users}
            title="Equipe não definida"
            description="Adicione integrantes para que possam acessar o projeto."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="divide-y">
            {members.map((member) => (
              <li key={member.user_id} className="group flex items-center gap-3 py-2.5">
                <UserAvatar
                  userId={member.user_id}
                  name={member.profile?.full_name}
                  src={member.profile?.avatar_url}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.profile?.full_name ?? 'Usuário'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.profile?.job_title ?? (member.profile ? ROLE_META[member.profile.role].label : '—')}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 capitalize">
                  {member.role_in_project}
                </Badge>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => remove.mutate(member.user_id)}
                    aria-label={`Remover ${member.profile?.full_name}`}
                  >
                    <UserMinus className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && available.length > 0 && (
          <div className="flex gap-2 border-t pt-4">
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger aria-label="Selecionar integrante">
                <SelectValue placeholder="Adicionar integrante…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              disabled={!selected}
              loading={add.isPending}
              onClick={() => {
                add.mutate({ userId: selected });
                setSelected('');
              }}
              aria-label="Adicionar à equipe"
            >
              <UserPlus className="size-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
