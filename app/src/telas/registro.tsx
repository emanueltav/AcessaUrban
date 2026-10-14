import { StyleSheet, Text, View } from 'react-native';

export default function Registro() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Registro de Ocorrência</Text>
      <Text>O formulário de registro será exibido aqui.</Text>
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
    marginBottom: 8,
  },
});