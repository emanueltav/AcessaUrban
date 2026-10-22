import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '../servicos/supabase';

type Bairro = {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
  nota_atual: number;
};

export default function Ranking() {
  const [bairros, setBairros] = useState<Bairro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useFocusEffect(
    useCallback(() => {
      let ativo = true;

      async function carregarRanking() {
        try {
          setCarregando(true);
          setErro('');

          const { data, error } = await supabase
            .from('bairros')
            .select(
              'id, nome, municipio, uf, nota_atual'
            )
            .order('nota_atual', {
              ascending: false,
            })
            .order('municipio', {
              ascending: true,
            })
            .order('nome', {
              ascending: true,
            });

          if (!ativo) {
            return;
          }

          if (error) {
            console.error(
              'Erro ao carregar ranking:',
              error
            );

            setErro(
              'Não foi possível carregar o ranking.'
            );

            return;
          }

          const bairrosFormatados: Bairro[] = (
            data ?? []
          ).map((bairro) => ({
            id: String(bairro.id),
            nome: String(bairro.nome),
            municipio: String(bairro.municipio),
            uf: String(bairro.uf),
            nota_atual: Number(bairro.nota_atual),
          }));

          setBairros(bairrosFormatados);
        } catch (error) {
          if (error instanceof Error) {
            console.error(error.message);
          }

          if (ativo) {
            setErro(
              'Não foi possível carregar o ranking.'
            );
          }
        } finally {
          if (ativo) {
            setCarregando(false);
          }
        }
      }

      carregarRanking();

      return () => {
        ativo = false;
      };
    }, [])
  );

  function obterPosicao(index: number) {
    if (index === 0) {
      return 1;
    }

    const bairroAtual = bairros[index];
    const bairroAnterior = bairros[index - 1];

    if (
      bairroAtual.nota_atual ===
      bairroAnterior.nota_atual
    ) {
      for (let i = index - 1; i >= 0; i -= 1) {
        if (
          bairros[i].nota_atual !==
          bairroAtual.nota_atual
        ) {
          return i + 2;
        }
      }

      return 1;
    }

    return index + 1;
  }

  if (carregando) {
    return (
      <View style={styles.centralizado}>
        <ActivityIndicator />

        <Text style={styles.mensagem}>
          Carregando ranking...
        </Text>
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.centralizado}>
        <Text style={styles.titulo}>
          Ranking de Bairros
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
        Ranking de Bairros
      </Text>

      {bairros.length === 0 ? (
        <Text style={styles.mensagem}>
          Nenhum bairro cadastrado.
        </Text>
      ) : (
        <FlatList
          data={bairros}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item, index }) => (
            <View style={styles.item}>
              <View style={styles.posicao}>
                <Text style={styles.textoPosicao}>
                  {obterPosicao(index)}º
                </Text>
              </View>

              <View style={styles.informacoes}>
                <Text style={styles.nome}>
                  {item.nome}
                </Text>

                <Text style={styles.local}>
                  {item.municipio}/{item.uf}
                </Text>
              </View>

              <Text style={styles.nota}>
                {item.nota_atual.toFixed(1)}
              </Text>
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
    marginBottom: 20,
  },

  lista: {
    gap: 8,
    paddingBottom: 24,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
  },

  posicao: {
    width: 45,
  },

  textoPosicao: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  informacoes: {
    flex: 1,
  },

  nome: {
    fontSize: 16,
    fontWeight: 'bold',
  },

  local: {
    marginTop: 2,
  },

  nota: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  mensagem: {
    textAlign: 'center',
    marginTop: 12,
  },
});