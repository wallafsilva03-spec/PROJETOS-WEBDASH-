'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ShieldAlert, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/label';
import { Input, Textarea } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Hint } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useRiskMutations, useRisks } from '@/hooks/use-project-details';
import { useProjectMembers } from '@/hooks/use-projects';
import { RISK_STATUS_META, riskSeverityMeta } from '@/lib/constants';
import { riskSchema, type RiskInput } from '@/lib/validations';
import { cn } from '@/lib/utils';
import type { Risk } from '@/types/database';

const SCALE = [1, 2, 3, 4, 5];
const NONE = '__none__';

/** Matriz 5×5 de probabilidade × impacto. */
export function RiskMatrix({ risks }: { risks: Risk[] }) {
  const open = risks.filter((risk) => !['mitigado', 'aceito'].includes(risk.status));

  return (
    <div className="inline-block">
      <div className="flex">
        <div className="flex flex-col justify-around pr-2 text-[10px] font-medium text-muted-foreground">
          <span className="rotate-180 [writing-mode:vertical-rl]">Probabilidade</span>
        </div>
        <div>
          <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
            {[...SCALE].reverse().map((probability) => (
              <React.Fragment key={probability}>
                <span className="flex w-4 items-center justify-center text-[10px] text-muted-foreground">
                  {probability}
                </span>
                {SCALE.map((impact) => {
                  const cell = open.filter((r) => r.probability === probability && r.impact === impact);
                  const severity = probability * impact;
                  const meta = riskSeverityMeta(severity);

                  return (
                    <Hint
                      key={`${probability}-${impact}`}
                      label={
                        cell.length
                          ? cell.map((risk) => risk.title).join(' · ')
                          : `${meta.label} — nenhum risco nesta célula`
                      }
                    >
                      <div
                        className={cn(
                          'flex size-11 items-center justify-center rounded-md text-sm font-semibold transition-transform hover:scale-105',
                          meta.className,
                          !cell.length && 'opacity-25',
                        )}
                      >
                        {cell.length || ''}
                      </div>
                    </Hint>
                  );
                })}
              </React.Fragment>
            ))}
            <span />
            {SCALE.map((impact) => (
              <span key={impact} className="text-center text-[10px] text-muted-foreground">
                {impact}
              </span>
            ))}
          </div>
          <p className="mt-1 text-center text-[10px] font-medium text-muted-foreground">Impacto</p>
        </div>
      </div>
    </div>
  );
}

export function RisksPanel({ projectId }: { projectId: string }) {
  const { data, isLoading } = useRisks(projectId);
  const { save, remove } = useRiskMutations(projectId);
  const members = useProjectMembers(projectId);
  const [editing, setEditing] = React.useState<Risk | null>(null);
  const [open, setOpen] = React.useState(false);

  const risks = data ?? [];

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RiskInput>({
    resolver: zodResolver(riskSchema),
    defaultValues: { title: '', probability: 3, impact: 3, status: 'identificado' },
  });

  React.useEffect(() => {
    if (!open) return;
    reset({
      title: editing?.title ?? '',
      description: editing?.description ?? '',
      probability: editing?.probability ?? 3,
      impact: editing?.impact ?? 3,
      status: editing?.status ?? 'identificado',
      mitigation: editing?.mitigation ?? '',
      owner_id: editing?.owner_id ?? null,
    });
  }, [open, editing, reset]);

  async function onSubmit(values: RiskInput) {
    await save.mutateAsync({
      id: editing?.id,
      ...values,
      description: values.description || null,
      mitigation: values.mitigation || null,
    });
    setOpen(false);
    setEditing(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Heatmap de riscos</CardTitle>
        </CardHeader>
        <CardContent>
          <RiskMatrix risks={risks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="size-4 text-primary" aria-hidden />
            Riscos do projeto
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Novo risco
          </Button>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !risks.length ? (
            <EmptyState
              icon={ShieldAlert}
              title="Nenhum risco mapeado"
              description="Registre riscos para acompanhar probabilidade, impacto e mitigação."
              className="border-0 bg-transparent py-8"
            />
          ) : (
            <ul className="space-y-2">
              {risks.map((risk) => {
                const meta = riskSeverityMeta(risk.severity);
                return (
                  <li
                    key={risk.id}
                    className="group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-secondary/50"
                  >
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold',
                        meta.className,
                      )}
                      title={`Severidade ${risk.severity} (${meta.label})`}
                    >
                      {risk.severity}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setEditing(risk);
                        setOpen(true);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="font-medium">{risk.title}</p>
                      {risk.mitigation && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          Mitigação: {risk.mitigation}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge variant="soft" className={RISK_STATUS_META[risk.status].className}>
                          {RISK_STATUS_META[risk.status].label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          P{risk.probability} × I{risk.impact}
                        </span>
                      </div>
                    </button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => remove.mutate(risk.id)}
                      aria-label={`Remover risco ${risk.title}`}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar risco' : 'Novo risco'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Field label="Título" htmlFor="risk-title" error={errors.title?.message} required>
              <Input id="risk-title" {...register('title')} />
            </Field>

            <Field label="Descrição" htmlFor="risk-description">
              <Textarea id="risk-description" rows={2} {...register('description')} />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Probabilidade (1–5)" htmlFor="risk-probability">
                <Input id="risk-probability" type="number" min="1" max="5" {...register('probability')} />
              </Field>
              <Field label="Impacto (1–5)" htmlFor="risk-impact">
                <Input id="risk-impact" type="number" min="1" max="5" {...register('impact')} />
              </Field>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Field label="Status">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RISK_STATUS_META).map(([value, meta]) => (
                          <SelectItem key={value} value={value}>
                            {meta.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
            </div>

            <Controller
              control={control}
              name="owner_id"
              render={({ field }) => (
                <Field label="Responsável pela mitigação">
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sem responsável</SelectItem>
                      {members.data?.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.profile?.full_name ?? 'Usuário'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Field label="Plano de mitigação" htmlFor="risk-mitigation">
              <Textarea id="risk-mitigation" rows={3} {...register('mitigation')} />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" loading={isSubmitting}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
