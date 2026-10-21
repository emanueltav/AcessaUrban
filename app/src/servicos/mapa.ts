import { supabase } from './supabase';

export type StatusOcorrencia =
  | 'PENDENTE_VALIDACAO'
  | 'ATIVA'
  | 'RESOLVIDA';

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
  bairro: BairroMapa | null;
};

export async function listarOcorrenciasMapa(): Promise<
  OcorrenciaMapa[]
> {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select(`
      id,
      usuario_id,
      categoria,
      gravidade,
      descricao,
      latitude,
      longitude,
      foto_url,
      status,
      criado_em,
      bairro:bairros (
        nome,
        municipio,
        uf
      )
    `)
    .order('criado_em', {
      ascending: false,
    });

  if (error) {
    throw new Error(
      `Erro ao carregar ocorrências: ${error.message}`
    );
  }

  return (data ?? []).map((ocorrencia) => {
    const bairro = Array.isArray(ocorrencia.bairro)
      ? ocorrencia.bairro[0] ?? null
      : ocorrencia.bairro ?? null;

    return {
      id: String(ocorrencia.id),
      usuario_id: String(ocorrencia.usuario_id),
      categoria: String(ocorrencia.categoria),
      gravidade: String(ocorrencia.gravidade),
      descricao: ocorrencia.descricao,
      latitude: Number(ocorrencia.latitude),
      longitude: Number(ocorrencia.longitude),
      foto_url: String(ocorrencia.foto_url),
      status: ocorrencia.status as StatusOcorrencia,
      criado_em: String(ocorrencia.criado_em),
      bairro: bairro
        ? {
            nome: String(bairro.nome),
            municipio: String(bairro.municipio),
            uf: String(bairro.uf),
          }
        : null,
    };
  });
}
