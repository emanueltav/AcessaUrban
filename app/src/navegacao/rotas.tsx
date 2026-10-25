import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DefaultTheme, NavigationContainer, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import Aviso from '../componentes/aviso';
import { useAutenticacao } from '../contextos/autenticacao';
import { definirEstilos, useTema } from '../contextos/tema';
import { buscarPerfil } from '../servicos/perfil';
import type { PerfilUsuario } from '../servicos/perfil';
import { supabase } from '../servicos/supabase';
import Mapa from '../telas/mapa';
import Registro from '../telas/registro';
import Ranking from '../telas/ranking';
import Conta from '../telas/conta';
import Ocorrencias from '../telas/ocorrencias';
import Pracas from '../telas/pracas';

export type RootStackParamList = {
  Principal: undefined;
  Ocorrencia: { ocorrenciaId: string };
  Ocorrencias: undefined;
  Pracas: undefined;
  NovaPraca: { abrirCadastro?: boolean } | undefined;
  Registro: undefined;
  Conta: undefined;
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

function SemTela() { return null; }

function AbasPrincipais() {
  const { cores, modo, selecionarModo } = useTema();
  const styles = useEstilos();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { sessao } = useAutenticacao();
  const [acoesAbertas, setAcoesAbertas] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [avisoSaida, setAvisoSaida] = useState<'confirmar' | { erro: string } | null>(null);
  const [aparenciaAberta, setAparenciaAberta] = useState(false);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const usuarioId = sessao?.user.id;

  useEffect(() => { setPerfil(null); }, [usuarioId]);

  useEffect(() => {
    if (!usuarioId || !menuAberto) {
      if (!usuarioId) setPerfil(null);
      return;
    }
    let ativo = true;
    buscarPerfil(usuarioId)
      .then((dados) => { if (ativo) setPerfil(dados); })
      .catch(() => { if (ativo) setPerfil(null); });
    return () => { ativo = false; };
  }, [usuarioId, menuAberto]);

  function abrir(nome: 'Ocorrencias' | 'Pracas' | 'NovaPraca' | 'Registro' | 'Conta') {
    setAcoesAbertas(false);
    setMenuAberto(false);
    navigation.navigate(nome);
  }

  function confirmarSaida() {
    setMenuAberto(false);
    setAvisoSaida('confirmar');
  }

  async function sair() {
    setAvisoSaida(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setAvisoSaida({ erro: error.message });
    } catch {
      setAvisoSaida({ erro: 'Não foi possível encerrar sua sessão. Tente novamente.' });
    }
  }

  const nomeUsuario = perfil?.nome || sessao?.user.email?.split('@')[0] || 'Visitante';
  const erroSaida = avisoSaida && typeof avisoSaida === 'object' ? avisoSaida.erro : null;

  return <>
    <Tab.Navigator screenOptions={{
      headerTitleAlign: 'center',
      headerStyle: { backgroundColor: cores.fundo },
      headerTitle: () => <View style={modo === 'escuro' && styles.fundoMarca}>
        <Image source={require('../../assets/acessaurban-wordmark.png')}
          style={styles.marca} resizeMode="contain" accessibilityLabel="AcessaUrban" />
      </View>,
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu da conta"
        style={styles.botaoConta} onPress={() => setMenuAberto(true)}>
        <Text style={styles.inicial}>{sessao ? nomeUsuario[0].toUpperCase() : '☰'}</Text>
      </Pressable>,
      tabBarActiveTintColor: cores.laranja,
      tabBarInactiveTintColor: cores.azul,
      tabBarStyle: { backgroundColor: cores.fundo, borderTopColor: cores.borda },
    }}>
      <Tab.Screen name="Mapa" component={Mapa} options={{
        tabBarIcon: ({ color }) => <Text style={[styles.iconeAba, { color }]}>⌖</Text>,
      }} />
      <Tab.Screen name="Cadastrar" component={SemTela} options={{
        headerShown: false,
        tabBarLabel: () => null,
        tabBarButton: () => <Pressable accessibilityRole="button"
          accessibilityLabel="Cadastrar ocorrência ou praça" onPress={() => setAcoesAbertas(true)}
          style={styles.espacoAcao}>
          <View style={styles.botaoAcao}><Text style={styles.mais}>+</Text></View>
        </Pressable>,
      }} />
      <Tab.Screen name="Ranking" component={Ranking} options={{
        tabBarIcon: ({ color }) => <Text style={[styles.iconeAba, { color }]}>★</Text>,
      }} />
    </Tab.Navigator>

    <Modal visible={acoesAbertas} transparent animationType="fade"
      onRequestClose={() => setAcoesAbertas(false)}>
      <View style={styles.camada}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAcoesAbertas(false)} />
        <View style={styles.menuAcoes}>
          <Text style={styles.tituloMenu}>O que deseja cadastrar?</Text>
          <Pressable style={styles.opcao} onPress={() => abrir('Registro')}>
            <Text style={styles.textoOpcao}>Nova ocorrência</Text>
          </Pressable>
          <Pressable style={styles.opcao} onPress={() => abrir('NovaPraca')}>
            <Text style={styles.textoOpcao}>Nova praça</Text>
          </Pressable>
        </View>
      </View>
    </Modal>

    <Modal visible={menuAberto} transparent animationType="fade"
      onRequestClose={() => setMenuAberto(false)}>
      <View style={styles.camada}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuAberto(false)} />
        <View style={styles.menuConta}>
          <Pressable style={styles.cabecalhoConta} onPress={() => abrir('Conta')}>
            <Text style={styles.nomeUsuario}>{nomeUsuario}</Text>
            <Text style={styles.bairroUsuario}>{perfil?.bairro?.nome ?? (sessao ? 'Selecionar bairro' : 'Entrar ou criar conta')}</Text>
          </Pressable>
          <Pressable style={styles.itemMenu} onPress={() => abrir('Ocorrencias')}>
            <Text style={styles.textoOpcao}>Ocorrências</Text>
          </Pressable>
          <Pressable style={styles.itemMenu} onPress={() => abrir('Pracas')}>
            <Text style={styles.textoOpcao}>Praças</Text>
          </Pressable>
          <Pressable style={styles.itemMenu} onPress={() => setAparenciaAberta((atual) => !atual)}>
            <Text style={styles.textoOpcao}>Aparência</Text>
          </Pressable>
          {aparenciaAberta && <View style={styles.opcoesTema}>
            {(['claro', 'escuro'] as const).map((opcao) =>
              <Pressable key={opcao} accessibilityRole="button"
                accessibilityLabel={`Ativar modo ${opcao}`} onPress={() => selecionarModo(opcao)}
                style={[styles.opcaoTema, modo === opcao && styles.opcaoTemaAtiva]}>
                <Text style={styles.textoOpcaoTema}>{opcao === 'claro' ? '☀  Claro' : '☾  Escuro'}</Text>
              </Pressable>)}
          </View>}
          {sessao ? <Pressable style={styles.itemMenu} onPress={confirmarSaida}>
            <Text style={styles.sair}>Sair da conta</Text>
          </Pressable> : <Pressable style={styles.itemMenu} onPress={() => abrir('Conta')}>
            <Text style={styles.textoOpcao}>Entrar / Cadastrar</Text>
          </Pressable>}
        </View>
      </View>
    </Modal>
    <Aviso titulo={erroSaida ? 'Não foi possível sair' : 'Sair da conta?'}
      mensagem={erroSaida ?? (avisoSaida === 'confirmar'
        ? 'Deseja realmente encerrar sua sessão no AcessaUrban?' : null)}
      confirmarTexto={erroSaida ? 'Entendi' : 'Sair'} destrutivo={avisoSaida === 'confirmar'}
      confirmar={() => { if (avisoSaida === 'confirmar') void sair(); else setAvisoSaida(null); }}
      cancelar={avisoSaida === 'confirmar' ? () => setAvisoSaida(null) : undefined} />
  </>;
}

