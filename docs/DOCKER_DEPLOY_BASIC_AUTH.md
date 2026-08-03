# Docker Compose Deploy com Basic Auth

Este guia descreve o deploy de produção via GitHub Actions em uma VPS usando
Docker Compose. A stack publicada tem:

- `frontend`: Nginx servindo o build React/Vite.
- `backend`: API Node/Express na rede interna Docker.
- Proxy `/api` no Nginx para o backend.
- Basic Auth preservado no Nginx para `/` e `/api`.

O deploy esperado e automatizado e:

```text
push na main -> GitHub Actions -> SSH na VPS -> docker compose up -d --build
```

## Arquivos Principais

- Frontend Dockerfile: `Dockerfile`
- Backend Dockerfile: `artifacts/api-server/Dockerfile`
- Compose de producao: `docker-compose.yml`
- Nginx: `artifacts/escala-generator/nginx.conf`
- Variaveis exemplo: `.env.example`
- Workflow: `.github/workflows/deploy.yml`
- Script local de htpasswd: `artifacts/escala-generator/scripts/create-htpasswd.sh`

O build do Vite gera `artifacts/escala-generator/tmp/dist/public`, e o Dockerfile do
frontend copia exatamente esse diretorio para `/usr/share/nginx/html`.

## Secrets do GitHub

Configure estes secrets no repositorio em GitHub Actions:

```text
VPS_HOST       Host ou IP da VPS
VPS_USER       Usuario SSH usado no deploy
VPS_PORT       Porta SSH, normalmente 22
VPS_SSH_KEY    Chave privada SSH sem senha para o usuario de deploy
DEPLOY_PATH    Caminho absoluto do checkout na VPS
```

Exemplo de `DEPLOY_PATH`:

```text
/opt/automate-escala-vigor/app
```

## Primeiro Setup Manual da VPS

O agente nao acessa a VPS diretamente. Estes comandos devem ser executados uma
vez por quem administra a VPS.

Instale dependencias basicas:

```bash
sudo apt update
sudo apt install -y git apache2-utils ca-certificates curl
```

Instale Docker Engine e o plugin `docker compose` seguindo a documentacao
oficial da distribuicao da VPS. Valide:

```bash
docker --version
docker compose version
```

Crie os diretorios:

```bash
sudo mkdir -p /opt/automate-escala-vigor
sudo mkdir -p /opt/escala-generator
sudo chown -R "$USER":"$USER" /opt/automate-escala-vigor
```

Clone o repositorio no caminho usado por `DEPLOY_PATH`:

```bash
git clone git@github.com:OWNER/REPO.git /opt/automate-escala-vigor/app
cd /opt/automate-escala-vigor/app
git checkout main
```

Crie o arquivo de Basic Auth fora do repositorio:

```bash
sudo htpasswd -B -c /opt/escala-generator/.htpasswd leandro
```

Adicione usuarios depois sem `-c`:

```bash
sudo htpasswd -B /opt/escala-generator/.htpasswd vinicius
```

Crie o `.env` de producao a partir do exemplo:

```bash
cp .env.example .env
```

Edite `.env` na VPS:

```text
FRONTEND_PORT=8081
FRONTEND_BUILD_PORT=5173
BASE_PATH=/
VITE_API_BASE_URL=
HTPASSWD_PATH=/opt/escala-generator/.htpasswd
LOG_LEVEL=info
OPERATIONAL_SCHEDULE_SOURCE_PATH=/opt/escala-generator/data/Escala_em_Vigor.xlsx
```

Em producao via Compose, mantenha `VITE_API_BASE_URL` vazio para o navegador
usar `/api` no mesmo host do Nginx.

Importante: o `docker-compose.yml` monta a pasta privada
`/opt/escala-generator/data` do host dentro do container do backend em modo
somente leitura. Sem esse bind mount, a API nao consegue enxergar a escala
operacional privada mesmo com `OPERATIONAL_SCHEDULE_SOURCE_PATH` configurado.

## Arquivo Operacional Privado na VPS

O gerador nao deve depender de bases reais versionadas no repositorio. A escala
oficial em vigor deve ficar somente na VPS, fora do checkout do Git.

Padrao recomendado:

```text
/opt/escala-generator/data/Escala_em_Vigor.xlsx
```

