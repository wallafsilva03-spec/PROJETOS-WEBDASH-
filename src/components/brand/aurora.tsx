import { cn } from '@/lib/utils';

/**
 * Fluxo de cores institucionais que atravessa a tela — a "aurora" da marca.
 *
 * O truque é sempre o mesmo: um elemento com o dobro da altura do container,
 * pintado com um degradê que se repete a cada metade dele (`background-size:
 * 100% 50%`), deslizando exatamente 50% no eixo Y. Como o padrão se repete na
 * mesma distância que ele anda, o laço não tem emenda — a cor entra por um
 * lado e sai pelo outro para sempre, sem canvas e sem JavaScript.
 *
 * O `prefers-reduced-motion` de globals.css congela tudo isso; o degradê fica
 * parado no lugar e a tela continua bonita.
 */

/** Verde FORTALECER, limão CONECTAR e um azul claro que sobrevive ao fundo escuro. */
const GREEN = '#0E8F46';
const LIME = '#8CC63F';
const BLUE = '#3B6FD4';

function flowingGradient(stops: string) {
  return {
    backgroundImage: `linear-gradient(to bottom, ${stops})`,
    // Uma volta do padrão = metade do elemento = a distância percorrida.
    backgroundSize: '100% 50%',
    backgroundRepeat: 'repeat-y' as const,
    willChange: 'transform',
  };
}

interface Beam {
  left: string;
  width: string;
  color: string;
  direction: 'down' | 'up';
  duration: string;
}

/** Feixes largos em velocidades diferentes: uns descem, outros sobem. */
const BEAMS: Beam[] = [
  { left: '-8%', width: '30%', color: LIME, direction: 'down', duration: '15s' },
  { left: '14%', width: '24%', color: GREEN, direction: 'up', duration: '21s' },
  { left: '34%', width: '26%', color: BLUE, direction: 'down', duration: '27s' },
  { left: '56%', width: '24%', color: LIME, direction: 'up', duration: '18s' },
  { left: '74%', width: '26%', color: GREEN, direction: 'down', duration: '24s' },
  { left: '90%', width: '22%', color: BLUE, direction: 'up', duration: '30s' },
];

/**
 * Um núcleo forte e curto, com as pontas indo a zero. É o que faz a cor ler
 * como faixa correndo em vez de neblina parada.
 */
function beamStops(color: string) {
  return `${color}00 0%, ${color}00 6%, ${color}ff 24%, ${color}cc 38%, ${color}33 54%, ${color}00 70%, ${color}00 100%`;
}

/**
 * Painel inteiro tomado pela aurora. Fica atrás do conteúdo — o pai precisa
 * ser `relative` e o conteúdo, `relative` também, para não sumir debaixo dela.
 */
export function AuroraBackdrop({
  className,
  /** Quanto a aurora aparece. `soft` para áreas com texto por cima. */
  intensity = 'normal',
}: {
  className?: string;
  intensity?: 'soft' | 'normal';
}) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        intensity === 'soft' ? 'opacity-40' : 'opacity-95',
        className,
      )}
      aria-hidden
    >
      {/* Manchas que respiram, dando profundidade por trás dos feixes. */}
      <div
        className="absolute -right-24 -top-32 size-[30rem] animate-aurora-drift rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${LIME} 0%, transparent 70%)` }}
      />
      <div
        className="absolute -bottom-40 -left-20 size-[28rem] animate-aurora-drift rounded-full blur-3xl"
        style={{
          background: `radial-gradient(circle, ${GREEN} 0%, transparent 70%)`,
          animationDuration: '18s',
          animationDelay: '-6s',
        }}
      />

      {/* Os feixes verticais: o movimento propriamente dito. */}
      <div className="absolute inset-0 blur-[26px]">
        {BEAMS.map((beam) => (
          <div
            key={beam.left}
            className="absolute inset-y-0 overflow-hidden"
            style={{ left: beam.left, width: beam.width }}
          >
            <div
              className={cn(
                'h-[200%] w-full',
                beam.direction === 'down' ? 'animate-flow-down' : 'animate-flow-up',
              )}
              style={{ ...flowingGradient(beamStops(beam.color)), animationDuration: beam.duration }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Fio vertical de cor correndo sem parar — a versão discreta da aurora, para
 * a borda da barra lateral e para as telas onde não cabe um painel inteiro.
 */
export function AuroraRail({
  className,
  direction = 'down',
  duration = '11s',
}: {
  className?: string;
  direction?: 'down' | 'up';
  duration?: string;
}) {
  return (
    <span className={cn('pointer-events-none block overflow-hidden', className)} aria-hidden>
      <span
        className={cn(
          'block h-[200%] w-full',
          direction === 'down' ? 'animate-flow-down' : 'animate-flow-up',
        )}
        style={{
          ...flowingGradient(
            `transparent 0%, ${GREEN}00 6%, ${GREEN} 18%, ${LIME} 34%, ${BLUE} 50%, ${LIME} 66%, ${GREEN} 82%, ${GREEN}00 94%, transparent 100%`,
          ),
          animationDuration: duration,
        }}
      />
    </span>
  );
}
