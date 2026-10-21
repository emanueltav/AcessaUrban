import json
from collections import defaultdict
from pathlib import Path


RAIZ = Path(__file__).resolve().parent.parent

ARQUIVO_GEOJSON = (
    RAIZ
    / "dados"
    / "ibge"
    / "RN_bairros_CD2022.geojson"
)

PASTA_MIGRATIONS = RAIZ / "supabase" / "migrations"


def escapar_sql(texto: str) -> str:
    return texto.replace("'", "''")


def encontrar_migration() -> Path:
    migrations = sorted(
        PASTA_MIGRATIONS.glob("*_bairros_rn.sql"),
        reverse=True,
    )

    if not migrations:
        raise RuntimeError(
            "Migration bairros_rn não encontrada."
        )

    return migrations[0]


def carregar_bairros():
    if not ARQUIVO_GEOJSON.exists():
        raise RuntimeError(
            f"Arquivo não encontrado: {ARQUIVO_GEOJSON}"
        )

    with ARQUIVO_GEOJSON.open(
        "r",
        encoding="utf-8",
    ) as arquivo:
        dados = json.load(arquivo)

    bairros = defaultdict(list)

    for feature in dados["features"]:
        propriedades = feature["properties"]
        geometria = feature["geometry"]

        codigo_bairro = propriedades["CD_BAIRRO"]

        bairros[codigo_bairro].append(
            {
                "nome": propriedades["NM_BAIRRO"],
                "municipio": propriedades["NM_MUN"],
                "uf": "RN",
                "codigo_municipio": propriedades["CD_MUN"],
                "geometria": geometria,
            }
        )

    return bairros


def gerar_geometria_sql(partes) -> str:
    geometrias = []

    for parte in partes:
        geojson = json.dumps(
            parte["geometria"],
            ensure_ascii=False,
            separators=(",", ":"),
        )

        geojson = escapar_sql(geojson)

        geometria = (
            "extensions.ST_SetSRID("
            f"extensions.ST_GeomFromGeoJSON('{geojson}'), "
            "4326"
            ")"
        )

        geometrias.append(geometria)

    if len(geometrias) == 1:
        return (
            f"extensions.ST_Multi({geometrias[0]})"
        )

    return (
        "extensions.ST_Multi("
        "extensions.ST_CollectionExtract("
        "extensions.ST_Collect("
        f"ARRAY[{', '.join(geometrias)}]"
        "), "
        "3"
        ")"
        ")"
    )


def gerar_sql(bairros) -> str:
    linhas = []

    linhas.append(
        """ALTER TABLE public.bairros
ADD COLUMN IF NOT EXISTS codigo_bairro_ibge TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS bairros_codigo_bairro_ibge_idx
ON public.bairros (codigo_bairro_ibge)
WHERE codigo_bairro_ibge IS NOT NULL;

WITH dados_bairros (
    codigo_bairro_ibge,
    nome,
    municipio,
    uf,
    codigo_municipio_ibge,
    limite_geografico
) AS (
    VALUES"""
    )

    valores = []

    for codigo_bairro, partes in sorted(bairros.items()):
        primeira = partes[0]

        geometria_sql = gerar_geometria_sql(partes)

        nome = escapar_sql(primeira["nome"])
        municipio = escapar_sql(primeira["municipio"])
        uf = escapar_sql(primeira["uf"])
        codigo_municipio = escapar_sql(
            primeira["codigo_municipio"]
        )
        codigo_bairro_sql = escapar_sql(
            codigo_bairro
        )

        valores.append(
            "    ("
            f"'{codigo_bairro_sql}', "
            f"'{nome}', "
            f"'{municipio}', "
            f"'{uf}', "
            f"'{codigo_municipio}', "
            f"{geometria_sql}"
            ")"
        )

    linhas.append(",\n".join(valores))

    linhas.append(
        """)
INSERT INTO public.bairros (
    codigo_bairro_ibge,
    nome,
    municipio,
    uf,
    codigo_municipio_ibge,
    limite_geografico
)
SELECT
    codigo_bairro_ibge,
    nome,
    municipio,
    uf,
    codigo_municipio_ibge,
    limite_geografico
FROM dados_bairros
ON CONFLICT (nome, municipio, uf)
DO UPDATE SET
    codigo_bairro_ibge = EXCLUDED.codigo_bairro_ibge,
    codigo_municipio_ibge = EXCLUDED.codigo_municipio_ibge,
    limite_geografico = EXCLUDED.limite_geografico;
"""
    )

    return "\n".join(linhas)


def main():
    migration = encontrar_migration()
    bairros = carregar_bairros()

    sql = gerar_sql(bairros)

    migration.write_text(
        sql,
        encoding="utf-8",
    )

    total_partes = sum(
        len(partes)
        for partes in bairros.values()
    )

    print(f"Migration gerada: {migration}")
    print(f"Bairros gerados: {len(bairros)}")
    print(f"Polígonos processados: {total_partes}")


if __name__ == "__main__":
    main()