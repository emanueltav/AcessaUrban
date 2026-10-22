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
