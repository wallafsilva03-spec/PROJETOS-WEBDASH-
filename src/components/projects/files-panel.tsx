'use client';

import * as React from 'react';
import { Download, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useAttachmentMutations, useAttachments } from '@/hooks/use-project-details';
import { formatDateTime, formatFileSize } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/types/database';

const MAX_SIZE = 50 * 1024 * 1024;

export function FilesPanel({ projectId, taskId }: { projectId: string; taskId?: string | null }) {
  const { data, isLoading } = useAttachments(projectId);
  const { upload, remove, getSignedUrl } = useAttachmentMutations(projectId);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const files = (data ?? []).filter((file) => (taskId ? file.task_id === taskId : true));

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;

    for (const file of Array.from(list)) {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} excede o limite de 50 MB.`);
        continue;
      }
      await upload.mutateAsync({ file, taskId: taskId ?? null });
    }
  }

  async function download(attachment: Attachment) {
    try {
      const url = await getSignedUrl(attachment);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(`Não foi possível gerar o link: ${(error as Error).message}`);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Paperclip className="size-4 text-primary" aria-hidden />
          Arquivos
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} loading={upload.isPending}>
          <Upload className="size-3.5" />
          Enviar
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          onChange={(event) => {
            void handleFiles(event.target.files);
            event.target.value = '';
          }}
        />

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            'rounded-lg border-2 border-dashed p-6 text-center text-sm transition-colors',
            dragging ? 'border-primary bg-primary/5' : 'border-border text-muted-foreground',
          )}
        >
          Arraste arquivos aqui ou use o botão <strong>Enviar</strong>. Limite de 50 MB por arquivo.
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !files.length ? (
          <EmptyState
            icon={Paperclip}
            title="Nenhum arquivo"
            description="Anexe documentos, atas e evidências do projeto."
            className="border-0 bg-transparent py-6"
          />
        ) : (
          <ul className="divide-y">
            {files.map((file) => {
              const isImage = file.mime_type?.startsWith('image/');
              const Icon = isImage ? ImageIcon : FileText;

              return (
                <li key={file.id} className="group flex items-center gap-3 py-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.file_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatFileSize(file.size_bytes)} · {file.uploader?.full_name ?? 'Sistema'} ·{' '}
                      {formatDateTime(file.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => download(file)} aria-label="Baixar">
                      <Download className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => remove.mutate(file)}
                      aria-label="Excluir arquivo"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
