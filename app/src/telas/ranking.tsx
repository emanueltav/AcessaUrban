import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAutenticacao } from '../contextos/autenticacao';
import { definirEstilos, Texto as Text } from '../contextos/tema';
import { buscarPerfil } from '../servicos/perfil';
import { supabase } from '../servicos/supabase';

type Bairro = {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  nota_atual: number;
  posicao: number;
};

function adicionarPosicoes(bairros: Omit<Bairro, 'posicao'>[]): Bairro[] {
  let posicao = 1;
  return bairros.map((bairro, indice) => {
    if (indice > 0 && bairro.nota_atual !== bairros[indice - 1].nota_atual) {
      posicao = indice + 1;
    }
    return { ...bairro, posicao };
  });
}

export default function Ranking() {
  const styles = useEstilos();
  const usuarioId = useAutenticacao().sessao?.user.id ?? null;
  const [bairros, setBairros] = useState<Bairro[]>([]);
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
          .select('id, nome, municipio, uf, nota_atual')
          .order('nota_atual', { ascending: false })
          .order('municipio', { ascending: true })
          .order('nome', { ascending: true });

        if (!ativo) return;
        if (error) throw error;

        setBairros(adicionarPosicoes((data ?? []).map((bairro) => ({
          id: String(bairro.id),
          nome: String(bairro.nome),
          municipio: String(bairro.municipio),
          uf: String(bairro.uf),
          nota_atual: Number(bairro.nota_atual),
        }))));

        let bairroId: string | null = null;
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

  if (carregando || erro) return (
    <View style={styles.centralizado}>
      {carregando ? <ActivityIndicator /> : <Text style={styles.titulo}>Ranking de Bairros</Text>}
      <Text style={styles.mensagem}>{erro || 'Carregando ranking...'}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Ranking de Bairros</Text>
      <FlatList
        data={bairros}
        keyExtractor={(bairro) => bairro.id}
        contentContainerStyle={styles.lista}
        ListEmptyComponent={<Text style={styles.mensagem}>Nenhum bairro cadastrado.</Text>}
        renderItem={({ item }) => {
          const meuBairro = item.id === bairroUsuarioId;
          return (
            <View style={[styles.item, meuBairro && styles.itemMeuBairro]}>
              <View style={styles.posicao}>
                <Text style={styles.textoPosicao}>{item.posicao}º</Text>
              </View>
              <View style={styles.informacoes}>
                <Text style={styles.nome}>{meuBairro ? '🏠 ' : ''}{item.nome}</Text>
                <Text style={styles.local}>{item.municipio}/{item.uf}</Text>
                {meuBairro && <Text style={styles.textoMeuBairro}>Meu bairro</Text>}
              </View>
              <Text style={styles.nota}>{item.nota_atual.toFixed(1)}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const useEstilos = definirEstilos((c) => StyleSheet.create({
  container: { flex: 1, padding: 24 },
  centralizado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  titulo: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  lista: { gap: 8, paddingBottom: 24 },
  item: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 8, padding: 12 },
  itemMeuBairro: { borderColor: c.laranja, backgroundColor: c.cartao },
  posicao: { width: 45 },
  textoPosicao: { fontSize: 16, fontWeight: 'bold' },
  informacoes: { flex: 1 },
  nome: { fontSize: 16, fontWeight: 'bold' },
  local: { marginTop: 2 },
  textoMeuBairro: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  nota: { fontSize: 18, fontWeight: 'bold' },
  mensagem: { textAlign: 'center', marginTop: 12 },
}));
