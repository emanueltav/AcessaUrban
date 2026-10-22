import { supabase } from './supabase';

export type StatusOcorrencia =
  | 'PENDENTE_VALIDACAO'
  | 'ATIVA'
  | 'RESOLVIDA';

export type CategoriaOcorrencia =
  | 'PAVIMENTACAO'
  | 'ILUMINACAO'
  | 'ESGOTO'
  | 'CALCAMENTO';

export type GravidadeOcorrencia =
  | 'LEVE'
  | 'MODERADO'
  | 'GRAVE';

export type VotoResolucao =
  | 'AINDA_EXISTE'
  | 'RESOLVIDO';

export type FotoOcorrencia = {
  id: string;
  foto_url: string;
  ordem: number;
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
  bairro: BairroOcorrencia | null;
};

export type ResumoValidacoes = {
  confirmacoes: number;
  resolvidos: number;
  aindaExiste: number;
  usuarioConfirmou: boolean;
  votoResolucaoUsuario: VotoResolucao | null;
};

export async function buscarOcorrencia(
  ocorrenciaId: string
): Promise<OcorrenciaDetalhe> {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select(\`
      id,
      usuario_id,
      categoria,
      gravidade,
      descricao,
      foto_url,
      status,
      criado_em,
      bairro:bairros (
        nome,
        municipio,
        uf
      ),
      fotos:ocorrencia_fotos (
        id,
        foto_url,
        ordem
      )
    \`)
    .eq('id', ocorrenciaId)
    .single();

  if (error) {
    throw new Error(
      \`Erro ao carregar ocorrência: \${error.message}\`
    );
  }

  const bairro = Array.isArray(data.bairro)
    ? data.bairro[0] ?? null
    : data.bairro ?? null;

  const fotos = (
    Array.isArray(data.fotos)
      ? data.fotos
      : []
  )
    .map((foto) => ({
      id: String(foto.id),
      foto_url: String(foto.foto_url),
      ordem: Number(foto.ordem),
    }))
    .sort((a, b) => a.ordem - b.ordem);

  if (
    fotos.length === 0 &&
    data.foto_url
  ) {
    fotos.push({
      id: 'principal',
      foto_url: String(data.foto_url),
      ordem: 1,
    });
  }

  return {
    id: String(data.id),
    usuario_id: String(data.usuario_id),
    categoria:
      data.categoria as CategoriaOcorrencia,
    gravidade:
      data.gravidade as GravidadeOcorrencia,
    descricao: data.descricao,
    foto_url: String(data.foto_url),
    fotos,
    status: data.status as StatusOcorrencia,
    criado_em: String(data.criado_em),
    bairro: bairro
      ? {
          nome: String(bairro.nome),
          municipio: String(bairro.municipio),
          uf: String(bairro.uf),
        }
      : null,
  };
}

export async function buscarResumoValidacoes(
  ocorrenciaId: string,
  usuarioId: string
): Promise<ResumoValidacoes> {
  const { data, error } = await supabase
    .from('validacoes_ocorrencia')
    .select('usuario_id, fase, voto')
    .eq('ocorrencia_id', ocorrenciaId);

  if (error) {
    throw new Error(
      \`Erro ao carregar validações: \${error.message}\`
    );
  }

  let confirmacoes = 0;
  let resolvidos = 0;
  let aindaExiste = 0;
  let usuarioConfirmou = false;

  let votoResolucaoUsuario:
    | VotoResolucao
    | null = null;

  for (const validacao of data ?? []) {
    if (
      validacao.fase === 'CONFIRMACAO' &&
      validacao.voto === 'CONFIRMA_PROBLEMA'
    ) {
      confirmacoes += 1;

      if (
        validacao.usuario_id === usuarioId
      ) {
        usuarioConfirmou = true;
      }
    }

    if (validacao.fase === 'RESOLUCAO') {
      if (
        validacao.voto === 'RESOLVIDO'
      ) {
        resolvidos += 1;
      }

      if (
        validacao.voto === 'AINDA_EXISTE'
      ) {
        aindaExiste += 1;
      }

      if (
        validacao.usuario_id === usuarioId
      ) {
        votoResolucaoUsuario =
          validacao.voto as VotoResolucao;
      }
    }
  }

  return {
    confirmacoes,
    resolvidos,
    aindaExiste,
    usuarioConfirmou,
    votoResolucaoUsuario,
  };
}

export async function confirmarProblema(
  ocorrenciaId: string,
  usuarioId: string
) {
  const { error } = await supabase
    .from('validacoes_ocorrencia')
    .insert({
      ocorrencia_id: ocorrenciaId,
      usuario_id: usuarioId,
      fase: 'CONFIRMACAO',
      voto: 'CONFIRMA_PROBLEMA',
    });

  if (error) {
    throw new Error(error.message);
  }
}

export async function votarResolucao(
  ocorrenciaId: string,
  usuarioId: string,
  voto: VotoResolucao
) {
  const { error } = await supabase
    .from('validacoes_ocorrencia')
    .upsert(
      {
        ocorrencia_id: ocorrenciaId,
        usuario_id: usuarioId,
        fase: 'RESOLUCAO',
        voto,
      },
      {
        onConflict:
          'ocorrencia_id,usuario_id,fase',
      }
    );

  if (error) {
    throw new Error(error.message);
  }
}
