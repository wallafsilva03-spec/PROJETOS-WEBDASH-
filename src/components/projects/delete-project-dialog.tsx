'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useDeleteProject } from '@/hooks/use-projects';

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: { id: string; code: string; name: string };
  /** Para onde ir depois de excluir. Sem isso, apenas fecha o diálogo. */
  redirectTo?: string;
}

/**
 * Confirmação de exclusão do projeto.
 *
 * A exclusão é em cascata no banco: some tudo que pendura no projeto. Por isso
 * o código precisa ser digitado — é o mesmo pedágio de um `drop`, e evita o
 * clique errado num item do portfólio.
 */
export function DeleteProjectDialog({ open, onOpenChange, project, redirectTo }: DeleteProjectDialogProps) {
  const router = useRouter();
  const remove = useDeleteProject();
  const [typed, setTyped] = React.useState('');

  React.useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const confirmed = typed.trim().toUpperCase() === project.code.toUpperCase();

  async function onConfirm() {
    try {
      await remove.mutateAsync(project.id);
    } catch {
      return; // a mutation já mostrou o motivo no toast; o diálogo continua aberto
    }
    onOpenChange(false);
    if (redirectTo) router.push(redirectTo);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" aria-hidden />
            Excluir {project.code}
          </DialogTitle>
          <DialogDescription>
            Esta ação não tem volta. O projeto <strong>{project.name}</strong> sai do portfólio junto
            com tudo que está pendurado nele.
          </DialogDescription>
        </DialogHeader>

        <ul className="list-disc space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 py-3 pl-9 pr-4 text-sm text-muted-foreground">
          <li>tarefas, dependências e checklist</li>
          <li>etapas, marcos e riscos</li>
          <li>comentários, arquivos anexados e horas apontadas</li>
          <li>equipe do projeto e histórico de atividades</li>
        </ul>

        <Field
          label={`Digite ${project.code} para confirmar`}
          htmlFor="delete-project-code"
          hint="Só administradores podem excluir projetos."
        >
          <Input
            id="delete-project-code"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={project.code}
            autoComplete="off"
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!confirmed}
            loading={remove.isPending}
            onClick={onConfirm}
          >
            Excluir definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
