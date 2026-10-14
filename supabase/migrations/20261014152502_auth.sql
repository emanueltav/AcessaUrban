-- vincula cada perfil a um usuário do Supabase Auth.
ALTER TABLE public.perfis
ADD CONSTRAINT perfis_auth_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE RESTRICT;


-- cria automaticamente o perfil após o cadastro de um usuário.
CREATE OR REPLACE FUNCTION public.criar_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.perfis (id, nome)
    VALUES (
        NEW.id,
        COALESCE(
            NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'nome'), ''),
            NULLIF(SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), ''),
            'Usuario'
        )
    );

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_criar_perfil
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.criar_perfil();


-- função destinada somente ao trigger do banco.
REVOKE ALL
ON FUNCTION public.criar_perfil()
FROM PUBLIC;