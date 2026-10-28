import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useAutenticacao } from '../contextos/autenticacao';
import Aviso from '../componentes/aviso';
import { Campo as TextInput, definirEstilos, Texto as Text } from '../contextos/tema';
import { buscarOcorrenciasProximas, registrarOcorrencia } from '../servicos/ocorrencias';
import type { OcorrenciaProxima } from '../servicos/ocorrencias';
import type { Coordenadas } from '../servicos/mapa';
import type { CategoriaOcorrencia, GravidadeOcorrencia } from '../servicos/votacoes';

type Opcao<T extends string> = { valor: T; titulo: string };

const categorias: Opcao<CategoriaOcorrencia>[] = [
  { valor: 'PAVIMENTACAO', titulo: 'Pavimentação' }, { valor: 'ILUMINACAO', titulo: 'Iluminação' },
  { valor: 'ESGOTO', titulo: 'Esgoto' }, { valor: 'CALCAMENTO', titulo: 'Calçamento' },
  { valor: 'OUTRO', titulo: 'Outro' },
];
const gravidades: Opcao<GravidadeOcorrencia>[] = [
  { valor: 'LEVE', titulo: 'Leve' }, { valor: 'MODERADO', titulo: 'Moderado' },
  { valor: 'GRAVE', titulo: 'Grave' },
];

function mensagemDuplicidade({ status, descricao, distanciaMetros }: OcorrenciaProxima): string {
  const detalhe = descricao?.trim();
  const resumo = detalhe ? `\n\nDescrição: ${detalhe.slice(0, 100)}${detalhe.length > 100 ? '…' : ''}` : '';
  return `Encontramos uma ocorrência ${status === 'ATIVA' ? 'ativa' : 'pendente de validação'} da mesma categoria a aproximadamente ` +
    `${Math.round(distanciaMetros)} metros deste local.${resumo}\n\n` +
    'Pode ser o mesmo problema. Deseja registrar mesmo assim?';
}

function Opcoes<T extends string>({ itens, valor, selecionar, disabled }: {
  itens: Opcao<T>[]; valor: T | null; selecionar: (valor: T) => void; disabled: boolean;
}) {
  const styles = useEstilos();
  return <View style={styles.opcoes}>{itens.map((item) => (
    <Pressable key={item.valor} disabled={disabled} onPress={() => selecionar(item.valor)}
      accessibilityRole="radio" accessibilityState={{ selected: valor === item.valor, disabled }}
      style={[styles.opcao, valor === item.valor && styles.opcaoSelecionada]}>
      <Text style={[styles.textoOpcao, valor === item.valor && styles.textoOpcaoSelecionada]}>{item.titulo}</Text>
    </Pressable>
  ))}</View>;
}

