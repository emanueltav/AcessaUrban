import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { definirEstilos, Texto as Text } from '../contextos/tema';

type Props = {
  titulo: string;
  mensagem: string | null;
  confirmarTexto: string;
  confirmar: () => void;
  cancelar?: () => void;
  destrutivo?: boolean;
};

export default function Aviso({ titulo, mensagem, confirmarTexto, confirmar, cancelar, destrutivo }: Props) {
  const styles = useEstilos();
  return <Modal visible={mensagem !== null} transparent animationType="fade"
    onRequestClose={cancelar ?? confirmar}>
    <View style={styles.camada}>
      <Pressable style={StyleSheet.absoluteFill} onPress={cancelar ?? confirmar}
        accessibilityRole="button" accessibilityLabel="Fechar aviso" />
      <View style={styles.cartao}>
        <Text style={styles.etiqueta}>ATENÇÃO</Text>
        <Text style={styles.titulo}>{titulo}</Text>
        <Text style={styles.mensagem}>{mensagem}</Text>
        <Pressable style={[styles.botao, destrutivo && styles.destrutivo]} onPress={confirmar}
          accessibilityRole="button">
          <Text style={styles.textoBotao}>{confirmarTexto}</Text>
        </Pressable>
        {cancelar && <Pressable style={styles.cancelar} onPress={cancelar} accessibilityRole="button">
          <Text style={styles.textoCancelar}>Cancelar</Text>
        </Pressable>}
      </View>
    </View>
  </Modal>;
}

const useEstilos = definirEstilos((c) => StyleSheet.create({
  camada: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  cartao: { backgroundColor: c.cartao, borderRadius: 20, padding: 22, gap: 12, elevation: 8 },
  etiqueta: { color: c.laranja, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  titulo: { fontSize: 21, fontWeight: '700' },
  mensagem: { color: c.secundario, fontSize: 15, lineHeight: 23, marginBottom: 6 },
  botao: { backgroundColor: c.botao, borderRadius: 12, padding: 14 },
  destrutivo: { backgroundColor: c.perigo },
  textoBotao: { color: c.textoBotao, fontWeight: '700', textAlign: 'center' },
  cancelar: { borderWidth: 1, borderColor: c.borda, borderRadius: 12, padding: 13 },
  textoCancelar: { fontWeight: '600', textAlign: 'center' },
}));
