import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAutenticacao } from '../contextos/autenticacao';
import { registrarOcorrencia } from '../servicos/ocorrencias';

type Categoria = 'PAVIMENTACAO' | 'ILUMINACAO' | 'ESGOTO' | 'CALCAMENTO';
type Gravidade = 'LEVE' | 'MODERADO' | 'GRAVE';
type Coordenadas = { latitude: number; longitude: number };
type Opcao<T extends string> = { valor: T; titulo: string };

const categorias: Opcao<Categoria>[] = [
  { valor: 'PAVIMENTACAO', titulo: 'Pavimentação' }, { valor: 'ILUMINACAO', titulo: 'Iluminação' },
  { valor: 'ESGOTO', titulo: 'Esgoto' }, { valor: 'CALCAMENTO', titulo: 'Calçamento' },
];
const gravidades: Opcao<Gravidade>[] = [
  { valor: 'LEVE', titulo: 'Leve' }, { valor: 'MODERADO', titulo: 'Moderado' },
  { valor: 'GRAVE', titulo: 'Grave' },
];

function Opcoes<T extends string>({ itens, valor, selecionar, disabled }: {
  itens: Opcao<T>[]; valor: T | null; selecionar: (valor: T) => void; disabled: boolean;
}) {
  return <View style={styles.opcoes}>{itens.map((item) => (
    <Pressable key={item.valor} disabled={disabled} onPress={() => selecionar(item.valor)}
      style={[styles.opcao, valor === item.valor && styles.opcaoSelecionada]}>
      <Text style={[styles.textoOpcao, valor === item.valor && styles.textoOpcaoSelecionada]}>{item.titulo}</Text>
    </Pressable>
  ))}</View>;
}

