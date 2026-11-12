'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

const DEMAND_STATUSES = [
  'Não iniciado',
  'Em andamento',
  'Em validação/ajuste',
  'Pausado',
  'Concluído',
  'Cancelado',
] as const;

export type DemandStatus = (typeof DEMAND_STATUSES)[number];

export function DemandStatusEditor({
  position,
  demand,
  status,
}: {
  position: number;
  demand: string;
  status: DemandStatus;
}) {
  const router = useRouter();
  const [savedStatus, setSavedStatus] = useState(status);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [saving, setSaving] = useState(false);

  async function saveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || selectedStatus === savedStatus) return;

    setSaving(true);
    try {
      const { data, error } = await createClient()
        .from('subgroup_demands')
        .update({ status: selectedStatus })
        .eq('position', position)
        .eq('status', savedStatus)
        .select('position')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error('O status mudou desde a última consulta. Confira o status atual e tente novamente.');
        router.refresh();
        return;
      }

      setSavedStatus(selectedStatus);
      toast.success('Status da demanda atualizado.');
      router.refresh();
    } catch {
      toast.error('Não foi possível salvar o status da demanda. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={saveStatus} className="flex flex-wrap items-center gap-2 self-start">
      <select
        aria-label={`Status da demanda ${demand}`}
        className="h-9 w-fit max-w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        value={selectedStatus}
        disabled={saving}
        onChange={(event) => setSelectedStatus(event.target.value as DemandStatus)}
      >
        {DEMAND_STATUSES.map((option) => <option key={option}>{option}</option>)}
      </select>
      {selectedStatus !== savedStatus && (
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      )}
    </form>
  );
}
