import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Text as TextoBase, TextInput as CampoBase, View,
  type TextProps, type TextInputProps } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Modo = 'claro' | 'escuro';
const CHAVE = 'acessaurban.aparencia';
const PALETAS = {
  claro: { fundo: '#EAE8DB', cartao: '#FFFFFF', texto: '#333229', secundario: '#55564E',
    borda: '#CAC6B8', botao: '#0F2C40', textoBotao: '#FFFFFF', laranja: '#F4663A', azul: '#0F2C40', perigo: '#A32B20' },
  escuro: { fundo: '#0F2C40', cartao: '#1B3B50', texto: '#EAE8DB', secundario: '#BECDD3',
    borda: '#4C6878', botao: '#F4663A', textoBotao: '#0F2C40', laranja: '#F4663A', azul: '#EAE8DB', perigo: '#FF9B8B' },
};
export type CoresTema = typeof PALETAS.claro;
const Contexto = createContext<{ modo: Modo; cores: CoresTema; selecionarModo: (modo: Modo) => void } | null>(null);

export function TemaProvider({ children }: { children: ReactNode }) {
  const [modo, setModo] = useState<Modo | null>(null);
  const opacidade = useRef(new Animated.Value(1)).current;
  const animando = useRef(false);

  useEffect(() => {
    let ativo = true;
    AsyncStorage.getItem(CHAVE)
      .then((valor) => { if (ativo) setModo(valor === 'escuro' ? 'escuro' : 'claro'); })
      .catch(() => { if (ativo) setModo('claro'); });
    return () => { ativo = false; };
  }, []);

  function selecionarModo(novo: Modo) {
    if (!modo || animando.current || novo === modo) return;
    animando.current = true;
    Animated.timing(opacidade, { toValue: 0.25, duration: 130, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) { animando.current = false; return; }
      setModo(novo);
      void AsyncStorage.setItem(CHAVE, novo).catch(() => {});
      Animated.timing(opacidade, { toValue: 1, duration: 240, useNativeDriver: true })
        .start(() => { animando.current = false; });
    });
  }

  const atual = modo ?? 'claro';
  return <Contexto.Provider value={{ modo: atual, cores: PALETAS[atual], selecionarModo }}>
    <View style={{ flex: 1, backgroundColor: PALETAS[atual].fundo }}>
      {modo && <Animated.View style={{ flex: 1, opacity: opacidade }}>{children}</Animated.View>}
    </View>
  </Contexto.Provider>;
}

export function useTema() {
  const tema = useContext(Contexto);
  if (!tema) throw new Error('useTema requer TemaProvider');
  return tema;
}

export function definirEstilos<T>(criar: (cores: CoresTema) => T): () => T {
  const claro = criar(PALETAS.claro), escuro = criar(PALETAS.escuro);
  return () => useTema().modo === 'escuro' ? escuro : claro;
}

export function Texto({ style, ...props }: TextProps) {
  return <TextoBase {...props} style={[{ color: useTema().cores.texto }, style]} />;
}

export function Campo({ style, placeholderTextColor, selectionColor, ...props }: TextInputProps) {
  const { cores } = useTema();
  return <CampoBase {...props} placeholderTextColor={placeholderTextColor ?? cores.secundario}
    selectionColor={selectionColor ?? cores.laranja} style={[{ color: cores.texto, backgroundColor: cores.cartao }, style]} />;
}
