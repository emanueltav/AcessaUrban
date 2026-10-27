import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { Camera, GeoJSONSource, Layer, Map, Marker,
  type CameraRef, type GeoJSONSourceProps, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native';

import bairrosRN from '../../assets/bairros-rn.json';
import type { RootStackParamList } from '../navegacao/rotas';
import { definirEstilos, Texto as Text } from '../contextos/tema';
import { useDadosMapa } from '../hooks/useDadosMapa';
import type { OcorrenciaMapa } from '../servicos/mapa';
import type { PracaMapa } from '../servicos/pracas';

const ESTILO_MAPA = 'https://tiles.openfreemap.org/styles/liberty';
// Malha de bairros do RN: IBGE, Censo 2022 (185 bairros em 19 municípios).
const LIMITES_BAIRROS = bairrosRN as GeoJSONSourceProps['data'];
type Coordenada = [number, number];
type Indicador = { x: number; y: number; angulo: number };
const CENTRO_INICIAL: Coordenada = [-35.211, -5.7945];
const SIMBOLOS: Record<OcorrenciaMapa['status'], string> = {
  PENDENTE_VALIDACAO: '?',
  ATIVA: '!',
  RESOLVIDA: '✓',
};
const CORES_STATUS = { PENDENTE_VALIDACAO: '#666666', ATIVA: '#222222', RESOLVIDA: '#2e7d32' };
const mercatorY = (latitude: number) => {
  const rad = Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2)) / (2 * Math.PI);
};

export default function Mapa() {
  const styles = useEstilos();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { ocorrencias, pracas, carregando, erro, erroPracas } = useDadosMapa();
  const camera = useRef<CameraRef>(null);
  const estadoMapa = useRef<ViewStateChangeEvent | null>(null);
  const focado = useRef(false);
  const localAtual = useRef<Coordenada | null>(null);
  const acompanhando = useRef(true);
  const dimensoes = useRef({ width: 0, height: 0 });
  const ultimaProjecao = useRef(0);
  const [pracaSelecionada, setPracaSelecionada] = useState<PracaMapa | null>(null);
  const [localizacao, setLocalizacao] = useState<Coordenada | null>(null);
  const [indicador, setIndicador] = useState<Indicador | null>(null);
  const [erroGPS, setErroGPS] = useState('');

  function atualizarIndicador() {
    const local = localAtual.current;
    const estado = estadoMapa.current;
    const { width, height } = dimensoes.current;
    if (!focado.current || acompanhando.current || !local || !estado || !width || !height)
      return setIndicador(null);

    const escala = 512 * 2 ** estado.zoom;
    const leste = (((local[0] - estado.center[0] + 540) % 360) - 180) / 360 * escala;
    const sul = (mercatorY(estado.center[1]) - mercatorY(local[1])) * escala;
    const rumo = estado.bearing * Math.PI / 180;
    const dx = leste * Math.cos(rumo) + sul * Math.sin(rumo);
    const dy = sul * Math.cos(rumo) - leste * Math.sin(rumo);
    const x = width / 2 + dx, y = height / 2 + dy;
    if (!Number.isFinite(x) || !Number.isFinite(y) ||
        (x >= 0 && x <= width && y >= 0 && y <= height)) return setIndicador(null);
    const tx = dx > 0 ? (width / 2 - 28) / dx : dx < 0 ? (28 - width / 2) / dx : Infinity;
    const ty = dy > 0 ? (height / 2 - 82) / dy : dy < 0 ? (28 - height / 2) / dy : Infinity;
    const fator = Math.min(tx, ty);
    setIndicador({ x: width / 2 + dx * fator - 21, y: height / 2 + dy * fator - 21,
      angulo: Math.atan2(dy, dx) * 180 / Math.PI });
  }

  function centralizar() {
    if (!localAtual.current) return;
    acompanhando.current = true;
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
    else atualizarIndicador();
  }

  useFocusEffect(useCallback(() => {
    let ativo = true;
    focado.current = true;
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
    return () => { ativo = false; focado.current = false; assinatura?.remove(); };
  }, []));

  useFocusEffect(useCallback(() => { setPracaSelecionada(null); }, []));

  if (carregando || erro) return <View style={styles.centralizado}>
    {carregando && <ActivityIndicator />}
    <Text style={styles.mensagem}>{erro || 'Carregando ocorrências...'}</Text>
  </View>;

  return (
    <View style={styles.container}>
      <Map style={styles.mapa} mapStyle={ESTILO_MAPA}
        onLayout={({ nativeEvent }) => {
          dimensoes.current = nativeEvent.layout;
          atualizarIndicador();
        }}
        onDidFinishLoadingMap={() => {
          if (focado.current && acompanhando.current && localAtual.current)
            camera.current?.jumpTo({ center: localAtual.current, zoom: 15 });
          else atualizarIndicador();
        }}
        onRegionWillChange={({ nativeEvent }) => {
          estadoMapa.current = nativeEvent;
          if (nativeEvent.userInteraction) acompanhando.current = false;
        }}
        onRegionIsChanging={({ nativeEvent }) => {
          estadoMapa.current = nativeEvent;
          if (acompanhando.current || Date.now() - ultimaProjecao.current < 180) return;
          ultimaProjecao.current = Date.now();
          atualizarIndicador();
        }}
        onRegionDidChange={({ nativeEvent }) => {
          estadoMapa.current = nativeEvent;
          if (!acompanhando.current) atualizarIndicador();
        }}>
        <Camera ref={camera} initialViewState={{
          center: localAtual.current ?? CENTRO_INICIAL, zoom: localAtual.current ? 15 : 10,
        }} />
        <GeoJSONSource id="bairros-rn" data={LIMITES_BAIRROS}>
          <Layer id="limites-bairros" type="line" source="bairros-rn" paint={{
            'line-color': '#0F2C40', 'line-opacity': 0.65, 'line-width': 1.6,
          }} />
        </GeoJSONSource>
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
        {pracas.map((praca) => <Marker key={praca.id} id={`praca-${praca.id}`}
          lngLat={[praca.longitude, praca.latitude]} anchor="bottom"
          onPress={() => setPracaSelecionada(praca)}>
          <View style={styles.marcadorPraca}><Text style={styles.arvore}>🌳</Text></View>
        </Marker>)}
      </Map>
      {indicador && <Pressable accessibilityRole="button"
        accessibilityLabel="Voltar à minha localização" onPress={centralizar}
        style={[styles.indicadorBorda, { left: indicador.x, top: indicador.y }]}>
        <Text style={[styles.seta, { transform: [{ rotate: `${indicador.angulo}deg` }] }]}>➤</Text>
      </Pressable>}
      {!!(erroGPS || erroPracas) && <Text style={styles.avisoGPS}>{erroGPS || erroPracas}</Text>}
      {pracaSelecionada && <View style={styles.cartaoPraca}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar informações da praça"
          style={styles.fecharCartao} onPress={() => setPracaSelecionada(null)}>
          <Text style={styles.fecharTexto}>✕</Text>
        </Pressable>
        <Text style={styles.nomePraca}>{pracaSelecionada.nome}</Text>
        {pracaSelecionada.bairro && <Text style={styles.bairroPraca}>
          {pracaSelecionada.bairro.nome} — {pracaSelecionada.bairro.municipio}/{pracaSelecionada.bairro.uf}
        </Text>}
        {!!pracaSelecionada.fotos.length && <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fotosPraca}>
          {pracaSelecionada.fotos.map((foto) => <Image key={foto.id}
            source={{ uri: foto.foto_url }} style={styles.fotoPraca} />)}
        </ScrollView>}
        <Text style={styles.notaPraca}>{pracaSelecionada.media === null ? 'Ainda sem avaliações'
          : `★ ${pracaSelecionada.media.toFixed(1)} (${pracaSelecionada.totalAvaliacoes} avaliações)`}</Text>
        <Pressable onPress={() => navigation.navigate('Pracas')} accessibilityRole="button">
          <Text style={styles.linkPraca}>Ver praças e avaliações</Text>
        </Pressable>
      </View>}
      <Pressable style={styles.explorarPracas} onPress={() => navigation.navigate('Pracas')}
        accessibilityRole="button" accessibilityLabel="Explorar praças">
        <Text style={styles.textoExplorar}>Explorar praças</Text>
      </Pressable>
    </View>
  );
}

