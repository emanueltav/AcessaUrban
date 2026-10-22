import {
  enviarFotoStorage,
  FotoEnviada,
  removerFotosStorage,
} from './fotos';
import { supabase } from './supabase';

type NovaOcorrencia = {
  usuarioId: string;
  fotoUris: string[];
  latitude: number;
  longitude: number;

  categoria:
    | 'PAVIMENTACAO'
    | 'ILUMINACAO'
    | 'ESGOTO'
    | 'CALCAMENTO';

  gravidade:
    | 'LEVE'
    | 'MODERADO'
    | 'GRAVE';

  descricao: string;
};

export type OcorrenciaResumoGeral = {
  id: string;
  categoria: string;
  gravidade: string;
  criado_em: string;
  ativado_em: string | null;
  resolvido_em: string | null;

  bairro: {
    nome: string;
    municipio: string;
    uf: string;
  } | null;
};

export type ResumoOcorrenciasGeral = {
  ativas: number;
  resolvidasMes: number;
  tempoMedioResolucaoDias: number | null;
  ocorrenciasAtivas: OcorrenciaResumoGeral[];
  ocorrenciasAnteriores: OcorrenciaResumoGeral[];
};

export function diasDesde(
  data: string
) {
  const diferenca =
    Date.now() -
    new Date(data).getTime();

  return Math.max(
    0,
    Math.floor(
      diferenca /
        (1000 * 60 * 60 * 24)
    )
  );
}

export async function buscarResumoOcorrencias():
  Promise<ResumoOcorrenciasGeral> {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select(`
      id,
      categoria,
      gravidade,
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
    .in(
      'status',
      ['ATIVA', 'RESOLVIDA']
    )
    .order(
      'criado_em',
      {
        ascending: false,
      }
    );

  if (error) {
    throw new Error(
      `Erro ao carregar ocorrências: ${error.message}`
    );
  }

  const agora = new Date();

  const inicioMes =
    new Date(
      agora.getFullYear(),
      agora.getMonth(),
      1
    );

  const limiteHistorico =
    new Date(agora);

  limiteHistorico.setDate(
    limiteHistorico.getDate() - 30
  );

  const ativas:
    OcorrenciaResumoGeral[] = [];

  const resolvidas:
    OcorrenciaResumoGeral[] = [];

  for (const item of data ?? []) {
    const bairro =
      Array.isArray(item.bairro)
        ? item.bairro[0] ?? null
        : item.bairro ?? null;

    const ocorrencia:
      OcorrenciaResumoGeral = {
        id: String(item.id),

        categoria: String(
          item.categoria
        ),

        gravidade: String(
          item.gravidade
        ),

        criado_em: String(
          item.criado_em
        ),

        ativado_em:
          item.ativado_em
            ? String(
                item.ativado_em
              )
            : null,

        resolvido_em:
          item.resolvido_em
            ? String(
                item.resolvido_em
              )
            : null,

        bairro: bairro
          ? {
              nome: String(
                bairro.nome
              ),

              municipio: String(
                bairro.municipio
              ),

              uf: String(
                bairro.uf
              ),
            }
          : null,
      };

    if (
      item.status === 'ATIVA'
    ) {
      ativas.push(
        ocorrencia
      );
    }

    if (
      item.status ===
      'RESOLVIDA'
    ) {
      resolvidas.push(
        ocorrencia
      );
    }
  }

  const resolvidasMes =
    resolvidas.filter(
      (ocorrencia) =>
        ocorrencia.resolvido_em &&
        new Date(
          ocorrencia.resolvido_em
        ) >= inicioMes
    ).length;

  const temposResolucao =
    resolvidas
      .filter(
        (ocorrencia) =>
          ocorrencia.ativado_em &&
          ocorrencia.resolvido_em
      )
      .map(
        (ocorrencia) => {
          const inicio =
            new Date(
              ocorrencia
                .ativado_em!
            ).getTime();

          const fim =
            new Date(
              ocorrencia
                .resolvido_em!
            ).getTime();

          return Math.max(
            0,
            (fim - inicio) /
              (
                1000 *
                60 *
                60 *
                24
              )
          );
        }
      );

  const tempoMedioResolucaoDias =
    temposResolucao.length > 0
      ? temposResolucao.reduce(
          (total, dias) =>
            total + dias,
          0
        ) /
        temposResolucao.length
      : null;

  const ocorrenciasAnteriores =
    resolvidas.filter(
      (ocorrencia) =>
        ocorrencia.resolvido_em &&
        new Date(
          ocorrencia.resolvido_em
        ) < limiteHistorico
    );

  return {
    ativas: ativas.length,
    resolvidasMes,
    tempoMedioResolucaoDias,
    ocorrenciasAtivas:
      ativas,
    ocorrenciasAnteriores,
  };
}

export async function registrarOcorrencia(
  dados: NovaOcorrencia
) {
  if (
    dados.fotoUris.length < 1 ||
    dados.fotoUris.length > 3
  ) {
    throw new Error(
      'A ocorrência deve possuir entre 1 e 3 fotos.'
    );
  }

  const fotosEnviadas: FotoEnviada[] = [];

  try {
    for (const fotoUri of dados.fotoUris) {
      const foto = await enviarFotoStorage(
        dados.usuarioId,
        fotoUri,
        'ocorrencias'
      );

      fotosEnviadas.push(foto);
    }

    const { data, error } = await supabase.rpc(
      'registrar_ocorrencia_com_fotos',
      {
        p_categoria: dados.categoria,
        p_gravidade: dados.gravidade,
        p_descricao: dados.descricao.trim(),
        p_latitude: dados.latitude,
        p_longitude: dados.longitude,

        p_foto_urls:
          fotosEnviadas.map(
            (foto) => foto.url
          ),

        p_caminhos_storage:
          fotosEnviadas.map(
            (foto) => foto.caminho
          ),
      }
    );

    if (error) {
      throw new Error(
        `Erro ao registrar ocorrência: ${error.message}`
      );
    }

    return String(data);
  } catch (error) {
    await removerFotosStorage(
      fotosEnviadas.map(
        (foto) => foto.caminho
      )
    );

    throw error;
  }
}
