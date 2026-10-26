import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Aviso from '../componentes/aviso';
import { useAutenticacao } from '../contextos/autenticacao';
import { Campo as TextInput, definirEstilos, Texto as Text } from '../contextos/tema';
import { atualizarBairroPerfil, buscarBairros, buscarPerfil } from '../servicos/perfil';
import type { BairroPerfil, PerfilUsuario } from '../servicos/perfil';
import { supabase } from '../servicos/supabase';

function mensagemErro(erro: unknown, alternativa: string) {
  return erro instanceof Error ? erro.message : alternativa;
}

export default function Conta() {
  const styles = useEstilos();
  const { sessao, carregando } = useAutenticacao();
  const usuarioId = sessao?.user.id ?? null;
  const [cadastro, setCadastro] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [avisoSaida, setAvisoSaida] = useState(false);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);
  const [editandoBairro, setEditandoBairro] = useState(false);
  const [buscaBairro, setBuscaBairro] = useState('');
  const [resultadosBairro, setResultadosBairro] = useState<BairroPerfil[]>([]);
  const [pesquisandoBairro, setPesquisandoBairro] = useState(false);

  useEffect(() => {
    if (usuarioId) return;
    setCadastro(false);
    setNome('');
    setEmail('');
    setSenha('');
    setMensagem('');
    setEditandoBairro(false);
    setBuscaBairro('');
    setResultadosBairro([]);
  }, [usuarioId]);

  useFocusEffect(useCallback(() => {
    if (!usuarioId) {
      setPerfil(null);
      setCarregandoPerfil(false);
      return;
    }

    let ativo = true;
    setCarregandoPerfil(true);
    buscarPerfil(usuarioId)
      .then((dados) => { if (ativo) setPerfil(dados); })
      .catch((erro) => {
        if (ativo) setMensagem(mensagemErro(erro, 'Não foi possível carregar o perfil.'));
      })
      .finally(() => { if (ativo) setCarregandoPerfil(false); });

    return () => { ativo = false; };
  }, [usuarioId]));

  async function executar(acao: () => Promise<void>, erroPadrao: string) {
    if (processando) return;
    setProcessando(true);
    setMensagem('');
    try {
      await acao();
    } catch (erro) {
      setMensagem(mensagemErro(erro, erroPadrao));
    } finally {
      setProcessando(false);
    }
  }

  async function autenticar() {
    if (!email.trim() || !senha || (cadastro && !nome.trim())) {
      setMensagem(cadastro ? 'Preencha nome, e-mail e senha.' : 'Informe o e-mail e a senha.');
      return;
    }
    if (cadastro && senha.length < 6) {
      setMensagem('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    await executar(async () => {
      const { error } = cadastro
        ? await supabase.auth.signUp({
            email: email.trim(), password: senha, options: { data: { nome: nome.trim() } },
          })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) throw error;
      setSenha('');
    }, cadastro ? 'Não foi possível criar a conta.' : 'Não foi possível entrar na conta.');
  }

  async function sair() {
    setAvisoSaida(false);
    await executar(async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }, 'Não foi possível sair da conta.');
  }

  async function pesquisarBairros() {
    if (!buscaBairro.trim()) {
      setMensagem('Digite o nome de um bairro.');
      return;
    }
    try {
      setPesquisandoBairro(true);
      setMensagem('');
      const bairros = await buscarBairros(buscaBairro);
      setResultadosBairro(bairros);
      if (!bairros.length) setMensagem('Nenhum bairro encontrado.');
    } catch (erro) {
      setMensagem(mensagemErro(erro, 'Não foi possível pesquisar os bairros.'));
    } finally {
      setPesquisandoBairro(false);
    }
  }

  async function salvarBairro(bairro: BairroPerfil | null) {
    if (!usuarioId) return;
    const idUsuario = usuarioId;
    await executar(async () => {
      await atualizarBairroPerfil(idUsuario, bairro?.id ?? null);
      setPerfil((atual) => atual ? { ...atual, bairro_id: bairro?.id ?? null, bairro } : atual);
      setEditandoBairro(false);
      setBuscaBairro('');
      setResultadosBairro([]);
      setMensagem(bairro ? 'Bairro atualizado com sucesso.' : 'Bairro removido do perfil.');
    }, bairro ? 'Não foi possível atualizar o bairro.' : 'Não foi possível remover o bairro.');
  }

  if (carregando) {
    return <View style={styles.centralizado}><ActivityIndicator /></View>;
  }

  if (sessao) {
    const nomeExibicao = perfil?.nome || sessao.user.email?.split('@')[0] || 'Usuário';
    return <>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.identidade}>
          <View style={styles.avatar}><Text style={styles.inicial}>{nomeExibicao[0].toUpperCase()}</Text></View>
          <View style={styles.dadosConta}>
            <Text style={styles.nomePerfil}>{nomeExibicao}</Text>
            <Text style={styles.email}>{sessao.user.email}</Text>
          </View>
        </View>

        {carregandoPerfil ? <ActivityIndicator /> : (
          <View style={styles.bloco}>
            <Text style={styles.subtitulo}>Meu bairro</Text>
            {perfil?.bairro ? (
              <Text style={styles.bairroAtual}>
                🏠 {perfil.bairro.nome} — {perfil.bairro.municipio}/{perfil.bairro.uf}
              </Text>
            ) : <Text>Nenhum bairro selecionado.</Text>}

            <Pressable style={styles.botaoSecundario} disabled={processando}
              onPress={() => { setEditandoBairro((atual) => !atual); setMensagem(''); }}>
              <Text style={styles.textoBotaoSecundario}>
                {perfil?.bairro ? 'Alterar bairro' : 'Escolher bairro'}
              </Text>
            </Pressable>

            {editandoBairro ? (
              <View style={styles.selecaoBairro}>
                <TextInput style={styles.campo} placeholder="Digite o nome do bairro"
                  value={buscaBairro} onChangeText={setBuscaBairro} editable={!processando} />
                <Pressable style={styles.botaoSecundario} onPress={pesquisarBairros}
                  disabled={pesquisandoBairro || processando}>
                  <Text style={styles.textoBotaoSecundario}>
                    {pesquisandoBairro ? 'Pesquisando...' : 'Pesquisar'}
                  </Text>
                </Pressable>

                {resultadosBairro.map((bairro) => (
                  <Pressable key={bairro.id} disabled={processando}
                    style={[styles.opcaoBairro, perfil?.bairro_id === bairro.id && styles.opcaoBairroAtual]}
                    onPress={() => salvarBairro(bairro)}>
                    <Text style={styles.nomeBairro}>{bairro.nome}</Text>
                    <Text style={styles.municipio}>{bairro.municipio}/{bairro.uf}</Text>
                  </Pressable>
                ))}

                {perfil?.bairro ? (
                  <Pressable style={styles.botaoRemover} onPress={() => salvarBairro(null)}
                    disabled={processando}>
                    <Text style={styles.textoRemover}>Remover bairro do perfil</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        )}

        <Pressable style={styles.botao} onPress={() => setAvisoSaida(true)} disabled={processando}>
          <Text style={styles.textoBotao}>{processando ? 'Aguarde...' : 'Sair'}</Text>
        </Pressable>
        {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}
      </ScrollView>
      <Aviso titulo="Sair da conta?" mensagem={avisoSaida
        ? 'Deseja realmente encerrar sua sessão no AcessaUrban?' : null}
        confirmarTexto="Sair" destrutivo confirmar={() => { void sair(); }}
        cancelar={() => setAvisoSaida(false)} />
    </>;
  }

  return (
    <View style={styles.centralizado}>
      <View style={styles.formulario}>
        <Text style={styles.titulo}>{cadastro ? 'Criar Conta' : 'Entrar'}</Text>
        {cadastro ? (
          <TextInput style={styles.campo} placeholder="Nome" value={nome}
            onChangeText={setNome} editable={!processando} />
        ) : null}
        <TextInput style={styles.campo} placeholder="E-mail" value={email}
          onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
          editable={!processando} />
        <TextInput style={styles.campo} placeholder="Senha" value={senha}
          onChangeText={setSenha} autoCapitalize="none" secureTextEntry editable={!processando} />

        <Pressable style={styles.botao} onPress={autenticar} disabled={processando}>
          <Text style={styles.textoBotao}>
            {processando ? 'Aguarde...' : cadastro ? 'Criar conta' : 'Entrar'}
          </Text>
        </Pressable>
        <Pressable disabled={processando} onPress={() => {
          setCadastro((atual) => !atual);
          setMensagem('');
        }}>
          <Text style={styles.link}>
            {cadastro ? 'Já possui uma conta? Entrar' : 'Não possui uma conta? Criar conta'}
          </Text>
        </Pressable>
        {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}
      </View>
    </View>
  );
}

const useEstilos = definirEstilos((c) => StyleSheet.create({
  container: { padding: 24, gap: 16 },
  centralizado: { flex: 1, justifyContent: 'center', padding: 24 },
  formulario: { width: '100%', borderWidth: 1, borderColor: c.borda,
    backgroundColor: c.cartao, borderRadius: 18, padding: 20, gap: 12 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: c.azul, marginBottom: 8, textAlign: 'center' },
  subtitulo: { fontSize: 18, fontWeight: 'bold', color: c.azul },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: c.azul,
    justifyContent: 'center', alignItems: 'center' },
  inicial: { fontSize: 24, fontWeight: 'bold', color: c.cartao },
  dadosConta: { flex: 1 },
  nomePerfil: { fontSize: 20, fontWeight: 'bold', color: c.azul },
  bloco: { borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 16, padding: 16, gap: 10 },
  campo: { borderWidth: 1, borderColor: c.borda, borderRadius: 12, padding: 14 },
  botao: { backgroundColor: c.botao, borderRadius: 12, padding: 14, marginTop: 4 },
  botaoSecundario: { borderWidth: 1, borderColor: c.botao, borderRadius: 12, padding: 12 },
  textoBotao: { color: c.textoBotao, fontWeight: 'bold', textAlign: 'center' },
  textoBotaoSecundario: { color: c.azul, fontWeight: 'bold', textAlign: 'center' },
  link: { color: c.azul, textAlign: 'center', textDecorationLine: 'underline' },
  email: { color: c.secundario, fontSize: 13, marginTop: 3 },
  bairroAtual: { color: c.texto, fontWeight: '600' },
  selecaoBairro: { gap: 8, marginTop: 8, backgroundColor: c.fundo, borderRadius: 12, padding: 12 },
  opcaoBairro: { borderWidth: 1, borderColor: c.borda, backgroundColor: c.cartao, borderRadius: 12, padding: 12 },
  opcaoBairroAtual: { borderColor: c.laranja },
  nomeBairro: { color: c.azul, fontWeight: 'bold' },
  municipio: { color: c.secundario, fontSize: 13 },
  botaoRemover: { borderWidth: 1, borderColor: c.perigo, borderRadius: 12, padding: 10, marginTop: 8 },
  textoRemover: { color: c.perigo, fontWeight: 'bold', textAlign: 'center' },
  mensagem: { textAlign: 'center', marginTop: 8 },
}));
