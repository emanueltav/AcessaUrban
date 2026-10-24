import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { Camera, Map, Marker, type CameraRef, type MapRef } from '@maplibre/maplibre-react-native';

import type { RootStackParamList } from '../navegacao/rotas';
import { listarOcorrenciasMapa, OcorrenciaMapa } from '../servicos/mapa';

const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/liberty';
type Coordenada = [number, number];
type Indicador = { x: number; y: number; angulo: number };
const CENTRO_INICIAL: Coordenada = [-35.211, -5.7945];
const SIMBOLOS: Record<OcorrenciaMapa['status'], string> = {
  PENDENTE_VALIDACAO: '?',
  ATIVA: '!',
  RESOLVIDA: '✓',
};
const CORES_STATUS = { PENDENTE_VALIDACAO: '#666666', ATIVA: '#222222', RESOLVIDA: '#2e7d32' };

export default function Mapa() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const camera = useRef<CameraRef>(null);
  const mapa = useRef<MapRef>(null);
  const localAtual = useRef<Coordenada | null>(null);
  const acompanhando = useRef(true);
  const dimensoes = useRef({ width: 0, height: 0 });
  const projecao = useRef(0);
  const ultimaProjecao = useRef(0);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaMapa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [localizacao, setLocalizacao] = useState<Coordenada | null>(null);
  const [indicador, setIndicador] = useState<Indicador | null>(null);
  const [erroGPS, setErroGPS] = useState('');

  async function atualizarIndicador() {
    const id = ++projecao.current;
    const local = localAtual.current;
    const { width, height } = dimensoes.current;
    if (acompanhando.current || !local || !mapa.current || !width || !height)
      return setIndicador(null);

    try {
      const [x, y] = await mapa.current.project(local);
      if (id !== projecao.current || acompanhando.current) return;
      if (!Number.isFinite(x) || !Number.isFinite(y) ||
          (x >= 0 && x <= width && y >= 0 && y <= height)) return setIndicador(null);
      const dx = x - width / 2, dy = y - height / 2;
      const tx = dx > 0 ? (width / 2 - 28) / dx : dx < 0 ? (28 - width / 2) / dx : Infinity;
      const ty = dy > 0 ? (height / 2 - 82) / dy : dy < 0 ? (28 - height / 2) / dy : Infinity;
      const fator = Math.min(tx, ty);
      setIndicador({ x: width / 2 + dx * fator - 21, y: height / 2 + dy * fator - 21,
        angulo: Math.atan2(dy, dx) * 180 / Math.PI });
    } catch {
      if (id === projecao.current) setIndicador(null);
    }
  }

  function centralizar() {
    if (!localAtual.current) return;
    acompanhando.current = true;
    projecao.current++;
    setIndicador(null);
    camera.current?.easeTo({ center: localAtual.current, zoom: 15, duration: 650 });
  }

  function atualizarLocalizacao(posicao: Location.LocationObject) {
    const local: Coordenada = [posicao.coords.longitude, posicao.coords.latitude];
    const primeira = localAtual.current === null;
    localAtual.current = local;
    setLocalizacao(local);
    setErroGPS('');
    if (acompanhando.current)
      camera.current?.easeTo({ center: local, zoom: primeira ? 15 : undefined, duration: 600 });
    else void atualizarIndicador();
  }

  useFocusEffect(useCallback(() => {
    let ativo = true;
    let assinatura: Location.LocationSubscription | null = null;

    async function iniciarGPS() {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!ativo) return;
        if (!granted) return setErroGPS('Permita o acesso à localização para acompanhar sua posição.');
        setErroGPS('');
        const anterior = await Location.getLastKnownPositionAsync({ maxAge: 30000 }).catch(() => null);
        if (ativo && anterior) atualizarLocalizacao(anterior);
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 2500, distanceInterval: 5 },
          (posicao) => { if (ativo) atualizarLocalizacao(posicao); },
          () => { if (ativo) setErroGPS('Não foi possível atualizar sua localização.'); }
        );
        if (ativo) assinatura = sub;
        else sub.remove();
      } catch {
        if (ativo) setErroGPS('Não foi possível obter sua localização.');
      }
    }
    void iniciarGPS();
    return () => { ativo = false; assinatura?.remove(); };
  }, []));

  useFocusEffect(useCallback(() => {
    let ativo = true;
    async function carregar() {
      setCarregando(true);
      setErro('');
      try {
        const dados = await listarOcorrenciasMapa();
        if (ativo) setOcorrencias(dados);
      } catch (error) {
        console.error('Erro ao carregar mapa:', error);
        if (ativo) setErro('Não foi possível carregar as ocorrências.');
      } finally { if (ativo) setCarregando(false); }
    }
    void carregar();
    return () => { ativo = false; };
  }, []));

  if (carregando || erro) return <View style={styles.centralizado}>
    {carregando && <ActivityIndicator />}
    <Text style={styles.mensagem}>{erro || 'Carregando ocorrências...'}</Text>
  </View>;

  return (
    <View style={styles.container}>
      <Map ref={mapa} style={styles.mapa} mapStyle={ESTILO_MAPA}
        onLayout={({ nativeEvent }) => {
          dimensoes.current = nativeEvent.layout;
          void atualizarIndicador();
        }}
        onDidFinishLoadingMap={() => {
          if (acompanhando.current && localAtual.current)
            camera.current?.jumpTo({ center: localAtual.current, zoom: 15 });
          else void atualizarIndicador();
        }}
        onRegionWillChange={({ nativeEvent }) => {
          if (nativeEvent.userInteraction) acompanhando.current = false;
        }}
        onRegionIsChanging={() => {
          if (acompanhando.current || Date.now() - ultimaProjecao.current < 180) return;
          ultimaProjecao.current = Date.now();
          void atualizarIndicador();
        }}
        onRegionDidChange={() => { if (!acompanhando.current) void atualizarIndicador(); }}>
        <Camera ref={camera} initialViewState={{
          center: localAtual.current ?? CENTRO_INICIAL, zoom: localAtual.current ? 15 : 10,
        }} />
        {localizacao && <Marker id="minha-localizacao" lngLat={localizacao}
          anchor="center" onPress={centralizar}>
          <View style={styles.localAnel}><View style={styles.localCentro} /></View>
        </Marker>}
        {ocorrencias.map((ocorrencia) => (
          <Marker key={ocorrencia.id} id={ocorrencia.id} anchor="bottom"
            lngLat={[ocorrencia.longitude, ocorrencia.latitude]}
            onPress={() => navigation.navigate('Ocorrencia', { ocorrenciaId: ocorrencia.id })}>
            <View style={[styles.marcador, { backgroundColor: CORES_STATUS[ocorrencia.status] }]}>
              <Text style={styles.textoMarcador}>{SIMBOLOS[ocorrencia.status]}</Text>
            </View>
          </Marker>
        ))}
      </Map>
      {indicador && <Pressable accessibilityRole="button"
        accessibilityLabel="Voltar à minha localização" onPress={centralizar}
        style={[styles.indicadorBorda, { left: indicador.x, top: indicador.y }]}>
        <Text style={[styles.seta, { transform: [{ rotate: `${indicador.angulo}deg` }] }]}>➤</Text>
      </Pressable>}
      {!!erroGPS && <Text style={styles.avisoGPS}>{erroGPS}</Text>}
      <Pressable style={styles.explorarPracas} onPress={() => navigation.navigate('Pracas')}
        accessibilityRole="button" accessibilityLabel="Explorar praças">
        <Text style={styles.textoExplorar}>Explorar praças</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapa: { flex: 1 },
  localAnel: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', elevation: 3 },
  localCentro: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#F4663A' },
  indicadorBorda: { position: 'absolute', width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F2C40', elevation: 4 },
  seta: { color: '#F4663A', fontSize: 24, fontWeight: 'bold' },
  avisoGPS: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: '#EAE8DB',
    color: '#333229', padding: 10, borderRadius: 8, fontSize: 12, maxWidth: '85%' },
  explorarPracas: { position: 'absolute', bottom: 18, right: 16, backgroundColor: '#0F2C40',
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 24, elevation: 3 },
  textoExplorar: { color: '#EAE8DB', fontWeight: '700' },
  centralizado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mensagem: { textAlign: 'center', marginTop: 12 },
  marcador: { width: 32, height: 32, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  textoMarcador: { color: '#ffffff', fontWeight: 'bold' },
});