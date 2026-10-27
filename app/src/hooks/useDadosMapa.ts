import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { LIMITE_MARCADORES, listarOcorrenciasMapa,
  type LimitesMapa, type OcorrenciaMapa } from '../servicos/mapa';
import { listarPracasMapa, type PracaMapa } from '../servicos/pracas';

export function useDadosMapa(limites?: LimitesMapa | null) {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaMapa[]>([]);
  const [pracas, setPracas] = useState<PracaMapa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [erroPracas, setErroPracas] = useState('');
  const [excesso, setExcesso] = useState(false);

  useFocusEffect(useCallback(() => {
    if (limites === null) return;
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErro(''); setErroPracas('');
      const area = limites ?? undefined;
      const [oc, pr] = await Promise.allSettled([listarOcorrenciasMapa(area), listarPracasMapa(area)]);
      if (!ativo) return;
      const excedeu = (oc.status === 'fulfilled' && oc.value.length > LIMITE_MARCADORES) ||
        (pr.status === 'fulfilled' && pr.value.length > LIMITE_MARCADORES);
      setExcesso(excedeu);
      if (oc.status === 'fulfilled')
        setOcorrencias(oc.value.length > LIMITE_MARCADORES ? [] : oc.value);
      else {
        console.error('Erro ao carregar ocorrências:', oc.reason);
        setOcorrencias([]);
        setErro('Não foi possível carregar as ocorrências.');
      }
      if (pr.status === 'fulfilled')
        setPracas(pr.value.length > LIMITE_MARCADORES ? [] : pr.value);
      else {
        console.error('Erro ao carregar praças:', pr.reason);
        setPracas([]);
        setErroPracas('Não foi possível carregar as praças.');
      }
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, [limites]));

  return { ocorrencias, pracas, carregando, erro, erroPracas, excesso };
}