Crie o diretorio uma vez:

```bash
mkdir -p /opt/escala-generator/data
chmod 700 /opt/escala-generator/data
```

Atualizacao manual recomendada:

1. Obtenha o arquivo oficial atualizado.
2. Envie o arquivo para a VPS com o nome padrao `Escala_em_Vigor.xlsx`.
3. Substitua o arquivo anterior no caminho configurado em
   `OPERATIONAL_SCHEDULE_SOURCE_PATH`.
4. Reinicie apenas o backend, ou a stack inteira, se necessario.

Exemplo com `scp`:

```bash
scp ./Escala_em_Vigor.xlsx USER@VPS:/opt/escala-generator/data/Escala_em_Vigor.xlsx
```

Exemplo ja conectado na VPS:

```bash
cp /caminho/origem/Escala_em_Vigor.xlsx /opt/escala-generator/data/Escala_em_Vigor.xlsx
```

Permissoes recomendadas:

```bash
chmod 600 /opt/escala-generator/data/Escala_em_Vigor.xlsx
```

Se a stack ja estiver no ar, reinicie o backend:

```bash
docker compose restart backend
```

Validacao rapida:

```bash
curl -s -u leandro:SENHA "http://localhost:8081/api/operational-schedule/previous-month?year=2026&month=7"
```

O esperado e receber JSON com:

- `detectedYear`
- `detectedMonth`
- `sheetName`
- `employees`
- `prevMonth.daysByEmployeeId`

Regra operacional importante:

- a base carregada representa o mes anterior;
- ela deve ser usada apenas para gerar o mes subsequente;
- se a base for `julho/2026`, o periodo valido para geracao sera
  `agosto/2026`.

O frontend ja exibe essa informacao e bloqueia geracoes incompatíveis.

## Deploy via GitHub Actions

O workflow `.github/workflows/deploy.yml` roda automaticamente em push na
branch `main`.

Na VPS, o workflow executa:

```bash
cd "$DEPLOY_PATH"
git fetch origin main --prune
git checkout -B main origin/main
git reset --hard origin/main
git pull --ff-only origin main
docker compose up -d --build
docker image prune -f
docker compose ps
```

Nao ha registry nesta fase. As imagens sao buildadas localmente na VPS a partir
do checkout atualizado.

## Comandos Manuais de Emergencia

Executar a partir de `DEPLOY_PATH` na VPS.

Ver status:

```bash
docker compose ps
```

Ver logs da stack:

```bash
docker compose logs -f
```

Ver logs de um servico:

```bash
docker compose logs -f frontend
docker compose logs -f backend
```

Reiniciar:

```bash
docker compose restart
```

Parar:

```bash
docker compose down
```

Rebuildar manualmente:

```bash
git fetch origin main --prune
git checkout -B main origin/main
git reset --hard origin/main
docker compose up -d --build
```

Limpeza segura de imagens nao usadas:

```bash
docker image prune -f
```

## Validacao

Healthcheck publico do Nginx, sem Basic Auth:

```bash
curl -i http://localhost:8081/healthz
```

Sem credenciais, a aplicacao deve exigir Basic Auth:

```bash
curl -I http://localhost:8081/
```

Esperado:

```text
HTTP/1.1 401 Unauthorized
```

Com credenciais:

```bash
curl -I -u leandro:SENHA http://localhost:8081/
```

Validar proxy `/api` pelo Nginx:

```bash
curl -i -u leandro:SENHA http://localhost:8081/api/healthz
```

Esperado:

```json
{"status":"ok"}
```

Validar backend apenas internamente:

```bash
docker compose exec backend wget -qO- http://127.0.0.1:3000/api/healthz
```

## Build Local

Build frontend:

```bash
PORT=5173 BASE_PATH=/ VITE_API_BASE_URL= pnpm --filter @workspace/escala-generator run build
```

Build backend:

```bash
pnpm --filter @workspace/api-server run build
```

Build da stack com Docker Compose:

```bash
cp .env.example .env
docker compose build
docker compose up -d
docker compose ps
```

Se Docker nao estiver disponivel no ambiente local, valide com os builds `pnpm`
e deixe o runtime Compose para a VPS/GitHub Actions.
