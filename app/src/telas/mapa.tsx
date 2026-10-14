import { StyleSheet, Text, View } from 'react-native';

export default function Mapa() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mapa Interativo</Text>
      <Text>As ocorrências serão exibidas aqui.</Text>
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