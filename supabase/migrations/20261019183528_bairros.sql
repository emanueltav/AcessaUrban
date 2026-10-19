ALTER TABLE public.bairros
DROP CONSTRAINT IF EXISTS bairros_nome_key;

ALTER TABLE public.bairros
ADD COLUMN municipio TEXT NOT NULL,
ADD COLUMN uf CHAR(2) NOT NULL,
ADD COLUMN codigo_municipio_ibge TEXT;

ALTER TABLE public.bairros
ADD CONSTRAINT bairros_nome_municipio_uf_key
UNIQUE (nome, municipio, uf);

CREATE INDEX bairros_municipio_uf_idx
ON public.bairros (uf, municipio);