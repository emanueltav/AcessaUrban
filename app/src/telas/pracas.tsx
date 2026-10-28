import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import Aviso from '../componentes/aviso';
import { useAutenticacao } from '../contextos/autenticacao';
import { Campo as TextInput, definirEstilos, Texto as Text } from '../contextos/tema';
import { avaliarPraca, buscarPracasProximas, confirmarPraca, excluirPracaPendente,
  listarPracas, registrarPraca, type Praca, type PracaProxima } from '../servicos/pracas';
import type { Coordenadas } from '../servicos/mapa';

type Variante = 'principal' | 'secundario' | 'remover';
const erroTexto = (erro: unknown, padrao: string) => erro instanceof Error ? erro.message : padrao;

function bonusPraca(praca: Praca) {
  const media = praca.media ?? 0;
  if (praca.status !== 'APROVADA' || praca.totalAvaliacoes < 2 || media < 4) return null;
  return `Bônus para o bairro: +${media >= 4.5 ? '0,10' : '0,05'}`;
}

const mensagemPracaProxima = (praca: PracaProxima) =>
  `A praça "${praca.nome}" (${praca.status === 'APROVADA' ? 'aprovada' : 'aguardando confirmação'}) está a aproximadamente ` +
    `${Math.round(praca.distanciaMetros)} metros deste local.\n\n` +
    'Pode ser a mesma praça. Deseja cadastrar mesmo assim?';

