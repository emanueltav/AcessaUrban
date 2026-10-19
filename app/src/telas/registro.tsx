import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAutenticacao } from '../contextos/autenticacao';

export default function Registro() {
  const { sessao, carregando } = useAutenticacao();

  if (carregando) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!sessao) {
    return (
      <View style={styles.container}>
        <Text style={styles.titulo}>Registro de Ocorrência</Text>

        <Text style={styles.texto}>
          Entre na sua conta para registrar uma ocorrência.
        </Text>

        <Text style={styles.texto}>
          Use a aba Conta para fazer login ou criar seu cadastro.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Registro de Ocorrência</Text>

      <Text style={styles.texto}>
        Usuário autenticado: {sessao.user.email}
      </Text>

      <Text style={styles.texto}>
        O formulário de registro será implementado aqui.
      </Text>
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

  texto: {
    textAlign: 'center',
    marginBottom: 8,
  },
});