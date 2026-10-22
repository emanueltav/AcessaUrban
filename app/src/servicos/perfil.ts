import { supabase } from './supabase';

export type BairroPerfil = {
  id: string;
  nome: string;
  municipio: string;
  uf: string;
};

export type PerfilUsuario = {
  id: string;
  nome: string;
  bairro_id: string | null;
  bairro: BairroPerfil | null;
};

export async function buscarPerfil(
  usuarioId: string
): Promise<PerfilUsuario> {
  const { data, error } = await supabase
    .from('perfis')
    .select(`
      id,
      nome,
      bairro_id,
      bairro:bairros (
        id,
        nome,
        municipio,
        uf
      )
    `)
    .eq('id', usuarioId)
    .single();

  if (error) {
    throw new Error(
      `Erro ao carregar perfil: ${error.message}`
    );
  }

  const bairro = Array.isArray(data.bairro)
    ? data.bairro[0] ?? null
    : data.bairro ?? null;

  return {
    id: String(data.id),
    nome: String(data.nome),

    bairro_id: data.bairro_id
      ? String(data.bairro_id)
      : null,

    bairro: bairro
      ? {
          id: String(bairro.id),
          nome: String(bairro.nome),
          municipio: String(
            bairro.municipio
          ),
          uf: String(bairro.uf),
        }
      : null,
  };
}

export async function buscarBairros(
  termo: string
): Promise<BairroPerfil[]> {
  const busca = termo.trim();

  if (!busca) {
    return [];
  }

  const { data, error } = await supabase
    .from('bairros')
    .select(
      'id, nome, municipio, uf'
    )
    .ilike('nome', `%${busca}%`)
    .order('nome', {
      ascending: true,
    })
    .limit(30);

  if (error) {
    throw new Error(
      `Erro ao pesquisar bairros: ${error.message}`
    );
  }

  return (data ?? []).map((bairro) => ({
    id: String(bairro.id),
    nome: String(bairro.nome),
    municipio: String(bairro.municipio),
    uf: String(bairro.uf),
  }));
}

export async function atualizarBairroPerfil(
  usuarioId: string,
  bairroId: string | null
) {
  const { error } = await supabase
    .from('perfis')
    .update({
      bairro_id: bairroId,
    })
    .eq('id', usuarioId);

  if (error) {
    throw new Error(
      `Erro ao atualizar bairro: ${error.message}`
    );
  }
}
