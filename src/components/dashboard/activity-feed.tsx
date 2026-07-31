'use client';

import Link from 'next/link';
import { Activity } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useActivityFeed } from '@/hooks/use-analytics';
import { formatRelative } from '@/lib/format';

export function ActivityFeed({ projectId, limit = 12 }: { projectId?: string; limit?: number }) {
  const { data, isLoading } = useActivityFeed(projectId, limit);

  return (
    <Card className="h-full">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-primary" aria-hidden />
          Atividades recentes
        </CardTitle>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 animate-pulse-ring rounded-full bg-success" aria-hidden />
          ao vivo
        </span>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data?.length ? (
          <EmptyState
            icon={Activity}
            title="Sem movimentações"
            description="As alterações feitas pela equipe aparecem aqui em tempo real."
            className="border-0 bg-transparent py-8"
          />
        ) : (
          <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-border">
            {data.map((item) => (
              <li key={item.id} className="relative flex gap-3">
                <UserAvatar
                  userId={item.actor_id}
                  name={item.actor_name}
                  src={item.actor_avatar}
                  className="size-8 shrink-0 ring-2 ring-card"
                />
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{item.actor_name ?? 'Sistema'}</span>{' '}
                    <span className="text-muted-foreground">{item.summary}</span>
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {item.project_id && (
                      <Link
                        href={`/projetos/${item.project_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.project_code ?? item.project_name}
                      </Link>
                    )}
                    <span aria-hidden>·</span>
                    <time dateTime={item.created_at}>{formatRelative(item.created_at)}</time>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
