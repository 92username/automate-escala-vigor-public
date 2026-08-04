[![CI](https://github.com/92username/automate-escala-vigor-public/actions/workflows/ci.yml/badge.svg)](https://github.com/92username/automate-escala-vigor-public/actions/workflows/ci.yml) [![Deploy VPS](https://github.com/92username/automate-escala-vigor-public/actions/workflows/deploy.yml/badge.svg)](https://github.com/92username/automate-escala-vigor-public/actions/workflows/deploy.yml)
# Gerador de Escalas

Aplicação web para geração automática de escalas operacionais mensais em regime
2x2.

O sistema reduz o trabalho manual de montagem de escalas, aplica regras
operacionais, gera múltiplas alternativas, pontua cada alternativa e apresenta
as melhores opções ao usuário.

Este README é a porta de entrada oficial do projeto. Os detalhes normativos,
técnicos e operacionais ficam centralizados em [`docs/`](docs/README.md).

## Problema de Negócio

A elaboração manual de escalas operacionais é sujeita a retrabalho, assimetria de
carga entre operadores, dificuldade de auditoria e decisões pouco rastreáveis.

O projeto existe para apoiar a criação de escalas mais consistentes, justas e
auditáveis, mantendo a cobertura operacional como prioridade máxima.

## Objetivos

- Automatizar a geração da escala mensal.
- Garantir cobertura mínima dos turnos operacionais.
- Preservar o ciclo operacional 2x2 sempre que possível.
- Distribuir carga de trabalho, turnos e FT de forma equilibrada.
- Reduzir intervenções manuais.
- Gerar alternativas comparáveis por ranking.
- Manter decisões rastreáveis para auditoria e melhoria contínua.

## Como o Sistema Funciona

Em alto nível, o gerador:

1. Recebe operadores, papéis, ausências, feriados e histórico do mês anterior.
2. Infere o alinhamento do ciclo 2x2 para o mês atual.
3. Preenche alocações de acordo com regras operacionais.
4. Rebalanceia déficits usando excedentes quando possível.
5. Marca FT quando há excedente operacional ou realocação.
6. Valida cobertura, carga, papéis críticos e restrições.
7. Gera múltiplas tentativas candidatas.
8. Ranqueia alternativas por perfis de otimização.
9. Exibe as melhores escalas com métricas, avisos e logs de decisão.

## Princípios do Projeto

### Cobertura Operacional

A continuidade do serviço tem prioridade máxima. O algoritmo deve favorecer
soluções que mantenham os turnos cobertos e sinalizem claramente qualquer
pendência.

### Justiça Operacional

Nenhum operador deve ser sistematicamente favorecido ou prejudicado. O sistema
busca equilibrar dias trabalhados, distribuição de turnos, FT e realocações.

### Transparência

Toda decisão relevante deve ser explicável por regra, métrica ou log de decisão.

### Auditabilidade

As escalas geradas devem permitir revisão posterior: motivo de alocação,
realocação, FT, warning, violação e penalidade de ranking.

### Evolução Controlada

As regras de negócio podem evoluir, mas mudanças relevantes devem ser
documentadas, testadas e registradas.

## Documentação Oficial

- [Índice da documentação](docs/README.md)
- [Regras de negócio](docs/BUSINESS_RULES.md)
- [Algoritmo e ranking](docs/SCHEDULER.md)
- [Auditabilidade](docs/AUDITABILITY.md)
- [Arquitetura](docs/ARCHITECTURE.md)
- [Instalação local](docs/INSTALL.md)
- [Deploy Docker com Basic Auth](docs/DOCKER_DEPLOY_BASIC_AUTH.md)
- [Basic Auth via Nginx](docs/BASIC_AUTH_NGINX.md)
- [Changelog](docs/CHANGELOG.md)
- [Licenciamento](docs/LICENSING.md)

Em caso de divergência, prevalecem nesta ordem:

1. Regras de negócio documentadas em `docs/BUSINESS_RULES.md`.
2. Testes automatizados associados às regras.
3. Implementação atual do scheduler.
4. Resumos descritivos deste README.

## Estado Atual

O projeto possui geração automática de escalas, criação de alternativas,
ranking por perfis de otimização, validação operacional, métricas e logs de
decisão.

As frentes principais de evolução são:

- melhoria contínua do balanceamento de FT;
- aprimoramento da explicabilidade;
- refinamento do ranking;
- consolidação da documentação oficial;
- redução de distorções operacionais.

## Licença

Uso operacional interno. A licença definitiva deve ser formalizada antes de
qualquer distribuição externa. Veja [Licenciamento](docs/LICENSING.md).
