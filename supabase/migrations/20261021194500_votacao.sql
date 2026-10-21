-- valida as regras de criação e alteração dos votos.
CREATE OR REPLACE FUNCTION public.validar_voto_ocorrencia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_autor_id UUID;
    v_status TEXT;
BEGIN
    SELECT
        usuario_id,
        status
    INTO
        v_autor_id,
        v_status
    FROM public.ocorrencias
    WHERE id = NEW.ocorrencia_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ocorrencia nao encontrada';
    END IF;

    -- o autor não participa da validação da própria ocorrência.
    IF NEW.usuario_id = v_autor_id THEN
        RAISE EXCEPTION 'O autor nao pode validar a propria ocorrencia';
    END IF;

    -- cada fase só aceita votos enquanto estiver ativa.
    IF NEW.fase = 'CONFIRMACAO'
       AND v_status <> 'PENDENTE_VALIDACAO' THEN
        RAISE EXCEPTION 'A ocorrencia nao esta aguardando confirmacao';
    END IF;

    IF NEW.fase = 'RESOLUCAO'
       AND v_status <> 'ATIVA' THEN
        RAISE EXCEPTION 'A ocorrencia nao esta ativa';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- identificação do voto não pode ser alterada.
        IF NEW.ocorrencia_id IS DISTINCT FROM OLD.ocorrencia_id
           OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
           OR NEW.fase IS DISTINCT FROM OLD.fase THEN
            RAISE EXCEPTION 'Nao e permitido alterar a identificacao do voto';
        END IF;

        -- confirmação é definitiva.
        IF OLD.fase <> 'RESOLUCAO' THEN
            RAISE EXCEPTION 'Votos de confirmacao nao podem ser alterados';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_validar_voto_ocorrencia
ON public.validacoes_ocorrencia;

CREATE TRIGGER trg_validar_voto_ocorrencia
BEFORE INSERT OR UPDATE
ON public.validacoes_ocorrencia
FOR EACH ROW
EXECUTE FUNCTION public.validar_voto_ocorrencia();


-- permite ao usuário alterar somente o próprio voto.
DROP POLICY IF EXISTS "Usuario pode alterar propria validacao"
ON public.validacoes_ocorrencia;

CREATE POLICY "Usuario pode alterar propria validacao"
ON public.validacoes_ocorrencia
FOR UPDATE
TO authenticated
USING (
    usuario_id = (SELECT auth.uid())
)
WITH CHECK (
    usuario_id = (SELECT auth.uid())
);


-- o processamento também acontece quando o voto de resolução é alterado.
DROP TRIGGER IF EXISTS trg_processar_voto
ON public.validacoes_ocorrencia;

CREATE TRIGGER trg_processar_voto
AFTER INSERT OR UPDATE OF voto
ON public.validacoes_ocorrencia
FOR EACH ROW
EXECUTE FUNCTION public.processar_voto();


REVOKE ALL
ON FUNCTION public.validar_voto_ocorrencia()
FROM PUBLIC;
