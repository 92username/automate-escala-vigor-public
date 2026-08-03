# Arquitetura

Este documento descreve a organização técnica atual do repositório.

## Visão Geral

O projeto é um workspace `pnpm` com aplicação frontend, servidor de API,
bibliotecas compartilhadas, especificação OpenAPI e documentação.

## Estrutura Principal

- `README.md`: porta de entrada do projeto.
- `docs/`: documentação oficial.
- `Dockerfile`: build do app e runtime Nginx.
- `artifacts/escala-generator`: aplicação React/Vite do gerador de escalas.
- `artifacts/api-server`: servidor de API.
- `lib/api-spec`: especificação OpenAPI.
- `lib/api-client-react`: cliente React gerado.
- `lib/api-zod`: tipos e validações gerados.
- `lib/db`: schema e utilitários de banco.
- `scripts`: scripts auxiliares.

## Scheduler

O motor de geração fica em:

```text
artifacts/escala-generator/src/lib/scheduler
```

Módulos principais:

- `index.ts`: orquestra tentativas, alternativas e resultado final.
- `context.ts`: cria o contexto mensal e estruturas de estado.
- `assignment.ts`: aplica ciclo base, alocações, FT e realocações.
- `fairness.ts`: escolhe candidatos com critérios de balanceamento.
- `rebalance.ts`: cobre déficits usando excedentes.
- `weekend.ts`: tenta preservar folga consecutiva em fim de semana.
- `validation.ts`: valida cobertura, carga e restrições.
- `optimization.ts`: calcula métricas, scores e alternativas.
- `result.ts`: monta o resultado final.

## Fluxo Técnico

1. A UI coleta ou monta os dados de entrada.
2. O scheduler gera a escala e alternativas.
3. O resultado retorna linhas por operador, visão por dia, métricas, warnings,
   violations, logs e resumo de otimização.
4. A UI apresenta as melhores alternativas para decisão operacional.

## Deploy

O deploy de produção usa Docker Compose com dois serviços: `frontend` em Nginx e
`backend` em Node/Express. O Nginx serve o build React/Vite, preserva Basic Auth
e encaminha `/api` para o backend pela rede interna Docker.

O controle de acesso é feito por Basic Auth no Nginx, fora do React. O backend
não é exposto diretamente no host.

Veja:

- [Deploy Docker com Basic Auth](DOCKER_DEPLOY_BASIC_AUTH.md)
- [Basic Auth via Nginx](BASIC_AUTH_NGINX.md)
