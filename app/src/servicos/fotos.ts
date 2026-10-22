import { supabase } from './supabase';

export type FotoEnviada = {
  url: string;
  caminho: string;
};

export async function enviarFotoStorage(
  usuarioId: string,
  fotoUri: string,
  pasta: string
): Promise<FotoEnviada> {
  const resposta = await fetch(fotoUri);
  const arquivo = await resposta.arrayBuffer();

  const nomeArquivo = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.jpg`;

  const caminho =
    `${usuarioId}/${pasta}/${nomeArquivo}`;

  const { error } = await supabase.storage
    .from('fotos')
    .upload(caminho, arquivo, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(
      `Erro ao enviar foto: ${error.message}`
    );
  }

  const { data } = supabase.storage
    .from('fotos')
    .getPublicUrl(caminho);

  return {
    url: data.publicUrl,
    caminho,
  };
}

export async function removerFotosStorage(
  caminhos: string[]
) {
  const caminhosValidos =
    caminhos.filter(Boolean);

  if (caminhosValidos.length === 0) {
    return;
  }

  const { error } = await supabase.storage
    .from('fotos')
    .remove(caminhosValidos);

  if (error) {
    console.error(
      'Erro ao remover fotos do Storage:',
      error
    );
  }
}
