ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bairros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validacoes_ocorrencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pracas ENABLE ROW LEVEL SECURITY;


-- perfil
CREATE POLICY "Usuario pode visualizar o proprio perfil"
ON public.perfis
FOR SELECT
TO authenticated
USING (
    id = (SELECT auth.uid())
);

-- bairros
CREATE POLICY "Bairros sao publicos para leitura"
ON public.bairros
FOR SELECT
TO anon, authenticated
USING (true);


-- ocorrencias
CREATE POLICY "Visitantes podem visualizar ocorrencias publicas"
ON public.ocorrencias
FOR SELECT
TO anon
USING (
    status IN ('ATIVA', 'RESOLVIDA')
);

CREATE POLICY "Usuarios autenticados podem visualizar ocorrencias"
ON public.ocorrencias
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuario pode registrar propria ocorrencia"
ON public.ocorrencias
FOR INSERT
TO authenticated
WITH CHECK (
    usuario_id = (SELECT auth.uid())
    AND status = 'PENDENTE_VALIDACAO'
);


-- validacoes
CREATE POLICY "Usuarios autenticados podem visualizar validacoes"
ON public.validacoes_ocorrencia
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuario pode registrar propria validacao"
ON public.validacoes_ocorrencia
FOR INSERT
TO authenticated
WITH CHECK (
    usuario_id = (SELECT auth.uid())
);


-- pracas
CREATE POLICY "Visitantes podem visualizar pracas aprovadas"
ON public.pracas
FOR SELECT
TO anon
USING (
    status = 'APROVADA'
);

CREATE POLICY "Usuarios autenticados podem visualizar pracas"
ON public.pracas
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Usuario autenticado pode solicitar praca"
ON public.pracas
FOR INSERT
TO authenticated
WITH CHECK (
    status = 'PENDENTE'
);