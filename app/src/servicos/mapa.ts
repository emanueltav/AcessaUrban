import { supabase } from './supabase';

export type StatusOcorrencia = 'PENDENTE_VALIDACAO' | 'ATIVA' | 'RESOLVIDA';
export type Coordenadas = { latitude: number; longitude: number };
export type LimitesMapa = { minLat: number; maxLat: number; minLon: number; maxLon: number };
export const LIMITE_MARCADORES = 300;

export function distanciaMetros(origem: Coordenadas, destino: Coordenadas): number {
  const radianos = Math.PI / 180;
  const diferencaLatitude = (destino.latitude - origem.latitude) * radianos;
  const diferencaLongitude = (destino.longitude - origem.longitude) * radianos;
  const a = Math.sin(diferencaLatitude / 2) ** 2 +
    Math.cos(origem.latitude * radianos) * Math.cos(destino.latitude * radianos) *
    Math.sin(diferencaLongitude / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function limitesProximidade(local: Coordenadas, raioMetros: number) {
  const margemLatitude = raioMetros / 110000;
  const margemLongitude = raioMetros /
    (110000 * Math.max(Math.abs(Math.cos(local.latitude * Math.PI / 180)), 0.01));

  return {
    minLat: local.latitude - margemLatitude,
    maxLat: local.latitude + margemLatitude,
    minLon: local.longitude - margemLongitude,
    maxLon: local.longitude + margemLongitude,
  };
}

type BairroMapa = {
  nome: string;
  municipio: string;
  uf: string;
};

export type OcorrenciaMapa = {
  id: string;
  usuario_id: string;
  categoria: string;
  gravidade: string;
  descricao: string | null;
  latitude: number;
  longitude: number;
  foto_url: string;
  status: StatusOcorrencia;
  criado_em: string;
  ativado_em: string | null;
  resolvido_em: string | null;
  bairro: BairroMapa | null;
};

function resolvidaAindaVisivel(resolvidoEm: string | null): boolean {
  if (!resolvidoEm) return false;

  const limite = new Date();
  limite.setDate(limite.getDate() - 30);
  return new Date(resolvidoEm) >= limite;
}

export async function listarOcorrenciasMapa(limites?: LimitesMapa): Promise<OcorrenciaMapa[]> {
  let consulta = supabase
    .from('ocorrencias')
    .select(`
      id, usuario_id, categoria, gravidade, descricao,
      latitude, longitude, foto_url, status, criado_em,
      ativado_em, resolvido_em,
      bairro:bairros (nome, municipio, uf)
    `)
    .order('criado_em', { ascending: false });

  if (limites) {
    const limite = new Date();
    limite.setDate(limite.getDate() - 30);
    consulta = consulta
      .gte('latitude', limites.minLat).lte('latitude', limites.maxLat)
      .gte('longitude', limites.minLon).lte('longitude', limites.maxLon)
      .or(`status.neq.RESOLVIDA,resolvido_em.gte.${limite.toISOString()}`)
      .limit(LIMITE_MARCADORES + 1);
  }

  const { data, error } = await consulta;

  if (error) {
    throw new Error(`Erro ao carregar ocorrências: ${error.message}`);
  }

  return (data ?? [])
    .map((item): OcorrenciaMapa => {
      const bairro = Array.isArray(item.bairro)
        ? item.bairro[0] ?? null
        : item.bairro ?? null;

      return {
        id: String(item.id),
        usuario_id: String(item.usuario_id),
        categoria: String(item.categoria),
        gravidade: String(item.gravidade),
        descricao: item.descricao,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        foto_url: String(item.foto_url),
        status: item.status as StatusOcorrencia,
        criado_em: String(item.criado_em),
        ativado_em: item.ativado_em ? String(item.ativado_em) : null,
        resolvido_em: item.resolvido_em ? String(item.resolvido_em) : null,
        bairro: bairro
          ? {
              nome: String(bairro.nome),
              municipio: String(bairro.municipio),
              uf: String(bairro.uf),
            }
          : null,
      };
    })
    .filter((item) =>
      item.status !== 'RESOLVIDA' || resolvidaAindaVisivel(item.resolvido_em)
    );
}
