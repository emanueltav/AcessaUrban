-- adiciona o bairro atual do usuário ao perfil.

ALTER TABLE public.perfis
ADD COLUMN bairro_id UUID
REFERENCES public.bairros(id)
ON DELETE SET NULL;


CREATE INDEX perfis_bairro_id_idx
ON public.perfis (bairro_id);


-- permite que o usuário altere o próprio perfil.
CREATE POLICY "Usuario pode atualizar o proprio perfil"
ON public.perfis
FOR UPDATE
TO authenticated
USING (
    id = (SELECT auth.uid())
)
WITH CHECK (
    id = (SELECT auth.uid())
);
