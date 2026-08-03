# Documentação do Projeto

Esta pasta contém a documentação oficial detalhada do Gerador Inteligente de
Escalas.

O README da raiz funciona como porta de entrada. Os documentos abaixo carregam o
detalhamento normativo, técnico e operacional.

## Documentos

- [Regras de negócio](BUSINESS_RULES.md): papéis, turnos, ciclo 2x2, FT,
  ausências, cobertura mínima e validações.
- [Algoritmo e ranking](SCHEDULER.md): estratégia de geração, tentativas,
  métricas, perfis de otimização e desempates.
- [Auditabilidade](AUDITABILITY.md): logs de decisão, warnings, violações,
  métricas e interpretação dos resultados.
- [Arquitetura](ARCHITECTURE.md): estrutura do repositório, módulos principais e
  fluxo técnico.
- [Instalação local](INSTALL.md): dependências, comandos de desenvolvimento,
  build e testes.
- [Deploy Docker com Basic Auth](DOCKER_DEPLOY_BASIC_AUTH.md): publicação em
  container com Nginx.
- [Basic Auth via Nginx](BASIC_AUTH_NGINX.md): decisão técnica de autenticação
  fora do React.
- [Changelog](CHANGELOG.md): histórico de mudanças relevantes.
- [Licenciamento](LICENSING.md): status da decisão de licença e restrição de
  distribuição.

## Ordem de Autoridade

Quando houver divergência entre documentos, use esta ordem:

1. `BUSINESS_RULES.md` para comportamento operacional esperado.
2. Testes automatizados para comportamento validado.
3. Código atual do scheduler para comportamento implementado.
4. README da raiz para visão executiva.

Toda divergência encontrada deve ser corrigida na documentação ou no código.
