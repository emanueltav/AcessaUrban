import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  RouteProp,
  useRoute,
} from '@react-navigation/native';

import { useAutenticacao } from '../contextos/autenticacao';
import type { RootStackParamList } from '../navegacao/rotas';
import {
  buscarOcorrencia,
  buscarResumoValidacoes,
  confirmarProblema,
  OcorrenciaDetalhe,
  ResumoValidacoes,
  votarResolucao,
  VotoResolucao,
} from '../servicos/votacoes';

const resumoInicial: ResumoValidacoes = {
  confirmacoes: 0,
  resolvidos: 0,
  aindaExiste: 0,
  usuarioConfirmou: false,
  votoResolucaoUsuario: null,
};

function tituloCategoria(categoria: OcorrenciaDetalhe['categoria']) {
  switch (categoria) {
    case 'PAVIMENTACAO':
      return 'Pavimentação';
    case 'ILUMINACAO':
      return 'Iluminação';
    case 'ESGOTO':
      return 'Esgoto';
    case 'CALCAMENTO':
      return 'Calçamento';
  }
}

function tituloGravidade(gravidade: OcorrenciaDetalhe['gravidade']) {
  switch (gravidade) {
    case 'LEVE':
      return 'Leve';
    case 'MODERADO':
      return 'Moderado';
    case 'GRAVE':
      return 'Grave';
  }
}

function tituloStatus(status: OcorrenciaDetalhe['status']) {
  switch (status) {
    case 'PENDENTE_VALIDACAO':
      return 'Aguardando validação';
    case 'ATIVA':
      return 'Ativa';
    case 'RESOLVIDA':
      return 'Resolvida';
  }
}

function mensagemErroVoto(error: unknown) {
  const mensagem =
    error instanceof Error ? error.message : '';

  if (
    mensagem.includes(
      'O autor nao pode validar a propria ocorrencia'
    )
  ) {
    return 'Você não pode votar na ocorrência que registrou.';
  }

  if (
    mensagem.includes(
      'A ocorrencia nao esta aguardando confirmacao'
    )
  ) {
    return 'Esta ocorrência não está mais aguardando confirmação.';
  }

  if (mensagem.includes('A ocorrencia nao esta ativa')) {
    return 'Esta ocorrência não está mais disponível para votação.';
  }

  if (
    mensagem.includes('duplicate key') ||
    mensagem.includes('unique constraint')
  ) {
    return 'Você já confirmou esta ocorrência.';
  }

  return 'Não foi possível registrar seu voto.';
}