export default function Pracas() {
  const styles = useEstilos();
  const route = useRoute();
  const abrirCadastro = (route.params as { abrirCadastro?: boolean } | undefined)?.abrirCadastro;
  const { sessao } = useAutenticacao();
  const usuarioId = sessao?.user.id ?? null;
  const [pracas, setPracas] = useState<Praca[]>([]);
  const [cadastrando, setCadastrando] = useState(abrirCadastro === true);
  const [nome, setNome] = useState('');
  const [fotos, setFotos] = useState<string[]>([]);
  const [local, setLocal] = useState<Coordenadas | null>(null);
  const [buscandoGPS, setBuscandoGPS] = useState(false);
  const [notas, setNotas] = useState<Record<string, number>>({});
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [duplicidade, setDuplicidade] = useState<string | null>(null);
  const [pracaExclusao, setPracaExclusao] = useState<Praca | null>(null);

  const carregar = useCallback(async (preservarMensagem = false) => {
    try {
      setCarregando(true);
      if (!preservarMensagem) setMensagem('');
      setPracas(await listarPracas(usuarioId));
    } catch (erro) {
      setMensagem(erroTexto(erro, 'Não foi possível carregar as praças.'));
    } finally { setCarregando(false); }
  }, [usuarioId]);
  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  async function obterGPS() {
    if (buscandoGPS) return;
    setBuscandoGPS(true);
    setMensagem('');
    try {
      if (!(await Location.requestForegroundPermissionsAsync()).granted) {
        setLocal(null);
        setMensagem('É necessário permitir o acesso à localização.');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocal({ latitude: coords.latitude, longitude: coords.longitude });
    } catch (erro) {
      setLocal(null);
      setMensagem(erroTexto(erro, 'Não foi possível obter sua localização.'));
    } finally { setBuscandoGPS(false); }
  }

  async function tirarFoto() {
    if (fotos.length >= 3) return setMensagem('Você pode adicionar no máximo 3 fotos.');
    try {
      setMensagem('');
      if (!(await ImagePicker.requestCameraPermissionsAsync()).granted)
        return setMensagem('É necessário permitir o acesso à câmera.');
      const foto = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (foto.canceled) return;
      setFotos((atual) => [...atual, foto.assets[0].uri]);
      if (!fotos.length) {
        setLocal(null);
        await obterGPS();
      }
    } catch (erro) {
      setMensagem(erroTexto(erro, 'Não foi possível utilizar a câmera.'));
    }
  }

  function limparCadastro() {
    setNome(''); setFotos([]); setLocal(null);
    setBuscandoGPS(false); setCadastrando(false);
  }

  function removerFoto(indice: number) {
    const restantes = fotos.filter((_, i) => i !== indice);
    setFotos(restantes);
    if (!restantes.length) setLocal(null); setMensagem('');
  }

  async function executar(id: string, tarefa: () => Promise<string>, erroPadrao: string) {
    if (processando) return;
    setProcessando(id);
    setMensagem('');
    try {
      setMensagem(await tarefa());
      await carregar(true);
    } catch (erro) {
      setMensagem(erroTexto(erro, erroPadrao));
    } finally { setProcessando(null); }
  }

  async function salvarCadastro() {
    if (!usuarioId || !local) return;
    await executar('cadastro', async () => {
      await registrarPraca({ usuarioId, nome, fotoUris: fotos, ...local });
      limparCadastro();
      return 'Praça cadastrada. Ela precisa de 2 confirmações para ser aprovada.';
    }, 'Não foi possível cadastrar a praça.');
  }

  async function cadastrar() {
    if (!usuarioId || processando || verificando || buscandoGPS) return;
    if (!nome.trim()) return setMensagem('Informe o nome da praça.');
    if (!fotos.length) return setMensagem('Adicione pelo menos uma foto da praça.');
    if (!local) return setMensagem('A localização da praça ainda não foi obtida.');

    setVerificando(true);
    setMensagem('');
    try {
      const proximas = await buscarPracasProximas(local);
      if (!proximas.length) return await salvarCadastro();

      setDuplicidade(mensagemPracaProxima(proximas[0]));
    } catch (erro) {
      setMensagem(erroTexto(erro, 'Não foi possível verificar praças próximas.'));
    } finally { setVerificando(false); }
  }

  async function confirmar(praca: Praca) {
    if (!usuarioId || processando) return;
    const nota = notas[praca.id];
    if (!nota) return setMensagem('Escolha de 1 a 5 estrelas antes de confirmar a praça.');
    await executar(praca.id, async () => {
      const status = await confirmarPraca(praca.id, nota);
      setNotas((atual) => { const novas = { ...atual }; delete novas[praca.id]; return novas; });
      return status === 'APROVADA' ? 'Praça confirmada e aprovada.' : 'Confirmação registrada.';
    }, 'Não foi possível confirmar a praça.');
  }

  async function avaliar(id: string, nota: number) {
    if (!usuarioId) return setMensagem('Entre na sua conta para avaliar uma praça.');
    await executar(id, async () => {
      await avaliarPraca(id, nota);
      return 'Avaliação registrada.';
    }, 'Não foi possível registrar sua avaliação.');
  }

  function excluir() {
    if (!pracaExclusao) return;
    const id = pracaExclusao.id;
    setPracaExclusao(null);
    void executar(id, async () => {
      await excluirPracaPendente(id);
      return 'Praça excluída com sucesso.';
    }, 'Não foi possível excluir a praça.');
  }

  if (carregando) return <View style={styles.centralizado}>
    <ActivityIndicator /><Text style={styles.mensagem}>Carregando praças...</Text>
  </View>;

  const pendentes = pracas.filter((praca) => praca.status === 'PENDENTE'),
    aprovadas = pracas.filter((praca) => praca.status === 'APROVADA');
  const ocupado = processando !== null || verificando;

  return <><ScrollView contentContainerStyle={styles.container}>
    {sessao ? <Botao texto={cadastrando ? 'Cancelar cadastro' : 'Cadastrar nova praça'} disabled={ocupado}
      acao={() => { if (cadastrando) limparCadastro(); else setCadastrando(true); setMensagem(''); }} />
      : <Text style={styles.aviso}>Entre na sua conta para cadastrar ou avaliar praças.</Text>}

    {cadastrando && <View style={styles.bloco}>
      <Text style={styles.subtitulo}>Nova praça</Text>
      <TextInput style={styles.campo} placeholder="Nome da praça" value={nome} onChangeText={setNome} editable={!ocupado} />
      <Text>Adicione de 1 a 3 fotos.</Text>
      {!!fotos.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galeria}>
        {fotos.map((uri, indice) => <View key={`${uri}-${indice}`} style={styles.cartaoFoto}>
          <Image source={{ uri }} style={styles.foto} />
          <Text style={styles.numeroFoto}>Foto {indice + 1}</Text>
          <Botao variante="remover" texto="Remover" disabled={ocupado}
            acao={() => removerFoto(indice)} />
        </View>)}
      </ScrollView>}
      {fotos.length < 3 ? <Botao variante="secundario" acao={tirarFoto} disabled={ocupado || buscandoGPS}
        texto={fotos.length ? 'Adicionar outra foto' : 'Tirar foto'} />
        : <Text style={styles.aviso}>Limite de 3 fotos atingido.</Text>}
      {!!fotos.length && <View style={styles.statusLocalizacao}>
        {buscandoGPS ? <><ActivityIndicator /><Text>Obtendo localização...</Text></> : local ?
          <Text>Localização obtida automaticamente.</Text> : <>
            <Text>Localização não disponível.</Text>
            <Botao variante="secundario" texto="Tentar localização novamente" acao={obterGPS} disabled={ocupado} />
          </>}
      </View>}
      <Botao texto={verificando ? 'Verificando...' : processando === 'cadastro' ? 'Cadastrando...' : 'Registrar praça'} acao={cadastrar}
        disabled={ocupado || buscandoGPS} />
    </View>}

    {sessao && !!pendentes.length && <>
      <Text style={styles.subtitulo}>Aguardando confirmação</Text>
      {pendentes.map((praca) => <View key={praca.id} style={styles.bloco}>
        <ResumoPraca praca={praca} />
        <Text>Confirmações: {praca.confirmacoes}/2</Text>
        {usuarioId === praca.usuario_id ?
          <Text style={styles.aviso}>Você cadastrou esta praça. Outros usuários precisam confirmar a existência dela.</Text>
          : praca.usuarioConfirmou ? <Text style={styles.aviso}>Você já confirmou esta praça.</Text> : <>
            <Text>Esta praça realmente existe neste local? Avalie para confirmar:</Text>
            <Estrelas valor={notas[praca.id] ?? 0} disabled={ocupado}
              onPress={(nota) => setNotas((atual) => ({ ...atual, [praca.id]: nota }))} />
            <Botao texto={processando === praca.id ? 'Confirmando...' : 'Confirmar praça'}
              acao={() => confirmar(praca)} disabled={ocupado} />
          </>}
        {usuarioId === praca.usuario_id && praca.confirmacoes === 0 &&
          <Botao variante="remover" texto="Excluir praça" disabled={ocupado}
            acao={() => setPracaExclusao(praca)} />}
      </View>)}
    </>}

    <Text style={styles.subtitulo}>Praças aprovadas</Text>
    {!aprovadas.length ? <Text style={styles.aviso}>Nenhuma praça aprovada ainda.</Text> :
      aprovadas.map((praca) => <View key={praca.id} style={styles.bloco}>
        <ResumoPraca praca={praca} />
        <Text style={styles.media}>{praca.media === null ? 'Sem avaliações' :
          `★ ${praca.media.toFixed(1)} (${praca.totalAvaliacoes})`}</Text>
        {!!bonusPraca(praca) && <Text style={styles.bonus}>{bonusPraca(praca)}</Text>}
        {sessao && <><Text>Sua avaliação:</Text>
          <Estrelas valor={praca.avaliacaoUsuario ?? 0} disabled={ocupado}
            onPress={(nota) => avaliar(praca.id, nota)} />
        </>}
      </View>)}
    {!!mensagem && <Text style={styles.mensagem}>{mensagem}</Text>}
  </ScrollView>
    <Aviso mensagem={duplicidade} titulo="Possível praça duplicada"
      confirmarTexto="Cadastrar mesmo assim" cancelar={() => setDuplicidade(null)}
      confirmar={() => { setDuplicidade(null); void salvarCadastro(); }} />
    <Aviso mensagem={pracaExclusao ? `A praça "${pracaExclusao.nome}" e suas fotos serão excluídas definitivamente.` : null}
      titulo="Excluir praça?" confirmarTexto="Excluir" destrutivo
      cancelar={() => setPracaExclusao(null)} confirmar={excluir} />
  </>;
}

