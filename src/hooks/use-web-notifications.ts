'use client';

import * as React from 'react';

/**
 * Avisos do navegador — o balão que aparece no canto da tela mesmo quando a
 * pessoa está em outra aba.
 *
 * É a API `Notification` do próprio navegador, não uma janela do site: por
 * isso ela atravessa a aba. O preço é que o navegador manda nas regras — só
 * concede a permissão a partir de um clique, e uma vez negada não dá para
 * pedir de novo por código; a pessoa precisa liberar no cadeado da barra de
 * endereço.
 *
 * O que este arquivo NÃO faz: avisar com o navegador fechado. Isso é Web Push
 * (service worker + VAPID + servidor que empurra), outra empreitada. Aqui o
 * requisito é o que foi pedido — estar em outra aba, com o sistema aberto em
 * alguma delas.
 */

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

export interface WebNotificationInput {
  title: string;
  body?: string | null;
  /** Notificações com a mesma tag se substituem, em vez de empilhar. */
  tag?: string;
  /** Para onde levar quando a pessoa clica no balão. */
  href?: string;
}

/** Guardado aqui, e não no banco: é uma escolha do navegador, não da conta. */
const STORAGE_KEY = 'webdash:avisos-navegador';

function readPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationPermissionState;
}

export function useWebNotifications() {
  const [permission, setPermission] = React.useState<NotificationPermissionState>('unsupported');
  const [enabled, setEnabled] = React.useState(false);

  // Só depois de montar: no servidor não existe `Notification`, e ler no
  // primeiro render deixaria o HTML do servidor diferente do do navegador.
  React.useEffect(() => {
    setPermission(readPermission());
    setEnabled(window.localStorage.getItem(STORAGE_KEY) !== 'off');
  }, []);

  const setPreference = React.useCallback((next: boolean) => {
    setEnabled(next);
    window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off');
  }, []);

  /** Precisa sair de um clique — o navegador ignora o pedido fora dele. */
  const request = React.useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported' as const;

    const result = await Notification.requestPermission();
    setPermission(result as NotificationPermissionState);
    if (result === 'granted') setPreference(true);
    return result as NotificationPermissionState;
  }, [setPreference]);

  const show = React.useCallback(
    ({ title, body, tag, href }: WebNotificationInput) => {
      if (!enabled || readPermission() !== 'granted') return;

      try {
        // Sem `icon`: o projeto não publica um arquivo estático de ícone, e
        // apontar para um caminho que não existe deixa o balão com o quadrado
        // vazio do navegador.
        const notification = new Notification(title, { body: body ?? undefined, tag });

        notification.onclick = () => {
          window.focus();
          if (href) window.location.href = href;
          notification.close();
        };
      } catch {
        // Alguns navegadores exigem service worker para `new Notification`.
        // Não é motivo para derrubar o aviso dentro do app, que já apareceu.
      }
    },
    [enabled],
  );

  return {
    /** O que o navegador respondeu: `granted`, `denied`, `default`… */
    permission,
    /** Preferência da pessoa neste navegador, mesmo com permissão concedida. */
    enabled,
    setPreference,
    request,
    show,
    active: permission === 'granted' && enabled,
  };
}
