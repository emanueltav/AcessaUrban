import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { supabase } from '../servicos/supabase';

export default function Ranking() {
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    async function testarConexao() {
      const { data, error } = await supabase
        .from('bairros')
        .select('id, nome, nota_atual');

      if (error) {
        console.error('Erro ao consultar bairros:', error);
        setMensagem(`Erro: ${error.message}`);
      } else {
        console.log('Bairros recebidos:', data);

        if (data.length === 0) {
          setMensagem(
            'Conexão com o Supabase funcionando. Nenhum bairro cadastrado.'
          );
        } else {
          setMensagem(
            `Conexão funcionando. ${data.length} bairro(s) encontrado(s).`
          );
        }
      }

      setCarregando(false);
    }

    testarConexao();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Ranking de Bairros</Text>

      {carregando ? (
        <ActivityIndicator />
      ) : (
        <Text style={styles.mensagem}>{mensagem}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },

  mensagem: {
    textAlign: 'center',
  },
});