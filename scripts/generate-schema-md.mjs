/**
 * Gera docs/SCHEMA.md a partir de site/schema-data.js.
 * Fonte única: alterou uma migration, atualize o schema-data e rode `npm run docs:schema`.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = require(resolve(root, 'site/schema-data.js'));

const out = [];
const w = (line = '') => out.push(line);

/** Escapa `|` para não quebrar as tabelas Markdown. */
const cell = (value) => String(value ?? '').replace(/\|/g, '\\|');

w('# Schema do banco · WebDash Grupo Moreno');
w();
w('> Documento gerado automaticamente por `npm run docs:schema`. Não edite à mão —');
w('> a fonte é [`site/schema-data.js`](../site/schema-data.js).');
w();
w(`**Motor:** ${schema.meta.engine}  `);
w(`**Migrations:** \`${schema.meta.migrations}\``);
w();
w(
  `O banco tem **${schema.tables.length} tabelas**, **${schema.views.length} views**, ` +
    `**${schema.functions.length} functions** e **${schema.triggers.length} grupos de triggers**, ` +
    'com Row Level Security ativa em todas as tabelas.',
);
w();

/* ------------------------------------------------------------- Sumário */
w('## Sumário');
w();
w('- [Perfis de acesso](#perfis-de-acesso)');
w('- [Diagrama de relacionamentos](#diagrama-de-relacionamentos)');
w('- [Tabelas](#tabelas)');
schema.domains.forEach((domain) => {
  const tables = schema.tables.filter((table) => table.domain === domain.id);
  if (tables.length) w(`  - [${domain.label}](#${slug(domain.label)})`);
});
w('- [Tipos enumerados](#tipos-enumerados)');
w('- [Views](#views)');
w('- [Functions](#functions)');
w('- [Triggers](#triggers)');
w('- [Realtime](#realtime)');
w('- [Storage](#storage)');
w();

/* ------------------------------------------------------------- Perfis */
w('## Perfis de acesso');
w();
w('As permissões são aplicadas no banco por Row Level Security, não no frontend.');
w();
w('| Perfil | Alcance |');
w('| ------ | ------- |');
schema.roles.forEach((role) => w(`| **${cell(role.role)}** | ${cell(role.scope)} |`));
w();

/* ------------------------------------------------------------ Diagrama */
w('## Diagrama de relacionamentos');
w();
w('```mermaid');
w('erDiagram');
schema.tables.forEach((table) => {
  table.columns
    .filter((column) => column.ref && !column.ref.startsWith('auth.'))
    .forEach((column) => {
      const target = column.ref.split('(')[0];
      const cardinality = column.flags?.includes('NOT NULL') ? '||--o{' : '|o--o{';
      w(`  ${target} ${cardinality} ${table.name} : "${column.name}"`);
    });
});
w('```');
w();

/* ------------------------------------------------------------- Tabelas */
w('## Tabelas');
w();

schema.domains.forEach((domain) => {
  const tables = schema.tables.filter((table) => table.domain === domain.id);
  if (!tables.length) return;

  w(`### ${domain.label}`);
  w();
  w(`_${domain.hint}_`);
  w();

  tables.forEach((table) => {
    w(`#### \`${table.name}\``);
    w();
    w(table.description);
    w();
    w('| Coluna | Tipo | Restrições | Referência | Observação |');
    w('| ------ | ---- | ---------- | ---------- | ---------- |');

    table.columns.forEach((column) => {
      const flags = (column.flags ?? []).join(', ') || '—';
      const ref = column.ref ? `\`${column.ref}\`${column.onDelete ? ` ON DELETE ${column.onDelete}` : ''}` : '—';
      const note = [column.default ? `default \`${column.default}\`` : null, column.note]
        .filter(Boolean)
        .join('. ');

      w(`| \`${cell(column.name)}\` | \`${cell(column.type)}\` | ${cell(flags)} | ${cell(ref)} | ${cell(note || '—')} |`);
    });

    w();
    if (table.indexes?.length) {
      w(`**Índices e restrições:** ${table.indexes.map((index) => `\`${index}\``).join(', ')}`);
      w();
    }
    w(`**RLS:** ${table.rls}`);
    w();
  });
});

/* --------------------------------------------------------------- Enums */
w('## Tipos enumerados');
w();
w('| Tipo | Valores | Uso |');
w('| ---- | ------- | --- |');
schema.enums.forEach((item) =>
  w(`| \`${cell(item.name)}\` | ${item.values.map((v) => `\`${v}\``).join(', ')} | ${cell(item.description)} |`),
);
w();

/* --------------------------------------------------------------- Views */
w('## Views');
w();
w('Todas criadas com `security_invoker = on`: a RLS do usuário logado continua valendo.');
w();
w('| View | O que entrega | Consumida por |');
w('| ---- | ------------- | ------------- |');
schema.views.forEach((view) => w(`| \`${cell(view.name)}\` | ${cell(view.description)} | ${cell(view.usedBy)} |`));
w();

/* ----------------------------------------------------------- Functions */
w('## Functions');
w();
w('| Função | Categoria | Descrição |');
w('| ------ | --------- | --------- |');
schema.functions.forEach((fn) => w(`| \`${cell(fn.name)}\` | ${cell(fn.kind)} | ${cell(fn.description)} |`));
w();

/* ------------------------------------------------------------ Triggers */
w('## Triggers');
w();
w('| Tabela | Trigger | Momento | Efeito |');
w('| ------ | ------- | ------- | ------ |');
schema.triggers.forEach((trigger) =>
  w(`| \`${cell(trigger.table)}\` | \`${cell(trigger.name)}\` | ${cell(trigger.when)} | ${cell(trigger.description)} |`),
);
w();

/* ------------------------------------------------------------ Realtime */
w('## Realtime');
w();
w('Tabelas publicadas em `supabase_realtime`, todas com `REPLICA IDENTITY FULL`:');
w();
w(schema.realtime.map((table) => `\`${table}\``).join(' · '));
w();

/* ------------------------------------------------------------- Storage */
w('## Storage');
w();
w('| Bucket | Visibilidade | Limite | Policies |');
w('| ------ | ------------ | ------ | -------- |');
schema.storage.forEach((bucket) =>
  w(`| \`${cell(bucket.bucket)}\` | ${cell(bucket.visibility)} | ${cell(bucket.limit)} | ${cell(bucket.policies)} |`),
);
w();

mkdirSync(resolve(root, 'docs'), { recursive: true });
writeFileSync(resolve(root, 'docs/SCHEMA.md'), `${out.join('\n')}\n`, 'utf8');

console.log(`docs/SCHEMA.md gerado — ${schema.tables.length} tabelas, ${schema.views.length} views.`);

function slug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
