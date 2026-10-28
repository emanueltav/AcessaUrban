-- completa o módulo de praças: fotos, validação comunitária, avaliações e bônus.

ALTER TABLE public.pracas
ADD COLUMN usuario_id UUID
    REFERENCES public.perfis(id)
    ON DELETE RESTRICT,
ADD COLUMN latitude DOUBLE PRECISION
    CHECK (latitude BETWEEN -90 AND 90),
ADD COLUMN longitude DOUBLE PRECISION
    CHECK (longitude BETWEEN -180 AND 180);


-- fotos das praças: de 1 a 3 por novo cadastro.
CREATE TABLE public.praca_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    praca_id UUID NOT NULL
        REFERENCES public.pracas(id)
        ON DELETE CASCADE,

    foto_url TEXT NOT NULL,

    caminho_storage TEXT NOT NULL,

    ordem SMALLINT NOT NULL
        CHECK (ordem BETWEEN 1 AND 3),

    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (praca_id, ordem)
);


CREATE INDEX praca_fotos_praca_id_idx
ON public.praca_fotos (praca_id);


-- preserva eventual foto de praça já existente.
INSERT INTO public.praca_fotos (
    praca_id,
    foto_url,
    caminho_storage,
    ordem
)
SELECT
    id,
    foto_url,
    'legado',
    1
FROM public.pracas
WHERE foto_url IS NOT NULL
  AND BTRIM(foto_url) <> '';


ALTER TABLE public.praca_fotos
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Usuarios autenticados visualizam fotos das pracas"
ON public.praca_fotos
FOR SELECT
TO authenticated
USING (true);


CREATE POLICY "Visitantes visualizam fotos de pracas aprovadas"
ON public.praca_fotos
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM public.pracas p
        WHERE p.id = praca_id
          AND p.status = 'APROVADA'
    )
);


-- confirmação de existência é definitiva e separada da avaliação.
CREATE TABLE public.praca_confirmacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    praca_id UUID NOT NULL
        REFERENCES public.pracas(id)
        ON DELETE CASCADE,

    usuario_id UUID NOT NULL
        REFERENCES public.perfis(id)
        ON DELETE CASCADE,

    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (praca_id, usuario_id)
);


CREATE INDEX praca_confirmacoes_praca_id_idx
ON public.praca_confirmacoes (praca_id);


ALTER TABLE public.praca_confirmacoes
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Usuarios autenticados visualizam confirmacoes de pracas"
ON public.praca_confirmacoes
FOR SELECT
TO authenticated
USING (true);


-- avaliações podem mudar depois que a praça for aprovada.
CREATE TABLE public.praca_avaliacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    praca_id UUID NOT NULL
        REFERENCES public.pracas(id)
        ON DELETE CASCADE,

    usuario_id UUID NOT NULL
        REFERENCES public.perfis(id)
        ON DELETE CASCADE,

    nota SMALLINT NOT NULL
        CHECK (nota BETWEEN 1 AND 5),

    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (praca_id, usuario_id)
);


CREATE INDEX praca_avaliacoes_praca_id_idx
ON public.praca_avaliacoes (praca_id);


ALTER TABLE public.praca_avaliacoes
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Usuarios autenticados visualizam avaliacoes de pracas"
ON public.praca_avaliacoes
FOR SELECT
TO authenticated
USING (true);


CREATE POLICY "Visitantes visualizam avaliacoes de pracas aprovadas"
ON public.praca_avaliacoes
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM public.pracas p
        WHERE p.id = praca_id
          AND p.status = 'APROVADA'
    )
);


-- novos cadastros passam obrigatoriamente pela função segura abaixo.
DROP POLICY IF EXISTS "Usuario autenticado pode solicitar praca"
ON public.pracas;


-- separa a pontuação das ocorrências do bônus das praças.
ALTER TABLE public.bairros
ADD COLUMN nota_base NUMERIC NOT NULL DEFAULT 3.0
    CHECK (nota_base BETWEEN 0.0 AND 5.0),
ADD COLUMN bonus_pracas NUMERIC NOT NULL DEFAULT 0.0
    CHECK (bonus_pracas BETWEEN 0.0 AND 0.5);


-- preserva exatamente a nota já existente no momento da migration.
UPDATE public.bairros
SET
    nota_base = nota_atual,
    bonus_pracas = 0.0;


