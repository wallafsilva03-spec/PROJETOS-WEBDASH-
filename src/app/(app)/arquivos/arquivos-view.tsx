'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowUpRight, FolderKanban, Paperclip } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';
import { FilesPanel } from '@/components/projects/files-panel';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useProjects } from '@/hooks/use-projects';

/**
 * Tela de arquivos por projeto: escolhe o projeto no campo suspenso e anexa,
 * baixa ou remove os documentos dele. É o mesmo painel da aba "Arquivos" do
 * projeto, aqui num caminho direto para quem só quer subir documento.
 *
 * O projeto escolhido vai para a URL (`?projeto=`), então o endereço pode ser
 * compartilhado e o botão voltar do navegador funciona.
 */
export function ArquivosView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, isError, refetch } = useProjects({ sort: 'name' });

  const projects = React.useMemo(() => data ?? [], [data]);
  const fromUrl = searchParams.get('projeto');
  const selected = projects.find((project) => project.id === fromUrl) ?? null;

  function choose(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('projeto', id);
    router.replace(`/arquivos?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Documentos"
        title="Arquivos por projeto"
        description="Escolha o projeto e envie atas, contratos, planilhas e evidências. Limite de 50 MB por arquivo."
        actions={
          selected && (
            <Button variant="outline" asChild>
              <Link href={`/projetos/${selected.id}`}>
                Abrir projeto
                <ArrowUpRight className="size-4" />
              </Link>
            </Button>
          )
        }
      />

      <Card className="p-4">
        <div className="flex flex-col gap-2 sm:max-w-lg">
          <Label htmlFor="projeto-arquivos">Projeto</Label>

          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={selected?.id ?? ''} onValueChange={choose} disabled={!projects.length}>
              <SelectTrigger id="projeto-arquivos" aria-label="Escolher o projeto">
                <SelectValue placeholder="Selecione um projeto…" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code} · {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selected?.department_name && (
            <p className="text-xs text-muted-foreground">{selected.department_name}</p>
          )}
        </div>
      </Card>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !projects.length ? (
        <EmptyState
          icon={FolderKanban}
          title="Nenhum projeto cadastrado"
          description="Crie um projeto para começar a anexar documentos."
          action={
            <Button variant="brand" asChild>
              <Link href="/projetos?novo=1">Criar projeto</Link>
            </Button>
          }
        />
      ) : !selected ? (
        <EmptyState
          icon={Paperclip}
          title="Escolha um projeto"
          description="Os arquivos ficam guardados por projeto — selecione um acima para ver e enviar documentos."
        />
      ) : (
        <FilesPanel key={selected.id} projectId={selected.id} />
      )}
    </div>
  );
}
