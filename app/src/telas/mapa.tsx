import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';

import type { RootStackParamList } from '../navegacao/rotas';
import { definirEstilos, Texto as Text } from '../contextos/tema';
import { listarOcorrenciasMapa, OcorrenciaMapa } from '../servicos/mapa';

const TITULOS: Record<OcorrenciaMapa['status'], string> = {
  PENDENTE_VALIDACAO: 'Aguardando validação',
  ATIVA: 'Ativa',
  RESOLVIDA: 'Resolvida recentemente',
};

export default function Mapa() {
  const styles = useEstilos();
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
          console.error('Erro ao carregar mapa web:', error);
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
        {carregando ? <ActivityIndicator /> : <Text style={styles.titulo}>Mapa de Ocorrências</Text>}
        <Text style={styles.mensagem}>
          {erro || 'Carregando ocorrências...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mapa de Ocorrências</Text>
      <Text style={styles.aviso}>
        O mapa interativo será exibido no aplicativo móvel.
        No navegador, as ocorrências atuais e as resolvidas
        nos últimos 30 dias são listadas abaixo.
      </Text>
      <Pressable style={styles.explorarPracas} onPress={() => navigation.navigate('Pracas')}>
        <Text style={styles.textoExplorar}>Explorar praças</Text>
      </Pressable>

      {ocorrencias.length === 0 ? (
        <Text style={styles.mensagem}>Nenhuma ocorrência disponível.</Text>
      ) : (
        <FlatList
          data={ocorrencias}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <Text style={styles.nome}>{item.categoria}</Text>
              <Text>Gravidade: {item.gravidade}</Text>
              <Text>Status: {TITULOS[item.status]}</Text>
              {item.bairro ? (
                <Text>{item.bairro.nome} — {item.bairro.municipio}/{item.bairro.uf}</Text>
              ) : null}
              {item.descricao ? (
                <Text style={styles.descricao}>{item.descricao}</Text>
              ) : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const useEstilos = definirEstilos((c) => StyleSheet.create({
  container: { flex: 1, padding: 24 },
  explorarPracas: { alignSelf: 'flex-start', backgroundColor: c.botao,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, marginBottom: 20 },
  textoExplorar: { color: c.textoBotao, fontWeight: '700' },
  centralizado: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  titulo: {
    fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 16,
  },
  aviso: { textAlign: 'center', marginBottom: 20 },
  lista: { gap: 8, paddingBottom: 24 },
  item: {
    borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 8, padding: 12,
  },
  nome: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  descricao: { marginTop: 6 },
  mensagem: { textAlign: 'center', marginTop: 12 },
}));
