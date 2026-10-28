import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../servicos/supabase';

type AutenticacaoContexto = {
  sessao: Session | null;
  carregando: boolean;
};

const AutenticacaoContext = createContext<AutenticacaoContexto>({
  sessao: null,
  carregando: true,
});

type Props = {
  children: ReactNode;
};

export function AutenticacaoProvider({ children }: Props) {
  const [sessao, setSessao] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregarSessaoInicial() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (ativo) setSessao(data.session);
      } catch (error) {
        console.error('Erro ao carregar sessão:', error);
        if (ativo) setSessao(null);
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregarSessaoInicial();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      if (!ativo) return;
      setSessao(novaSessao);
      setCarregando(false);
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  return <AutenticacaoContext.Provider value={{ sessao, carregando }}>
    {children}
  </AutenticacaoContext.Provider>;
}

export function useAutenticacao() {
  return useContext(AutenticacaoContext);
}
