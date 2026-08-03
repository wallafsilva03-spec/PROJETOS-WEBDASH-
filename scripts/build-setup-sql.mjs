/**
 * Concatena as migrations + seed em um único arquivo (supabase/setup.sql),
 * para quem prefere colar tudo de uma vez no SQL Editor do Supabase em vez
 * de usar o CLI. Regenerar com `npm run db:setup-sql`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = resolve(root, 'supabase/migrations');

const files = readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const header = `-- =====================================================================
-- WEBDASH · Gestão de Projetos Corporativos — Grupo Moreno
-- ARQUIVO ÚNICO DE INSTALAÇÃO
--
-- Gerado automaticamente por scripts/build-setup-sql.mjs.
-- Não edite este arquivo: altere as migrations em supabase/migrations
-- e rode \`npm run db:setup-sql\`.
--
-- Como usar:
--   1. Abra o SQL Editor do seu projeto no Supabase
--   2. Cole TODO o conteúdo deste arquivo
--   3. Execute (Run)
--
-- É seguro executar mais de uma vez: tudo usa if not exists / or replace.
-- =====================================================================

`;

const parts = files.map((file) => {
  const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
  return [
    '-- ---------------------------------------------------------------------',
    `-- ORIGEM: supabase/migrations/${file}`,
    '-- ---------------------------------------------------------------------',
    '',
    sql.trimEnd(),
    '',
  ].join('\n');
});

const seed = readFileSync(resolve(root, 'supabase/seed.sql'), 'utf8');
parts.push(
  [
    '-- ---------------------------------------------------------------------',
    '-- ORIGEM: supabase/seed.sql (departamentos, clientes e tags do Grupo Moreno)',
    '-- ---------------------------------------------------------------------',
    '',
    seed.trimEnd(),
    '',
  ].join('\n'),
);

const output = header + parts.join('\n');
writeFileSync(resolve(root, 'supabase/setup.sql'), `${output}\n`, 'utf8');

console.log(
  `supabase/setup.sql gerado — ${files.length} migrations + seed, ` +
    `${output.split('\n').length} linhas.`,
);
