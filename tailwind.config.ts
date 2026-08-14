import type { Config } from 'tailwindcss';

/**
 * Paleta institucional Grupo Moreno
 * ---------------------------------
 * Verde escuro  #0E8F46  -> hsl(146 82% 31%)  | FORTALECER
 * Verde claro   #8CC63F  -> hsl(86 54% 51%)   | CONECTAR
 * Azul          #1B3F94  -> hsl(222 69% 34%)  | CRESCER
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1440px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          muted: 'hsl(var(--sidebar-muted))',
          accent: 'hsl(var(--sidebar-accent))',
          border: 'hsl(var(--sidebar-border))',
        },
        /** Cores fixas da marca — usar para logotipo, selos e destaques institucionais. */
        moreno: {
          green: {
            50: 'hsl(146 60% 96%)',
            100: 'hsl(146 58% 90%)',
            200: 'hsl(146 55% 79%)',
            300: 'hsl(146 55% 65%)',
            400: 'hsl(146 62% 48%)',
            500: 'hsl(146 82% 31%)',
            600: 'hsl(146 84% 26%)',
            700: 'hsl(146 86% 21%)',
            800: 'hsl(146 88% 16%)',
            900: 'hsl(146 90% 12%)',
          },
          lime: {
            50: 'hsl(86 60% 96%)',
            100: 'hsl(86 58% 90%)',
            200: 'hsl(86 56% 80%)',
            300: 'hsl(86 55% 68%)',
            400: 'hsl(86 54% 58%)',
            500: 'hsl(86 54% 51%)',
            600: 'hsl(86 56% 42%)',
            700: 'hsl(86 58% 33%)',
            800: 'hsl(86 58% 26%)',
            900: 'hsl(86 58% 19%)',
          },
          blue: {
            50: 'hsl(222 70% 96%)',
            100: 'hsl(222 70% 91%)',
            200: 'hsl(222 70% 82%)',
            300: 'hsl(222 70% 70%)',
            400: 'hsl(222 69% 53%)',
            500: 'hsl(222 69% 34%)',
            600: 'hsl(222 72% 29%)',
            700: 'hsl(222 75% 24%)',
            800: 'hsl(222 78% 18%)',
            900: 'hsl(222 80% 13%)',
          },
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
          6: 'hsl(var(--chart-6))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 hsl(222 40% 12% / 0.04), 0 1px 3px 0 hsl(222 40% 12% / 0.06)',
        'card-hover': '0 4px 12px -2px hsl(222 40% 12% / 0.10), 0 2px 6px -2px hsl(222 40% 12% / 0.06)',
        brand: '0 8px 24px -8px hsl(222 69% 34% / 0.45)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(120deg, hsl(146 82% 31%) 0%, hsl(86 54% 51%) 52%, hsl(222 69% 34%) 100%)',
        'gradient-brand-soft':
          'linear-gradient(120deg, hsl(146 82% 31% / 0.12) 0%, hsl(86 54% 51% / 0.12) 52%, hsl(222 69% 34% / 0.12) 100%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 hsl(146 82% 31% / 0.45)' },
          '70%': { boxShadow: '0 0 0 8px hsl(146 82% 31% / 0)' },
          '100%': { boxShadow: '0 0 0 0 hsl(146 82% 31% / 0)' },
        },
        /**
         * Aurora da marca. O elemento tem o dobro da altura do container e um
         * degradê que se repete a cada metade dele, então andar 50% recoloca o
         * padrão exatamente onde começou — laço contínuo, sem emenda visível.
         */
        'flow-down': {
          from: { transform: 'translate3d(0, -50%, 0)' },
          to: { transform: 'translate3d(0, 0, 0)' },
        },
        'flow-up': {
          from: { transform: 'translate3d(0, 0, 0)' },
          to: { transform: 'translate3d(0, -50%, 0)' },
        },
        'aurora-drift': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)', opacity: '0.5' },
          '50%': { transform: 'translate3d(0, -8%, 0) scale(1.15)', opacity: '0.85' },
        },
        /**
         * O balanço da cortina: a faixa inteira vai e vem de lado, entortando
         * um pouco e esticando na vertical, como tecido pendurado pegando
         * vento. Anda no elemento de fora, enquanto a cor corre no de dentro.
         */
        curtain: {
          '0%, 100%': { transform: 'translate3d(-5%, 0, 0) skewX(-2.5deg) scaleY(1)' },
          '50%': { transform: 'translate3d(5%, 0, 0) skewX(2.5deg) scaleY(1.06)' },
        },
        /**
         * O manifesto da marca: FORTALECER, CONECTAR, CRESCER e a assinatura.
         *
         * Um laço só, de 9s, usado pelos quatro elementos — o que muda entre
         * eles é o `animation-delay`, e é dele que vem a entrada em sequência.
         * Como a duração é a mesma para todos, o descompasso é o mesmo para
         * sempre: entram um por vez, ficam juntos no alto do ciclo e saem na
         * mesma ordem em que chegaram.
         *
         * O estado final é invisível de propósito, e o `backwards` do
         * atalho de animação é o que segura cada um escondido durante o seu
         * atraso. Sem ele os quatro apareceriam de cara na primeira volta.
         */
        'reveal-word': {
          '0%': { opacity: '0', transform: 'translate3d(0, 16px, 0) scale(0.96)' },
          '7%': { opacity: '1', transform: 'translate3d(0, 0, 0) scale(1)' },
          '55%': { opacity: '1', transform: 'translate3d(0, 0, 0) scale(1)' },
          '62%': { opacity: '0', transform: 'translate3d(0, -10px, 0) scale(0.98)' },
          '100%': { opacity: '0', transform: 'translate3d(0, -10px, 0) scale(0.98)' },
        },
        /**
         * A mesma ideia, mas para quando os quatro textos dividem um lugar só
         * — a linha da barra lateral. Aqui não dá para acumular: cada um tem
         * um quarto do ciclo (2,25s dos 9s) e precisa sair antes do próximo
         * entrar, senão viram um borrão em cima do outro. Entra por baixo e
         * sai por cima, como letreiro rolando.
         */
        'roll-item': {
          '0%': { opacity: '0', transform: 'translate3d(0, 100%, 0)' },
          '4%': { opacity: '1', transform: 'translate3d(0, 0, 0)' },
          '21%': { opacity: '1', transform: 'translate3d(0, 0, 0)' },
          '25%': { opacity: '0', transform: 'translate3d(0, -100%, 0)' },
          '100%': { opacity: '0', transform: 'translate3d(0, -100%, 0)' },
        },
        /**
         * Entrada dos blocos do mural de TV. Roda uma vez por lâmina — a
         * lâmina é remontada a cada troca, e isso basta para a animação
         * recomeçar. O escalonamento vem do `animation-delay` de cada bloco.
         */
        'tv-rise': {
          from: { opacity: '0', transform: 'translate3d(0, 32px, 0) scale(0.98)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0) scale(1)' },
        },
        /** Barra que mostra quanto falta para a próxima lâmina. */
        'tv-progress': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        /** Respiro lento dos números grandes — a tela nunca fica totalmente parada. */
        'tv-breathe': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -6px, 0)' },
        },
        /** A assinatura chega abrindo as letras, não subindo como as palavras. */
        'reveal-phrase': {
          '0%': { opacity: '0', letterSpacing: '0.05em' },
          '9%': { opacity: '1', letterSpacing: '0.28em' },
          '55%': { opacity: '1', letterSpacing: '0.28em' },
          '62%': { opacity: '0', letterSpacing: '0.32em' },
          '100%': { opacity: '0', letterSpacing: '0.32em' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.8s infinite',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        'flow-down': 'flow-down 7s linear infinite',
        'flow-up': 'flow-up 7s linear infinite',
        // Vai e volta: a cor sobe e desce, sem repuxar no fim do laço.
        'sway-down': 'flow-down 6s ease-in-out infinite alternate',
        'sway-up': 'flow-up 6s ease-in-out infinite alternate',
        'aurora-drift': 'aurora-drift 9s ease-in-out infinite',
        curtain: 'curtain 8s ease-in-out infinite',
        // `backwards` mantém cada elemento escondido enquanto o atraso corre.
        'reveal-word': 'reveal-word 9s ease-in-out infinite backwards',
        'reveal-phrase': 'reveal-phrase 9s ease-in-out infinite backwards',
        'roll-item': 'roll-item 9s ease-in-out infinite backwards',
        'tv-rise': 'tv-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) backwards',
        'tv-progress': 'tv-progress linear forwards',
        'tv-breathe': 'tv-breathe 7s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
