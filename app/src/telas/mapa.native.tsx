import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  NavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import {
  Camera,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';

import type { RootStackParamList } from '../navegacao/rotas';
import {
  listarOcorrenciasMapa,
  OcorrenciaMapa,
} from '../servicos/mapa';

const ESTILO_MAPA =
  'https://tiles.openfreemap.org/styles/liberty';

const CENTRO_INICIAL: [number, number] = [
  -35.211,
  -5.7945,
];

function simboloStatus(
  status: OcorrenciaMapa['status']
) {
  switch (status) {
    case 'PENDENTE_VALIDACAO':
      return '?';
    case 'ATIVA':
      return '!';
    case 'RESOLVIDA':
      return '✓';
  }
}

export default function Mapa() {
  const navigation =
    useNavigation<NavigationProp<RootStackParamList>>();

  const [ocorrencias, setOcorrencias] = useState<
    OcorrenciaMapa[]
  >([]);

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

          if (ativo) {
            setOcorrencias(dados);
          }
        } catch (error) {
          if (error instanceof Error) {
            console.error(error.message);
          }

          if (ativo) {
            setErro(
              'Não foi possível carregar as ocorrências.'
            );
          }
        } finally {
          if (ativo) {
            setCarregando(false);
          }
        }
      }

      carregarOcorrencias();

      return () => {
        ativo = false;
      };
    }, [])
  );

  if (carregando) {
    return (
      <View style={styles.centralizado}>
        <ActivityIndicator />

        <Text style={styles.mensagem}>
          Carregando ocorrências...
        </Text>
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.centralizado}>
        <Text style={styles.mensagem}>
          {erro}
        </Text>
      </View>
    );
  }

  return (
    <Map
      style={styles.mapa}
      mapStyle={ESTILO_MAPA}
    >
      <Camera
        initialViewState={{
          center: CENTRO_INICIAL,
          zoom: 10,
        }}
      />

      {ocorrencias.map((ocorrencia) => (
        <Marker
          key={ocorrencia.id}
          id={ocorrencia.id}
          lngLat={[
            ocorrencia.longitude,
            ocorrencia.latitude,
          ]}
          anchor="bottom"
          onPress={() => {
            navigation.navigate('Ocorrencia', {
              ocorrenciaId: ocorrencia.id,
            });
          }}
        >
          <View
            style={[
              styles.marcador,
              ocorrencia.status === 'PENDENTE_VALIDACAO' &&
                styles.marcadorPendente,
              ocorrencia.status === 'ATIVA' &&
                styles.marcadorAtiva,
              ocorrencia.status === 'RESOLVIDA' &&
                styles.marcadorResolvida,
            ]}
          >
            <Text style={styles.textoMarcador}>
              {simboloStatus(ocorrencia.status)}
            </Text>
          </View>
        </Marker>
      ))}
    </Map>
  );
}

const styles = StyleSheet.create({
  mapa: {
    flex: 1,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  mensagem: {
    textAlign: 'center',
    marginTop: 12,
  },

  marcador: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  marcadorPendente: {
    backgroundColor: '#666666',
  },

  marcadorAtiva: {
    backgroundColor: '#222222',
  },

  marcadorResolvida: {
    backgroundColor: '#2e7d32',
  },

  textoMarcador: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
