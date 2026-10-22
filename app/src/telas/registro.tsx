import { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

import { useAutenticacao } from '../contextos/autenticacao';
import { registrarOcorrencia } from '../servicos/ocorrencias';

type Categoria =
  | 'PAVIMENTACAO'
  | 'ILUMINACAO'
  | 'ESGOTO'
  | 'CALCAMENTO';

type Gravidade = 'LEVE' | 'MODERADO' | 'GRAVE';

const categorias: {
  valor: Categoria;
  titulo: string;
}[] = [
  { valor: 'PAVIMENTACAO', titulo: 'Pavimentação' },
  { valor: 'ILUMINACAO', titulo: 'Iluminação' },
  { valor: 'ESGOTO', titulo: 'Esgoto' },
  { valor: 'CALCAMENTO', titulo: 'Calçamento' },
];

const gravidades: {
  valor: Gravidade;
  titulo: string;
}[] = [
  { valor: 'LEVE', titulo: 'Leve' },
  { valor: 'MODERADO', titulo: 'Moderado' },
  { valor: 'GRAVE', titulo: 'Grave' },
];

export default function Registro() {
  const { sessao, carregando } = useAutenticacao();

  const [fotoUris, setFotoUris] = useState<string[]>([]);

  const [latitude, setLatitude] =
    useState<number | null>(null);

  const [longitude, setLongitude] =
    useState<number | null>(null);

  const [categoria, setCategoria] =
    useState<Categoria | null>(null);

  const [gravidade, setGravidade] =
    useState<Gravidade | null>(null);

  const [descricao, setDescricao] = useState('');

  const [
    obtendoLocalizacao,
    setObtendoLocalizacao,
  ] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  async function obterLocalizacao() {
    setObtendoLocalizacao(true);

    try {
      const permissao =
        await Location.requestForegroundPermissionsAsync();

      if (!permissao.granted) {
        setMensagem(
          'É necessário permitir o acesso à localização.'
        );
        return;
      }

      const localizacao =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      setLatitude(localizacao.coords.latitude);
      setLongitude(localizacao.coords.longitude);
      setMensagem('');
    } catch {
      setMensagem(
        'Não foi possível obter sua localização.'
      );
    } finally {
      setObtendoLocalizacao(false);
    }
  }

  async function tirarFoto() {
    if (fotoUris.length >= 3) {
      setMensagem(
        'Você pode adicionar no máximo 3 fotos.'
      );
      return;
    }

    setMensagem('');

    try {
      const permissao =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permissao.granted) {
        setMensagem(
          'É necessário permitir o acesso à câmera.'
        );
        return;
      }

      const resultado =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.7,
        });

      if (resultado.canceled) {
        return;
      }

      const primeiraFoto = fotoUris.length === 0;
      const foto = resultado.assets[0];

      setFotoUris((atual) => [
        ...atual,
        foto.uri,
      ]);

      if (primeiraFoto) {
        setLatitude(null);
        setLongitude(null);

        await obterLocalizacao();
      }
    } catch {
      setMensagem(
        'Não foi possível utilizar a câmera.'
      );
    }
  }

  function removerFoto(indice: number) {
    setFotoUris((atual) => {
      const novasFotos = atual.filter(
        (_, posicao) => posicao !== indice
      );

      if (novasFotos.length === 0) {
        setLatitude(null);
        setLongitude(null);
      }

      return novasFotos;
    });

    setMensagem('');
  }

  function limparOcorrencia() {
    setFotoUris([]);
    setLatitude(null);
    setLongitude(null);
    setCategoria(null);
    setGravidade(null);
    setDescricao('');
    setMensagem('');
  }

  async function enviarOcorrencia() {
    if (!sessao) {
      setMensagem(
        'É necessário estar autenticado.'
      );
      return;
    }

    if (fotoUris.length === 0) {
      setMensagem(
        'Tire pelo menos uma foto do problema.'
      );
      return;
    }

    if (
      latitude === null ||
      longitude === null
    ) {
      setMensagem(
        'A localização ainda não foi obtida.'
      );
      return;
    }

    if (!categoria) {
      setMensagem('Selecione uma categoria.');
      return;
    }

    if (!gravidade) {
      setMensagem('Selecione a gravidade.');
      return;
    }

    if (!descricao.trim()) {
      setMensagem(
        'Digite uma pequena descrição.'
      );
      return;
    }

    setEnviando(true);
    setMensagem('');

    try {
      await registrarOcorrencia({
        usuarioId: sessao.user.id,
        fotoUris,
        latitude,
        longitude,
        categoria,
        gravidade,
        descricao,
      });

      limparOcorrencia();

      setMensagem(
        'Ocorrência registrada com sucesso.'
      );
    } catch (error) {
      if (error instanceof Error) {
        setMensagem(error.message);
      } else {
        setMensagem(
          'Não foi possível registrar a ocorrência.'
        );
      }
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <View style={styles.centralizado}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!sessao) {
    return (
      <View style={styles.centralizado}>
        <Text style={styles.titulo}>
          Registro de Ocorrência
        </Text>

        <Text style={styles.textoCentralizado}>
          Entre na sua conta para registrar uma ocorrência.
        </Text>

        <Text style={styles.textoCentralizado}>
          Use a aba Conta para fazer login ou criar seu cadastro.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>
        Registro de Ocorrência
      </Text>

      <Text style={styles.rotulo}>
        1. Fotos do problema
      </Text>

      <Text style={styles.ajuda}>
        Adicione de 1 a 3 fotos.
      </Text>

      {fotoUris.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listaFotos}
        >
          {fotoUris.map((fotoUri, indice) => (
            <View
              key={`${fotoUri}-${indice}`}
              style={styles.cartaoFoto}
            >
              <Image
                source={{ uri: fotoUri }}
                style={styles.foto}
              />

              <Text style={styles.numeroFoto}>
                Foto {indice + 1}
              </Text>

              <Pressable
                style={styles.botaoRemoverFoto}
                onPress={() => removerFoto(indice)}
                disabled={enviando}
              >
                <Text
                  style={styles.textoBotaoRemoverFoto}
                >
                  Remover
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {fotoUris.length < 3 ? (
        <Pressable
          style={styles.botao}
          onPress={tirarFoto}
          disabled={enviando}
        >
          <Text style={styles.textoBotao}>
            {fotoUris.length === 0
              ? 'Tirar foto'
              : 'Adicionar outra foto'}
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.limiteFotos}>
          Limite de 3 fotos atingido.
        </Text>
      )}

      {fotoUris.length > 0 ? (
        <Pressable
          style={styles.botaoCancelar}
          onPress={limparOcorrencia}
          disabled={enviando}
        >
          <Text style={styles.textoBotaoCancelar}>
            Cancelar ocorrência
          </Text>
        </Pressable>
      ) : null}

      {fotoUris.length > 0 ? (
        <>
          <Text style={styles.rotulo}>
            2. Localização
          </Text>

          {obtendoLocalizacao ? (
            <View style={styles.status}>
              <ActivityIndicator />
              <Text>
                Obtendo localização...
              </Text>
            </View>
          ) : latitude !== null &&
            longitude !== null ? (
            <View style={styles.status}>
              <Text>
                Localização obtida automaticamente.
              </Text>
            </View>
          ) : (
            <View style={styles.status}>
              <Text>
                Localização não disponível.
              </Text>

              <Pressable
                style={styles.botaoSecundario}
                onPress={obterLocalizacao}
                disabled={enviando}
              >
                <Text
                  style={styles.textoBotaoSecundario}
                >
                  Tentar novamente
                </Text>
              </Pressable>
            </View>
          )}
        </>
      ) : null}

      {fotoUris.length > 0 &&
      latitude !== null &&
      longitude !== null &&
      !obtendoLocalizacao ? (
        <>
          <Text style={styles.rotulo}>
            3. Categoria
          </Text>

          <View style={styles.opcoes}>
            {categorias.map((item) => (
              <Pressable
                key={item.valor}
                style={[
                  styles.opcao,
                  categoria === item.valor &&
                    styles.opcaoSelecionada,
                ]}
                onPress={() => {
                  setCategoria(item.valor);
                  setMensagem('');
                }}
                disabled={enviando}
              >
                <Text
                  style={[
                    styles.textoOpcao,
                    categoria === item.valor &&
                      styles.textoOpcaoSelecionada,
                  ]}
                >
                  {item.titulo}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.rotulo}>
            4. Gravidade
          </Text>

          <View style={styles.opcoes}>
            {gravidades.map((item) => (
              <Pressable
                key={item.valor}
                style={[
                  styles.opcao,
                  gravidade === item.valor &&
                    styles.opcaoSelecionada,
                ]}
                onPress={() => {
                  setGravidade(item.valor);
                  setMensagem('');
                }}
                disabled={enviando}
              >
                <Text
                  style={[
                    styles.textoOpcao,
                    gravidade === item.valor &&
                      styles.textoOpcaoSelecionada,
                  ]}
                >
                  {item.titulo}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.rotulo}>
            5. Descrição
          </Text>

          <TextInput
            style={styles.descricao}
            placeholder="Descreva brevemente o problema"
            value={descricao}
            onChangeText={(texto) => {
              setDescricao(texto);
              setMensagem('');
            }}
            multiline
            maxLength={300}
            editable={!enviando}
          />

          <Text style={styles.contador}>
            {descricao.length}/300
          </Text>

          <Pressable
            style={styles.botao}
            onPress={enviarOcorrencia}
            disabled={enviando}
          >
            <Text style={styles.textoBotao}>
              {enviando
                ? 'Registrando...'
                : 'Registrar ocorrência'}
            </Text>
          </Pressable>
        </>
      ) : null}

      {mensagem ? (
        <Text style={styles.mensagem}>
          {mensagem}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
  },

  centralizado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },

  rotulo: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 20,
  },

  ajuda: {
    marginBottom: 10,
  },

  listaFotos: {
    gap: 10,
    paddingBottom: 4,
  },

  cartaoFoto: {
    width: 220,
  },

  foto: {
    width: 220,
    height: 165,
    borderRadius: 8,
  },

  numeroFoto: {
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },

  botaoRemoverFoto: {
    borderWidth: 1,
    borderColor: '#b00020',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },

  textoBotaoRemoverFoto: {
    color: '#b00020',
    fontWeight: 'bold',
    textAlign: 'center',
  },

  limiteFotos: {
    textAlign: 'center',
    marginTop: 12,
  },

  status: {
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
  },

  opcoes: {
    gap: 8,
  },

  opcao: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    padding: 12,
  },

  opcaoSelecionada: {
    backgroundColor: '#222222',
    borderColor: '#222222',
  },

  textoOpcao: {
    textAlign: 'center',
  },

  textoOpcaoSelecionada: {
    color: '#ffffff',
    fontWeight: 'bold',
  },

  descricao: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    padding: 12,
    textAlignVertical: 'top',
  },

  contador: {
    textAlign: 'right',
    marginTop: 4,
  },

  botao: {
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 14,
    marginTop: 20,
  },

  botaoSecundario: {
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },

  textoBotao: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },

  textoBotaoSecundario: {
    fontWeight: 'bold',
    textAlign: 'center',
  },

  botaoCancelar: {
    borderWidth: 1,
    borderColor: '#b00020',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },

  textoBotaoCancelar: {
    color: '#b00020',
    fontWeight: 'bold',
    textAlign: 'center',
  },

  mensagem: {
    textAlign: 'center',
    marginTop: 16,
  },

  textoCentralizado: {
    textAlign: 'center',
    marginBottom: 8,
  },
});
