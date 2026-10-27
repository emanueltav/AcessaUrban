import { enviarFotosStorage, removerFotosStorage } from './fotos';
import { distanciaMetros, limitesProximidade, LIMITE_MARCADORES,
  type Coordenadas, type LimitesMapa } from './mapa';
import { supabase } from './supabase';

export type StatusPraca = 'PENDENTE' | 'APROVADA';

export type FotoPraca = {
  id: string;
  foto_url: string;
  ordem: number;
};

export type Praca = {
  id: string;
  usuario_id: string | null;
  nome: string;
  status: StatusPraca;
  criado_em: string;
  fotos: FotoPraca[];
  bairro: { nome: string; municipio: string; uf: string } | null;
  confirmacoes: number;
  usuarioConfirmou: boolean;
  media: number | null;
  totalAvaliacoes: number;
  avaliacaoUsuario: number | null;
};

export type PracaProxima = {
  id: string;
  nome: string;
  status: StatusPraca;
  distanciaMetros: number;
};

export type PracaMapa = Pick<Praca, 'id' | 'nome' | 'fotos' | 'bairro' | 'media' | 'totalAvaliacoes'> & Coordenadas;

export async function listarPracasMapa(limites?: LimitesMapa): Promise<PracaMapa[]> {
  let consulta = supabase.from('pracas')
    .select(`id, nome, latitude, longitude,
      bairro:bairros (nome, municipio, uf),
      fotos:praca_fotos (id, foto_url, ordem),
      avaliacoes:praca_avaliacoes (nota)`)
    .eq('status', 'APROVADA')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null);

  if (limites) consulta = consulta
    .gte('latitude', limites.minLat).lte('latitude', limites.maxLat)
    .gte('longitude', limites.minLon).lte('longitude', limites.maxLon)
    .limit(LIMITE_MARCADORES + 1);

  const { data, error } = await consulta;

  if (error) throw new Error(`Erro ao carregar praças no mapa: ${error.message}`);
  return (data ?? []).map((item): PracaMapa => {
    const avaliacoes = Array.isArray(item.avaliacoes) ? item.avaliacoes : [];
    const bairro = Array.isArray(item.bairro) ? item.bairro[0] ?? null : item.bairro ?? null;
    return {
      id: String(item.id), nome: String(item.nome),
      latitude: Number(item.latitude), longitude: Number(item.longitude),
      bairro: bairro ? { nome: bairro.nome, municipio: bairro.municipio, uf: bairro.uf } : null,
      fotos: (item.fotos ?? []).map((foto) => ({
        id: String(foto.id), foto_url: String(foto.foto_url), ordem: Number(foto.ordem),
      })).sort((a, b) => a.ordem - b.ordem),
      media: avaliacoes.length
        ? avaliacoes.reduce((total, avaliacao) => total + Number(avaliacao.nota), 0) / avaliacoes.length
        : null,
      totalAvaliacoes: avaliacoes.length,
    };
  }).filter((praca) => Number.isFinite(praca.latitude) && Number.isFinite(praca.longitude));
}

export async function buscarPracasProximas(local: Coordenadas): Promise<PracaProxima[]> {
  const raio = 80;
  const { minLat, maxLat, minLon, maxLon } = limitesProximidade(local, raio);
  const { data, error } = await supabase
    .from('pracas')
    .select('id, nome, status, latitude, longitude')
    .in('status', ['PENDENTE', 'APROVADA'])
    .gte('latitude', minLat)
    .lte('latitude', maxLat)
    .gte('longitude', minLon)
    .lte('longitude', maxLon);

  if (error) throw new Error(`Erro ao verificar praças próximas: ${error.message}`);

  return (data ?? [])
    .map((item) => ({
      id: String(item.id),
      nome: String(item.nome),
      status: item.status as StatusPraca,
      distanciaMetros: distanciaMetros(local, {
        latitude: Number(item.latitude), longitude: Number(item.longitude),
      }),
    }))
    .filter((item) => item.distanciaMetros <= raio)
    .sort((a, b) => a.distanciaMetros - b.distanciaMetros);
}

