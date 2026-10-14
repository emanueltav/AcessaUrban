import { StyleSheet, Text, View } from 'react-native';

export default function Ranking() {
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Ranking de Bairros</Text>
      <Text>As notas dos bairros serão exibidas aqui.</Text>
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