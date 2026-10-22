import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  RouteProp,
  useRoute,
} from '@react-navigation/native';

import { useAutenticacao } from '../contextos/autenticacao';
import type { RootStackParamList } from '../navegacao/rotas';
import {
  buscarHistoricoOcorrencia,
  buscarOcorrencia,
  buscarResumoValidacoes,
  confirmarProblema,
  EventoValidacao,
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

function tituloCategoria(
  categoria: OcorrenciaDetalhe['categoria']
) {
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

function tituloGravidade(
  gravidade: OcorrenciaDetalhe['gravidade']
) {
  switch (gravidade) {
    case 'LEVE':
      return 'Leve';
    case 'MODERADO':
      return 'Moderado';
    case 'GRAVE':
      return 'Grave';
  }
}

function tituloStatus(
  status: OcorrenciaDetalhe['status']
) {
  switch (status) {
    case 'PENDENTE_VALIDACAO':
      return 'Aguardando validação';
    case 'ATIVA':
      return 'Ativa';
    case 'RESOLVIDA':
      return 'Resolvida';
  }
}

function tituloVoto(voto: VotoResolucao) {
  return voto === 'RESOLVIDO'
    ? 'Resolvido'
    : 'Ainda existe';
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString('pt-BR');
}

function mensagemErroVoto(error: unknown) {
  const mensagem =
    error instanceof Error
      ? error.message
      : '';

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

  if (
    mensagem.includes(
      'A ocorrencia nao esta ativa'
    )
  ) {
    return 'Esta ocorrência não está mais disponível para votação.';
  }

  if (
    mensagem.includes(
      'Erro ao enviar foto'
    )
  ) {
    return 'Não foi possível enviar uma das fotos.';
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
    useRoute<
      RouteProp<RootStackParamList, 'Ocorrencia'>
    >();

  const [ocorrencia, setOcorrencia] =
    useState<OcorrenciaDetalhe | null>(null);
  const [resumo, setResumo] =
    useState<ResumoValidacoes>(resumoInicial);
  const [historico, setHistorico] =
    useState<EventoValidacao[]>([]);
  const [historicoAberto, setHistoricoAberto] =
    useState(false);
  const [votoPreparando, setVotoPreparando] =
    useState<VotoResolucao | null>(null);
  const [fotosVoto, setFotosVoto] =
    useState<string[]>([]);
  const [carregando, setCarregando] =
    useState(true);
  const [enviandoVoto, setEnviandoVoto] =
    useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] =
    useState('');

  const ocorrenciaId =
    route.params.ocorrenciaId;
  const usuarioId =
    sessao?.user.id ?? null;

  const carregarDados =
    useCallback(async () => {
      try {
        setCarregando(true);
        setErro('');

        const [
          dadosOcorrencia,
          dadosHistorico,
        ] = await Promise.all([
          buscarOcorrencia(
            ocorrenciaId
          ),
          buscarHistoricoOcorrencia(
            ocorrenciaId
          ),
        ]);

        setOcorrencia(
          dadosOcorrencia
        );
        setHistorico(
          dadosHistorico
        );

        if (usuarioId) {
          const dadosResumo =
            await buscarResumoValidacoes(
              ocorrenciaId,
              usuarioId
            );

          setResumo(
            dadosResumo
          );
        } else {
          setResumo(
            resumoInicial
          );
        }
      } catch (error) {
        if (
          error instanceof Error
        ) {
          console.error(
            error.message
          );
        }

        setErro(
          'Não foi possível carregar esta ocorrência.'
        );
      } finally {
        setCarregando(false);
      }
    }, [
      ocorrenciaId,
      usuarioId,
    ]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  async function confirmar() {
    if (
      !usuarioId ||
      enviandoVoto
    ) {
      return;
    }

    try {
      setEnviandoVoto(true);
      setMensagem('');

      await confirmarProblema(
        ocorrenciaId,
        usuarioId
      );

      setMensagem(
        'Ocorrência confirmada.'
      );

      await carregarDados();
    } catch (error) {
      setMensagem(
        mensagemErroVoto(
          error
        )
      );
    } finally {
      setEnviandoVoto(
        false
      );
    }
  }

  function prepararVoto(
    voto: VotoResolucao
  ) {
    setVotoPreparando(voto);
    setFotosVoto([]);
    setMensagem('');
  }

  async function tirarFotoVoto() {
    if (fotosVoto.length >= 3) {
      setMensagem(
        'Você pode adicionar no máximo 3 fotos.'
      );
      return;
    }

    try {
      const permissao =
        await ImagePicker
          .requestCameraPermissionsAsync();

      if (!permissao.granted) {
        setMensagem(
          'É necessário permitir o acesso à câmera.'
        );
        return;
      }

      const resultado =
        await ImagePicker
          .launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
          });

      if (resultado.canceled) {
        return;
      }

      setFotosVoto(
        (atual) => [
          ...atual,
          resultado.assets[0].uri,
        ]
      );

      setMensagem('');
    } catch {
      setMensagem(
        'Não foi possível utilizar a câmera.'
      );
    }
  }

  function removerFotoVoto(
    indice: number
  ) {
    setFotosVoto(
      (atual) =>
        atual.filter(
          (_, posicao) =>
            posicao !== indice
        )
    );

    setMensagem('');
  }

  async function enviarVoto() {
    if (
      !usuarioId ||
      !votoPreparando ||
      enviandoVoto
    ) {
      return;
    }

    try {
      setEnviandoVoto(true);
      setMensagem('');

      await votarResolucao(
        ocorrenciaId,
        usuarioId,
        votoPreparando,
        fotosVoto
      );

      setMensagem(
        votoPreparando ===
          'RESOLVIDO'
          ? 'Voto registrado como resolvido.'
          : 'Voto registrado como ainda existe.'
      );

      setVotoPreparando(
        null
      );
      setFotosVoto([]);

      await carregarDados();
    } catch (error) {
      setMensagem(
        mensagemErroVoto(
          error
        )
      );
    } finally {
      setEnviandoVoto(
        false
      );
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

  if (
    erro ||
    !ocorrencia
  ) {
    return (
      <View style={styles.centralizado}>
        <Text style={styles.mensagem}>
          {erro ||
            'Ocorrência não encontrada.'}
        </Text>
      </View>
    );
  }

  const ehAutor =
    usuarioId ===
    ocorrencia.usuario_id;

  const evidenciaResolucao =
    [...historico]
      .reverse()
      .find(
        (evento) =>
          evento.voto ===
            'RESOLVIDO' &&
          evento.fotos.length > 0
      );

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.galeria
        }
      >
        {ocorrencia.fotos.map(
          (foto, indice) => (
            <View
              key={foto.id}
              style={
                styles.cartaoFoto
              }
            >
              <Image
                source={{
                  uri: foto.foto_url,
                }}
                style={styles.foto}
              />

              {ocorrencia.fotos
                .length > 1 ? (
                <Text
                  style={
                    styles.numeroFoto
                  }
                >
                  {indice + 1}/
                  {
                    ocorrencia
                      .fotos.length
                  }
                </Text>
              ) : null}
            </View>
          )
        )}
      </ScrollView>

      <View style={styles.bloco}>
        <Text style={styles.titulo}>
          {tituloCategoria(
            ocorrencia.categoria
          )}
        </Text>

        <Text>
          Gravidade:{' '}
          {tituloGravidade(
            ocorrencia.gravidade
          )}
        </Text>

        <Text>
          Status:{' '}
          {tituloStatus(
            ocorrencia.status
          )}
        </Text>

        {ocorrencia.bairro ? (
          <Text>
            {
              ocorrencia
                .bairro.nome
            }{' '}
            —{' '}
            {
              ocorrencia
                .bairro.municipio
            }
            /
            {
              ocorrencia
                .bairro.uf
            }
          </Text>
        ) : null}

        {ocorrencia.descricao ? (
          <Text
            style={
              styles.descricao
            }
          >
            {ocorrencia.descricao}
          </Text>
        ) : null}

        {ocorrencia.status ===
          'ATIVA' &&
        ocorrencia.ativado_em ? (
          <Text style={styles.dataStatus}>
            Ativa desde{' '}
            {formatarData(
              ocorrencia.ativado_em
            )}
          </Text>
        ) : null}

        {ocorrencia.status ===
          'RESOLVIDA' &&
        ocorrencia.resolvido_em ? (
          <Text style={styles.dataStatus}>
            Resolvida em{' '}
            {formatarData(
              ocorrencia.resolvido_em
            )}
          </Text>
        ) : null}
      </View>

      {ocorrencia.status ===
        'RESOLVIDA' &&
      evidenciaResolucao ? (
        <View style={styles.bloco}>
          <Text
            style={styles.subtitulo}
          >
            Evidência da resolução
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.galeria
            }
          >
            {evidenciaResolucao
              .fotos.map((foto) => (
                <Image
                  key={foto.id}
                  source={{
                    uri:
                      foto.foto_url,
                  }}
                  style={
                    styles
                      .fotoEvidenciaDestaque
                  }
                />
              ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.bloco}>
        <Text style={styles.subtitulo}>
          Validação da comunidade
        </Text>

        {sessao ? (
          <>
            {ocorrencia.status ===
            'PENDENTE_VALIDACAO' ? (
              <Text style={styles.contagem}>
                Confirmações:{' '}
                {resumo.confirmacoes}/3
              </Text>
            ) : (
              <Text style={styles.contagem}>
                Confirmações concluídas
              </Text>
            )}

            {ocorrencia.status ===
            'ATIVA' ? (
              <>
                <Text style={styles.contagem}>
                  Resolvido:{' '}
                  {resumo.resolvidos}/3
                </Text>

                <Text style={styles.contagem}>
                  Ainda existe:{' '}
                  {resumo.aindaExiste}
                </Text>

                {resumo.votoResolucaoUsuario ? (
                  <Text style={styles.votoAtual}>
                    Seu voto atual:{' '}
                    {tituloVoto(
                      resumo
                        .votoResolucaoUsuario
                    )}
                  </Text>
                ) : null}
              </>
            ) : null}
          </>
        ) : null}

        {ocorrencia.status ===
        'RESOLVIDA' ? (
          <Text style={styles.aviso}>
            Esta ocorrência foi marcada
            como resolvida.
          </Text>
        ) : null}

        {!sessao ? (
          <Text style={styles.aviso}>
            Entre na sua conta para
            participar da validação.
          </Text>
        ) : ehAutor ? (
          <Text style={styles.aviso}>
            Você registrou esta ocorrência
            e não participa da votação
            dela.
          </Text>
        ) : ocorrencia.status ===
          'PENDENTE_VALIDACAO' ? (
          resumo.usuarioConfirmou ? (
            <Text style={styles.aviso}>
              Você já confirmou esta
              ocorrência.
            </Text>
          ) : (
            <Pressable
              style={[
                styles.botaoPrincipal,
                enviandoVoto &&
                  styles.botaoDesabilitado,
              ]}
              onPress={confirmar}
              disabled={enviandoVoto}
            >
              <Text
                style={
                  styles
                    .textoBotaoPrincipal
                }
              >
                {enviandoVoto
                  ? 'Confirmando...'
                  : 'Confirmar problema'}
              </Text>
            </Pressable>
          )
        ) : ocorrencia.status ===
          'ATIVA' ? (
          <View style={styles.acoes}>
            <Pressable
              style={[
                styles.botaoVoto,
                resumo
                  .votoResolucaoUsuario ===
                  'AINDA_EXISTE' &&
                  styles
                    .botaoVotoSelecionado,
              ]}
              onPress={() =>
                prepararVoto(
                  'AINDA_EXISTE'
                )
              }
              disabled={enviandoVoto}
            >
              <Text
                style={[
                  styles.textoBotaoVoto,
                  resumo
                    .votoResolucaoUsuario ===
                    'AINDA_EXISTE' &&
                    styles
                      .textoBotaoVotoSelecionado,
                ]}
              >
                Ainda existe
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.botaoVoto,
                resumo
                  .votoResolucaoUsuario ===
                  'RESOLVIDO' &&
                  styles
                    .botaoVotoSelecionado,
              ]}
              onPress={() =>
                prepararVoto(
                  'RESOLVIDO'
                )
              }
              disabled={enviandoVoto}
            >
              <Text
                style={[
                  styles.textoBotaoVoto,
                  resumo
                    .votoResolucaoUsuario ===
                    'RESOLVIDO' &&
                    styles
                      .textoBotaoVotoSelecionado,
                ]}
              >
                Resolvido
              </Text>
            </Pressable>

            {votoPreparando ? (
              <View
                style={
                  styles
                    .blocoPreparacao
                }
              >
                <Text
                  style={
                    styles.subtitulo
                  }
                >
                  {tituloVoto(
                    votoPreparando
                  )}
                </Text>

                <Text>
                  Você pode anexar até
                  3 fotos como evidência.
                  As fotos são opcionais.
                </Text>

                {fotosVoto.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={
                      false
                    }
                    contentContainerStyle={
                      styles.galeria
                    }
                  >
                    {fotosVoto.map(
                      (
                        fotoUri,
                        indice
                      ) => (
                        <View
                          key={
                            fotoUri +
                            indice
                          }
                        >
                          <Image
                            source={{
                              uri:
                                fotoUri,
                            }}
                            style={
                              styles
                                .fotoEvidencia
                            }
                          />

                          <Text
                            style={
                              styles
                                .numeroFoto
                            }
                          >
                            Foto{' '}
                            {indice + 1}
                          </Text>

                          <Pressable
                            style={
                              styles
                                .botaoRemover
                            }
                            onPress={() =>
                              removerFotoVoto(
                                indice
                              )
                            }
                            disabled={
                              enviandoVoto
                            }
                          >
                            <Text
                              style={
                                styles
                                  .textoRemover
                              }
                            >
                              Remover
                            </Text>
                          </Pressable>
                        </View>
                      )
                    )}
                  </ScrollView>
                ) : null}

                {fotosVoto.length < 3 ? (
                  <Pressable
                    style={
                      styles
                        .botaoSecundario
                    }
                    onPress={
                      tirarFotoVoto
                    }
                    disabled={
                      enviandoVoto
                    }
                  >
                    <Text
                      style={
                        styles
                          .textoBotaoSecundario
                      }
                    >
                      {fotosVoto.length ===
                      0
                        ? 'Adicionar foto'
                        : 'Adicionar outra foto'}
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    style={styles.aviso}
                  >
                    Limite de 3 fotos
                    atingido.
                  </Text>
                )}

                <Pressable
                  style={
                    styles
                      .botaoPrincipal
                  }
                  onPress={
                    enviarVoto
                  }
                  disabled={
                    enviandoVoto
                  }
                >
                  <Text
                    style={
                      styles
                        .textoBotaoPrincipal
                    }
                  >
                    {enviandoVoto
                      ? 'Enviando...'
                      : 'Confirmar voto'}
                  </Text>
                </Pressable>

                <Pressable
                  style={
                    styles
                      .botaoSecundario
                  }
                  onPress={() => {
                    setVotoPreparando(
                      null
                    );
                    setFotosVoto([]);
                    setMensagem('');
                  }}
                  disabled={
                    enviandoVoto
                  }
                >
                  <Text
                    style={
                      styles
                        .textoBotaoSecundario
                    }
                  >
                    Cancelar
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {enviandoVoto &&
        ocorrencia.status ===
          'ATIVA' ? (
          <ActivityIndicator
            style={
              styles.carregandoVoto
            }
          />
        ) : null}

        {mensagem ? (
          <Text
            style={styles.mensagem}
          >
            {mensagem}
          </Text>
        ) : null}
      </View>

      {historico.length > 0 ? (
        <View style={styles.bloco}>
          <Pressable
            onPress={() =>
              setHistoricoAberto(
                (atual) => !atual
              )
            }
          >
            <Text
              style={
                styles.linkHistorico
              }
            >
              {historicoAberto
                ? 'Ocultar histórico'
                : 'Ver histórico da ocorrência >'}
            </Text>
          </Pressable>

          {historicoAberto ? (
            <View
              style={
                styles.historico
              }
            >
              <View
                style={
                  styles.eventoHistorico
                }
              >
                <Text
                  style={
                    styles.tituloEvento
                  }
                >
                  Relato original
                </Text>

                <Text>
                  {formatarData(
                    ocorrencia
                      .criado_em
                  )}
                </Text>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  contentContainerStyle={
                    styles.galeria
                  }
                >
                  {ocorrencia.fotos.map(
                    (foto) => (
                      <Image
                        key={foto.id}
                        source={{
                          uri:
                            foto
                              .foto_url,
                        }}
                        style={
                          styles
                            .fotoHistorico
                        }
                      />
                    )
                  )}
                </ScrollView>
              </View>

              {historico.map(
                (evento) => (
                  <View
                    key={
                      evento.id
                    }
                    style={
                      styles
                        .eventoHistorico
                    }
                  >
                    <Text
                      style={
                        styles
                          .tituloEvento
                      }
                    >
                      {tituloVoto(
                        evento.voto
                      )}
                    </Text>

                    <Text>
                      {formatarData(
                        evento
                          .criado_em
                      )}
                    </Text>

                    {evento.fotos
                      .length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={
                          false
                        }
                        contentContainerStyle={
                          styles.galeria
                        }
                      >
                        {evento.fotos.map(
                          (foto) => (
                            <Image
                              key={
                                foto.id
                              }
                              source={{
                                uri:
                                  foto
                                    .foto_url,
                              }}
                              style={
                                styles
                                  .fotoHistorico
                              }
                            />
                          )
                        )}
                      </ScrollView>
                    ) : (
                      <Text
                        style={
                          styles
                            .semFotos
                        }
                      >
                        Sem foto anexada.
                      </Text>
                    )}
                  </View>
                )
              )}
            </View>
          ) : null}
        </View>
      ) : null}
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

  galeria: {
    gap: 10,
  },

  cartaoFoto: {
    width: 300,
  },

  foto: {
    width: 300,
    height: 240,
    borderRadius: 10,
  },

  fotoEvidencia: {
    width: 180,
    height: 135,
    borderRadius: 8,
  },

  fotoEvidenciaDestaque: {
    width: 280,
    height: 210,
    borderRadius: 10,
  },

  fotoHistorico: {
    width: 160,
    height: 120,
    borderRadius: 8,
  },

  numeroFoto: {
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },

  bloco: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 10,
    padding: 16,
    gap: 8,
  },

  blocoPreparacao: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    padding: 12,
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

  dataStatus: {
    marginTop: 4,
    fontWeight: '600',
  },

  contagem: {
    fontWeight: '600',
  },

  votoAtual: {
    marginTop: 4,
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

  botaoSecundario: {
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },

  textoBotaoSecundario: {
    fontWeight: 'bold',
    textAlign: 'center',
  },

  botaoRemover: {
    borderWidth: 1,
    borderColor: '#b00020',
    borderRadius: 8,
    padding: 6,
    marginTop: 4,
  },

  textoRemover: {
    color: '#b00020',
    fontWeight: 'bold',
    textAlign: 'center',
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

  linkHistorico: {
    fontWeight: 'bold',
    textAlign: 'right',
  },

  historico: {
    gap: 12,
    marginTop: 8,
  },

  eventoHistorico: {
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
    paddingTop: 10,
    gap: 6,
  },

  tituloEvento: {
    fontWeight: 'bold',
  },

  semFotos: {
    fontStyle: 'italic',
  },
});