-- recalcula o bônus de todas as praças aprovadas do bairro.
CREATE OR REPLACE FUNCTION public.recalcular_bonus_pracas(
    p_bairro_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_bonus NUMERIC;
BEGIN
    SELECT
        COALESCE(
            SUM(
                CASE
                    WHEN media >= 4.5 THEN 0.10
                    WHEN media >= 4.0 THEN 0.05
                    ELSE 0
                END
            ),
            0
        )
    INTO v_bonus
    FROM (
        SELECT
            p.id,
            AVG(pa.nota)::NUMERIC AS media
        FROM public.pracas p
        JOIN public.praca_avaliacoes pa
          ON pa.praca_id = p.id
        WHERE p.bairro_id = p_bairro_id
          AND p.status = 'APROVADA'
        GROUP BY p.id
        HAVING COUNT(pa.id) >= 2
    ) avaliadas;

    v_bonus :=
        LEAST(
            0.5,
            COALESCE(v_bonus, 0)
        );

    UPDATE public.bairros
    SET
        bonus_pracas = v_bonus,
        nota_atual = LEAST(
            5.0,
            nota_base + v_bonus
        )
    WHERE id = p_bairro_id;
END;
$$;


-- mantém o bônus sincronizado quando uma avaliação muda.
CREATE OR REPLACE FUNCTION public.processar_avaliacao_praca()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_praca_id UUID;
    v_bairro_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_praca_id := OLD.praca_id;
    ELSE
        v_praca_id := NEW.praca_id;
    END IF;

    SELECT bairro_id
    INTO v_bairro_id
    FROM public.pracas
    WHERE id = v_praca_id;

    IF v_bairro_id IS NOT NULL THEN
        PERFORM
            public.recalcular_bonus_pracas(
                v_bairro_id
            );
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_processar_avaliacao_praca
AFTER INSERT OR UPDATE OR DELETE
ON public.praca_avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.processar_avaliacao_praca();


-- registra uma praça pendente e suas 1 a 3 fotos na mesma transação.
CREATE OR REPLACE FUNCTION public.registrar_praca_com_fotos(
    p_nome TEXT,
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
    v_bairro_id UUID;
    v_praca_id UUID;
    v_total_fotos INTEGER;
    v_indice INTEGER;
BEGIN
    v_usuario_id := auth.uid();

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
        RAISE EXCEPTION 'Nome da praca obrigatorio';
    END IF;

    v_total_fotos :=
        COALESCE(
            array_length(p_foto_urls, 1),
            0
        );

    IF v_total_fotos < 1
       OR v_total_fotos > 3 THEN
        RAISE EXCEPTION
            'A praca deve possuir entre 1 e 3 fotos';
    END IF;

    IF COALESCE(
        array_length(p_caminhos_storage, 1),
        0
    ) <> v_total_fotos THEN
        RAISE EXCEPTION
            'Dados das fotos inconsistentes';
    END IF;

    SELECT b.id
    INTO v_bairro_id
    FROM public.bairros b
    WHERE b.limite_geografico IS NOT NULL
      AND extensions.ST_Covers(
          b.limite_geografico,
          extensions.ST_SetSRID(
              extensions.ST_MakePoint(
                  p_longitude,
                  p_latitude
              ),
              4326
          )
      )
    ORDER BY b.id
    LIMIT 1;

    IF v_bairro_id IS NULL THEN
        RAISE EXCEPTION
            'Localizacao fora dos bairros cadastrados';
    END IF;

    INSERT INTO public.pracas (
        bairro_id,
        usuario_id,
        nome,
        foto_url,
        latitude,
        longitude,
        status
    )
    VALUES (
        v_bairro_id,
        v_usuario_id,
        BTRIM(p_nome),
        p_foto_urls[1],
        p_latitude,
        p_longitude,
        'PENDENTE'
    )
    RETURNING id
    INTO v_praca_id;

    FOR v_indice IN 1..v_total_fotos LOOP
        INSERT INTO public.praca_fotos (
            praca_id,
            foto_url,
            caminho_storage,
            ordem
        )
        VALUES (
            v_praca_id,
            p_foto_urls[v_indice],
            p_caminhos_storage[v_indice],
            v_indice
        );
    END LOOP;

    RETURN v_praca_id;
END;
$$;


-- confirma a existência da praça e registra a primeira avaliação do usuário.
CREATE OR REPLACE FUNCTION public.confirmar_praca(
    p_praca_id UUID,
    p_nota SMALLINT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id UUID;
    v_autor_id UUID;
    v_status TEXT;
    v_bairro_id UUID;
    v_total INTEGER;
BEGIN
    v_usuario_id := auth.uid();

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF p_nota < 1 OR p_nota > 5 THEN
        RAISE EXCEPTION
            'A avaliacao deve estar entre 1 e 5 estrelas';
    END IF;

    SELECT
        usuario_id,
        status,
        bairro_id
    INTO
        v_autor_id,
        v_status,
        v_bairro_id
    FROM public.pracas
    WHERE id = p_praca_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Praca nao encontrada';
    END IF;

    IF v_status <> 'PENDENTE' THEN
        RAISE EXCEPTION
            'A praca nao esta aguardando confirmacao';
    END IF;

    IF v_autor_id = v_usuario_id THEN
        RAISE EXCEPTION
            'O autor nao pode confirmar a propria praca';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.praca_confirmacoes
        WHERE praca_id = p_praca_id
          AND usuario_id = v_usuario_id
    ) THEN
        RAISE EXCEPTION
            'Voce ja confirmou esta praca';
    END IF;

    INSERT INTO public.praca_confirmacoes (
        praca_id,
        usuario_id
    )
    VALUES (
        p_praca_id,
        v_usuario_id
    );

    INSERT INTO public.praca_avaliacoes (
        praca_id,
        usuario_id,
        nota
    )
    VALUES (
        p_praca_id,
        v_usuario_id,
        p_nota
    )
    ON CONFLICT (
        praca_id,
        usuario_id
    )
    DO UPDATE
    SET
        nota = EXCLUDED.nota,
        atualizado_em = now();

    SELECT COUNT(DISTINCT usuario_id)
    INTO v_total
    FROM public.praca_confirmacoes
    WHERE praca_id = p_praca_id;

    IF v_total >= 2 THEN
        UPDATE public.pracas
        SET status = 'APROVADA'
        WHERE id = p_praca_id
          AND status = 'PENDENTE';

        PERFORM
            public.recalcular_bonus_pracas(
                v_bairro_id
            );

        RETURN 'APROVADA';
    END IF;

    RETURN 'PENDENTE';
END;
$$;


-- depois de aprovada, cada usuário pode alterar sua própria nota.
CREATE OR REPLACE FUNCTION public.avaliar_praca(
    p_praca_id UUID,
    p_nota SMALLINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id UUID;
    v_status TEXT;
BEGIN
    v_usuario_id := auth.uid();

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF p_nota < 1 OR p_nota > 5 THEN
        RAISE EXCEPTION
            'A avaliacao deve estar entre 1 e 5 estrelas';
    END IF;

    SELECT status
    INTO v_status
    FROM public.pracas
    WHERE id = p_praca_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Praca nao encontrada';
    END IF;

    IF v_status <> 'APROVADA' THEN
        RAISE EXCEPTION
            'A praca ainda nao foi aprovada';
    END IF;

    INSERT INTO public.praca_avaliacoes (
        praca_id,
        usuario_id,
        nota
    )
    VALUES (
        p_praca_id,
        v_usuario_id,
        p_nota
    )
    ON CONFLICT (
        praca_id,
        usuario_id
    )
    DO UPDATE
    SET
        nota = EXCLUDED.nota,
        atualizado_em = now();
END;
$$;


-- ocorrências continuam sendo a nota-base; praças entram apenas como bônus.
CREATE OR REPLACE FUNCTION public.processar_voto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_status TEXT;
    v_gravidade TEXT;
    v_bairro_id UUID;
    v_total INTEGER;
    v_penalidade NUMERIC;
BEGIN
    SELECT
        status,
        gravidade,
        bairro_id
    INTO
        v_status,
        v_gravidade,
        v_bairro_id
    FROM public.ocorrencias
    WHERE id = NEW.ocorrencia_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ocorrencia nao encontrada';
    END IF;

    IF NEW.fase = 'CONFIRMACAO' THEN

        IF v_status <> 'PENDENTE_VALIDACAO' THEN
            RAISE EXCEPTION
                'A ocorrencia nao esta aguardando confirmacao';
        END IF;

        SELECT COUNT(DISTINCT usuario_id)
        INTO v_total
        FROM public.validacoes_ocorrencia
        WHERE ocorrencia_id = NEW.ocorrencia_id
          AND fase = 'CONFIRMACAO'
          AND voto = 'CONFIRMA_PROBLEMA';

        IF v_total >= 3 THEN
            v_penalidade :=
                CASE v_gravidade
                    WHEN 'LEVE' THEN 0.1
                    WHEN 'MODERADO' THEN 0.2
                    WHEN 'GRAVE' THEN 0.4
                END;

            UPDATE public.ocorrencias
            SET
                status = 'ATIVA',
                ativado_em = COALESCE(
                    ativado_em,
                    now()
                )
            WHERE id = NEW.ocorrencia_id
              AND status = 'PENDENTE_VALIDACAO';

            UPDATE public.bairros
            SET
                nota_base = GREATEST(
                    0.0,
                    nota_base - v_penalidade
                ),
                nota_atual = LEAST(
                    5.0,
                    GREATEST(
                        0.0,
                        nota_base - v_penalidade
                    ) + bonus_pracas
                )
            WHERE id = v_bairro_id;
        END IF;

    ELSIF NEW.fase = 'RESOLUCAO' THEN

        IF v_status <> 'ATIVA' THEN
            RAISE EXCEPTION
                'A ocorrencia nao esta ativa';
        END IF;

        SELECT COUNT(DISTINCT usuario_id)
        INTO v_total
        FROM public.validacoes_ocorrencia
        WHERE ocorrencia_id = NEW.ocorrencia_id
          AND fase = 'RESOLUCAO'
          AND voto = 'RESOLVIDO';

        IF v_total >= 3 THEN
            v_penalidade :=
                CASE v_gravidade
                    WHEN 'LEVE' THEN 0.1
                    WHEN 'MODERADO' THEN 0.2
                    WHEN 'GRAVE' THEN 0.4
                END;

            UPDATE public.ocorrencias
            SET
                status = 'RESOLVIDA',
                resolvido_em = COALESCE(
                    resolvido_em,
                    now()
                )
            WHERE id = NEW.ocorrencia_id
              AND status = 'ATIVA';

            UPDATE public.bairros
            SET
                nota_base = LEAST(
                    5.0,
                    nota_base +
                        v_penalidade +
                        0.1
                ),
                nota_atual = LEAST(
                    5.0,
                    LEAST(
                        5.0,
                        nota_base +
                            v_penalidade +
                            0.1
                    ) + bonus_pracas
                )
            WHERE id = v_bairro_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


REVOKE ALL
ON FUNCTION public.recalcular_bonus_pracas(UUID)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.processar_avaliacao_praca()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.registrar_praca_com_fotos(
    TEXT,
    DOUBLE PRECISION,
    DOUBLE PRECISION,
    TEXT[],
    TEXT[]
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.confirmar_praca(UUID, SMALLINT)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.avaliar_praca(UUID, SMALLINT)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.processar_voto()
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.registrar_praca_com_fotos(
    TEXT,
    DOUBLE PRECISION,
    DOUBLE PRECISION,
    TEXT[],
    TEXT[]
)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.confirmar_praca(UUID, SMALLINT)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.avaliar_praca(UUID, SMALLINT)
TO authenticated;


-- O autor pode excluir uma praça pendente antes de qualquer confirmação.
CREATE OR REPLACE FUNCTION public.excluir_praca_pendente(p_praca_id UUID)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_autor UUID;
    v_status TEXT;
    v_caminhos TEXT[];
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    SELECT usuario_id, status INTO v_autor, v_status
    FROM public.pracas
    WHERE id = p_praca_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Praca nao encontrada';
    END IF;
    IF v_autor IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Somente o autor pode excluir esta praca';
    END IF;
    IF v_status <> 'PENDENTE'
       OR EXISTS (
           SELECT 1 FROM public.praca_confirmacoes
           WHERE praca_id = p_praca_id
       )
       OR EXISTS (
           SELECT 1 FROM public.praca_avaliacoes
           WHERE praca_id = p_praca_id
       ) THEN
        RAISE EXCEPTION 'Nao e possivel excluir uma praca ja confirmada';
    END IF;

    SELECT COALESCE(array_agg(caminho_storage), ARRAY[]::TEXT[])
    INTO v_caminhos
    FROM public.praca_fotos
    WHERE praca_id = p_praca_id;

    DELETE FROM public.pracas WHERE id = p_praca_id;
    RETURN v_caminhos;
END;
$$;

REVOKE ALL ON FUNCTION public.excluir_praca_pendente(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.excluir_praca_pendente(UUID) TO authenticated;
