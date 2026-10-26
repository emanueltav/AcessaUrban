import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAutenticacao } from '../contextos/autenticacao';
import { Campo as TextInput, definirEstilos, Texto as Text } from '../contextos/tema';
import { buscarPerfil } from '../servicos/perfil';
import { supabase } from '../servicos/supabase';

type Bairro = {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  nota_base: number;
  bonus_pracas: number;
  nota_atual: number;
  posicao: number;
};

const formatarNota = (nota: number) => nota.toFixed(2).replace('.', ',');
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function adicionarPosicoes(bairros: Omit<Bairro, 'posicao'>[]): Bairro[] {
  let posicao = 1;
  return bairros.map((bairro, indice) => {
    if (indice && bairro.nota_atual !== bairros[indice - 1].nota_atual) posicao = indice + 1;
    return { ...bairro, posicao };
  });
}

export default function Ranking() {
  const styles = useEstilos();
  const usuarioId = useAutenticacao().sessao?.user.id ?? null;
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [busca, setBusca] = useState('');
  const [bairroUsuarioId, setBairroUsuarioId] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useFocusEffect(useCallback(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErro('');
      try {
        const { data, error } = await supabase.from('bairros')
          .select('id, nome, municipio, uf, nota_base, bonus_pracas, nota_atual')
          .order('nota_atual', { ascending: false })
          .order('municipio', { ascending: true })
          .order('nome', { ascending: true });

        if (!ativo) return;
        if (error) throw error;
        setBairros(adicionarPosicoes((data ?? []).map((bairro) => ({
          ...bairro,
          nota_base: Number(bairro.nota_base),
          bonus_pracas: Number(bairro.bonus_pracas),
          nota_atual: Number(bairro.nota_atual),
        }))));
        setMostrarTodos(false);

        let bairroId = null;
        if (usuarioId) {
          try {
            bairroId = (await buscarPerfil(usuarioId)).bairro_id;
          } catch (errorPerfil) {
            console.error('Erro ao carregar bairro do perfil:', errorPerfil);
          }
        }
        if (ativo) setBairroUsuarioId(bairroId);
      } catch (error) {
        console.error('Erro ao carregar ranking:', error);
        if (ativo) setErro('Não foi possível carregar o ranking.');
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    void carregar();
    return () => { ativo = false; };
  }, [usuarioId]));

  const pesquisa = normalizar(busca.trim());
  const resultados = pesquisa
    ? bairros.filter((bairro) => normalizar(`${bairro.nome} ${bairro.municipio}`).includes(pesquisa))
    : mostrarTodos ? bairros : bairros.slice(0, 10);
  if (carregando || erro) return (
    <View style={styles.centralizado}>
      {carregando ? <ActivityIndicator /> : <Text style={styles.titulo}>Ranking de Bairros</Text>}
      <Text style={styles.mensagem}>{erro || 'Carregando ranking...'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Ranking de Bairros</Text>
      <Text style={styles.explicacao}>A nota final considera ocorrências e bônus das praças, até 5 pontos.</Text>
      <TextInput placeholder="Buscar bairro ou município" style={styles.busca}
        value={busca} onChangeText={setBusca} autoCorrect={false} />
      <FlatList
        data={resultados}
        keyExtractor={(bairro) => bairro.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.mensagem}>
          {pesquisa ? 'Nenhum bairro encontrado.' : 'Nenhum bairro cadastrado.'}
        </Text>}
        ListFooterComponent={!pesquisa && !mostrarTodos && bairros.length > 10 ? (
          <Pressable style={styles.verMais} onPress={() => setMostrarTodos(true)}>
            <Text style={styles.textoVerMais}>Ver mais bairros</Text>
          </Pressable>
        ) : null}
        renderItem={({ item }) => {
          const meuBairro = item.id === bairroUsuarioId;
          return <View style={[styles.item, meuBairro && styles.itemMeuBairro]}>
            <View style={styles.posicao}>
              <Text style={styles.textoPosicao}>{item.posicao}º</Text>
            </View>
            <View style={styles.informacoes}>
              <Text style={styles.nome}>{meuBairro ? '🏠 ' : ''}{item.nome}</Text>
              <Text style={styles.local}>{item.municipio}/{item.uf}</Text>
              <Text style={styles.detalheNota}>Base {formatarNota(item.nota_base)} · Praças +{formatarNota(item.bonus_pracas)}</Text>
              {meuBairro && <Text style={styles.textoMeuBairro}>Meu bairro</Text>}
            </View>
            <View style={styles.notaFinal}>
              <Text style={styles.nota}>{formatarNota(item.nota_atual)}</Text>
              <Text style={styles.legendaNota}>Nota final</Text>
            </View>
          </View>;
        }}
      />
    </View>
  );
}

const useEstilos = definirEstilos((c) => StyleSheet.create({
  container: { flex: 1, padding: 24 },
  centralizado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: c.azul, textAlign: 'center', marginBottom: 6 },
  explicacao: { color: c.secundario, fontSize: 13, textAlign: 'center', marginBottom: 16 },
  busca: { borderWidth: 1, borderColor: c.borda, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  lista: { gap: 10, paddingBottom: 24 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1,
    borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 16, padding: 14 },
  itemMeuBairro: { borderColor: c.laranja, borderWidth: 2 },
  posicao: { width: 45 },
  textoPosicao: { fontSize: 18, fontWeight: 'bold', color: c.laranja },
  informacoes: { flex: 1 },
  nome: { fontSize: 17, fontWeight: 'bold', color: c.azul },
  local: { color: c.secundario, fontSize: 12, marginTop: 3 },
  detalheNota: { color: c.secundario, fontSize: 12, marginTop: 8 },
  textoMeuBairro: { color: c.laranja, marginTop: 4, fontSize: 12, fontWeight: '700' },
  notaFinal: { alignItems: 'center' },
  nota: { color: c.laranja, fontSize: 20, fontWeight: 'bold' },
  legendaNota: { color: c.secundario, fontSize: 11 },
  mensagem: { textAlign: 'center', marginTop: 12 },
  verMais: { alignSelf: 'center', backgroundColor: c.botao, borderRadius: 12,
    paddingHorizontal: 20, paddingVertical: 12, marginTop: 12 },
  textoVerMais: { color: c.textoBotao, fontWeight: '700' },
}));