export default function Registro() {
  const { sessao, carregando } = useAutenticacao();
  const [fotos, setFotos] = useState<string[]>([]);
  const [local, setLocal] = useState<Coordenadas | null>(null);
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [gravidade, setGravidade] = useState<Gravidade | null>(null);
  const [descricao, setDescricao] = useState('');
  const [obtendoLocalizacao, setObtendoLocalizacao] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const ocupado = enviando || obtendoLocalizacao;

  function limpar() {
    setFotos([]); setLocal(null); setCategoria(null); setGravidade(null); setDescricao(''); setMensagem('');
  }

  async function obterLocalizacao() {
    if (ocupado) return;
    setObtendoLocalizacao(true);
    setLocal(null);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return setMensagem('É necessário permitir o acesso à localização.');
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocal({ latitude: coords.latitude, longitude: coords.longitude });
      setMensagem('');
    } catch {
      setMensagem('Não foi possível obter sua localização.');
    } finally {
      setObtendoLocalizacao(false);
    }
  }

  async function tirarFoto() {
    if (ocupado) return;
    if (fotos.length >= 3) return setMensagem('Você pode adicionar no máximo 3 fotos.');
    try {
      setMensagem('');
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) return setMensagem('É necessário permitir o acesso à câmera.');
      const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (resultado.canceled) return;
      setFotos((atual) => [...atual, resultado.assets[0].uri]);
      if (!fotos.length) await obterLocalizacao();
    } catch {
      setMensagem('Não foi possível utilizar a câmera.');
    }
  }

  function removerFoto(indice: number) {
    const restantes = fotos.filter((_, i) => i !== indice);
    setFotos(restantes);
    if (!restantes.length) setLocal(null);
    setMensagem('');
  }

  async function registrar() {
    if (ocupado) return;
    const aviso = !sessao ? 'É necessário estar autenticado.'
      : !fotos.length ? 'Tire pelo menos uma foto do problema.'
      : !local ? 'A localização ainda não foi obtida.'
      : !categoria ? 'Selecione uma categoria.'
      : !gravidade ? 'Selecione a gravidade.'
      : !descricao.trim() ? 'Digite uma pequena descrição.' : '';
    if (aviso) return setMensagem(aviso);
    if (!sessao || !local || !categoria || !gravidade) return;

    setEnviando(true);
    setMensagem('');
    try {
      await registrarOcorrencia({
        usuarioId: sessao.user.id, fotoUris: fotos, ...local, categoria, gravidade, descricao,
      });
      limpar();
      setMensagem('Ocorrência registrada com sucesso.');
    } catch (error) {
      setMensagem(error instanceof Error ? error.message : 'Não foi possível registrar a ocorrência.');
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) return <View style={styles.centralizado}><ActivityIndicator /></View>;
  if (!sessao) return <View style={styles.centralizado}>
    <Text style={styles.titulo}>Registro de Ocorrência</Text>
    <Text style={styles.textoCentralizado}>Entre na sua conta para registrar uma ocorrência.</Text>
    <Text style={styles.textoCentralizado}>Use a aba Conta para fazer login ou criar seu cadastro.</Text>
  </View>;

  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.titulo}>Registro de Ocorrência</Text>
    <Text style={styles.rotulo}>1. Fotos do problema</Text>
    <Text style={styles.ajuda}>Adicione de 1 a 3 fotos.</Text>
    {!!fotos.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.listaFotos}>
      {fotos.map((uri, i) => <View key={`${uri}-${i}`} style={styles.cartaoFoto}>
        <Image source={{ uri }} style={styles.foto} />
        <Text style={styles.numeroFoto}>Foto {i + 1}</Text>
        <Pressable style={styles.botaoRemoverFoto} disabled={ocupado} onPress={() => removerFoto(i)}>
          <Text style={styles.textoPerigo}>Remover</Text></Pressable>
      </View>)}
    </ScrollView>}
    {fotos.length < 3 ? <Pressable style={styles.botao} onPress={tirarFoto} disabled={ocupado}>
      <Text style={styles.textoBotao}>{fotos.length ? 'Adicionar outra foto' : 'Tirar foto'}</Text></Pressable>
      : <Text style={styles.limiteFotos}>Limite de 3 fotos atingido.</Text>}
    {!!fotos.length && <>
      <Pressable style={styles.botaoCancelar} disabled={ocupado} onPress={limpar}>
        <Text style={styles.textoPerigo}>Cancelar ocorrência</Text></Pressable>
      <Text style={styles.rotulo}>2. Localização</Text>
      <View style={styles.status}>
        {obtendoLocalizacao ? <><ActivityIndicator /><Text>Obtendo localização...</Text></>
          : local ? <Text>Localização obtida automaticamente.</Text>
          : <><Text>Localização não disponível.</Text>
            <Pressable style={styles.botaoSecundario} disabled={ocupado} onPress={obterLocalizacao}>
              <Text style={styles.textoBotaoSecundario}>Tentar novamente</Text></Pressable>
          </>}
      </View>
      {local && !obtendoLocalizacao && <>
        <Text style={styles.rotulo}>3. Categoria</Text>
        <Opcoes itens={categorias} valor={categoria} disabled={enviando}
          selecionar={(valor) => { setCategoria(valor); setMensagem(''); }} />
        <Text style={styles.rotulo}>4. Gravidade</Text>
        <Opcoes itens={gravidades} valor={gravidade} disabled={enviando}
          selecionar={(valor) => { setGravidade(valor); setMensagem(''); }} />
        <Text style={styles.rotulo}>5. Descrição</Text>
        <TextInput style={styles.descricao} multiline maxLength={300}
          placeholder="Descreva brevemente o problema" value={descricao} editable={!enviando}
          onChangeText={(texto: string) => { setDescricao(texto); setMensagem(''); }} />
        <Text style={styles.contador}>{descricao.length}/300</Text>
        <Pressable style={styles.botao} onPress={registrar} disabled={ocupado}>
          <Text style={styles.textoBotao}>{enviando ? 'Registrando...' : 'Registrar ocorrência'}</Text>
        </Pressable>
      </>}
    </>}
    {!!mensagem && <Text style={styles.mensagem}>{mensagem}</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: 24 },
  centralizado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  titulo: { fontSize: 24, fontWeight: 'bold', marginBottom: 24, textAlign: 'center' },
  rotulo: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginTop: 20 },
  ajuda: { marginBottom: 10 },
  listaFotos: { gap: 10, paddingBottom: 4 },
  cartaoFoto: { width: 220 },
  foto: { width: 220, height: 165, borderRadius: 8 },
  numeroFoto: { textAlign: 'center', marginTop: 4, fontWeight: '600' },
  botaoRemoverFoto: { borderWidth: 1, borderColor: '#b00020', borderRadius: 8, padding: 8, marginTop: 6 },
  textoPerigo: { color: '#b00020', fontWeight: 'bold', textAlign: 'center' },
  limiteFotos: { textAlign: 'center', marginTop: 12 },
  status: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#dddddd', borderRadius: 8 },
  opcoes: { gap: 8 },
  opcao: { borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 12 },
  opcaoSelecionada: { backgroundColor: '#222222', borderColor: '#222222' },
  textoOpcao: { textAlign: 'center' },
  textoOpcaoSelecionada: { color: '#ffffff', fontWeight: 'bold' },
  descricao: { minHeight: 100, borderWidth: 1, borderColor: '#cccccc', borderRadius: 8, padding: 12, textAlignVertical: 'top' },
  contador: { textAlign: 'right', marginTop: 4 },
  botao: { backgroundColor: '#222222', borderRadius: 8, padding: 14, marginTop: 20 },
  botaoSecundario: { borderWidth: 1, borderColor: '#222222', borderRadius: 8, padding: 12, marginTop: 8 },
  textoBotao: { color: '#ffffff', fontWeight: 'bold', textAlign: 'center' },
  textoBotaoSecundario: { fontWeight: 'bold', textAlign: 'center' },
  botaoCancelar: { borderWidth: 1, borderColor: '#b00020', borderRadius: 8, padding: 12, marginTop: 8 },
  mensagem: { textAlign: 'center', marginTop: 16 },
  textoCentralizado: { textAlign: 'center', marginBottom: 8 },
});