const useEstilos = definirEstilos((c) => StyleSheet.create({
  container: { flex: 1 },
  mapa: { flex: 1 },
  localAnel: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', elevation: 3 },
  localCentro: { width: 18, height: 18, borderRadius: 9, backgroundColor: c.laranja },
  indicadorBorda: { position: 'absolute', width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center', backgroundColor: c.botao, elevation: 4 },
  seta: { color: c.textoBotao, fontSize: 24, fontWeight: 'bold' },
  avisoGPS: { position: 'absolute', top: 12, alignSelf: 'center', backgroundColor: c.cartao,
    color: c.texto, padding: 10, borderRadius: 8, fontSize: 12, maxWidth: '85%' },
  explorarPracas: { position: 'absolute', bottom: 18, right: 16, backgroundColor: c.botao,
    paddingVertical: 12, paddingHorizontal: 18, borderRadius: 24, elevation: 3 },
  textoExplorar: { color: c.textoBotao, fontWeight: '700' },
  centralizado: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  mensagem: { textAlign: 'center', marginTop: 12 },
  marcador: { width: 32, height: 32, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  textoMarcador: { color: '#ffffff', fontWeight: 'bold' },
  marcadorPraca: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.cartao,
    borderWidth: 2, borderColor: c.laranja, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  arvore: { fontSize: 23 },
  cartaoPraca: { position: 'absolute', bottom: 75, left: 16, right: 16,
    backgroundColor: c.cartao, borderRadius: 16, padding: 14, gap: 8, elevation: 7 },
  fecharCartao: { position: 'absolute', right: 12, top: 10, zIndex: 1, padding: 5 },
  fecharTexto: { fontSize: 16, color: c.secundario },
  nomePraca: { fontSize: 18, fontWeight: '700', color: c.texto, paddingRight: 30 },
  bairroPraca: { color: c.secundario, fontSize: 13 },
  fotosPraca: { gap: 8 },
  fotoPraca: { width: 135, height: 90, borderRadius: 8 },
  notaPraca: { color: c.texto, fontWeight: '600' },
  linkPraca: { color: c.azul, fontWeight: '700', textDecorationLine: 'underline' },
}));
