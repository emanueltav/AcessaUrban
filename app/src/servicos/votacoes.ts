import {
  enviarFotoStorage,
  removerFotosStorage,
} from './fotos';
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
      ativado_em,
      resolvido_em,
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

  if (fotos.length === 0 && data.foto_url) {
    fotos.push({
      id: 'principal',
      foto_url: String(data.foto_url),
      ordem: 1,
    });
  }

  return {
    id: String(data.id),
    usuario_id: String(data.usuario_id),
    categoria: data.categoria as CategoriaOcorrencia,
    gravidade: data.gravidade as GravidadeOcorrencia,
    descricao: data.descricao,
    foto_url: String(data.foto_url),
    fotos,
    status: data.status as StatusOcorrencia,
    criado_em: String(data.criado_em),
    ativado_em: data.ativado_em
      ? String(data.ativado_em)
      : null,
    resolvido_em: data.resolvido_em
      ? String(data.resolvido_em)
      : null,
    bairro: bairro
      ? {
          nome: String(bairro.nome),
          municipio: String(bairro.municipio),
          uf: String(bairro.uf),
        }
      : null,
  };
}

export async function buscarHistoricoOcorrencia(
  ocorrenciaId: string
): Promise<EventoValidacao[]> {
  const { data, error } = await supabase
    .from('validacao_eventos')
    .select(\`
      id,
      voto,
      criado_em,
      fotos:validacao_evento_fotos (
        id,
        foto_url,
        ordem
      )
    \`)
    .eq('ocorrencia_id', ocorrenciaId)
    .order('criado_em', {
      ascending: true,
    });

  if (error) {
    throw new Error(
      \`Erro ao carregar histórico: \${error.message}\`
    );
  }

  return (data ?? []).map((evento) => {
    const fotos = (
      Array.isArray(evento.fotos)
        ? evento.fotos
        : []
    )
      .map((foto) => ({
        id: String(foto.id),
        foto_url: String(foto.foto_url),
        ordem: Number(foto.ordem),
      }))
      .sort((a, b) => a.ordem - b.ordem);

    return {
      id: String(evento.id),
      voto: evento.voto as VotoResolucao,
      criado_em: String(evento.criado_em),
      fotos,
    };
  });
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
  let votoResolucaoUsuario: VotoResolucao | null = null;

  for (const validacao of data ?? []) {
    if (
      validacao.fase === 'CONFIRMACAO' &&
      validacao.voto === 'CONFIRMA_PROBLEMA'
    ) {
      confirmacoes += 1;

      if (validacao.usuario_id === usuarioId) {
        usuarioConfirmou = true;
      }
    }

    if (validacao.fase === 'RESOLUCAO') {
      if (validacao.voto === 'RESOLVIDO') {
        resolvidos += 1;
      }

      if (validacao.voto === 'AINDA_EXISTE') {
        aindaExiste += 1;
      }

      if (validacao.usuario_id === usuarioId) {
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
  voto: VotoResolucao,
  fotoUris: string[] = []
) {
  if (fotoUris.length > 3) {
    throw new Error(
      'É permitido anexar no máximo 3 fotos.'
    );
  }

  const fotosEnviadas: {
    url: string;
    caminho: string;
  }[] = [];

  try {
    for (const fotoUri of fotoUris) {
      const foto = await enviarFotoStorage(
        usuarioId,
        fotoUri,
        'validacoes'
      );

      fotosEnviadas.push(foto);
    }

    const { error } = await supabase.rpc(
      'registrar_voto_resolucao_com_evidencias',
      {
        p_ocorrencia_id: ocorrenciaId,
        p_voto: voto,
        p_foto_urls: fotosEnviadas.map(
          (foto) => foto.url
        ),
        p_caminhos_storage: fotosEnviadas.map(
          (foto) => foto.caminho
        ),
      }
    );

    if (error) {
      throw new Error(error.message);
    }
  } catch (error) {
    await removerFotosStorage(
      fotosEnviadas.map(
        (foto) => foto.caminho
      )
    );

    throw error;
  }
}
