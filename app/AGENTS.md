# AcessaUrban — notas para manutenção

## Projeto real

- **Expo SDK 57**, React Native, TypeScript estrito.
- **React Navigation**, não Expo Router. Manter `src/navegacao/rotas.tsx` e as telas em `src/telas`.
- **MapLibre React Native** para o mapa nativo; `mapa.tsx` é fallback web.
- Supabase Auth, Postgres/PostGIS, RPC e Storage. Não duplicar a lógica de pontuação no cliente.

## Antes de mudanças

1. Ler o arquivo atual e seus imports/consumidores.
2. Preservar assinatura das funções exportadas e as RPCs existentes.
3. Para Expo/React Native, confirmar a API na documentação **versionada para SDK 57**.
4. Rodar `npx tsc --noEmit` dentro de `app` e testar os fluxos críticos no Android.
5. Fazer mudanças em lotes pequenos e só commitar após aprovação explícita.

## Comandos principais

```bash
cd app
npx tsc --noEmit
npx expo-doctor
npx expo start --dev-client
```

Se precisar instalar módulo Expo, usar `npx expo install <pacote>` para compatibilidade. Nunca executar `npm audit fix --force`.

## Restrições

- Não editar ou reescrever migrations já aplicadas, criar migration nova se necessário.
- Preservar as regras de validação, histórico, bloqueio de voto do autor e bônus das praças.
- Evitar criar arquivos novos quando uma pequena função/componente local basta.
- Nunca commitar o `.env`, tokens ou chaves administrativas.
- Não criar mudanças estéticas grandes durante correção funcional.
