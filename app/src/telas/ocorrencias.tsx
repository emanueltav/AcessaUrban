import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NavigationProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useAutenticacao } from '../contextos/autenticacao';
import { definirEstilos, Texto as Text } from '../contextos/tema';
import type { RootStackParamList } from '../navegacao/rotas';
import { buscarResumoOcorrencias, diasDesde, OcorrenciaResumoGeral, ResumoOcorrenciasGeral } from '../servicos/ocorrencias';
import {
  buscarHistoricoOcorrencia, buscarOcorrencia, buscarResumoValidacoes, confirmarProblema,
  EventoValidacao, FotoOcorrencia, OcorrenciaDetalhe, ResumoValidacoes, votarResolucao, VotoResolucao,
} from '../servicos/votacoes';

const RESUMO_INICIAL: ResumoValidacoes = {
  confirmacoes: 0, resolvidos: 0, aindaExiste: 0,
  usuarioConfirmou: false, votoResolucaoUsuario: null,
};

const GERAL_INICIAL: ResumoOcorrenciasGeral = {
  ativas: 0, resolvidasMes: 0, tempoMedioResolucaoDias: null,
  ocorrenciasAtivas: [], ocorrenciasAnteriores: [],
};

const CATEGORIAS: Record<string, string> = {
  PAVIMENTACAO: 'Pavimentação', ILUMINACAO: 'Iluminação',
  ESGOTO: 'Esgoto', CALCAMENTO: 'Calçamento', OUTRO: 'Outro',
};
const GRAVIDADES: Record<string, string> = { LEVE: 'Leve', MODERADO: 'Moderado', GRAVE: 'Grave' };
const STATUS: Record<string, string> = {
  PENDENTE_VALIDACAO: 'Aguardando validação', ATIVA: 'Ativa', RESOLVIDA: 'Resolvida',
};

const ERROS_VOTO: [string, string][] = [
  ['O autor nao pode validar a propria ocorrencia', 'Você não pode votar na ocorrência que registrou.'],
  ['A ocorrencia nao esta aguardando confirmacao', 'Esta ocorrência não está mais aguardando confirmação.'],
  ['A ocorrencia nao esta ativa', 'Esta ocorrência não está mais disponível para votação.'],
  ['Erro ao enviar foto', 'Não foi possível enviar uma das fotos.'],
  ['duplicate key', 'Você já confirmou esta ocorrência.'],
  ['unique constraint', 'Você já confirmou esta ocorrência.'],
];

const formatarData = (data: string) => new Date(data).toLocaleDateString('pt-BR');
const tituloVoto = (voto: VotoResolucao) => voto === 'RESOLVIDO' ? 'Resolvido' : 'Ainda existe';

function mensagemErroVoto(erro: unknown) {
  const mensagem = erro instanceof Error ? erro.message : '';
  return ERROS_VOTO.find(([trecho]) => mensagem.includes(trecho))?.[1]
    ?? 'Não foi possível registrar seu voto.';
}

type FotoExibicao = Pick<FotoOcorrencia, 'id' | 'foto_url'>;

function GaleriaFotos({ fotos, estilo, numeracao = false }: {
  fotos: FotoExibicao[]; estilo: 'original' | 'destaque' | 'historico'; numeracao?: boolean;
}) {
  const styles = useEstilos();
  const estiloFoto = estilo === 'original' ? styles.foto
    : estilo === 'destaque' ? styles.fotoEvidenciaDestaque : styles.fotoHistorico;
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galeria}>
    {fotos.map((foto, indice) => <View key={foto.id}>
      <Image source={{ uri: foto.foto_url }} style={estiloFoto} />
      {numeracao && fotos.length > 1 &&
        <Text style={styles.numeroFoto}>{indice + 1}/{fotos.length}</Text>}
    </View>)}
  </ScrollView>;
}

