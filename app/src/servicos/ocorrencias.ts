import { supabase } from './supabase';

type NovaOcorrencia = {
  usuarioId: string;
  fotoUri: string;
  latitude: number;
  longitude: number;
  categoria: 'PAVIMENTACAO' | 'ILUMINACAO' | 'ESGOTO' | 'CALCAMENTO';
  gravidade: 'LEVE' | 'MODERADO' | 'GRAVE';
  descricao: string;
};

async function enviarFoto(usuarioId: string, fotoUri: string) {
  const resposta = await fetch(fotoUri);
  const arquivo = await resposta.arrayBuffer();

  const nomeArquivo = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.jpg`;

  const caminho = `${usuarioId}/${nomeArquivo}`;

  const { error } = await supabase.storage
    .from('fotos')
    .upload(caminho, arquivo, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`Erro ao enviar foto: ${error.message}`);
  }

  const { data } = supabase.storage
    .from('fotos')
    .getPublicUrl(caminho);

  return data.publicUrl;
}

export async function registrarOcorrencia(dados: NovaOcorrencia) {
  const fotoUrl = await enviarFoto(
    dados.usuarioId,
    dados.fotoUri
  );

  const { data, error } = await supabase
    .from('ocorrencias')
    .insert({
      usuario_id: dados.usuarioId,
      categoria: dados.categoria,
      gravidade: dados.gravidade,
      descricao: dados.descricao.trim(),
      latitude: dados.latitude,
      longitude: dados.longitude,
      foto_url: fotoUrl,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Erro ao registrar ocorrência: ${error.message}`);
  }

  return data.id;
}