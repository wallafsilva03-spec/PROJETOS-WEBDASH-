const agendaUrl = 'https://efeyfsfjeynrajtbghnf.supabase.co';
const agendaKey = 'sb_publishable_zm8CWQDRefboMcp7T5UK1A_mluD3RTa';
const agendaOrigin = 'https://agenda-projetos-coa.vercel.app';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function rpc(url, key, name, body, authorization) {
  return fetch(url + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: key, Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
}

Deno.serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': agendaOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Cache-Control': 'private, no-store',
    'Vary': 'Origin',
  };
  const json = (body, status = 200) => Response.json(body, { status, headers });
  const error = (status, message) => json({ message }, status);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'GET' && req.method !== 'POST') return error(405, 'Método indisponível.');

  const token = req.headers.get('Authorization');
  if (!token?.startsWith('Bearer ')) return error(401, 'Entre para acessar o catálogo.');
  try {
    const identity = await rpc(agendaUrl, agendaKey, 'agenda_catalog_identity', {}, token);
    if (identity.status === 401 || identity.status === 403) {
      return error(401, 'Entre novamente para acessar o catálogo.');
    }
    if (!identity.ok) return error(503, 'Não foi possível verificar seu acesso à Agenda.');
    const member = await identity.json();
    if (!member?.email || member.level !== 3) {
      return error(403, 'O vínculo com o Projetos Web está disponível para a conta master.');
    }

    const args = {
      member_email: member.email,
    };
    if (req.method === 'POST') {
      const { projectId, name } = (await req.json().catch(() => null)) ?? {};
      if (typeof projectId !== 'string' || !uuid.test(projectId) ||
          typeof name !== 'string' || !name.trim() || name.trim().length > 160) {
        return error(400, 'Selecione um projeto e informe um nome de até 160 caracteres.');
      }
      args.parent_project = projectId;
      args.subgroup_name = name.trim();
    }

    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const url = Deno.env.get('SUPABASE_URL');
    if (!url || !key) return error(503, 'A integração com o Projetos Web está indisponível.');
    const response = await rpc(url, key, 'agenda_web_catalog', args, 'Bearer ' + key);
    const data = await response.json().catch(() => null);
    if (response.ok && data) return json(data);
    if (data?.code === '42501') return error(403, data.message);
    if (data?.code === '22023') return error(400, data.message);
    return error(503, 'O Projetos Web está temporariamente indisponível.');
  } catch {
    return error(503, 'Não foi possível acessar o catálogo do Projetos Web.');
  }
});