export default function Ocorrencias() {
  const { sessao } = useAutenticacao();

  const route =
    useRoute<RouteProp<RootStackParamList, 'Ocorrencia'>>();

  const [ocorrencia, setOcorrencia] =
    useState<OcorrenciaDetalhe | null>(null);
  const [resumo, setResumo] =
    useState<ResumoValidacoes>(resumoInicial);
  const [carregando, setCarregando] = useState(true);
  const [enviandoVoto, setEnviandoVoto] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  const ocorrenciaId = route.params.ocorrenciaId;
  const usuarioId = sessao?.user.id ?? null;

  const carregarDados = useCallback(async () => {
    try {
      setCarregando(true);
      setErro('');

      const dadosOcorrencia =
        await buscarOcorrencia(ocorrenciaId);

      setOcorrencia(dadosOcorrencia);

      if (usuarioId) {
        const dadosResumo =
          await buscarResumoValidacoes(
            ocorrenciaId,
            usuarioId
          );

        setResumo(dadosResumo);
      } else {
        setResumo(resumoInicial);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(error.message);
      }

      setErro(
        'Não foi possível carregar esta ocorrência.'
      );
    } finally {
      setCarregando(false);
    }
  }, [ocorrenciaId, usuarioId]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  async function confirmar() {
    if (!usuarioId || enviandoVoto) {
      return;
    }

    try {
      setEnviandoVoto(true);
      setMensagem('');

      await confirmarProblema(
        ocorrenciaId,
        usuarioId
      );

      setMensagem('Ocorrência confirmada.');
      await carregarDados();
    } catch (error) {
      setMensagem(mensagemErroVoto(error));
    } finally {
      setEnviandoVoto(false);
    }
  }

  async function votar(voto: VotoResolucao) {
    if (!usuarioId || enviandoVoto) {
      return;
    }

    if (resumo.votoResolucaoUsuario === voto) {
      return;
    }

    try {
      setEnviandoVoto(true);
      setMensagem('');

      await votarResolucao(
        ocorrenciaId,
        usuarioId,
        voto
      );

      setMensagem(
        voto === 'RESOLVIDO'
          ? 'Voto alterado para resolvido.'
          : 'Voto alterado para ainda existe.'
      );

      await carregarDados();
    } catch (error) {
      setMensagem(mensagemErroVoto(error));
    } finally {
      setEnviandoVoto(false);
    }
  }

  if (carregando) {
    return (
      <View style={styles.centralizado}>
        <ActivityIndicator />
        <Text style={styles.mensagem}>
          Carregando ocorrência...
        </Text>
      </View>
    );
  }

  if (erro || !ocorrencia) {
    return (
      <View style={styles.centralizado}>
        <Text style={styles.mensagem}>
          {erro || 'Ocorrência não encontrada.'}
        </Text>
      </View>
    );
  }

  const ehAutor =
    usuarioId === ocorrencia.usuario_id;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Image
        source={{ uri: ocorrencia.foto_url }}
        style={styles.foto}
      />

      <View style={styles.bloco}>
        <Text style={styles.titulo}>
          {tituloCategoria(ocorrencia.categoria)}
        </Text>

        <Text>
          Gravidade: {tituloGravidade(ocorrencia.gravidade)}
        </Text>

        <Text>
          Status: {tituloStatus(ocorrencia.status)}
        </Text>

        {ocorrencia.bairro ? (
          <Text>
            {ocorrencia.bairro.nome} —{' '}
            {ocorrencia.bairro.municipio}/
            {ocorrencia.bairro.uf}
          </Text>
        ) : null}

        {ocorrencia.descricao ? (
          <Text style={styles.descricao}>
            {ocorrencia.descricao}
          </Text>
        ) : null}
      </View>

      <View style={styles.bloco}>
        <Text style={styles.subtitulo}>
          Validação da comunidade
        </Text>

        {sessao ? (
          <>
            {ocorrencia.status === 'PENDENTE_VALIDACAO' ? (
              <Text style={styles.contagem}>
                Confirmações: {resumo.confirmacoes}/3
              </Text>
            ) : (
              <Text style={styles.contagem}>
                Confirmações concluídas
              </Text>
            )}

            {ocorrencia.status === 'ATIVA' ? (
              <>
                <Text style={styles.contagem}>
                  Resolvido: {resumo.resolvidos}/3
                </Text>

                <Text style={styles.contagem}>
                  Ainda existe: {resumo.aindaExiste}
                </Text>
              </>
            ) : null}
          </>
        ) : null}

        {ocorrencia.status === 'RESOLVIDA' ? (
          <Text style={styles.aviso}>
            Esta ocorrência foi marcada como resolvida.
          </Text>
        ) : null}

        {!sessao ? (
          <Text style={styles.aviso}>
            Entre na sua conta para participar da validação.
          </Text>
        ) : ehAutor ? (
          <Text style={styles.aviso}>
            Você registrou esta ocorrência e não participa da
            votação dela.
          </Text>
        ) : ocorrencia.status === 'PENDENTE_VALIDACAO' ? (
          resumo.usuarioConfirmou ? (
            <Text style={styles.aviso}>
              Você já confirmou esta ocorrência.
            </Text>
          ) : (
            <Pressable
              style={[
                styles.botaoPrincipal,
                enviandoVoto && styles.botaoDesabilitado,
              ]}
              onPress={confirmar}
              disabled={enviandoVoto}
            >
              <Text style={styles.textoBotaoPrincipal}>
                {enviandoVoto
                  ? 'Confirmando...'
                  : 'Confirmar problema'}
              </Text>
            </Pressable>
          )
        ) : ocorrencia.status === 'ATIVA' ? (
          <View style={styles.acoes}>
            <Pressable
              style={[
                styles.botaoVoto,
                resumo.votoResolucaoUsuario ===
                  'AINDA_EXISTE' &&
                  styles.botaoVotoSelecionado,
              ]}
              onPress={() => votar('AINDA_EXISTE')}
              disabled={enviandoVoto}
            >
              <Text
                style={[
                  styles.textoBotaoVoto,
                  resumo.votoResolucaoUsuario ===
                    'AINDA_EXISTE' &&
                    styles.textoBotaoVotoSelecionado,
                ]}
              >
                Ainda existe
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.botaoVoto,
                resumo.votoResolucaoUsuario ===
                  'RESOLVIDO' &&
                  styles.botaoVotoSelecionado,
              ]}
              onPress={() => votar('RESOLVIDO')}
              disabled={enviandoVoto}
            >
              <Text
                style={[
                  styles.textoBotaoVoto,
                  resumo.votoResolucaoUsuario ===
                    'RESOLVIDO' &&
                    styles.textoBotaoVotoSelecionado,
                ]}
              >
                Resolvido
              </Text>
            </Pressable>
          </View>
        ) : null}

        {enviandoVoto &&
        ocorrencia.status === 'ATIVA' ? (
          <ActivityIndicator style={styles.carregandoVoto} />
        ) : null}

        {mensagem ? (
          <Text style={styles.mensagem}>
            {mensagem}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  foto: {
    width: '100%',
    height: 260,
    borderRadius: 10,
  },

  bloco: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 10,
    padding: 16,
    gap: 8,
  },

  titulo: {
    fontSize: 22,
    fontWeight: 'bold',
  },

  subtitulo: {
    fontSize: 18,
    fontWeight: 'bold',
  },

  descricao: {
    marginTop: 8,
  },

  contagem: {
    fontWeight: '600',
  },

  aviso: {
    marginTop: 6,
    textAlign: 'center',
  },

  acoes: {
    gap: 8,
    marginTop: 8,
  },

  botaoPrincipal: {
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 14,
    marginTop: 8,
  },

  textoBotaoPrincipal: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },

  botaoVoto: {
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    padding: 12,
  },

  botaoVotoSelecionado: {
    backgroundColor: '#222222',
  },

  textoBotaoVoto: {
    fontWeight: 'bold',
    textAlign: 'center',
  },

  textoBotaoVotoSelecionado: {
    color: '#ffffff',
  },

  botaoDesabilitado: {
    opacity: 0.6,
  },

  carregandoVoto: {
    marginTop: 8,
  },

  mensagem: {
    textAlign: 'center',
    marginTop: 8,
  },
});
