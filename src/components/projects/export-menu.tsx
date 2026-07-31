'use client';

import * as React from 'react';
import { Download, FileSpreadsheet, FileText, Table2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '@/lib/export';

interface ExportMenuProps<T> {
  rows: T[];
  columns: ExportColumn<T>[];
  filename: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}

/** Menu único de exportação — Excel, CSV e PDF — reutilizado em todas as telas. */
export function ExportMenu<T>({ rows, columns, filename, title, subtitle, disabled }: ExportMenuProps<T>) {
  const [busy, setBusy] = React.useState(false);

  async function run(action: () => void | Promise<void>) {
    if (!rows.length) {
      toast.info('Não há dados para exportar com os filtros atuais.');
      return;
    }
    setBusy(true);
    try {
      await action();
      toast.success('Relatório gerado.');
    } catch (error) {
      toast.error(`Falha ao exportar: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" loading={busy} disabled={disabled}>
          <Download className="size-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{rows.length} registro(s)</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => run(() => exportToExcel(rows, columns, filename, title))}>
          <FileSpreadsheet />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(() => exportToCsv(rows, columns, filename))}>
          <Table2 />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run(() => exportToPdf(rows, columns, filename, title, subtitle))}>
          <FileText />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