export default function Rotas() {
  const { cores, modo } = useTema();
  const tema = { ...DefaultTheme, dark: modo === 'escuro', colors: {
    ...DefaultTheme.colors, primary: cores.laranja, background: cores.fundo,
    card: cores.fundo, text: cores.texto, border: cores.borda,
  } };
  return <NavigationContainer theme={tema}>
    <StatusBar style={modo === 'escuro' ? 'light' : 'dark'} animated />
    <Stack.Navigator screenOptions={{ headerTitleAlign: 'center',
      headerTitleStyle: { fontSize: 24, fontWeight: '700' },
      headerStyle: { backgroundColor: cores.fundo }, headerTintColor: cores.texto,
      contentStyle: { backgroundColor: cores.fundo }, }}>
      <Stack.Screen name="Principal" component={AbasPrincipais} options={{ headerShown: false }} />
      <Stack.Screen name="Ocorrencia" component={Ocorrencias} options={{ title: 'Ocorrência' }} />
      <Stack.Screen name="Ocorrencias" component={Ocorrencias} options={{ title: 'Ocorrências' }} />
      <Stack.Screen name="Pracas" component={Pracas} options={{ title: 'Praças' }} />
      <Stack.Screen name="NovaPraca" component={Pracas} initialParams={{ abrirCadastro: true }}
        options={{ title: 'Nova praça' }} />
      <Stack.Screen name="Registro" component={Registro} options={{ title: 'Nova ocorrência' }} />
      <Stack.Screen name="Conta" component={Conta} options={{ title: 'Conta' }} />
    </Stack.Navigator>
  </NavigationContainer>;
}

