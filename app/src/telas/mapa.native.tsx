import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import { NavigationProp, useFocusEffect, useNavigation } from '@react-navigation/native';
import { Camera, GeoJSONSource, Layer, Map, Marker,
  type CameraRef, type FilterSpecification, type GeoJSONSourceProps, type GeoJSONSourceRef,
  type MapRef, type ViewStateChangeEvent } from '@maplibre/maplibre-react-native';

import type { RootStackParamList } from '../navegacao/rotas';
import { definirEstilos, Texto as Text, useTema } from '../contextos/tema';
import { useDadosMapa } from '../hooks/useDadosMapa';
import type { LimitesMapa, OcorrenciaMapa } from '../servicos/mapa';
import type { PracaMapa } from '../servicos/pracas';

const ESTILOS_MAPA = {
  claro: 'https://tiles.openfreemap.org/styles/liberty',
  escuro: 'https://tiles.openfreemap.org/styles/liberty',
};
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

type EventoPonto = Parameters<NonNullable<GeoJSONSourceProps['onPress']>>[0];

function PontosAgrupados({ id, dados, cor, referencia, aoTocar }: {
  id: string;
  dados: GeoJSONSourceProps['data'];
  cor: string;
  referencia: React.Ref<GeoJSONSourceRef>;
  aoTocar: (evento: EventoPonto) => void;
}) {
  const grupos: FilterSpecification = ['has', 'point_count'];
  const individuais: FilterSpecification = ['!', ['has', 'point_count']];
  return <GeoJSONSource id={id} ref={referencia} data={dados} cluster clusterRadius={55}
    clusterMaxZoom={14} onPress={aoTocar}>
    <Layer id={`${id}-grupos`} type="circle" source={id} maxzoom={15} filter={grupos}
      paint={{ 'circle-color': cor, 'circle-radius': 22, 'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2 }} />
    <Layer id={`${id}-quantidade`} type="symbol" source={id} maxzoom={15} filter={grupos}
      layout={{ 'text-font': ['Noto Sans Regular'], 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 14,
        'text-allow-overlap': true }} paint={{ 'text-color': '#FFFFFF' }} />
    <Layer id={`${id}-pontos`} type="circle" source={id} maxzoom={15} filter={individuais}
      paint={{ 'circle-color': ['get', 'cor'], 'circle-radius': 14,
        'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 2 }} />
    <Layer id={`${id}-simbolos`} type="symbol" source={id} maxzoom={15} filter={individuais}
      layout={{ 'text-font': ['Noto Sans Regular'], 'text-field': ['get', 'simbolo'],
        'text-size': 16, 'text-allow-overlap': true }}
      paint={{ 'text-color': '#FFFFFF' }} />
  </GeoJSONSource>;
}

export default function Mapa() {
  const styles = useEstilos();
  const { modo } = useTema();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [limites, setLimites] = useState<LimitesMapa | null>(null);
  const { ocorrencias, pracas, carregando, erro, erroPracas, excesso } = useDadosMapa(limites);
  const [zoom, setZoom] = useState(10);
  const mapa = useRef<MapRef>(null);
  const camera = useRef<CameraRef>(null);
  const fonteOcorrencias = useRef<GeoJSONSourceRef>(null);
  const fontePracas = useRef<GeoJSONSourceRef>(null);
  const areaCarregada = useRef<LimitesMapa | null>(null);
  const zoomCarregado = useRef(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const dadosOcorrencias = useMemo(() => ({ type: 'FeatureCollection' as const,
    features: ocorrencias.map((item) => ({ type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [item.longitude, item.latitude] },
      properties: { registroId: item.id, cor: CORES_STATUS[item.status],
        simbolo: SIMBOLOS[item.status] },
    })),
  }), [ocorrencias]);
  const dadosPracas = useMemo(() => ({ type: 'FeatureCollection' as const,
    features: pracas.map((item) => ({ type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [item.longitude, item.latitude] },
      properties: { registroId: item.id, cor: '#0F2C40', simbolo: 'P' },
    })),
  }), [pracas]);

  function atualizarRegiao(estado: Pick<ViewStateChangeEvent, 'bounds' | 'zoom'>) {
    setZoom(estado.zoom);
    const [oeste, sul, leste, norte] = estado.bounds;
    if (![oeste, sul, leste, norte].every(Number.isFinite)) return;
    const anterior = areaCarregada.current;
    if (anterior && oeste >= anterior.minLon && leste <= anterior.maxLon &&
        sul >= anterior.minLat && norte <= anterior.maxLat &&
        (!excesso || estado.zoom < zoomCarregado.current + 0.7)) return;

    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      if (!focado.current) return;
      const margemLat = (norte - sul) * 0.2;
      const cruzouMeridiano = oeste > leste;
      const margemLon = (leste - oeste) * 0.2;
      const novaArea = {
        minLat: Math.max(-90, sul - margemLat), maxLat: Math.min(90, norte + margemLat),
        minLon: cruzouMeridiano ? -180 : Math.max(-180, oeste - margemLon),
        maxLon: cruzouMeridiano ? 180 : Math.min(180, leste + margemLon),
      };
      areaCarregada.current = novaArea;
      zoomCarregado.current = estado.zoom;
      setLimites(novaArea);
    }, 500);
  }

  function tocarPonto(evento: EventoPonto, tipo: 'ocorrencia' | 'praca') {
    const ponto = evento.nativeEvent.features[0];
    if (!ponto || ponto.geometry.type !== 'Point') return;
    const [longitude, latitude] = ponto.geometry.coordinates;
    const agrupamentoId = ponto.properties?.cluster_id;
    if (typeof agrupamentoId === 'number') {
      const fonte = tipo === 'ocorrencia' ? fonteOcorrencias : fontePracas;
      void fonte.current?.getClusterExpansionZoom(agrupamentoId).then((alvo) => {
        if (focado.current && Number.isFinite(alvo))
          camera.current?.easeTo({ center: [longitude, latitude], zoom: Math.min(16, alvo + 0.5),
            duration: 550 });
      }).catch(() => {});
      return;
    }
    const id = String(ponto.properties?.registroId ?? '');
    if (!id) return;
    if (tipo === 'ocorrencia') navigation.navigate('Ocorrencia', { ocorrenciaId: id });
    else setPracaSelecionada(pracas.find((item) => item.id === id) ?? null);
  }

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current); }, []);

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

  return (
    <View style={styles.container}>
      <Map ref={mapa} style={styles.mapa} mapStyle={ESTILOS_MAPA[modo]}
        onLayout={({ nativeEvent }) => {
          dimensoes.current = nativeEvent.layout;
          atualizarIndicador();
        }}
        onDidFinishLoadingMap={() => {
          if (focado.current && acompanhando.current && localAtual.current)
            camera.current?.jumpTo({ center: localAtual.current, zoom: 15 });
          else atualizarIndicador();
          void mapa.current?.getViewState().then((estado) => {
            if (focado.current) atualizarRegiao(estado);
          }).catch(() => {});
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
          atualizarRegiao(nativeEvent);
        }}>
        <Camera ref={camera} initialViewState={{
          center: localAtual.current ?? CENTRO_INICIAL, zoom: localAtual.current ? 15 : 10,
        }} />
        {localizacao && <Marker id="minha-localizacao" lngLat={localizacao}
          anchor="center" onPress={centralizar}>
          <View style={styles.localAnel}><View style={styles.localCentro} /></View>
        </Marker>}
        <PontosAgrupados id="ocorrencias-mapa" dados={dadosOcorrencias} cor="#F4663A"
          referencia={fonteOcorrencias} aoTocar={(evento) => tocarPonto(evento, 'ocorrencia')} />
        <PontosAgrupados id="pracas-mapa" dados={dadosPracas} cor="#0F2C40"
          referencia={fontePracas} aoTocar={(evento) => tocarPonto(evento, 'praca')} />
        {zoom >= 15 && ocorrencias.map((ocorrencia) => (
          <Marker key={ocorrencia.id} id={ocorrencia.id} anchor="bottom"
            lngLat={[ocorrencia.longitude, ocorrencia.latitude]}
            onPress={() => navigation.navigate('Ocorrencia', { ocorrenciaId: ocorrencia.id })}>
            <View style={[styles.marcador, { backgroundColor: CORES_STATUS[ocorrencia.status] }]}>
              <Text style={styles.textoMarcador}>{SIMBOLOS[ocorrencia.status]}</Text>
            </View>
          </Marker>
        ))}
        {zoom >= 15 && pracas.map((praca) => <Marker key={praca.id} id={`praca-${praca.id}`}
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
      {!!(erro || erroPracas || excesso || erroGPS || carregando) &&
        <Text style={styles.avisoGPS}>{erro || erroPracas ||
          (excesso ? 'Muitos registros nesta região. Aproxime o mapa para visualizá-los.' : '') ||
          erroGPS || 'Atualizando registros...'}</Text>}
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
