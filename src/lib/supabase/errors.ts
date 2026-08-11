/**
 * Tradução dos erros do Postgres/PostgREST para uma mensagem acionável.
 *
 * O caso mais comum é o site estar mais novo que o banco: a tela pede uma
 * coluna ou uma view que ainda não foi criada no Supabase. Em vez de mostrar
 * "Could not find the column ... in the schema cache", dizemos o que fazer.
 */

const SETUP_HINT =
  'O banco ainda não tem as novidades desta versão. Abra o SQL Editor do Supabase, cole todo o ' +
  'conteúdo de supabase/setup.sql e clique em Run — é seguro executar mais de uma vez.';

/** Códigos de "objeto não existe": cache do PostgREST, coluna e tabela/view. */
const SCHEMA_CODES = new Set(['PGRST204', 'PGRST205', '42703', '42P01', '42883']);

export function isSchemaOutdated(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (!err) return false;

  if (err.code && SCHEMA_CODES.has(err.code)) return true;

  return /schema cache|does not exist|não existe/i.test(err.message ?? '');
}

/** Violação da unicidade do código do projeto (`projects_code_key`). */
export function isDuplicateProjectCode(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  if (err?.code !== '23505') return false;

  return /projects_code_key|\bcode\b/i.test(err.message ?? '');
}

/** Mensagem pronta para toast ou para o estado de erro da tela. */
export function describeDbError(error: unknown, fallback = 'Erro inesperado.'): string {
  const message = (error as { message?: string } | null)?.message ?? fallback;
  return isSchemaOutdated(error) ? `${message} — ${SETUP_HINT}` : message;
}

export { SETUP_HINT };
