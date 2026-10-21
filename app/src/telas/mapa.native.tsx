import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  Marker,
  Region,
} from 'react-native-maps';

import {
  listarOcorrenciasMapa,
  OcorrenciaMapa,
} from '../servicos/mapa';

const regiaoInicial: Region = {
  latitude: -5.7945,
  longitude: -35.211,
  latitudeDelta: 0.5,
  longitudeDelta: 0.5,
};

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
    <MapView
      style={styles.mapa}
      initialRegion={regiaoInicial}
    >
      {ocorrencias.map((ocorrencia) => (
        <Marker
          key={ocorrencia.id}
          coordinate={{
            latitude: ocorrencia.latitude,
            longitude: ocorrencia.longitude,
          }}
          title={ocorrencia.categoria}
          description={
            ocorrencia.bairro
              ? `${ocorrencia.bairro.nome} — ${ocorrencia.bairro.municipio}/${ocorrencia.bairro.uf}`
              : ocorrencia.descricao ?? undefined
          }
        />
      ))}
    </MapView>
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
});