function DetalheOcorrencia({ ocorrenciaId }: { ocorrenciaId: string }) {
  const styles = useEstilos();
  const { sessao } = useAutenticacao();
  const usuarioId = sessao?.user.id ?? null;
  const [ocorrencia, setOcorrencia] = useState<OcorrenciaDetalhe | null>(null);
  const [resumo, setResumo] = useState<ResumoValidacoes>(RESUMO_INICIAL);
  const [historico, setHistorico] = useState<EventoValidacao[]>([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [votoPreparando, setVotoPreparando] = useState<VotoResolucao | null>(null);
  const [fotosVoto, setFotosVoto] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setErro('');
      const [dadosOcorrencia, dadosHistorico] = await Promise.all([
        buscarOcorrencia(ocorrenciaId), buscarHistoricoOcorrencia(ocorrenciaId),
      ]);
      setOcorrencia(dadosOcorrencia);
      setHistorico(dadosHistorico);
      setResumo(usuarioId ? await buscarResumoValidacoes(ocorrenciaId, usuarioId) : RESUMO_INICIAL);
    } catch (error) {
      console.error('Erro ao carregar ocorrência:', error);
      setErro('Não foi possível carregar esta ocorrência.');
    } finally {
      setCarregando(false);
    }
  }, [ocorrenciaId, usuarioId]);

  useEffect(() => { void carregarDados(); }, [carregarDados]);

  async function confirmar() {
    if (!usuarioId || enviandoVoto) return;
    try {
      setEnviandoVoto(true);
      setMensagem('');
      await confirmarProblema(ocorrenciaId, usuarioId);
      setMensagem('Ocorrência confirmada.');
      await carregarDados();
    } catch (error) {
      setMensagem(mensagemErroVoto(error));
    } finally {
      setEnviandoVoto(false);
    }
  }

  function prepararVoto(voto: VotoResolucao) {
    setVotoPreparando(voto);
    setFotosVoto([]);
    setMensagem('');
  }

  async function tirarFotoVoto() {
    if (fotosVoto.length >= 3) return setMensagem('Você pode adicionar no máximo 3 fotos.');
    try {
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) return setMensagem('É necessário permitir o acesso à câmera.');
      const resultado = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (resultado.canceled) return;
      setFotosVoto((atual) => [...atual, resultado.assets[0].uri]);
      setMensagem('');
    } catch {
      setMensagem('Não foi possível utilizar a câmera.');
    }
  }

  async function enviarVoto() {
    if (!usuarioId || !votoPreparando || enviandoVoto) return;
    try {
      setEnviandoVoto(true);
      setMensagem('');
      await votarResolucao(ocorrenciaId, usuarioId, votoPreparando, fotosVoto);
      setMensagem(votoPreparando === 'RESOLVIDO'
        ? 'Voto registrado como resolvido.' : 'Voto registrado como ainda existe.');
      setVotoPreparando(null);
      setFotosVoto([]);
      await carregarDados();
    } catch (error) {
      setMensagem(mensagemErroVoto(error));
    } finally {
      setEnviandoVoto(false);
    }
  }

  if (carregando || erro || !ocorrencia) return <View style={styles.centralizado}>
    {carregando && <ActivityIndicator />}
    <Text style={styles.mensagem}>
      {erro || (carregando ? 'Carregando ocorrência...' : 'Ocorrência não encontrada.')}
    </Text>
  </View>;

  const ehAutor = usuarioId === ocorrencia.usuario_id;
  const pendente = ocorrencia.status === 'PENDENTE_VALIDACAO';
  const ativa = ocorrencia.status === 'ATIVA';
  const resolvida = ocorrencia.status === 'RESOLVIDA';
  const evidenciaResolucao = [...historico].reverse().find(
    (evento) => evento.voto === 'RESOLVIDO' && evento.fotos.length > 0
  );

  return <ScrollView contentContainerStyle={styles.container}>
    <GaleriaFotos fotos={ocorrencia.fotos} estilo="original" numeracao />

    <View style={styles.bloco}>
      <Text style={styles.titulo}>{CATEGORIAS[ocorrencia.categoria]}</Text>
      <Text>Gravidade: {GRAVIDADES[ocorrencia.gravidade]}</Text>
      <Text>Status: {STATUS[ocorrencia.status]}</Text>
      {ocorrencia.bairro && <Text>
        {ocorrencia.bairro.nome} — {ocorrencia.bairro.municipio}/{ocorrencia.bairro.uf}
      </Text>}
      {!!ocorrencia.descricao && <Text style={styles.descricao}>{ocorrencia.descricao}</Text>}
      {ativa && ocorrencia.ativado_em &&
        <Text style={styles.dataStatus}>Ativa desde {formatarData(ocorrencia.ativado_em)}</Text>}
      {resolvida && ocorrencia.resolvido_em &&
        <Text style={styles.dataStatus}>Resolvida em {formatarData(ocorrencia.resolvido_em)}</Text>}
    </View>

    {resolvida && evidenciaResolucao && <View style={styles.bloco}>
      <Text style={styles.subtitulo}>Evidência da resolução</Text>
      <GaleriaFotos fotos={evidenciaResolucao.fotos} estilo="destaque" />
    </View>}

    <View style={styles.bloco}>
      <Text style={styles.subtitulo}>Validação da comunidade</Text>
      {sessao && <>
        <Text style={styles.contagem}>
          {pendente ? `Confirmações: ${resumo.confirmacoes}/3` : 'Confirmações concluídas'}
        </Text>
        {ativa && <>
          <Text style={styles.contagem}>Resolvido: {resumo.resolvidos}/3</Text>
          <Text style={styles.contagem}>Ainda existe: {resumo.aindaExiste}</Text>
          {resumo.votoResolucaoUsuario && <Text style={styles.votoAtual}>
            Seu voto atual: {tituloVoto(resumo.votoResolucaoUsuario)}
          </Text>}
        </>}
      </>}

      {resolvida && <Text style={styles.aviso}>Esta ocorrência foi marcada como resolvida.</Text>}
      {!sessao ? <Text style={styles.aviso}>Entre na sua conta para participar da validação.</Text>
        : ehAutor ? <Text style={styles.aviso}>
          Você registrou esta ocorrência e não participa da votação dela.
        </Text>
        : pendente ? (resumo.usuarioConfirmou
          ? <Text style={styles.aviso}>Você já confirmou esta ocorrência.</Text>
          : <Pressable style={[styles.botaoPrincipal, enviandoVoto && styles.botaoDesabilitado]}
              onPress={confirmar} disabled={enviandoVoto}>
              <Text style={styles.textoBotaoPrincipal}>
                {enviandoVoto ? 'Confirmando...' : 'Confirmar problema'}
              </Text>
            </Pressable>)
        : ativa && <View style={styles.acoes}>
          {(['AINDA_EXISTE', 'RESOLVIDO'] as VotoResolucao[]).map((voto) =>
            <Pressable key={voto} disabled={enviandoVoto}
              style={[styles.botaoVoto, resumo.votoResolucaoUsuario === voto && styles.botaoVotoSelecionado]}
              onPress={() => prepararVoto(voto)}>
              <Text style={[styles.textoBotaoVoto,
                resumo.votoResolucaoUsuario === voto && styles.textoBotaoVotoSelecionado]}>
                {tituloVoto(voto)}
              </Text>
            </Pressable>)}

          {votoPreparando && <View style={styles.blocoPreparacao}>
            <Text style={styles.subtitulo}>{tituloVoto(votoPreparando)}</Text>
            <Text>Você pode anexar até 3 fotos como evidência. As fotos são opcionais.</Text>
            {!!fotosVoto.length && <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.galeria}>
              {fotosVoto.map((fotoUri, indice) => <View key={`${fotoUri}-${indice}`}>
                <Image source={{ uri: fotoUri }} style={styles.fotoEvidencia} />
                <Text style={styles.numeroFoto}>Foto {indice + 1}</Text>
                <Pressable style={styles.botaoRemover} disabled={enviandoVoto}
                  onPress={() => setFotosVoto((atual) => atual.filter((_, posicao) => posicao !== indice))}>
                  <Text style={styles.textoRemover}>Remover</Text>
                </Pressable>
              </View>)}
            </ScrollView>}
            {fotosVoto.length < 3 ? <Pressable style={styles.botaoSecundario}
              onPress={tirarFotoVoto} disabled={enviandoVoto}>
              <Text style={styles.textoBotaoSecundario}>
                {fotosVoto.length === 0 ? 'Adicionar foto' : 'Adicionar outra foto'}
              </Text>
            </Pressable> : <Text style={styles.aviso}>Limite de 3 fotos atingido.</Text>}
            <Pressable style={styles.botaoPrincipal} onPress={enviarVoto} disabled={enviandoVoto}>
              <Text style={styles.textoBotaoPrincipal}>{enviandoVoto ? 'Enviando...' : 'Confirmar voto'}</Text>
            </Pressable>
            <Pressable style={styles.botaoSecundario} disabled={enviandoVoto} onPress={() => {
              setVotoPreparando(null);
              setFotosVoto([]);
              setMensagem('');
            }}>
              <Text style={styles.textoBotaoSecundario}>Cancelar</Text>
            </Pressable>
          </View>}
        </View>}

      {enviandoVoto && ativa && <ActivityIndicator style={styles.carregandoVoto} />}
      {!!mensagem && <Text style={styles.mensagem}>{mensagem}</Text>}
    </View>

    {!!historico.length && <View style={styles.bloco}>
      <Pressable onPress={() => setHistoricoAberto((atual) => !atual)}>
        <Text style={styles.linkHistorico}>
          {historicoAberto ? 'Ocultar histórico' : 'Ver histórico da ocorrência >'}
        </Text>
      </Pressable>
      {historicoAberto && <View style={styles.historico}>
        <View style={styles.eventoHistorico}>
          <Text style={styles.tituloEvento}>Relato original</Text>
          <Text>{formatarData(ocorrencia.criado_em)}</Text>
          <GaleriaFotos fotos={ocorrencia.fotos} estilo="historico" />
        </View>
        {historico.map((evento) => <View key={evento.id} style={styles.eventoHistorico}>
          <Text style={styles.tituloEvento}>{tituloVoto(evento.voto)}</Text>
          <Text>{formatarData(evento.criado_em)}</Text>
          {evento.fotos.length > 0
            ? <GaleriaFotos fotos={evento.fotos} estilo="historico" />
            : <Text style={styles.semFotos}>Sem foto anexada.</Text>}
        </View>)}
      </View>}
    </View>}
  </ScrollView>;
}

