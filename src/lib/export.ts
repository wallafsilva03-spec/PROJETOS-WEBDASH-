'use client';

/**
 * Exportação de relatórios — Excel, CSV e PDF.
 * As bibliotecas pesadas são carregadas sob demanda (code splitting).
 */

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  /** Largura da coluna no PDF, em proporção. */
  width?: number;
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function toMatrix<T>(rows: T[], columns: ExportColumn<T>[]) {
  return rows.map((row) => columns.map((column) => column.accessor(row) ?? ''));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportToCsv<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const escape = (value: string | number) => {
    const text = String(value ?? '');
    return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  const lines = [
    columns.map((column) => escape(column.header)).join(';'),
    ...toMatrix(rows, columns).map((line) => line.map(escape).join(';')),
  ];

  // BOM garante acentuação correta ao abrir no Excel pt-BR.
  download(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' }), `${filename}-${stamp()}.csv`);
}

export async function exportToExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = 'Relatório',
) {
  const ExcelJS = await import('exceljs');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'WebDash · Grupo Moreno';
  workbook.created = new Date();

  // O Excel rejeita > 31 caracteres e os caracteres : \ / ? * [ ] no nome da aba.
  const sheet = workbook.addWorksheet(sheetName.replace(/[:\\/?*[\]]/g, '-').slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = columns.map((column, index) => ({
    header: column.header,
    key: `c${index}`,
    width: Math.max(column.header.length + 4, (column.width ?? 2) * 10),
  }));

  toMatrix(rows, columns).forEach((line) => sheet.addRow(line));

  // Cabeçalho no azul institucional Grupo Moreno.
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3F94' } };
  header.alignment = { vertical: 'middle', horizontal: 'left' };
  header.height = 22;

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${filename}-${stamp()}.xlsx`,
  );
}

export async function exportToPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  title: string,
  subtitle?: string,
) {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Cabeçalho institucional Grupo Moreno.
  doc.setFillColor(27, 63, 148);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 56, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text('Grupo Moreno · Gestão de Projetos', 40, 26);
  doc.setFontSize(10);
  doc.text(title, 40, 44);

  doc.setFillColor(14, 143, 70);
  doc.rect(0, 56, doc.internal.pageSize.getWidth() / 3, 4, 'F');
  doc.setFillColor(140, 198, 63);
  doc.rect(doc.internal.pageSize.getWidth() / 3, 56, doc.internal.pageSize.getWidth() / 3, 4, 'F');
  doc.setFillColor(27, 63, 148);
  doc.rect((doc.internal.pageSize.getWidth() / 3) * 2, 56, doc.internal.pageSize.getWidth() / 3, 4, 'F');

  if (subtitle) {
    doc.setTextColor(90, 90, 90);
    doc.setFontSize(9);
    doc.text(subtitle, 40, 78);
  }

  autoTable(doc, {
    startY: subtitle ? 92 : 78,
    head: [columns.map((column) => column.header)],
    body: toMatrix(rows, columns).map((line) => line.map((cell) => String(cell ?? ''))),
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [27, 63, 148], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [244, 247, 251] },
    margin: { left: 40, right: 40 },
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Emitido em ${new Date().toLocaleString('pt-BR')} · Página ${page} de ${pages}`,
      40,
      doc.internal.pageSize.getHeight() - 20,
    );
  }

  doc.save(`${filename}-${stamp()}.pdf`);
}
