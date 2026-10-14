-- define o bairro da ocorrência pelas coordenadas.
CREATE OR REPLACE FUNCTION public.definir_bairro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_bairro_id UUID;
BEGIN
    SELECT b.id
    INTO v_bairro_id
    FROM public.bairros b
    WHERE b.limite_geografico IS NOT NULL
      AND extensions.ST_Covers(
          b.limite_geografico,
          extensions.ST_SetSRID(
              extensions.ST_MakePoint(
                  NEW.longitude,
                  NEW.latitude
              ),
              4326
          )
      )
    ORDER BY b.id
    LIMIT 1;

    IF v_bairro_id IS NULL THEN
        RAISE EXCEPTION 'Localizacao fora dos bairros cadastrados';
    END IF;

    NEW.bairro_id = v_bairro_id;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_definir_bairro
BEFORE INSERT ON public.ocorrencias
FOR EACH ROW
EXECUTE FUNCTION public.definir_bairro();


-- função destinada somente ao trigger do banco.
REVOKE ALL
ON FUNCTION public.definir_bairro()
FROM PUBLIC;