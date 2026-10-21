import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';

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

export default function Mapa() {
  const [ocorrencias, setOcorrencias] = useState<
    OcorrenciaMapa[]
  >([]);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregarOcorrencias() {
      try {
        setCarregando(true);
        setErro('');

        const dados = await listarOcorrenciasMapa();

        setOcorrencias(dados);
      } catch (error) {
        if (error instanceof Error) {
          console.error(error.message);
        }

        setErro(
          'Não foi possível carregar as ocorrências.'
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarOcorrencias();
  }, []);

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
        >
          <View style={styles.marcador}>
            <Text style={styles.textoMarcador}>!</Text>
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
    backgroundColor: '#222222',
    borderWidth: 2,
    borderColor: '#ffffff',
  },

  textoMarcador: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});