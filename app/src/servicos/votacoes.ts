import { enviarFotosStorage, removerFotosStorage } from './fotos';
import { supabase } from './supabase';

export type StatusOcorrencia = 'PENDENTE_VALIDACAO' | 'ATIVA' | 'RESOLVIDA';
export type CategoriaOcorrencia = 'PAVIMENTACAO' | 'ILUMINACAO' | 'ESGOTO' | 'CALCAMENTO';
export type GravidadeOcorrencia = 'LEVE' | 'MODERADO' | 'GRAVE';
export type VotoResolucao = 'AINDA_EXISTE' | 'RESOLVIDO';

export type FotoOcorrencia = {
  id: string;
  foto_url: string;
  ordem: number;
};

export type EventoValidacao = {
  id: string;
  voto: VotoResolucao;
  criado_em: string;
  fotos: FotoOcorrencia[];
};

type BairroOcorrencia = {
  nome: string;
  municipio: string;
  uf: string;
};

export type OcorrenciaDetalhe = {
  id: string;
  usuario_id: string;
  categoria: CategoriaOcorrencia;
  gravidade: GravidadeOcorrencia;
  descricao: string | null;
  foto_url: string;
  fotos: FotoOcorrencia[];
  status: StatusOcorrencia;
  criado_em: string;
  ativado_em: string | null;
  resolvido_em: string | null;
  bairro: BairroOcorrencia | null;
};

export type ResumoValidacoes = {
  confirmacoes: number;
  resolvidos: number;
  aindaExiste: number;
  usuarioConfirmou: boolean;
  votoResolucaoUsuario: VotoResolucao | null;
};

function ordenarFotos(fotos: { id: unknown; foto_url: unknown; ordem: unknown }[]): FotoOcorrencia[] {
  return fotos.map((foto) => ({
    id: String(foto.id),
    foto_url: String(foto.foto_url),
    ordem: Number(foto.ordem),
  })).sort((a, b) => a.ordem - b.ordem);
}

export async function buscarOcorrencia(ocorrenciaId: string): Promise<OcorrenciaDetalhe> {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select(`
      id, usuario_id, categoria, gravidade, descricao, foto_url,
      status, criado_em, ativado_em, resolvido_em,
      bairro:bairros (nome, municipio, uf),
      fotos:ocorrencia_fotos (id, foto_url, ordem)
    `)
    .eq('id', ocorrenciaId)
    .single();

  if (error) throw new Error(`Erro ao carregar ocorrência: ${error.message}`);

  const bairro = Array.isArray(data.bairro) ? data.bairro[0] : data.bairro;
  const fotos = ordenarFotos(Array.isArray(data.fotos) ? data.fotos : []);

  if (!fotos.length && data.foto_url) {
    fotos.push({ id: 'principal', foto_url: String(data.foto_url), ordem: 1 });
  }

  return {
    ...data,
    fotos,
    bairro: bairro ? {
      nome: String(bairro.nome),
      municipio: String(bairro.municipio),
      uf: String(bairro.uf),
    } : null,
  } as OcorrenciaDetalhe;
}

export async function buscarHistoricoOcorrencia(ocorrenciaId: string): Promise<EventoValidacao[]> {
  const { data, error } = await supabase
    .from('validacao_eventos')
    .select('id, voto, criado_em, fotos:validacao_evento_fotos (id, foto_url, ordem)')
    .eq('ocorrencia_id', ocorrenciaId)
    .order('criado_em', { ascending: true });

  if (error) throw new Error(`Erro ao carregar histórico: ${error.message}`);

  return (data ?? []).map((evento) => ({
    id: String(evento.id),
    voto: evento.voto as VotoResolucao,
    criado_em: String(evento.criado_em),
    fotos: ordenarFotos(Array.isArray(evento.fotos) ? evento.fotos : []),
  }));
}

export async function buscarResumoValidacoes(
  ocorrenciaId: string,
  usuarioId: string
): Promise<ResumoValidacoes> {
  const { data, error } = await supabase
    .from('validacoes_ocorrencia')
    .select('usuario_id, fase, voto')
    .eq('ocorrencia_id', ocorrenciaId);

  if (error) throw new Error(`Erro ao carregar validações: ${error.message}`);

  const resumo: ResumoValidacoes = {
    confirmacoes: 0,
    resolvidos: 0,
    aindaExiste: 0,
    usuarioConfirmou: false,
    votoResolucaoUsuario: null,
  };

  for (const item of data ?? []) {
    if (item.fase === 'CONFIRMACAO' && item.voto === 'CONFIRMA_PROBLEMA') {
      resumo.confirmacoes++;
      if (item.usuario_id === usuarioId) resumo.usuarioConfirmou = true;
    }

    if (item.fase !== 'RESOLUCAO') continue;

    if (item.voto === 'RESOLVIDO') resumo.resolvidos++;
    if (item.voto === 'AINDA_EXISTE') resumo.aindaExiste++;
    if (item.usuario_id === usuarioId) {
      resumo.votoResolucaoUsuario = item.voto as VotoResolucao;
    }
  }

  return resumo;
}

export async function confirmarProblema(ocorrenciaId: string, usuarioId: string): Promise<void> {
  const { error } = await supabase.from('validacoes_ocorrencia').insert({
    ocorrencia_id: ocorrenciaId,
    usuario_id: usuarioId,
    fase: 'CONFIRMACAO',
    voto: 'CONFIRMA_PROBLEMA',
  });

  if (error) throw new Error(error.message);
}

export async function votarResolucao(
  ocorrenciaId: string,
  usuarioId: string,
  voto: VotoResolucao,
  fotoUris: string[] = []
): Promise<void> {
  if (fotoUris.length > 3) throw new Error('É permitido anexar no máximo 3 fotos.');

  const fotos = await enviarFotosStorage(usuarioId, fotoUris, 'validacoes');
  const caminhos = fotos.map((foto) => foto.caminho);

  try {
    const { error } = await supabase.rpc('registrar_voto_resolucao_com_evidencias', {
      p_ocorrencia_id: ocorrenciaId,
      p_voto: voto,
      p_foto_urls: fotos.map((foto) => foto.url),
      p_caminhos_storage: caminhos,
    });

    if (error) throw new Error(error.message);
  } catch (error) {
    await removerFotosStorage(caminhos);
    throw error;
  }
}