function Botao({ texto, acao, variante = 'principal', disabled = false }: {
  texto: string; acao: () => void; variante?: Variante; disabled?: boolean;
}) {
  const styles = useEstilos();
  const estiloBotao = variante === 'principal' ? styles.botaoPrincipal
    : variante === 'remover' ? styles.botaoRemover : styles.botaoSecundario;
  const estiloTexto = variante === 'principal' ? styles.textoBotaoPrincipal
    : variante === 'remover' ? styles.textoRemover : styles.textoBotaoSecundario;
  return <Pressable style={[estiloBotao, disabled && styles.desabilitado]}
    accessibilityRole="button" onPress={acao} disabled={disabled}>
    <Text style={estiloTexto}>{texto}</Text>
  </Pressable>;
}

function ResumoPraca({ praca }: { praca: Praca }) {
  const styles = useEstilos();
  return <>
    {!!praca.fotos.length && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galeria}>
      {praca.fotos.map((foto, i) => <View key={foto.id} style={styles.cartaoFoto}>
        <Image source={{ uri: foto.foto_url }} style={styles.foto} />
        {praca.fotos.length > 1 && <Text style={styles.numeroFoto}>{i + 1}/{praca.fotos.length}</Text>}
      </View>)}
    </ScrollView>}
    <View style={styles.linhaTitulo}>
      <Text style={styles.nomePraca}>{praca.nome}</Text>
      <Text style={styles.selo}>{praca.status === 'APROVADA' ? 'Aprovada' : 'Aguardando'}</Text>
    </View>
    {praca.bairro && <Text style={styles.bairroPraca}>
      {praca.bairro.nome} — {praca.bairro.municipio}/{praca.bairro.uf}
    </Text>}
  </>;
}

