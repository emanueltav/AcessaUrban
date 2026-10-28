import { enviarFotosStorage, removerFotosStorage } from './fotos';
import { distanciaMetros, limitesProximidade, normalizarBairro, type BairroMapa, type Coordenadas } from './mapa';
import { supabase } from './supabase';
import type { CategoriaOcorrencia, GravidadeOcorrencia } from './votacoes';

type NovaOcorrencia = {
  usuarioId: string;
  fotoUris: string[];
  latitude: number;
  longitude: number;
  categoria: CategoriaOcorrencia;
  gravidade: GravidadeOcorrencia;
  descricao: string;
};

export type OcorrenciaResumoGeral = {
  id: string;
  categoria: CategoriaOcorrencia;
  gravidade: GravidadeOcorrencia;
  criado_em: string;
  ativado_em: string | null;
  resolvido_em: string | null;
  bairro: BairroMapa | null;
};

export type ResumoOcorrenciasGeral = {
  ativas: number;
  resolvidasMes: number;
  tempoMedioResolucaoDias: number | null;
  ocorrenciasAtivas: OcorrenciaResumoGeral[];
  ocorrenciasAnteriores: OcorrenciaResumoGeral[];
};

export type OcorrenciaProxima = {
  id: string;
  descricao: string | null;
  status: 'PENDENTE_VALIDACAO' | 'ATIVA';
  distanciaMetros: number;
};

export async function buscarOcorrenciasProximas(
  categoria: NovaOcorrencia['categoria'], local: Coordenadas
): Promise<OcorrenciaProxima[]> {
  const raio = 30;
  const { minLat, maxLat, minLon, maxLon } = limitesProximidade(local, raio);
  const { data, error } = await supabase
    .from('ocorrencias')
    .select('id, descricao, status, latitude, longitude')
    .eq('categoria', categoria)
    .in('status', ['PENDENTE_VALIDACAO', 'ATIVA'])
    .gte('latitude', minLat)
    .lte('latitude', maxLat)
    .gte('longitude', minLon)
    .lte('longitude', maxLon);

  if (error) throw new Error(`Erro ao verificar ocorrências próximas: ${error.message}`);

  return (data ?? [])
    .map((item) => ({
      id: String(item.id),
      descricao: item.descricao,
      status: item.status as OcorrenciaProxima['status'],
      distanciaMetros: distanciaMetros(local, {
        latitude: Number(item.latitude), longitude: Number(item.longitude),
      }),
    }))
    .filter((item) => item.distanciaMetros <= raio)
    .sort((a, b) => a.distanciaMetros - b.distanciaMetros);
}

const DIA_MS = 24 * 60 * 60 * 1000;

export function diasDesde(data: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / DIA_MS));
}

export async function buscarResumoOcorrencias(): Promise<ResumoOcorrenciasGeral> {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select(`
      id, categoria, gravidade, status, criado_em, ativado_em,
      resolvido_em, bairro:bairros (nome, municipio, uf)
    `)
    .in('status', ['ATIVA', 'RESOLVIDA'])
    .order('criado_em', { ascending: false });

  if (error) {
    throw new Error(`Erro ao carregar ocorrências: ${error.message}`);
  }

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const limiteHistorico = new Date(agora);
  limiteHistorico.setDate(limiteHistorico.getDate() - 30);

  const ativas: OcorrenciaResumoGeral[] = [];
  const resolvidas: OcorrenciaResumoGeral[] = [];

  for (const item of data ?? []) {
    const ocorrencia: OcorrenciaResumoGeral = {
      id: String(item.id),
      categoria: item.categoria as CategoriaOcorrencia,
      gravidade: item.gravidade as GravidadeOcorrencia,
      criado_em: String(item.criado_em),
      ativado_em: item.ativado_em ? String(item.ativado_em) : null,
      resolvido_em: item.resolvido_em ? String(item.resolvido_em) : null,
      bairro: normalizarBairro(item.bairro),
    };

    if (item.status === 'ATIVA') ativas.push(ocorrencia);
    if (item.status === 'RESOLVIDA') resolvidas.push(ocorrencia);
  }

  const resolvidasMes = resolvidas.filter(
    (item) => item.resolvido_em && new Date(item.resolvido_em) >= inicioMes
  ).length;

  const tempos = resolvidas
    .filter((item) => item.ativado_em && item.resolvido_em)
    .map((item) => Math.max(
      0,
      (new Date(item.resolvido_em!).getTime() -
        new Date(item.ativado_em!).getTime()) / DIA_MS
    ));

  const tempoMedioResolucaoDias = tempos.length
    ? tempos.reduce((total, dias) => total + dias, 0) / tempos.length
    : null;

  return {
    ativas: ativas.length,
    resolvidasMes,
    tempoMedioResolucaoDias,
    ocorrenciasAtivas: ativas,
    ocorrenciasAnteriores: resolvidas.filter(
      (item) => item.resolvido_em && new Date(item.resolvido_em) < limiteHistorico
    ),
  };
}

export async function registrarOcorrencia(dados: NovaOcorrencia): Promise<string> {
  if (dados.fotoUris.length < 1 || dados.fotoUris.length > 3) {
    throw new Error('A ocorrência deve possuir entre 1 e 3 fotos.');
  }

  const fotos = await enviarFotosStorage(dados.usuarioId, dados.fotoUris, 'ocorrencias');

  try {
    const { data, error } = await supabase.rpc('registrar_ocorrencia_com_fotos', {
      p_categoria: dados.categoria,
      p_gravidade: dados.gravidade,
      p_descricao: dados.descricao.trim(),
      p_latitude: dados.latitude,
      p_longitude: dados.longitude,
      p_foto_urls: fotos.map((foto) => foto.url),
      p_caminhos_storage: fotos.map((foto) => foto.caminho),
    });

    if (error) throw new Error(`Erro ao registrar ocorrência: ${error.message}`);
    return String(data);
  } catch (error) {
    await removerFotosStorage(fotos.map((foto) => foto.caminho), { tolerarFalhas: true });
    throw error;
  }
}

export async function excluirOcorrenciaPendente(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('excluir_ocorrencia_pendente', {
    p_ocorrencia_id: id,
  });
  if (error) throw new Error(error.message);
  try {
    await removerFotosStorage(Array.isArray(data) ? data : []);
  } catch (erro) {
    throw new Error('A ocorrência foi excluída do banco, mas não foi possível remover todas as fotos. ' +
      (erro instanceof Error ? erro.message : 'Verifique o Storage.'));
  }
}
