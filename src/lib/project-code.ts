/**
 * Código do projeto gerado automaticamente a partir do relógio: ano, data e
 * hora do cadastro — `2026-0811-143207` é 11/08/2026 às 14:32:07.
 *
 * O formato foi escolhido para caber nas regras que já existem na coluna
 * `code` (única, no máximo 20 caracteres, só letras, números e hífen) e para
 * ordenar sozinho: alfabético e cronológico dão a mesma sequência.
 *
 * O horário é o local de quem cadastra, e não UTC, porque é a hora que a
 * pessoa vê no relógio na hora de conferir o projeto.
 */

function pad(value: number, size = 2) {
  return String(value).padStart(size, '0');
}

/** `AAAA-MMDD-HHMMSS` — ano, data e hora do cadastro. */
export function generateProjectCode(date: Date = new Date()) {
  const year = date.getFullYear();
  const day = `${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

  return `${year}-${day}-${time}`;
}

/**
 * Variante para quando o código já existe — dois cadastros no mesmo segundo.
 * Vira `2026-0811-143207-2`, ainda dentro dos 20 caracteres.
 */
export function withCodeSuffix(code: string, attempt: number) {
  return `${code}-${attempt}`;
}

/** Formato legível do código, para explicar o campo na tela. */
export const PROJECT_CODE_HINT = 'Gerado automaticamente: ano-data-hora do cadastro.';
