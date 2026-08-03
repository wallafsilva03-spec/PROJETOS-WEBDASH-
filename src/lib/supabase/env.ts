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

  // Trocar os dois campos de lugar é o engano mais comum: no painel do Supabase
  // a URL e a chave ficam lado a lado.
  if (url.startsWith('sb_publishable_') || url.startsWith('sb_secret_') || url.startsWith('eyJ')) {
    throw new SupabaseConfigError(
      'NEXT_PUBLIC_SUPABASE_URL recebeu uma chave em vez de um endereço. ' +
        'Esse campo é a Project URL, algo como https://abcdefghijklmnopqrst.supabase.co. ' +
        'A chave vai em NEXT_PUBLIC_SUPABASE_ANON_KEY. ' + AJUDA,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SupabaseConfigError(
      `NEXT_PUBLIC_SUPABASE_URL não é uma URL válida (valor recebido: "${url}"). ` +
        'Use o endereço completo do projeto, como https://abcdefghijklmnopqrst.supabase.co. ' + AJUDA,
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SupabaseConfigError(
      `NEXT_PUBLIC_SUPABASE_URL deve começar com https:// (valor recebido: "${url}"). ${AJUDA}`,
    );
  }

  // O Supabase tem dois formatos de chave pública em circulação:
  //   - novo: "sb_publishable_..."
  //   - legado: JWT "eyJ..." com três blocos separados por ponto (a antiga anon)
  // Ambos são aceitos pelo supabase-js e podem ir para o navegador.
  const isPublishable = anonKey.startsWith('sb_publishable_');
  const isLegacyAnonJwt = anonKey.startsWith('eyJ') && anonKey.split('.').length === 3;

  // As chaves privadas ignoram toda a RLS. Enviá-las ao navegador exporia o
  // banco inteiro, então é melhor falhar aqui do que publicar.
  if (anonKey.startsWith('sb_secret_')) {
    throw new SupabaseConfigError(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY recebeu a chave secreta (sb_secret_...). ' +
        'Ela ignora todas as regras de acesso do banco e nunca deve ir para o navegador. ' +
        'Use a chave "publishable" (sb_publishable_...).',
    );
  }

  if (!isPublishable && !isLegacyAnonJwt) {
    // Uma URL neste campo é o engano mais comum: os dois valores ficam lado a lado no painel.
    const pareceUrl = anonKey.startsWith('http');
    throw new SupabaseConfigError(
      pareceUrl
        ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY recebeu uma URL. Esse campo é a chave; ' +
          'a URL vai em NEXT_PUBLIC_SUPABASE_URL. ' + AJUDA
        : 'NEXT_PUBLIC_SUPABASE_ANON_KEY não parece uma chave válida. ' +
          'Em Project Settings → API, copie a chave pública: ela começa com ' +
          '"sb_publishable_" nos projetos novos, ou com "eyJ" nos mais antigos. ' +
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
