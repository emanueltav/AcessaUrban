-- atualiza automaticamente o campo atualizado_em das ocorrências.
CREATE OR REPLACE FUNCTION public.atualizar_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_atualizar_data
BEFORE UPDATE ON public.ocorrencias
FOR EACH ROW
EXECUTE FUNCTION public.atualizar_data();


-- processa votos de confirmação e resolução das ocorrências.
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
    -- bloqueia a ocorrência durante o processamento para evitar alterações no status e na nota do bairro.
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


    -- confirmação do problema
    IF NEW.fase = 'CONFIRMACAO' THEN

        IF v_status <> 'PENDENTE_VALIDACAO' THEN
            RAISE EXCEPTION 'A ocorrencia nao esta aguardando confirmacao';
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
            SET status = 'ATIVA'
            WHERE id = NEW.ocorrencia_id
              AND status = 'PENDENTE_VALIDACAO';

            UPDATE public.bairros
            SET nota_atual = GREATEST(
                0.0,
                nota_atual - v_penalidade
            )
            WHERE id = v_bairro_id;
        END IF;


    -- resolução do problema
    ELSIF NEW.fase = 'RESOLUCAO' THEN

        IF v_status <> 'ATIVA' THEN
            RAISE EXCEPTION 'A ocorrencia nao esta ativa';
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
            SET status = 'RESOLVIDA'
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


CREATE TRIGGER trg_processar_voto
AFTER INSERT ON public.validacoes_ocorrencia
FOR EACH ROW
EXECUTE FUNCTION public.processar_voto();


-- funções destinadas ao uso interno do banco.
REVOKE ALL
ON FUNCTION public.atualizar_data()
FROM PUBLIC;

REVOKE ALL
ON FUNCTION public.processar_voto()
FROM PUBLIC;