function Estrelas({ valor, onPress, disabled }: {
  valor: number; onPress: (nota: number) => void; disabled: boolean;
}) {
  const styles = useEstilos();
  return <View style={styles.estrelas}>{[1, 2, 3, 4, 5].map((nota) =>
    <Pressable key={nota} onPress={() => onPress(nota)} disabled={disabled}
      accessibilityRole="button" accessibilityLabel={`${nota} ${nota === 1 ? 'estrela' : 'estrelas'}`}>
      <Text style={[styles.estrela, nota <= valor && styles.estrelaAtiva]}>{nota <= valor ? '★' : '☆'}</Text>
    </Pressable>)}</View>;
}

const useEstilos = definirEstilos((c) => StyleSheet.create({
  container: { padding: 20, gap: 16 },
  centralizado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  subtitulo: { fontSize: 18, fontWeight: 'bold', color: c.azul },
  bloco: { borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 16, padding: 16, gap: 10 },
  linhaTitulo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  nomePraca: { fontSize: 18, fontWeight: 'bold', color: c.azul },
  selo: { backgroundColor: c.fundo, color: c.azul, borderRadius: 12, overflow: 'hidden',
    paddingVertical: 5, paddingHorizontal: 10, fontSize: 12, fontWeight: '700' },
  bairroPraca: { fontSize: 13, color: c.secundario },
  campo: { borderWidth: 1, borderColor: c.borda, borderRadius: 12, padding: 14 },
  galeria: { gap: 10 }, cartaoFoto: { width: 240 },
  foto: { width: 240, height: 180, borderRadius: 14 },
  numeroFoto: { textAlign: 'center', marginTop: 4, fontWeight: '600' },
  statusLocalizacao: { gap: 8, padding: 12, backgroundColor: c.fundo, borderRadius: 12 },
  botaoPrincipal: { backgroundColor: c.botao, borderRadius: 12, padding: 14 },
  textoBotaoPrincipal: { color: c.textoBotao, fontWeight: 'bold', textAlign: 'center' },
  botaoSecundario: { borderWidth: 1, borderColor: c.botao, borderRadius: 12, padding: 12 },
  textoBotaoSecundario: { color: c.azul, fontWeight: 'bold', textAlign: 'center' },
  botaoRemover: { borderWidth: 1, borderColor: c.perigo, borderRadius: 12, padding: 8 },
  textoRemover: { color: c.perigo, fontWeight: 'bold', textAlign: 'center' },
  desabilitado: { opacity: 0.5 },
  media: { fontSize: 17, fontWeight: 'bold', color: c.laranja },
  bonus: { color: c.azul, fontWeight: '600' },
  estrelas: { flexDirection: 'row', gap: 8 },
  estrela: { fontSize: 32, color: c.borda }, estrelaAtiva: { color: c.laranja },
  aviso: { textAlign: 'center', color: c.secundario }, mensagem: { textAlign: 'center' },
}));