export async function listarPracas(usuarioId?: string | null): Promise<Praca[]> {
  const { data, error } = await supabase
    .from('pracas')
    .select(`
      id, usuario_id, nome, status, criado_em,
      bairro:bairros (nome, municipio, uf),
      fotos:praca_fotos (id, foto_url, ordem),
      confirmacoes:praca_confirmacoes (usuario_id),
      avaliacoes:praca_avaliacoes (usuario_id, nota)
    `)
    .order('criado_em', { ascending: false });

  if (error) throw new Error(`Erro ao carregar praças: ${error.message}`);

  return (data ?? []).map((item): Praca => {
    const bairro = Array.isArray(item.bairro)
      ? item.bairro[0] ?? null
      : item.bairro ?? null;

    const fotos = Array.isArray(item.fotos)
      ? [...item.fotos].sort((a, b) => Number(a.ordem) - Number(b.ordem))
      : [];

    const confirmacoes = Array.isArray(item.confirmacoes) ? item.confirmacoes : [];
    const avaliacoes = Array.isArray(item.avaliacoes) ? item.avaliacoes : [];
    const soma = avaliacoes.reduce((total, avaliacao) => total + Number(avaliacao.nota), 0);
    const avaliacaoUsuario = usuarioId
      ? avaliacoes.find((avaliacao) => String(avaliacao.usuario_id) === usuarioId)
      : undefined;

    return {
      id: String(item.id),
      usuario_id: item.usuario_id ? String(item.usuario_id) : null,
      nome: String(item.nome),
      status: String(item.status) as StatusPraca,
      criado_em: String(item.criado_em),
      fotos: fotos.map((foto) => ({
        id: String(foto.id),
        foto_url: String(foto.foto_url),
        ordem: Number(foto.ordem),
      })),
      bairro: bairro
        ? {
            nome: String(bairro.nome),
            municipio: String(bairro.municipio),
            uf: String(bairro.uf),
          }
          : null,
      confirmacoes: confirmacoes.length,
      usuarioConfirmou: usuarioId
        ? confirmacoes.some((item) => String(item.usuario_id) === usuarioId)
        : false,
      media: avaliacoes.length ? soma / avaliacoes.length : null,
      totalAvaliacoes: avaliacoes.length,
      avaliacaoUsuario: avaliacaoUsuario ? Number(avaliacaoUsuario.nota) : null,
    };
  });
}

type NovaPraca = {
  usuarioId: string;
  nome: string;
  fotoUris: string[];
  latitude: number;
  longitude: number;
};

export async function registrarPraca(dados: NovaPraca): Promise<string> {
  if (dados.fotoUris.length < 1 || dados.fotoUris.length > 3) {
    throw new Error('A praça deve possuir entre 1 e 3 fotos.');
  }

  if (!dados.nome.trim()) throw new Error('Informe o nome da praça.');

  const fotos = await enviarFotosStorage(dados.usuarioId, dados.fotoUris, 'pracas');

  try {
    const { data, error } = await supabase.rpc('registrar_praca_com_fotos', {
      p_nome: dados.nome.trim(),
      p_latitude: dados.latitude,
      p_longitude: dados.longitude,
      p_foto_urls: fotos.map((foto) => foto.url),
      p_caminhos_storage: fotos.map((foto) => foto.caminho),
    });

    if (error) throw new Error(`Erro ao registrar praça: ${error.message}`);
    return String(data);
  } catch (error) {
    await removerFotosStorage(fotos.map((foto) => foto.caminho), { tolerarFalhas: true });
    throw error;
  }
}

export async function confirmarPraca(pracaId: string, nota: number): Promise<string> {
  const { data, error } = await supabase.rpc('confirmar_praca', {
    p_praca_id: pracaId,
    p_nota: nota,
  });

  if (error) throw new Error(`Erro ao confirmar praça: ${error.message}`);
  return String(data);
}

export async function avaliarPraca(pracaId: string, nota: number): Promise<void> {
  const { error } = await supabase.rpc('avaliar_praca', {
    p_praca_id: pracaId,
    p_nota: nota,
  });

  if (error) throw new Error(`Erro ao avaliar praça: ${error.message}`);
}

export async function excluirPracaPendente(id: string): Promise<void> {
  const { data, error } = await supabase.rpc('excluir_praca_pendente', {
    p_praca_id: id,
  });
  if (error) throw new Error(error.message);
  try {
    await removerFotosStorage(Array.isArray(data) ? data : []);
  } catch (erro) {
    throw new Error('A praça foi excluída do banco, mas não foi possível remover todas as fotos. ' +
      (erro instanceof Error ? erro.message : 'Verifique o Storage.'));
  }
}
