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

/**
 * Erros do Storage não são erros do Postgres: vêm da API de arquivos, com
 * outro vocabulário, e o texto cru ("Bucket not found") não diz a ninguém o
 * que fazer. Aqui cada caso vira a instrução correspondente.
 */
export function describeStorageError(error: unknown): string {
  const err = error as { message?: string; statusCode?: string; error?: string } | null;
  const raw = err?.message ?? err?.error ?? 'Erro inesperado no envio.';
  const text = `${raw} ${err?.error ?? ''}`.toLowerCase();

  if (text.includes('bucket not found') || text.includes('bucket') && text.includes('not found')) {
    return (
      'O bucket "project-files" não existe no Storage do Supabase. É ele que guarda os anexos. ' +
      `${SETUP_HINT} Se o setup.sql parar na parte de Storage, crie o bucket à mão em ` +
      'Storage → New bucket, com o nome exato project-files e a opção "Public bucket" desligada.'
    );
  }

  if (text.includes('row-level security') || text.includes('violates') || err?.statusCode === '403') {
    return (
      'O Storage recusou o envio por falta de permissão. As policies do bucket "project-files" ' +
      `não foram aplicadas, ou você não é membro deste projeto. ${SETUP_HINT}`
    );
  }

  if (text.includes('exceeded') || text.includes('payload too large') || err?.statusCode === '413') {
    return 'O arquivo passou do limite aceito pelo Storage (50 MB por arquivo).';
  }

  if (text.includes('duplicate') || err?.statusCode === '409') {
    return 'Já existe um arquivo com esse caminho. Tente enviar de novo.';
  }

  if (text.includes('jwt') || text.includes('unauthorized') || err?.statusCode === '401') {
    return 'Sua sessão expirou. Recarregue a página e entre de novo.';
  }

  return raw;
}

/** Mensagem pronta para toast ou para o estado de erro da tela. */
export function describeDbError(error: unknown, fallback = 'Erro inesperado.'): string {
  const message = (error as { message?: string } | null)?.message ?? fallback;
  return isSchemaOutdated(error) ? `${message} — ${SETUP_HINT}` : message;
}

export { SETUP_HINT };
