-- adiciona histórico de vida e evidências das ocorrências.

ALTER TABLE public.ocorrencias
ADD COLUMN ativado_em TIMESTAMPTZ,
ADD COLUMN resolvido_em TIMESTAMPTZ;


-- compatibilidade com ocorrências já existentes.
UPDATE public.ocorrencias
SET ativado_em = criado_em
WHERE status IN ('ATIVA', 'RESOLVIDA')
  AND ativado_em IS NULL;

UPDATE public.ocorrencias
SET resolvido_em = atualizado_em
WHERE status = 'RESOLVIDA'
  AND resolvido_em IS NULL;


CREATE INDEX ocorrencias_resolvido_em_idx
ON public.ocorrencias (resolvido_em)
WHERE status = 'RESOLVIDA';


-- cada alteração do voto de resolução vira um evento histórico.
CREATE TABLE public.validacao_eventos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    validacao_id UUID NOT NULL
        REFERENCES public.validacoes_ocorrencia(id)
        ON DELETE RESTRICT,

    ocorrencia_id UUID NOT NULL
        REFERENCES public.ocorrencias(id)
        ON DELETE RESTRICT,

    usuario_id UUID NOT NULL
        REFERENCES public.perfis(id)
        ON DELETE RESTRICT,

    voto TEXT NOT NULL
        CHECK (voto IN ('AINDA_EXISTE', 'RESOLVIDO')),

    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE INDEX validacao_eventos_ocorrencia_id_idx
ON public.validacao_eventos (ocorrencia_id, criado_em);


-- fotos pertencem ao momento histórico em que foram enviadas.
CREATE TABLE public.validacao_evento_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    evento_id UUID NOT NULL
        REFERENCES public.validacao_eventos(id)
        ON DELETE CASCADE,

    foto_url TEXT NOT NULL,

    caminho_storage TEXT NOT NULL,

    ordem SMALLINT NOT NULL
        CHECK (ordem BETWEEN 1 AND 3),

    criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (evento_id, ordem)
);


CREATE INDEX validacao_evento_fotos_evento_id_idx
ON public.validacao_evento_fotos (evento_id);


ALTER TABLE public.validacao_eventos
ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.validacao_evento_fotos
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Usuarios autenticados visualizam historico de validacao"
ON public.validacao_eventos
FOR SELECT
TO authenticated
USING (true);


CREATE POLICY "Visitantes visualizam historico de ocorrencias publicas"
ON public.validacao_eventos
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


CREATE POLICY "Usuarios autenticados visualizam fotos do historico"
ON public.validacao_evento_fotos
FOR SELECT
TO authenticated
USING (true);


CREATE POLICY "Visitantes visualizam fotos do historico publico"
ON public.validacao_evento_fotos
FOR SELECT
TO anon
USING (
    EXISTS (
        SELECT 1
        FROM public.validacao_eventos ve
        JOIN public.ocorrencias o
          ON o.id = ve.ocorrencia_id
        WHERE ve.id = evento_id
          AND o.status IN ('ATIVA', 'RESOLVIDA')
    )
);


-- mantém as regras atuais e registra os momentos de ativação e resolução.
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
                ativado_em = COALESCE(ativado_em, now())
            WHERE id = NEW.ocorrencia_id
              AND status = 'PENDENTE_VALIDACAO';

            UPDATE public.bairros
            SET nota_atual = GREATEST(
                0.0,
                nota_atual - v_penalidade
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
                resolvido_em = COALESCE(resolvido_em, now())
            WHERE id = NEW.ocorrencia_id
              AND status = 'ATIVA';

            UPDATE public.bairros
            SET nota_atual = LEAST(
                5.0,
                nota_atual + v_penalidade + 0.1
            )
            WHERE id = v_bairro_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$$;


REVOKE ALL
ON FUNCTION public.processar_voto()
FROM PUBLIC;


-- atualiza o voto atual e preserva cada envio como histórico.
CREATE OR REPLACE FUNCTION public.registrar_voto_resolucao_com_evidencias(
    p_ocorrencia_id UUID,
    p_voto TEXT,
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
    v_validacao_id UUID;
    v_evento_id UUID;
    v_total_fotos INTEGER;
    v_indice INTEGER;
BEGIN
    v_usuario_id := auth.uid();

    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Usuario nao autenticado';
    END IF;

    IF p_voto NOT IN ('AINDA_EXISTE', 'RESOLVIDO') THEN
        RAISE EXCEPTION 'Voto de resolucao invalido';
    END IF;

    v_total_fotos :=
        COALESCE(array_length(p_foto_urls, 1), 0);

    IF v_total_fotos > 3 THEN
        RAISE EXCEPTION
            'O voto pode possuir no maximo 3 fotos';
    END IF;

    IF COALESCE(
        array_length(p_caminhos_storage, 1),
        0
    ) <> v_total_fotos THEN
        RAISE EXCEPTION 'Dados das fotos inconsistentes';
    END IF;


    INSERT INTO public.validacoes_ocorrencia (
        ocorrencia_id,
        usuario_id,
        fase,
        voto
    )
    VALUES (
        p_ocorrencia_id,
        v_usuario_id,
        'RESOLUCAO',
        p_voto
    )
    ON CONFLICT (
        ocorrencia_id,
        usuario_id,
        fase
    )
    DO UPDATE
    SET voto = EXCLUDED.voto
    RETURNING id
    INTO v_validacao_id;


    INSERT INTO public.validacao_eventos (
        validacao_id,
        ocorrencia_id,
        usuario_id,
        voto
    )
    VALUES (
        v_validacao_id,
        p_ocorrencia_id,
        v_usuario_id,
        p_voto
    )
    RETURNING id
    INTO v_evento_id;


    IF v_total_fotos > 0 THEN
        FOR v_indice IN 1..v_total_fotos LOOP
            INSERT INTO public.validacao_evento_fotos (
                evento_id,
                foto_url,
                caminho_storage,
                ordem
            )
            VALUES (
                v_evento_id,
                p_foto_urls[v_indice],
                p_caminhos_storage[v_indice],
                v_indice
            );
        END LOOP;
    END IF;


    RETURN v_evento_id;
END;
$$;


REVOKE ALL
ON FUNCTION public.registrar_voto_resolucao_com_evidencias(
    UUID,
    TEXT,
    TEXT[],
    TEXT[]
)
FROM PUBLIC;


GRANT EXECUTE
ON FUNCTION public.registrar_voto_resolucao_com_evidencias(
    UUID,
    TEXT,
    TEXT[],
    TEXT[]
)
TO authenticated;
