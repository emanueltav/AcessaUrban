import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { listarOcorrenciasMapa, type OcorrenciaMapa } from '../servicos/mapa';
import { listarPracasMapa, type PracaMapa } from '../servicos/pracas';

export function useDadosMapa() {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaMapa[]>([]);
  const [pracas, setPracas] = useState<PracaMapa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [erroPracas, setErroPracas] = useState('');

  useFocusEffect(useCallback(() => {
    let ativo = true;
    async function carregar() {
      setErro(''); setErroPracas('');
      const [oc, pr] = await Promise.allSettled([listarOcorrenciasMapa(), listarPracasMapa()]);
      if (!ativo) return;
      if (oc.status === 'fulfilled') setOcorrencias(oc.value);
      else {
        console.error('Erro ao carregar ocorrências:', oc.reason);
        setErro('Não foi possível carregar as ocorrências.');
      }
      if (pr.status === 'fulfilled') setPracas(pr.value);
      else {
        console.error('Erro ao carregar praças:', pr.reason);
        setPracas([]);
        setErroPracas('Não foi possível carregar as praças.');
      }
      setCarregando(false);
    }
    void carregar();
    return () => { ativo = false; };
  }, []));

  return { ocorrencias, pracas, carregando, erro, erroPracas };
}
