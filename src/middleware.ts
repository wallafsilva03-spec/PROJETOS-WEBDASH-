import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

import { readSupabaseEnv } from '@/lib/supabase/env';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_ROUTES = ['/login', '/cadastro', '/recuperar-senha', '/auth'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  const { env, error } = readSupabaseEnv();

  // Sem credenciais válidas não há sessão para renovar. O middleware roda em
  // toda requisição: se lançasse exceção aqui, o site inteiro devolveria 500.
  // Deixa passar e registra o motivo, para a tela de login explicar o que falta.
  if (!env) {
    console.error(`[middleware] ${error}`);
    return response;
  }

  let refreshed = response;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        refreshed = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => refreshed.cookies.set(name, value, options));
      },
    },
  });

  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (cause) {
    // Instabilidade de rede ou projeto Supabase indisponível: não vale derrubar
    // a navegação inteira. As páginas protegidas seguem checando a sessão.
    console.error('[middleware] falha ao validar a sessão:', (cause as Error).message);
    return refreshed;
  }

  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === '/login' || pathname === '/cadastro')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    redirectUrl.search = '';
    return NextResponse.redirect(redirectUrl);
  }

  return refreshed;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
