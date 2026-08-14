import { cn } from '@/lib/utils';
import { BRAND } from '@/lib/constants';

/**
 * O manifesto do Grupo Moreno em movimento: FORTALECER, CONECTAR e CRESCER
 * entram um de cada vez, a assinatura JEITO MORENO DE SER fecha, e o ciclo
 * recomeça.
 *
 * Tudo é CSS — os quatro elementos compartilham o mesmo laço de 9s e só
 * diferem no atraso, do jeito que a aurora já fazia. Sem timer, sem estado e
 * sem `use client`: isto renderiza no servidor e nunca sai de compasso, por
 * mais tempo que a tela fique aberta.
 *
 * Quem pede menos movimento no sistema (`prefers-reduced-motion`) recebe as
 * três palavras e a frase paradas, todas visíveis: as regras de globals.css
 * encerram a animação na hora, e o estado de repouso do CSS — o que está nas
 * classes, não nos keyframes — é justamente o texto legível.
 */

/**
 * `color` é a cor da marca, usada como fundo da etiqueta com texto branco por
 * cima. Quando a palavra é o próprio texto colorido, essas cores não servem
 * nos dois fundos — o azul institucional some no azul da barra lateral e o
 * limão some no branco —, então cada uma tem a sua tinta clara e a sua
 * escura.
 */
const WORDS = [
  {
    label: 'FORTALECER',
    color: BRAND.green,
    ink: { light: BRAND.green, dark: '#34C77B' },
    delay: '0s',
  },
  {
    label: 'CONECTAR',
    color: BRAND.lime,
    ink: { light: '#5E9E1E', dark: BRAND.lime },
    delay: '0.9s',
  },
  {
    label: 'CRESCER',
    color: BRAND.blue,
    ink: { light: BRAND.blue, dark: '#7FA6F0' },
    delay: '1.8s',
  },
] as const;

/** A assinatura entra depois das três, com a volta inteira pela frente. */
const PHRASE_DELAY = '3s';
const PHRASE = 'JEITO MORENO DE SER';

/**
 * Versão grande, para a tela de login. As palavras se acumulam — quando a
 * frase chega, as três estão na tela.
 */
export function BrandManifesto({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Para leitor de tela é um texto só, sem a coreografia. */}
      <p className="sr-only">Fortalecer, conectar, crescer. Jeito Moreno de ser.</p>

      <ul className="flex flex-wrap items-center gap-2.5" aria-hidden>
        {WORDS.map((word) => (
          <li
            key={word.label}
            className="animate-reveal-word rounded-md px-3.5 py-1.5 text-xs font-bold tracking-wider text-white shadow-brand"
            style={{ backgroundColor: word.color, animationDelay: word.delay }}
          >
            {word.label}
          </li>
        ))}
      </ul>

      <p
        className="animate-reveal-phrase font-display text-lg font-semibold uppercase text-white/90"
        style={{ animationDelay: PHRASE_DELAY }}
        aria-hidden
      >
        {PHRASE}
      </p>
    </div>
  );
}

/**
 * Versão de uma linha só, para a barra lateral e para o cabeçalho do login no
 * celular.
 *
 * Aqui os quatro textos ocupam o mesmo lugar, então a coreografia é outra: em
 * vez de se acumularem, cada um tem um quarto do ciclo e sai antes do próximo
 * entrar — se usassem o laço da versão grande, ficariam impressos uns sobre os
 * outros. A altura é fixa e o excesso é cortado, para o letreiro não empurrar
 * o que está em volta.
 */
export function BrandManifestoInline({
  className,
  tone = 'light',
}: {
  className?: string;
  /** `light` para fundo escuro (barra lateral); `default` para fundo claro. */
  tone?: 'default' | 'light';
}) {
  /** Um quarto do ciclo de 9s para cada texto. */
  const slots = ['0s', '2.25s', '4.5s', '6.75s'];

  return (
    <div className={cn('relative h-4 overflow-hidden', className)}>
      <span className="sr-only">Fortalecer, conectar, crescer. Jeito Moreno de ser.</span>

      {WORDS.map((word, index) => (
        <span
          key={word.label}
          aria-hidden
          className="animate-roll-item absolute inset-0 flex items-center text-[11px] font-bold uppercase tracking-[0.16em]"
          style={{
            color: tone === 'light' ? word.ink.dark : word.ink.light,
            animationDelay: slots[index],
          }}
        >
          {word.label}
        </span>
      ))}

      <span
        aria-hidden
        className={cn(
          'animate-roll-item absolute inset-0 flex items-center whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em]',
          tone === 'light' ? 'text-white/80' : 'text-muted-foreground',
        )}
        style={{ animationDelay: slots[3] }}
      >
        {PHRASE}
      </span>
    </div>
  );
}
