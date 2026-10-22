import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  listarOcorrenciasMapa,
  OcorrenciaMapa,
} from '../servicos/mapa';

function tituloStatus(
  status: OcorrenciaMapa['status']
) {
  switch (status) {
    case 'PENDENTE_VALIDACAO':
      return 'Aguardando validação';
    case 'ATIVA':
      return 'Ativa';
    case 'RESOLVIDA':
      return 'Resolvida recentemente';
  }
}

export default function Mapa() {
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
        <Text style={styles.titulo}>
          Mapa de Ocorrências
        </Text>

        <Text style={styles.mensagem}>
          {erro}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>
        Mapa de Ocorrências
      </Text>

      <Text style={styles.aviso}>
        O mapa interativo será exibido no aplicativo móvel.
        No navegador, as ocorrências atuais e as resolvidas
        nos últimos 30 dias são listadas abaixo.
      </Text>

      {ocorrencias.length === 0 ? (
        <Text style={styles.mensagem}>
          Nenhuma ocorrência disponível.
        </Text>
      ) : (
        <FlatList
          data={ocorrencias}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.nome}>
                {item.categoria}
              </Text>

              <Text>
                Gravidade: {item.gravidade}
              </Text>

              <Text>
                Status: {tituloStatus(item.status)}
              </Text>

              {item.bairro ? (
                <Text>
                  {item.bairro.nome} —{' '}
                  {item.bairro.municipio}/{item.bairro.uf}
                </Text>
              ) : null}

              {item.descricao ? (
                <Text style={styles.descricao}>
                  {item.descricao}
                </Text>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },

  aviso: {
    textAlign: 'center',
    marginBottom: 20,
  },

  lista: {
    gap: 8,
    paddingBottom: 24,
  },

  item: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
  },

  nome: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  descricao: {
    marginTop: 6,
  },

  mensagem: {
    textAlign: 'center',
    marginTop: 12,
  },
});
