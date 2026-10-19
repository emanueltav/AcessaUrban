import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
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
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session);
      setCarregando(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao);
      setCarregando(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AutenticacaoContext.Provider value={{ sessao, carregando }}>
      {children}
    </AutenticacaoContext.Provider>
  );
}

export function useAutenticacao() {
  return useContext(AutenticacaoContext);
}