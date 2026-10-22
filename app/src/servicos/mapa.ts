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
  ativado_em: string | null;
  resolvido_em: string | null;
  bairro: BairroMapa | null;
};

function resolvidaAindaVisivel(
  resolvidoEm: string | null
) {
  if (!resolvidoEm) {
    return false;
  }

  const limite = new Date();
  limite.setDate(limite.getDate() - 30);

  return new Date(resolvidoEm) >= limite;
}

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
      ativado_em,
      resolvido_em,
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

  return (data ?? [])
    .map((ocorrencia) => {
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
        ativado_em: ocorrencia.ativado_em
          ? String(ocorrencia.ativado_em)
          : null,
        resolvido_em: ocorrencia.resolvido_em
          ? String(ocorrencia.resolvido_em)
          : null,
        bairro: bairro
          ? {
              nome: String(bairro.nome),
              municipio: String(bairro.municipio),
              uf: String(bairro.uf),
            }
          : null,
      };
    })
    .filter((ocorrencia) => {
      if (ocorrencia.status !== 'RESOLVIDA') {
        return true;
      }

      return resolvidaAindaVisivel(
        ocorrencia.resolvido_em
      );
    });
}