function CartaoOcorrencia({ ocorrencia, onPress }: {
  ocorrencia: OcorrenciaResumoGeral; onPress: () => void;
}) {
  const styles = useEstilos();
  const dias = diasDesde(ocorrencia.ativado_em ?? ocorrencia.criado_em);
  return <Pressable style={styles.itemGeral} onPress={onPress}>
    <Text style={styles.nomeItemGeral}>{CATEGORIAS[ocorrencia.categoria] ?? ocorrencia.categoria}</Text>
    {ocorrencia.bairro && <Text>
      {ocorrencia.bairro.nome} — {ocorrencia.bairro.municipio}/{ocorrencia.bairro.uf}
    </Text>}
    {ocorrencia.resolvido_em
      ? <Text>Resolvida em {formatarData(ocorrencia.resolvido_em)}</Text>
      : <Text>{dias === 0 ? 'Ativa hoje' : `Ativa há ${dias} ${dias === 1 ? 'dia' : 'dias'}`}</Text>}
    <Text>Gravidade: {ocorrencia.gravidade}</Text>
  </Pressable>;
}

function Metrica({ valor, nome }: { valor: number | string; nome: string }) {
  const styles = useEstilos();
  return <View style={styles.metrica}>
    <Text style={styles.valorMetrica}>{valor}</Text>
    <Text style={styles.nomeMetrica}>{nome}</Text>
  </View>;
}

