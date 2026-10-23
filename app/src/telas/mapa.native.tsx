import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';

import type { RootStackParamList } from '../navegacao/rotas';
import { listarOcorrenciasMapa, OcorrenciaMapa } from '../servicos/mapa';

const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/liberty';
const CENTRO_INICIAL: [number, number] = [-35.211, -5.7945];

const SIMBOLOS: Record<OcorrenciaMapa['status'], string> = {
  PENDENTE_VALIDACAO: '?',
  ATIVA: '!',
  RESOLVIDA: '✓',
};

export default function Mapa() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaMapa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregarOcorrencias() {
        try {
          setCarregando(true);
          setErro('');
          const dados = await listarOcorrenciasMapa();
          if (ativo) setOcorrencias(dados);
        } catch (error) {
          console.error('Erro ao carregar mapa:', error);
          if (ativo) setErro('Não foi possível carregar as ocorrências.');
        } finally {
          if (ativo) setCarregando(false);
        }
      }

      carregarOcorrencias();
      return () => { ativo = false; };
    }, [])
  );

  if (carregando || erro) {
    return (
      <View style={styles.centralizado}>
        {carregando ? <ActivityIndicator /> : null}
        <Text style={styles.mensagem}>
          {erro || 'Carregando ocorrências...'}
        </Text>
      </View>
    );
  }

  return (
    <Map style={styles.mapa} mapStyle={ESTILO_MAPA}>
      <Camera initialViewState={{ center: CENTRO_INICIAL, zoom: 10 }} />

      {ocorrencias.map((ocorrencia) => (
        <Marker
          key={ocorrencia.id}
          id={ocorrencia.id}
          lngLat={[ocorrencia.longitude, ocorrencia.latitude]}
          anchor="bottom"
          onPress={() => navigation.navigate('Ocorrencia', {
            ocorrenciaId: ocorrencia.id,
          })}
        >
          <View style={[
            styles.marcador,
            ocorrencia.status === 'PENDENTE_VALIDACAO' && styles.marcadorPendente,
            ocorrencia.status === 'ATIVA' && styles.marcadorAtiva,
            ocorrencia.status === 'RESOLVIDA' && styles.marcadorResolvida,
          ]}>
            <Text style={styles.textoMarcador}>{SIMBOLOS[ocorrencia.status]}</Text>
          </View>
        </Marker>
      ))}
    </Map>
  );
}

const styles = StyleSheet.create({
  mapa: { flex: 1 },
  centralizado: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  mensagem: { textAlign: 'center', marginTop: 12 },
  marcador: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff',
  },
  marcadorPendente: { backgroundColor: '#666666' },
  marcadorAtiva: { backgroundColor: '#222222' },
  marcadorResolvida: { backgroundColor: '#2e7d32' },
  textoMarcador: { color: '#ffffff', fontWeight: 'bold' },
});
