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
  const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const caminho = `${usuarioId}/${pasta}/${nomeArquivo}`;

  const { error } = await supabase.storage
    .from('fotos')
    .upload(caminho, arquivo, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`Erro ao enviar foto: ${error.message}`);
  }

  const { data } = supabase.storage.from('fotos').getPublicUrl(caminho);

  return { url: data.publicUrl, caminho };
}

export async function removerFotosStorage(caminhos: string[]): Promise<void> {
  const validos = caminhos.filter(Boolean);
  if (validos.length === 0) return;

  const { error } = await supabase.storage.from('fotos').remove(validos);

  if (error) {
    console.error('Erro ao remover fotos do Storage:', error);
  }
}

export async function enviarFotosStorage(
  usuarioId: string,
  fotoUris: string[],
  pasta: string
): Promise<FotoEnviada[]> {
  const enviadas: FotoEnviada[] = [];

  try {
    for (const uri of fotoUris) {
      enviadas.push(await enviarFotoStorage(usuarioId, uri, pasta));
    }
    return enviadas;
  } catch (error) {
    await removerFotosStorage(enviadas.map((foto) => foto.caminho));
    throw error;
  }
}