function PainelOcorrencias() {
  const styles = useEstilos();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [resumoGeral, setResumoGeral] = useState(GERAL_INICIAL);
  const [carregandoGeral, setCarregandoGeral] = useState(true);
  const [erroGeral, setErroGeral] = useState('');
  const [anterioresAbertas, setAnterioresAbertas] = useState(false);

  useFocusEffect(useCallback(() => {
    let ativo = true;
    async function carregar() {
      try {
        setCarregandoGeral(true);
        setErroGeral('');
        const dados = await buscarResumoOcorrencias();
        if (ativo) setResumoGeral(dados);
      } catch (error) {
        console.error('Erro ao carregar ocorrências:', error);
        if (ativo) setErroGeral('Não foi possível carregar as ocorrências.');
      } finally {
        if (ativo) setCarregandoGeral(false);
      }
    }
    void carregar();
    return () => { ativo = false; };
  }, []));

  if (carregandoGeral || erroGeral) return <View style={styles.centralizado}>
    {carregandoGeral && <ActivityIndicator />}
    <Text style={styles.mensagem}>{erroGeral || 'Carregando ocorrências...'}</Text>
  </View>;

  const abrirOcorrencia = (ocorrenciaId: string) => navigation.navigate('Ocorrencia', { ocorrenciaId });
  const tempo = resumoGeral.tempoMedioResolucaoDias;

  return <ScrollView contentContainerStyle={styles.container}>
    <View style={styles.metricas}>
      <Metrica valor={resumoGeral.ativas} nome="Ativas agora" />
      <Metrica valor={resumoGeral.resolvidasMes} nome="Resolvidas neste mês" />
      <Metrica valor={tempo === null ? '—' : Math.round(tempo)}
        nome={tempo === null ? 'Tempo médio' : 'Dias em média'} />
    </View>

    <Text style={styles.subtitulo}>Ocorrências ativas</Text>
    {!resumoGeral.ocorrenciasAtivas.length
      ? <Text style={styles.mensagem}>Nenhuma ocorrência ativa neste momento.</Text>
      : resumoGeral.ocorrenciasAtivas.map((item) =>
        <CartaoOcorrencia key={item.id} ocorrencia={item} onPress={() => abrirOcorrencia(item.id)} />)}

    <Pressable style={styles.botaoAnteriores} onPress={() => setAnterioresAbertas((atual) => !atual)}>
      <Text style={styles.textoBotaoAnteriores}>
        {anterioresAbertas ? 'Ocultar ocorrências anteriores' : 'Ver ocorrências anteriores >'}
      </Text>
    </Pressable>
    {anterioresAbertas && <View style={styles.listaAnteriores}>
      <Text style={styles.subtitulo}>Ocorrências anteriores</Text>
      {!resumoGeral.ocorrenciasAnteriores.length
        ? <Text style={styles.mensagem}>Ainda não existem ocorrências resolvidas há mais de 30 dias.</Text>
        : resumoGeral.ocorrenciasAnteriores.map((item) =>
          <CartaoOcorrencia key={item.id} ocorrencia={item} onPress={() => abrirOcorrencia(item.id)} />)}
    </View>}
  </ScrollView>;
}

