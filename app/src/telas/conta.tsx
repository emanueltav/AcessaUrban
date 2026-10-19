import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAutenticacao } from '../contextos/autenticacao';
import { supabase } from '../servicos/supabase';

export default function Conta() {
  const { sessao, carregando } = useAutenticacao();

  const [cadastro, setCadastro] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  async function entrar() {
    if (!email.trim() || !senha) {
      setMensagem('Informe o e-mail e a senha.');
      return;
    }

    setProcessando(true);
    setMensagem('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    if (error) {
      setMensagem(error.message);
    }

    setProcessando(false);
  }

  async function criarConta() {
    if (!nome.trim() || !email.trim() || !senha) {
      setMensagem('Preencha nome, e-mail e senha.');
      return;
    }

    if (senha.length < 6) {
      setMensagem('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setProcessando(true);
    setMensagem('');

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: {
          nome: nome.trim(),
        },
      },
    });

    if (error) {
      setMensagem(error.message);
    }

    setProcessando(false);
  }

  async function sair() {
    setProcessando(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setMensagem(error.message);
    }

    setProcessando(false);
  }

  if (carregando) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  if (sessao) {
    return (
      <View style={styles.container}>
        <Text style={styles.titulo}>Minha Conta</Text>

        <Text style={styles.texto}>Você está conectado como:</Text>
        <Text style={styles.email}>{sessao.user.email}</Text>

        <Pressable
          style={styles.botao}
          onPress={sair}
          disabled={processando}
        >
          <Text style={styles.textoBotao}>
            {processando ? 'Saindo...' : 'Sair'}
          </Text>
        </Pressable>

        {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>
        {cadastro ? 'Criar Conta' : 'Entrar'}
      </Text>

      {cadastro ? (
        <TextInput
          style={styles.campo}
          placeholder="Nome"
          value={nome}
          onChangeText={setNome}
        />
      ) : null}

      <TextInput
        style={styles.campo}
        placeholder="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.campo}
        placeholder="Senha"
        value={senha}
        onChangeText={setSenha}
        autoCapitalize="none"
        secureTextEntry
      />

      <Pressable
        style={styles.botao}
        onPress={cadastro ? criarConta : entrar}
        disabled={processando}
      >
        <Text style={styles.textoBotao}>
          {processando
            ? 'Aguarde...'
            : cadastro
              ? 'Criar conta'
              : 'Entrar'}
        </Text>
      </Pressable>

      <Pressable
        onPress={() => {
          setCadastro(!cadastro);
          setMensagem('');
        }}
      >
        <Text style={styles.link}>
          {cadastro
            ? 'Já possui uma conta? Entrar'
            : 'Não possui uma conta? Criar conta'}
        </Text>
      </Pressable>

      {mensagem ? <Text style={styles.mensagem}>{mensagem}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },

  titulo: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },

  campo: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },

  botao: {
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 14,
    marginTop: 4,
    marginBottom: 16,
  },

  textoBotao: {
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
  },

  link: {
    textAlign: 'center',
    textDecorationLine: 'underline',
  },

  texto: {
    textAlign: 'center',
  },

  email: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },

  mensagem: {
    textAlign: 'center',
    marginTop: 16,
  },
});