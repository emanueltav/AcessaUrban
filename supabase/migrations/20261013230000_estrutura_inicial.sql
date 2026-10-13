CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

CREATE TABLE public.perfis (
    id UUID PRIMARY KEY,
    nome TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bairros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL UNIQUE,
    nota_atual NUMERIC NOT NULL DEFAULT 3.0
        CHECK (nota_atual BETWEEN 0.0 AND 5.0),
    limite_geografico extensions.GEOMETRY(MULTIPOLYGON, 4326)
);

CREATE TABLE public.ocorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE RESTRICT,
    bairro_id UUID NOT NULL REFERENCES public.bairros(id) ON DELETE RESTRICT,
    categoria TEXT NOT NULL
        CHECK (categoria IN ('PAVIMENTACAO', 'ILUMINACAO', 'ESGOTO', 'CALCAMENTO')),
    gravidade TEXT NOT NULL
        CHECK (gravidade IN ('LEVE', 'MODERADO', 'GRAVE')),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    foto_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE_VALIDACAO'
        CHECK (status IN ('PENDENTE_VALIDACAO', 'ATIVA', 'RESOLVIDA')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.validacoes_ocorrencia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocorrencia_id UUID NOT NULL REFERENCES public.ocorrencias(id) ON DELETE RESTRICT,
    usuario_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE RESTRICT,
    fase TEXT NOT NULL CHECK (fase IN ('CONFIRMACAO', 'RESOLUCAO')),
    voto TEXT NOT NULL CHECK (voto IN ('CONFIRMA_PROBLEMA', 'AINDA_EXISTE', 'RESOLVIDO')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ocorrencia_id, usuario_id, fase),
    CONSTRAINT validacoes_ocorrencia_voto_por_fase CHECK (
        (fase = 'CONFIRMACAO' AND voto = 'CONFIRMA_PROBLEMA')
        OR (fase = 'RESOLUCAO' AND voto IN ('AINDA_EXISTE', 'RESOLVIDO'))
    )
);

CREATE TABLE public.pracas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bairro_id UUID NOT NULL REFERENCES public.bairros(id) ON DELETE RESTRICT,
    nome TEXT NOT NULL,
    foto_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDENTE'
        CHECK (status IN ('PENDENTE', 'APROVADA')),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bairros_limite_geografico_idx
    ON public.bairros USING GIST (limite_geografico);

CREATE INDEX ocorrencias_bairro_id_idx ON public.ocorrencias (bairro_id);
CREATE INDEX ocorrencias_status_idx ON public.ocorrencias (status);

-- O índice da UNIQUE já atende às buscas por ocorrencia_id em validacoes_ocorrencia.
