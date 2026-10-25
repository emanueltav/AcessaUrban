import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { NavigationProp, useNavigation } from '@react-navigation/native';

import type { RootStackParamList } from '../navegacao/rotas';
import { definirEstilos, Texto as Text } from '../contextos/tema';
import { useDadosMapa } from '../hooks/useDadosMapa';
import type { OcorrenciaMapa } from '../servicos/mapa';

const TITULOS: Record<OcorrenciaMapa['status'], string> = {
  PENDENTE_VALIDACAO: 'Aguardando validação',
  ATIVA: 'Ativa',
  RESOLVIDA: 'Resolvida recentemente',
};

export default function Mapa() {
  const styles = useEstilos();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { ocorrencias, pracas, carregando, erro, erroPracas } = useDadosMapa();

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
      <Text style={styles.titulo}>Ocorrências e praças</Text>
      <Text style={styles.aviso}>
        O mapa interativo é exibido no aplicativo móvel. No navegador,
        veja as ocorrências atuais, as resolvidas recentemente e as praças aprovadas.
      </Text>
      <Pressable style={styles.explorarPracas} onPress={() => navigation.navigate('Pracas')}>
        <Text style={styles.textoExplorar}>Explorar praças</Text>
      </Pressable>

      <FlatList
        data={ocorrencias}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.mensagem}>Nenhuma ocorrência disponível.</Text>}
        renderItem={({ item }) => <View style={styles.item}>
          <Text style={styles.nome}>{item.categoria}</Text>
          <Text>Gravidade: {item.gravidade}</Text>
          <Text>Status: {TITULOS[item.status]}</Text>
          {item.bairro && <Text>{item.bairro.nome} — {item.bairro.municipio}/{item.bairro.uf}</Text>}
          {item.descricao && <Text style={styles.descricao}>{item.descricao}</Text>}
        </View>}
        ListFooterComponent={<View style={styles.listaPracas}>
          <Text style={styles.nome}>Praças aprovadas</Text>
          {!!erroPracas && <Text>{erroPracas}</Text>}
          {!pracas.length && !erroPracas && <Text>Nenhuma praça aprovada disponível.</Text>}
          {pracas.map((praca) => <View key={praca.id} style={styles.item}>
            <Text style={styles.nome}>🌳 {praca.nome}</Text>
            {praca.bairro && <Text>{praca.bairro.nome} — {praca.bairro.municipio}/{praca.bairro.uf}</Text>}
            <Text>{praca.media === null ? 'Sem avaliações' : `★ ${praca.media.toFixed(1)} (${praca.totalAvaliacoes})`}</Text>
          </View>)}
        </View>}
      />
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
  listaPracas: { gap: 8, marginTop: 20 },
  item: {
    borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 8, padding: 12,
  },
  nome: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  descricao: { marginTop: 6 },
  mensagem: { textAlign: 'center', marginTop: 12 },
}));