export default function Ocorrencias() {
  const route = useRoute();
  const ocorrenciaId = (route.params as { ocorrenciaId?: string } | undefined)?.ocorrenciaId;
  return ocorrenciaId ? <DetalheOcorrencia ocorrenciaId={ocorrenciaId} /> : <PainelOcorrencias />;
}

const useEstilos = definirEstilos((c) => StyleSheet.create({
  container: { padding: 20, gap: 16 },
  centralizado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  galeria: { gap: 10 },
  foto: { width: 300, height: 240, borderRadius: 10 },
  fotoEvidencia: { width: 180, height: 135, borderRadius: 8 },
  fotoEvidenciaDestaque: { width: 280, height: 210, borderRadius: 10 },
  fotoHistorico: { width: 160, height: 120, borderRadius: 8 },
  numeroFoto: { textAlign: 'center', marginTop: 4, fontWeight: '600' },
  bloco: { borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 10, padding: 16, gap: 8 },
  blocoPreparacao: { borderWidth: 1, borderColor: c.borda, borderRadius: 8, padding: 12, gap: 8 },
  titulo: { fontSize: 22, fontWeight: 'bold' },
  subtitulo: { fontSize: 18, fontWeight: 'bold' },
  descricao: { marginTop: 8 },
  dataStatus: { marginTop: 4, fontWeight: '600' },
  contagem: { fontWeight: '600' },
  votoAtual: { marginTop: 4 },
  aviso: { marginTop: 6, textAlign: 'center' },
  acoes: { gap: 8, marginTop: 8 },
  botaoPrincipal: { backgroundColor: c.botao, borderRadius: 8, padding: 14, marginTop: 8 },
  botaoDesabilitado: { opacity: 0.5 },
  textoBotaoPrincipal: { color: c.textoBotao, fontWeight: 'bold', textAlign: 'center' },
  botaoVoto: { borderWidth: 1, borderColor: c.botao, borderRadius: 8, padding: 12 },
  botaoVotoSelecionado: { backgroundColor: c.botao },
  textoBotaoVoto: { fontWeight: 'bold', textAlign: 'center' },
  textoBotaoVotoSelecionado: { color: c.textoBotao },
  botaoSecundario: { borderWidth: 1, borderColor: c.botao, borderRadius: 8, padding: 12, marginTop: 8 },
  textoBotaoSecundario: { fontWeight: 'bold', textAlign: 'center' },
  carregandoVoto: { marginTop: 6 },
  botaoRemover: { borderWidth: 1, borderColor: c.perigo, borderRadius: 8, padding: 8, marginTop: 6 },
  textoRemover: { color: c.perigo, fontWeight: 'bold', textAlign: 'center' },
  mensagem: { marginTop: 8, textAlign: 'center' },
  linkHistorico: { color: c.azul, fontWeight: 'bold', textDecorationLine: 'underline' },
  historico: { gap: 12 },
  eventoHistorico: { borderTopWidth: 1, borderColor: c.borda, paddingTop: 12, gap: 8 },
  tituloEvento: { fontWeight: 'bold' },
  semFotos: { color: c.secundario },
  metricas: { flexDirection: 'row', gap: 8 },
  metrica: { flex: 1, borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 8,
    padding: 10, alignItems: 'center', justifyContent: 'center' },
  valorMetrica: { fontSize: 21, fontWeight: 'bold' },
  nomeMetrica: { fontSize: 11, textAlign: 'center' },
  itemGeral: { borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 8, padding: 12, gap: 4 },
  nomeItemGeral: { fontSize: 16, fontWeight: 'bold' },
  botaoAnteriores: { borderWidth: 1, borderColor: c.botao, borderRadius: 8, padding: 12 },
  textoBotaoAnteriores: { fontWeight: 'bold', textAlign: 'center' },
  listaAnteriores: { gap: 12 },
}));
