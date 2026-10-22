import {
  useCallback,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useFocusEffect,
} from '@react-navigation/native';
import * as ImagePicker
  from 'expo-image-picker';
import * as Location
  from 'expo-location';

import {
  useAutenticacao,
} from '../contextos/autenticacao';
import {
  avaliarPraca,
  confirmarPraca,
  listarPracas,
  Praca,
  registrarPraca,
} from '../servicos/pracas';

function textoBonus(
  praca: Praca
) {
  if (
    praca.status !==
      'APROVADA' ||
    praca.totalAvaliacoes <
      2 ||
    praca.media === null ||
    praca.media < 4
  ) {
    return null;
  }

  return praca.media >= 4.5
    ? 'Bônus para o bairro: +0,10'
    : 'Bônus para o bairro: +0,05';
}

export default function Pracas() {
  const { sessao } =
    useAutenticacao();

  const [pracas, setPracas] =
    useState<Praca[]>([]);

  const [
    cadastrando,
    setCadastrando,
  ] = useState(false);

  const [nome, setNome] =
    useState('');

  const [
    fotoUris,
    setFotoUris,
  ] = useState<string[]>([]);

  const [
    latitude,
    setLatitude,
  ] =
    useState<number | null>(
      null
    );

  const [
    longitude,
    setLongitude,
  ] =
    useState<number | null>(
      null
    );

  const [
    notasConfirmacao,
    setNotasConfirmacao,
  ] = useState<
    Record<string, number>
  >({});

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    processando,
    setProcessando,
  ] =
    useState<string | null>(
      null
    );

  const [
    mensagem,
    setMensagem,
  ] = useState('');

  const usuarioId =
    sessao?.user.id ?? null;

  const carregarPracas =
    useCallback(
      async () => {
        try {
          setCarregando(
            true
          );

          const dados =
            await listarPracas(
              usuarioId
            );

          setPracas(dados);
        } catch (error) {
          setMensagem(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar as praças.'
          );
        } finally {
          setCarregando(
            false
          );
        }
      },
      [usuarioId]
    );

  useFocusEffect(
    useCallback(() => {
      carregarPracas();
    }, [carregarPracas])
  );

  async function obterLocalizacao() {
    const permissao =
      await Location
        .requestForegroundPermissionsAsync();

    if (!permissao.granted) {
      throw new Error(
        'É necessário permitir o acesso à localização.'
      );
    }

    const localizacao =
      await Location
        .getCurrentPositionAsync({
          accuracy:
            Location
              .Accuracy.High,
        });

    setLatitude(
      localizacao.coords
        .latitude
    );

    setLongitude(
      localizacao.coords
        .longitude
    );
  }

  async function tirarFoto() {
    if (
      fotoUris.length >= 3
    ) {
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
            mediaTypes: [
              'images',
            ],
            quality: 0.7,
          });

      if (
        resultado.canceled
      ) {
        return;
      }

      const primeiraFoto =
        fotoUris.length === 0;

      setFotoUris(
        (atual) => [
          ...atual,
          resultado
            .assets[0]
            .uri,
        ]
      );

      if (primeiraFoto) {
        setLatitude(null);
        setLongitude(null);

        await obterLocalizacao();
      }

      setMensagem('');
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : 'Não foi possível utilizar a câmera.'
      );
    }
  }

  function removerFoto(
    indice: number
  ) {
    setFotoUris(
      (atual) => {
        const novas =
          atual.filter(
            (_, posicao) =>
              posicao !==
              indice
          );

        if (
          novas.length === 0
        ) {
          setLatitude(null);
          setLongitude(null);
        }

        return novas;
      }
    );
  }

  function limparCadastro() {
    setNome('');
    setFotoUris([]);
    setLatitude(null);
    setLongitude(null);
    setCadastrando(false);
  }

  async function cadastrar() {
    if (
      !usuarioId ||
      processando
    ) {
      return;
    }

    if (!nome.trim()) {
      setMensagem(
        'Informe o nome da praça.'
      );
      return;
    }

    if (
      fotoUris.length < 1
    ) {
      setMensagem(
        'Adicione pelo menos uma foto da praça.'
      );
      return;
    }

    if (
      latitude === null ||
      longitude === null
    ) {
      setMensagem(
        'A localização da praça ainda não foi obtida.'
      );
      return;
    }

    try {
      setProcessando(
        'cadastro'
      );
      setMensagem('');

      await registrarPraca({
        usuarioId,
        nome,
        fotoUris,
        latitude,
        longitude,
      });

      limparCadastro();

      setMensagem(
        'Praça cadastrada. Ela precisa de 2 confirmações para ser aprovada.'
      );

      await carregarPracas();
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : 'Não foi possível cadastrar a praça.'
      );
    } finally {
      setProcessando(null);
    }
  }

  async function confirmar(
    praca: Praca
  ) {
    if (
      !usuarioId ||
      processando
    ) {
      return;
    }

    const nota =
      notasConfirmacao[
        praca.id
      ];

    if (!nota) {
      setMensagem(
        'Escolha de 1 a 5 estrelas antes de confirmar a praça.'
      );
      return;
    }

    try {
      setProcessando(
        praca.id
      );
      setMensagem('');

      const novoStatus =
        await confirmarPraca(
          praca.id,
          nota
        );

      setNotasConfirmacao(
        (atual) => {
          const novo = {
            ...atual,
          };

          delete novo[
            praca.id
          ];

          return novo;
        }
      );

      setMensagem(
        novoStatus ===
          'APROVADA'
          ? 'Praça confirmada e aprovada.'
          : 'Confirmação registrada.'
      );

      await carregarPracas();
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a praça.'
      );
    } finally {
      setProcessando(null);
    }
  }

  async function avaliar(
    pracaId: string,
    nota: number
  ) {
    if (!usuarioId) {
      setMensagem(
        'Entre na sua conta para avaliar uma praça.'
      );
      return;
    }

    if (processando) {
      return;
    }

    try {
      setProcessando(
        pracaId
      );
      setMensagem('');

      await avaliarPraca(
        pracaId,
        nota
      );

      setMensagem(
        'Avaliação registrada.'
      );

      await carregarPracas();
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar sua avaliação.'
      );
    } finally {
      setProcessando(null);
    }
  }

  if (carregando) {
    return (
      <View
        style={
          styles.centralizado
        }
      >
        <ActivityIndicator />

        <Text
          style={
            styles.mensagem
          }
        >
          Carregando praças...
        </Text>
      </View>
    );
  }

  const pendentes =
    pracas.filter(
      (praca) =>
        praca.status ===
        'PENDENTE'
    );

  const aprovadas =
    pracas.filter(
      (praca) =>
        praca.status ===
        'APROVADA'
    );

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
    >
      <Text
        style={styles.titulo}
      >
        Praças
      </Text>

      {sessao ? (
        <Pressable
          style={
            styles
              .botaoPrincipal
          }
          onPress={() => {
            if (cadastrando) {
              limparCadastro();
            } else {
              setCadastrando(
                true
              );
            }

            setMensagem('');
          }}
          disabled={
            processando !==
            null
          }
        >
          <Text
            style={
              styles
                .textoBotaoPrincipal
            }
          >
            {cadastrando
              ? 'Cancelar cadastro'
              : 'Cadastrar nova praça'}
          </Text>
        </Pressable>
      ) : (
        <Text
          style={styles.aviso}
        >
          Entre na sua conta para
          cadastrar ou avaliar
          praças.
        </Text>
      )}

      {cadastrando ? (
        <View
          style={styles.bloco}
        >
          <Text
            style={
              styles.subtitulo
            }
          >
            Nova praça
          </Text>

          <TextInput
            style={styles.campo}
            placeholder="Nome da praça"
            value={nome}
            onChangeText={
              setNome
            }
            editable={
              processando ===
              null
            }
          />

          <Text>
            Adicione de 1 a 3
            fotos.
          </Text>

          {fotoUris.length >
          0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.galeria
              }
            >
              {fotoUris.map(
                (
                  fotoUri,
                  indice
                ) => (
                  <View
                    key={
                      fotoUri +
                      indice
                    }
                    style={
                      styles
                        .cartaoFoto
                    }
                  >
                    <Image
                      source={{
                        uri:
                          fotoUri,
                      }}
                      style={
                        styles
                          .fotoCadastro
                      }
                    />

                    <Text
                      style={
                        styles
                          .numeroFoto
                      }
                    >
                      Foto{' '}
                      {indice +
                        1}
                    </Text>

                    <Pressable
                      style={
                        styles
                          .botaoRemover
                      }
                      onPress={() =>
                        removerFoto(
                          indice
                        )
                      }
                      disabled={
                        processando !==
                        null
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

          {fotoUris.length <
          3 ? (
            <Pressable
              style={
                styles
                  .botaoSecundario
              }
              onPress={
                tirarFoto
              }
              disabled={
                processando !==
                null
              }
            >
              <Text
                style={
                  styles
                    .textoBotaoSecundario
                }
              >
                {fotoUris.length ===
                0
                  ? 'Tirar foto'
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

          {latitude !== null &&
          longitude !== null ? (
            <Text>
              Localização obtida
              automaticamente.
            </Text>
          ) : null}

          <Pressable
            style={
              styles
                .botaoPrincipal
            }
            onPress={
              cadastrar
            }
            disabled={
              processando !==
              null
            }
          >
            <Text
              style={
                styles
                  .textoBotaoPrincipal
              }
            >
              {processando ===
              'cadastro'
                ? 'Cadastrando...'
                : 'Registrar praça'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {sessao &&
      pendentes.length > 0 ? (
        <>
          <Text
            style={
              styles.subtitulo
            }
          >
            Aguardando confirmação
          </Text>

          {pendentes.map(
            (praca) => {
              const ehAutor =
                usuarioId ===
                praca.usuario_id;

              const nota =
                notasConfirmacao[
                  praca.id
                ] ?? 0;

              return (
                <View
                  key={praca.id}
                  style={
                    styles.bloco
                  }
                >
                  <Galeria
                    praca={praca}
                  />

                  <Text
                    style={
                      styles
                        .subtitulo
                    }
                  >
                    {praca.nome}
                  </Text>

                  <LocalPraca
                    praca={praca}
                  />

                  <Text>
                    Confirmações:{' '}
                    {
                      praca
                        .confirmacoes
                    }
                    /2
                  </Text>

                  {ehAutor ? (
                    <Text
                      style={
                        styles.aviso
                      }
                    >
                      Você cadastrou
                      esta praça. Outros
                      usuários precisam
                      confirmar a
                      existência dela.
                    </Text>
                  ) : praca
                      .usuarioConfirmou ? (
                    <Text
                      style={
                        styles.aviso
                      }
                    >
                      Você já confirmou
                      esta praça.
                    </Text>
                  ) : (
                    <>
                      <Text>
                        Esta praça
                        realmente existe
                        neste local?
                        Avalie para
                        confirmar:
                      </Text>

                      <Estrelas
                        valor={nota}
                        onPress={(
                          valor
                        ) =>
                          setNotasConfirmacao(
                            (
                              atual
                            ) => ({
                              ...atual,

                              [
                                praca.id
                              ]:
                                valor,
                            })
                          )
                        }
                        disabled={
                          processando !==
                          null
                        }
                      />

                      <Pressable
                        style={
                          styles
                            .botaoPrincipal
                        }
                        onPress={() =>
                          confirmar(
                            praca
                          )
                        }
                        disabled={
                          processando !==
                          null
                        }
                      >
                        <Text
                          style={
                            styles
                              .textoBotaoPrincipal
                          }
                        >
                          {processando ===
                          praca.id
                            ? 'Confirmando...'
                            : 'Confirmar praça'}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              );
            }
          )}
        </>
      ) : null}

      <Text
        style={styles.subtitulo}
      >
        Praças aprovadas
      </Text>

      {aprovadas.length ===
      0 ? (
        <Text
          style={styles.aviso}
        >
          Nenhuma praça aprovada
          ainda.
        </Text>
      ) : (
        aprovadas.map(
          (praca) => {
            const bonus =
              textoBonus(
                praca
              );

            return (
              <View
                key={praca.id}
                style={
                  styles.bloco
                }
              >
                <Galeria
                  praca={praca}
                />

                <Text
                  style={
                    styles
                      .subtitulo
                  }
                >
                  {praca.nome}
                </Text>

                <LocalPraca
                  praca={praca}
                />

                <Text
                  style={
                    styles.media
                  }
                >
                  {praca.media ===
                  null
                    ? 'Sem avaliações'
                    : \`★ \${praca.media.toFixed(
                        1
                      )} (\${praca.totalAvaliacoes})\`}
                </Text>

                {bonus ? (
                  <Text
                    style={
                      styles.bonus
                    }
                  >
                    {bonus}
                  </Text>
                ) : null}

                {sessao ? (
                  <>
                    <Text>
                      Sua avaliação:
                    </Text>

                    <Estrelas
                      valor={
                        praca
                          .avaliacaoUsuario ??
                        0
                      }
                      onPress={(
                        valor
                      ) =>
                        avaliar(
                          praca.id,
                          valor
                        )
                      }
                      disabled={
                        processando !==
                        null
                      }
                    />
                  </>
                ) : null}
              </View>
            );
          }
        )
      )}

      {mensagem ? (
        <Text
          style={
            styles.mensagem
          }
        >
          {mensagem}
        </Text>
      ) : null}
    </ScrollView>
  );
}

function Galeria({
  praca,
}: {
  praca: Praca;
}) {
  if (
    praca.fotos.length === 0
  ) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={
        false
      }
      contentContainerStyle={
        styles.galeria
      }
    >
      {praca.fotos.map(
        (foto, indice) => (
          <View
            key={foto.id}
            style={
              styles.cartaoFoto
            }
          >
            <Image
              source={{
                uri:
                  foto.foto_url,
              }}
              style={styles.foto}
            />

            {praca.fotos.length >
            1 ? (
              <Text
                style={
                  styles
                    .numeroFoto
                }
              >
                {indice + 1}/
                {
                  praca.fotos
                    .length
                }
              </Text>
            ) : null}
          </View>
        )
      )}
    </ScrollView>
  );
}

function LocalPraca({
  praca,
}: {
  praca: Praca;
}) {
  if (!praca.bairro) {
    return null;
  }

  return (
    <Text>
      {praca.bairro.nome} —{' '}
      {praca.bairro.municipio}/
      {praca.bairro.uf}
    </Text>
  );
}

function Estrelas({
  valor,
  onPress,
  disabled,
}: {
  valor: number;
  onPress: (
    nota: number
  ) => void;
  disabled: boolean;
}) {
  return (
    <View
      style={styles.estrelas}
    >
      {[
        1,
        2,
        3,
        4,
        5,
      ].map((nota) => (
        <Pressable
          key={nota}
          onPress={() =>
            onPress(nota)
          }
          disabled={disabled}
        >
          <Text
            style={
              styles.estrela
            }
          >
            {nota <= valor
              ? '★'
              : '☆'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      padding: 20,
      gap: 16,
    },

    centralizado: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding: 24,
    },

    titulo: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
    },

    subtitulo: {
      fontSize: 18,
      fontWeight: 'bold',
    },

    bloco: {
      borderWidth: 1,
      borderColor:
        '#dddddd',
      borderRadius: 10,
      padding: 14,
      gap: 8,
    },

    campo: {
      borderWidth: 1,
      borderColor:
        '#cccccc',
      borderRadius: 8,
      padding: 12,
    },

    galeria: {
      gap: 10,
    },

    cartaoFoto: {
      width: 240,
    },

    foto: {
      width: 240,
      height: 180,
      borderRadius: 8,
    },

    fotoCadastro: {
      width: 240,
      height: 180,
      borderRadius: 8,
    },

    numeroFoto: {
      textAlign: 'center',
      marginTop: 4,
      fontWeight: '600',
    },

    botaoPrincipal: {
      backgroundColor:
        '#222222',
      borderRadius: 8,
      padding: 14,
    },

    textoBotaoPrincipal: {
      color: '#ffffff',
      fontWeight: 'bold',
      textAlign: 'center',
    },

    botaoSecundario: {
      borderWidth: 1,
      borderColor:
        '#222222',
      borderRadius: 8,
      padding: 12,
    },

    textoBotaoSecundario: {
      fontWeight: 'bold',
      textAlign: 'center',
    },

    botaoRemover: {
      borderWidth: 1,
      borderColor:
        '#b00020',
      borderRadius: 8,
      padding: 8,
      marginTop: 6,
    },

    textoRemover: {
      color: '#b00020',
      fontWeight: 'bold',
      textAlign: 'center',
    },

    media: {
      fontSize: 17,
      fontWeight: 'bold',
    },

    bonus: {
      fontWeight: '600',
    },

    estrelas: {
      flexDirection: 'row',
      gap: 8,
    },

    estrela: {
      fontSize: 32,
    },

    aviso: {
      textAlign: 'center',
    },

    mensagem: {
      textAlign: 'center',
    },
  });