export default function Registro() {
  const styles = useEstilos();
  const { sessao, carregando } = useAutenticacao();
  const [fotos, setFotos] = useState<string[]>([]);
  const [local, setLocal] = useState<Coordenadas | null>(null);
  const [categoria, setCategoria] = useState<CategoriaOcorrencia | null>(null);
  const [gravidade, setGravidade] = useState<GravidadeOcorrencia | null>(null);
  const [descricao, setDescricao] = useState('');
  const [obtendoLocalizacao, setObtendoLocalizacao] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [duplicidade, setDuplicidade] = useState<string | null>(null);
  const ocupado = enviando || obtendoLocalizacao || verificando;

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

  async function salvarRegistro() {
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

  async function registrar() {
    if (ocupado) return;
    const aviso = !sessao ? 'É necessário estar autenticado.'
      : !fotos.length ? 'Tire pelo menos uma foto do problema.'
      : !local ? 'A localização ainda não foi obtida.'
      : !categoria ? 'Selecione uma categoria.'
      : !gravidade ? 'Selecione a gravidade.'
      : !descricao.trim() ? 'Digite uma pequena descrição.' : '';
    if (aviso) return setMensagem(aviso);
    if (!local || !categoria) return;

    setVerificando(true);
    setMensagem('');
    try {
      const proximas = await buscarOcorrenciasProximas(categoria, local);
      if (!proximas.length) return await salvarRegistro();

      setDuplicidade(mensagemDuplicidade(proximas[0]));
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : 'Não foi possível verificar ocorrências próximas.');
    } finally {
      setVerificando(false);
    }
  }

  if (carregando) return <View style={styles.centralizado}><ActivityIndicator /></View>;
  if (!sessao) return <View style={styles.centralizado}>
    <Text style={styles.textoCentralizado}>Entre na sua conta para registrar uma ocorrência.</Text>
    <Text style={styles.textoCentralizado}>Volte ao mapa e abra o menu superior para entrar ou criar uma conta.</Text>
  </View>;

  return <><ScrollView contentContainerStyle={styles.container}>
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
        <Opcoes itens={categorias} valor={categoria} disabled={ocupado}
          selecionar={(valor) => { setCategoria(valor); setMensagem(''); }} />
        <Text style={styles.rotulo}>4. Gravidade</Text>
        <Opcoes itens={gravidades} valor={gravidade} disabled={ocupado}
          selecionar={(valor) => { setGravidade(valor); setMensagem(''); }} />
        <Text style={styles.rotulo}>5. Descrição</Text>
        <TextInput style={styles.descricao} multiline maxLength={300}
          placeholder="Descreva brevemente o problema" value={descricao} editable={!ocupado}
          onChangeText={(texto: string) => { setDescricao(texto); setMensagem(''); }} />
        <Text style={styles.contador}>{descricao.length}/300</Text>
        <Pressable style={styles.botao} onPress={registrar} disabled={ocupado}>
          <Text style={styles.textoBotao}>{verificando ? 'Verificando...' : enviando ? 'Registrando...' : 'Registrar ocorrência'}</Text>
        </Pressable>
      </>}
    </>}
    {!!mensagem && <Text style={styles.mensagem}>{mensagem}</Text>}
  </ScrollView>
    <Aviso mensagem={duplicidade} titulo="Possível ocorrência duplicada"
      confirmarTexto="Registrar mesmo assim" cancelar={() => setDuplicidade(null)}
      confirmar={() => { setDuplicidade(null); void salvarRegistro(); }} />
  </>;
}

const useEstilos = definirEstilos((c) => StyleSheet.create({
  container: { padding: 24 },
  centralizado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  rotulo: { fontSize: 17, fontWeight: 'bold', color: c.azul, marginBottom: 10, marginTop: 24 },
  ajuda: { color: c.secundario, marginBottom: 10 },
  listaFotos: { gap: 10, paddingBottom: 4 },
  cartaoFoto: { width: 220 },
  foto: { width: 220, height: 165, borderRadius: 14 },
  numeroFoto: { textAlign: 'center', marginTop: 4, fontWeight: '600' },
  botaoRemoverFoto: { borderWidth: 1, borderColor: c.perigo, borderRadius: 12, padding: 8, marginTop: 6 },
  textoPerigo: { color: c.perigo, fontWeight: 'bold', textAlign: 'center' },
  limiteFotos: { textAlign: 'center', color: c.secundario, marginTop: 12 },
  status: { gap: 8, padding: 14, borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 14 },
  opcoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opcao: { borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 16, minWidth: 92 },
  opcaoSelecionada: { backgroundColor: c.botao, borderColor: c.botao },
  textoOpcao: { textAlign: 'center', fontWeight: '600' },
  textoOpcaoSelecionada: { color: c.textoBotao, fontWeight: 'bold' },
  descricao: { minHeight: 110, borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao,
    color: c.texto, borderRadius: 12, padding: 14, textAlignVertical: 'top' },
  contador: { textAlign: 'right', color: c.secundario, marginTop: 4 },
  botao: { backgroundColor: c.botao, borderRadius: 12, padding: 14, marginTop: 20 },
  botaoSecundario: { borderWidth: 1, borderColor: c.botao, borderRadius: 12, padding: 12, marginTop: 8 },
  textoBotao: { color: c.textoBotao, fontWeight: 'bold', textAlign: 'center' },
  textoBotaoSecundario: { color: c.azul, fontWeight: 'bold', textAlign: 'center' },
  botaoCancelar: { borderWidth: 1, borderColor: c.perigo, borderRadius: 12, padding: 12, marginTop: 8 },
  mensagem: { textAlign: 'center', marginTop: 16 },
  textoCentralizado: { color: c.secundario, textAlign: 'center', marginBottom: 8 },
}));
