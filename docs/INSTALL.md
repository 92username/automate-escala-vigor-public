# Instalação Local

Este documento descreve como rodar o projeto localmente.

## Pré-requisitos

- Node compatível com o projeto.
- `pnpm`.

O workspace força o uso de `pnpm` no `preinstall`.

## Instalar Dependências

Na raiz do repositório:

```bash
pnpm install
```

## Rodar o App

Comando completo para copiar e colar a partir da raiz do repositório:

```bash
pnpm install && PORT=5173 BASE_PATH=/ pnpm --filter @workspace/escala-generator run dev
```

Depois, acesse:

```text
http://localhost:5173/
```

Comando individual para quando as dependências já estiverem instaladas:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/escala-generator run dev
```

Acesse a URL mostrada no terminal. Por padrão:

```text
http://localhost:5173/
```

Se a porta `5173` estiver ocupada, o Vite pode subir automaticamente na próxima
porta disponível e mostrar a URL correta no terminal. Você também pode escolher
outra porta manualmente:

```bash
PORT=5174 BASE_PATH=/ pnpm --filter @workspace/escala-generator run dev
```

`PORT` e `BASE_PATH` são necessários porque a configuração do Vite valida essas
variáveis.

## Uso Básico

1. Selecione mês, ano e feriados.
2. Opcionalmente importe a escala oficial do mês anterior para inferir a posição
   do ciclo 2x2.
3. Cadastre ou edite funcionários, funções e novatos.
4. Cadastre afastamentos: férias, licença ou curso.
5. Clique em `Gerar Escala`.
6. Revise warnings, violações, alternativas de otimização e log de decisões.
7. Exporte a escala em `.xlsx`.

## Build

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/escala-generator run build
```

## Preview do Build

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/escala-generator run serve
```

## Typecheck

Na raiz:

```bash
pnpm run typecheck
```

Somente no app:

```bash
pnpm --filter @workspace/escala-generator run typecheck
```

## Testes

```bash
pnpm --filter @workspace/escala-generator run test
```

## Observações

- O projeto não possui script dedicado de lint neste momento.
- Para deploy em subcaminho, ajuste `BASE_PATH`.
- Para deploy na raiz do domínio, use `BASE_PATH=/`.
