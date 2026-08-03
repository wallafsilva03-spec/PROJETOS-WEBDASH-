/**
 * Leitura e validação das credenciais do Supabase.
 *
 * As variáveis `NEXT_PUBLIC_*` são gravadas no bundle durante o build, não
 * lidas em tempo de execução. Se estiverem ausentes ou malformadas na hora de
 * compilar, o cliente do Supabase lança exceção — e, se isso acontecer dentro
 * do middleware, toda requisição do site passa a devolver erro 500. Por isso a
 * validação fica isolada aqui e é sempre tratada por quem chama.
 */

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

const AJUDA =
  'Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
  'Localmente ficam no arquivo .env.local; na Vercel, em Settings → Environment Variables ' +
  '(marque o ambiente Production e refaça o deploy, porque essas variáveis entram no build).';

/**
 * Devolve as credenciais já normalizadas.
 * @throws {SupabaseConfigError} quando faltam ou estão em formato inválido.
 */
export function requireSupabaseEnv(): SupabaseEnv {
  // Colar a chave no painel costuma trazer espaço ou quebra de linha junto.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

  const faltando = [
    !url && 'NEXT_PUBLIC_SUPABASE_URL',
    !anonKey && 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ].filter(Boolean);

  if (faltando.length) {
    throw new SupabaseConfigError(`Configuração do Supabase ausente: ${faltando.join(' e ')}. ${AJUDA}`);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SupabaseConfigError(
      `NEXT_PUBLIC_SUPABASE_URL não é uma URL válida (valor recebido: "${url}"). ` +
        'Use o endereço completo do projeto, como https://abcdefgh.supabase.co. ' + AJUDA,
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SupabaseConfigError(
      `NEXT_PUBLIC_SUPABASE_URL deve começar com https:// (valor recebido: "${url}"). ${AJUDA}`,
    );
  }

  // A anon key é um JWT: três blocos separados por ponto, começando com "eyJ".
  // Errar a chave é comum — o campo vizinho no painel é a service_role.
  if (!anonKey.startsWith('eyJ') || anonKey.split('.').length !== 3) {
    throw new SupabaseConfigError(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY não parece uma chave válida. ' +
        'Copie o valor completo do campo "anon public" em Project Settings → API — ' +
        'ele começa com "eyJ" e tem três blocos separados por ponto. ' +
        'Não use a chave service_role: ela ignora todas as regras de acesso do banco. ' +
        AJUDA,
    );
  }

  return { url, anonKey };
}

/** Versão que não lança — para caminhos que precisam seguir mesmo sem configuração. */
export function readSupabaseEnv(): { env: SupabaseEnv | null; error: string | null } {
  try {
    return { env: requireSupabaseEnv(), error: null };
  } catch (error) {
    return { env: null, error: (error as Error).message };
  }
}
