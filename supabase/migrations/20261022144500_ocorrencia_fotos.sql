-- permite armazenar de 1 a 3 fotos por ocorrência.

CREATE TABLE public.ocorrencia_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ocorrencia_id UUID NOT NULL
        REFERENCES public.ocorrencias(id)
        ON DELETE CASCADE,

    foto_url TEXT NOT NULL,

    caminho_storage TEXT NOT NULL,

    ordem SMALLINT NOT NULL
        CHECK (ordem BETWEEN 1 AND 3),

    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (ocorrencia_id, ordem)
);


CREATE INDEX ocorrencia_fotos_ocorrencia_id_idx
ON public.ocorrencia_fotos (ocorrencia_id);


-- preserva as fotos das ocorrências já existentes.
INSERT INTO public.ocorrencia_fotos (
    ocorrencia_id,
    foto_url,
    caminho_storage,
    ordem
)
SELECT
    id,
    foto_url,
    'legado',
    1
FROM public.ocorrencias
WHERE foto_url IS NOT NULL
  AND BTRIM(foto_url) <> '';


ALTER TABLE public.ocorrencia_fotos
ENABLE ROW LEVEL SECURITY;


-- usuários autenticados podem visualizar todas as fotos.
CREATE POLICY "Usuarios autenticados visualizam fotos das ocorrencias"
ON public.ocorrencia_fotos
FOR SELECT
TO authenticated
USING (true);


-- visitantes só enxergam fotos de ocorrências públicas.
CREATE POLICY "Visitantes visualizam fotos de ocorrencias publicas"
ON public.ocorrencia_fotos
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM public.ocorrencias o
        WHERE o.id = ocorrencia_id
          AND o.status IN ('ATIVA', 'RESOLVIDA')
    )
);


-- o autor pode adicionar fotos apenas na própria ocorrência.
CREATE POLICY "Usuario adiciona foto na propria ocorrencia"
ON public.ocorrencia_fotos
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.ocorrencias o
        WHERE o.id = ocorrencia_id
          AND o.usuario_id = (SELECT auth.uid())
    )
);


-- necessário para limpar uploads caso o cadastro falhe.
CREATE POLICY "Usuario remove propria foto do storage"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'fotos'
    AND (storage.foldername(name))[1] =
        (SELECT auth.uid()::text)
);


-- registra a ocorrência e suas fotos na mesma transação.
CREATE OR REPLACE FUNCTION public.registrar_ocorrencia_com_fotos(
    p_categoria TEXT,
    p_gravidade TEXT,
    p_descricao TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_foto_urls TEXT[],
    p_caminhos_storage TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id UUID;
    v_ocorrencia_id UUID;
    v_total_fotos INTEGER;
    v_indice INTEGER;
BEGIN
    v_usuario_id := auth.uid();

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    v_total_fotos :=
        COALESCE(
            array_length(p_foto_urls, 1),
            0
        );

    IF v_total_fotos < 1
       OR v_total_fotos > 3 THEN
        RAISE EXCEPTION
            'A ocorrencia deve possuir entre 1 e 3 fotos';
    END IF;

    IF COALESCE(
        array_length(p_caminhos_storage, 1),
        0
    ) <> v_total_fotos THEN
        RAISE EXCEPTION
            'Dados das fotos inconsistentes';
    END IF;

    IF NULLIF(
        BTRIM(p_descricao),
        ''
    ) IS NULL THEN
        RAISE EXCEPTION
            'Descricao obrigatoria';
    END IF;

    INSERT INTO public.ocorrencias (
        usuario_id,
        categoria,
        gravidade,
        descricao,
        latitude,
        longitude,
        foto_url
    )
    VALUES (
        v_usuario_id,
        p_categoria,
        p_gravidade,
        BTRIM(p_descricao),
        p_latitude,
        p_longitude,
        p_foto_urls[1]
    )
    RETURNING id
    INTO v_ocorrencia_id;

    FOR v_indice IN 1..v_total_fotos LOOP
        INSERT INTO public.ocorrencia_fotos (
            ocorrencia_id,
            foto_url,
            caminho_storage,
            ordem
        )
        VALUES (
            v_ocorrencia_id,
            p_foto_urls[v_indice],
            p_caminhos_storage[v_indice],
            v_indice
        );
    END LOOP;

    RETURN v_ocorrencia_id;
END;
$$;


REVOKE ALL
ON FUNCTION public.registrar_ocorrencia_com_fotos(
    TEXT,
    TEXT,
    TEXT,
    DOUBLE PRECISION,
    DOUBLE PRECISION,
    TEXT[],
    TEXT[]
)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.registrar_ocorrencia_com_fotos(
    TEXT,
    TEXT,
    TEXT,
    DOUBLE PRECISION,
    DOUBLE PRECISION,
    TEXT[],
    TEXT[]
)
TO authenticated;