const useEstilos = definirEstilos((cores) => StyleSheet.create({
  marca: { width: 208, height: 34 },
  fundoMarca: { backgroundColor: '#EAE8DB', borderRadius: 10, paddingHorizontal: 5 },
  botaoConta: { marginRight: 16, width: 36, height: 36, borderRadius: 18,
    backgroundColor: cores.botao, alignItems: 'center', justifyContent: 'center' },
  inicial: { color: cores.textoBotao, fontSize: 18, fontWeight: '700' },
  iconeAba: { fontSize: 26, fontWeight: '700' },
  espacoAcao: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  botaoAcao: { width: 56, height: 56, borderRadius: 28, backgroundColor: cores.laranja,
    alignItems: 'center', justifyContent: 'center', transform: [{ translateY: -13 }],
    elevation: 4 },
  mais: { color: '#FFFFFF', fontSize: 36, lineHeight: 42, fontWeight: '500' },
  camada: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  menuAcoes: { position: 'absolute', bottom: 24, left: 20, right: 20,
    backgroundColor: cores.fundo, borderRadius: 18, padding: 18, gap: 10, elevation: 6 },
  tituloMenu: { fontWeight: '700', fontSize: 17, color: cores.texto, marginBottom: 4 },
  opcao: { backgroundColor: cores.cartao, borderRadius: 12, padding: 16 },
  textoOpcao: { color: cores.texto, fontSize: 16, fontWeight: '600' },
  menuConta: { position: 'absolute', top: 12, right: 12, width: 260,
    backgroundColor: cores.fundo, borderRadius: 16, padding: 8, elevation: 6 },
  cabecalhoConta: { padding: 12, borderBottomWidth: 1, borderColor: cores.borda },
  nomeUsuario: { color: cores.azul, fontWeight: '700', fontSize: 17 },
  bairroUsuario: { color: cores.secundario, fontSize: 13, marginTop: 3 },
  itemMenu: { padding: 14 },
  opcoesTema: { flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingBottom: 8 },
  opcaoTema: { flex: 1, borderRadius: 10, padding: 9, borderWidth: 1, borderColor: cores.borda },
  opcaoTemaAtiva: { borderColor: cores.laranja, backgroundColor: cores.cartao },
  textoOpcaoTema: { color: cores.texto, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  sair: { color: cores.perigo, fontSize: 16, fontWeight: '600' },
}));
