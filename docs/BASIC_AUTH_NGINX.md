# Basic Auth via Nginx

Este projeto está preparado para rodar atrás de um Nginx/reverse proxy com
Basic Auth. A autenticação será feita fora do React, na camada de servidor da
VPS.

## Decisão Técnica

- O app não terá tela de login ou cadastro por enquanto.
- O app não usará Microsoft/Azure/Entra ID nesta fase.
- O app não terá banco de usuários.
- O controle de acesso será feito pelo Nginx antes de entregar os arquivos do
  React/Vite.
- A configuração real do Nginx da VPS será mantida fora deste repositório.

Com essa abordagem, usuários sem credenciais não recebem o app. O navegador
mostra o prompt nativo de usuário e senha, e o Nginx valida as credenciais antes
de servir o conteúdo.

## Usuários

Os usuários devem ser criados manualmente em um arquivo `htpasswd` na VPS. Esse
arquivo não deve ser versionado no Git.

Exemplo para criar o primeiro usuário:

```bash
htpasswd -c .htpasswd usuario1
```

Exemplo para adicionar outro usuário:

```bash
htpasswd .htpasswd usuario2
```

Importante: use `-c` apenas ao criar o arquivo pela primeira vez. Usar `-c`
novamente recria o arquivo e remove usuários existentes.

Para trocar a senha de um usuário existente:

```bash
htpasswd .htpasswd usuario1
```

Para remover um usuário:

```bash
htpasswd -D .htpasswd usuario2
```

## Reverse proxy

O app deve ser publicado como uma SPA estatica. Para servir na raiz do dominio,
use:

```bash
BASE_PATH=/
```

O Nginx da VPS deve:

- aplicar Basic Auth antes de servir o app;
- servir o build estático gerado em `artifacts/escala-generator/tmp/dist/public`;
- usar fallback de SPA para `index.html`;
- manter HTTPS configurado no proxy externo;
- manter o arquivo `.htpasswd` fora do repositório.

Exemplo conceitual de Nginx:

```nginx
server {
  listen 80;
  server_name exemplo.com;

  root /var/www/escala-generator;
  index index.html;

  auth_basic "Acesso restrito";
  auth_basic_user_file /etc/nginx/.htpasswd;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Esse exemplo é apenas uma referência. A configuração final da VPS deve ser feita
fora deste repositório.

## Build e Validação Local

Na raiz do workspace, as dependências são instaladas com:

```bash
pnpm install
```

Para gerar o build do app:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/escala-generator run build
```

Para validar o build localmente com o preview do Vite:

```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/escala-generator run serve
```

Para checagem de tipos:

```bash
pnpm --filter @workspace/escala-generator run typecheck
```

Para testes:

```bash
pnpm --filter @workspace/escala-generator run test
```

Não existe script de lint dedicado neste pacote atualmente.

## Observações de Compatibilidade

- O app não depende de callback, redirect ou rota de login.
- O app não usa router com basename nesta fase.
- Para publicar em subcaminho, ajuste `BASE_PATH` para o caminho público, por
  exemplo `BASE_PATH=/escala/`, e configure o Nginx para servir o app nesse
  mesmo prefixo.
- Para publicar na raiz do dominio, mantenha `BASE_PATH=/`.
