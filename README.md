# AcessaUrban

Aplicativo móvel colaborativo de conservação urbana, desenvolvido como trabalho de conclusão de curso (TCC). O AcessaUrban permite registrar problemas de infraestrutura, avaliar praças e acompanhar indicadores por bairro em um mapa e ranking.

## Funcionalidades

- **Mapa interativo:** consulta ocorrências e praças na região visível conforme a navegação e o zoom, sem agrupamento de marcadores.
- **Ocorrências:** cadastro com localização, categoria, gravidade e uma a três fotos capturadas pela câmera.
- **Validação comunitária:** confirmação de problemas e acompanhamento da resolução, com histórico e evidências fotográficas.
- **Praças:** solicitação de cadastro, confirmação pela comunidade e avaliações de uma a cinco estrelas.
- **Ranking:** indicadores de conservação dos bairros, com penalidades de ocorrências e bônus de praças calculados no PostgreSQL.
- **Conta e aparência:** autenticação pelo Supabase, perfil e temas claro e escuro.

## Tecnologias

- React Native, Expo SDK 57 e TypeScript;
- React Navigation e MapLibre React Native;
- Supabase Auth, PostgreSQL/PostGIS, funções SQL, políticas RLS e Storage;
- Expo Location e Expo Image Picker.

## Estrutura do repositório

| Caminho | Finalidade |
| --- | --- |
| `app/src/telas` | Telas do aplicativo |
| `app/src/navegacao` | Navegação por abas e pilha |
| `app/src/servicos` | Integrações com banco, mapa e fotografias |
| `app/src/contextos` | Autenticação e tema |
| `app/src/hooks` | Carregamento de dados do mapa |
| `supabase/migrations` | Estrutura e regras versionadas do banco |

## Execução em ambiente de desenvolvimento

O aplicativo exige Node.js, npm, um projeto Supabase com as migrations aplicadas e um **development build** instalado no dispositivo. O MapLibre utiliza módulos nativos e não funciona no Expo Go convencional.

Em um ambiente previamente configurado, a partir da raiz do repositório:

```bash
cd app
npm ci
npx expo start --dev-client --tunnel
```

As variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` devem estar configuradas em `app/.env`, conforme `app/.env.example`. Nunca utilize chaves administrativas (`service_role`) no aplicativo ou no GitHub.

## Banco de dados e Supabase

O Supabase reúne autenticação, PostgreSQL com PostGIS e armazenamento de imagens. A pasta `supabase/migrations` contém os scripts SQL que definem a estrutura e as regras do banco:

- **Estrutura e autenticação:** tabelas de perfis, bairros, ocorrências, validações e praças, vinculadas aos usuários autenticados.
- **Território:** dados geográficos dos bairros cadastrados e associação de registros às suas localizações.
- **Segurança:** políticas RLS e permissões para consultas e operações autorizadas.
- **Ocorrências:** fotos, votos comunitários, histórico de resolução e atualização da pontuação dos bairros.
- **Praças:** cadastro, confirmação comunitária, avaliações e cálculo de bônus para os bairros.

As migrations são organizadas em ordem de aplicação para configurar uma nova instância do banco. O bucket público `fotos` armazena imagens de ocorrências e praças; qualquer pessoa com a URL pode visualizá-las, portanto não deve receber arquivos privados.

## Verificações

Dentro de `app/`:

```bash
npx tsc --noEmit
npx expo-doctor
```

Esses comandos verificam tipos e configuração, mas não substituem testes dos fluxos principais em um dispositivo.

## Escopo

O AcessaUrban reúne registros comunitários e indicadores territoriais. Não possui integração direta com sistemas de prefeituras nem painel administrativo web.
