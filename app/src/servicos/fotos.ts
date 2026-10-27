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

export async function removerFotosStorage(
  caminhos: string[], { tolerarFalhas = false }: { tolerarFalhas?: boolean } = {}
): Promise<void> {
  const validos = [...new Set(caminhos.filter((caminho) => caminho && caminho !== 'legado'))];
  if (validos.length === 0) return;

  try {
    const { data, error } = await supabase.storage.from('fotos').remove(validos);
    if (error) throw error;
    if (data?.length !== validos.length)
      throw new Error(`Somente ${data?.length ?? 0} de ${validos.length} foto(s) foram removidas.`);
  } catch (erro) {
    console.error('Erro ao remover fotos do Storage:', erro, validos);
    if (!tolerarFalhas) throw new Error('Não foi possível remover todas as fotos do Storage.');
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
    await removerFotosStorage(enviadas.map((foto) => foto.caminho), { tolerarFalhas: true });
    throw error;
  }
}
