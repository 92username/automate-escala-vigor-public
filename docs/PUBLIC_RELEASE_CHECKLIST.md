# Public Release Checklist

Objetivo: tornar o repositório público sem expor dados operacionais, dados pessoais ou artefatos internos, mantendo a demo hospedada funcional.

## Status Geral

- Branch de trabalho: `dev`
- Data de início desta faxina: `2026-08-02`
- Estratégia atual:
  - repositório público sem bases reais;
  - instância hospedada continua funcional;
  - leitura da escala-base real migrará para a VPS em fase posterior;
  - na Fase 1, manter apenas o primeiro nome dos operadores quando isso for necessário para não quebrar o uso atual.

## Fase 1 — Saneamento do Repositório

- [x] Criar branch `dev` para executar a limpeza sem tocar a `main`.
- [x] Mapear arquivos sensíveis já rastreados no Git.
- [x] Criar este checklist de acompanhamento.
- [x] Atualizar o `.gitignore` para impedir novo versionamento de bases e artefatos sensíveis.
- [x] Remover do rastreamento Git os arquivos reais de escala e PDFs/ZIPs desnecessários.
- [x] Decidir quais arquivos de template podem continuar públicos e quais devem sair do rastreamento.
- [x] Sanitizar referências diretas a dados reais no código, mantendo somente o primeiro nome quando necessário.
- [x] Sanitizar testes que ainda embutem nomes completos reais.
- [x] Sanitizar documentação que aponta para arquivos reais em `assets/`.
- [x] Revisar o diff final da Fase 1.

## Fase 2 — Fonte Privada na VPS

- [x] Definir variável de ambiente para o caminho da escala-base na VPS.
- [x] Implementar leitura do arquivo local no backend.
- [x] Tratar erro de arquivo ausente com resposta clara da API.
- [x] Adaptar o frontend para usar a API em vez de depender de arquivo versionado.
- [x] Validar geração da `escala prevista` com base privada na VPS.
- [x] Validar o fluxo da escala vertical com a mesma base privada.

## Fase 3 — Operação da Demo

- [x] Documentar como atualizar manualmente o arquivo na VPS.
- [x] Definir nome e local padrão do arquivo operacional na VPS.
- [x] Testar a demo pública ponta a ponta.
- [x] Confirmar que nenhum dado real permanece acessível pelo bundle frontend ou pelo repo.

## Fase 4 — Publicação Segura

- [x] Remover arquivos sensíveis do histórico Git.
- [x] Revisar README/docs públicos após a limpeza.
- [x] Validar `git grep` final para dados pessoais e referências sensíveis.
- [x] Abrir PR ou merge de `dev` para `main`.
- [x] Tornar o repositório público somente após a limpeza do histórico.

## Inventário Sensível Identificado

- Bases reais:
  - `assets/[REDACTED]`
  - `assets/[REDACTED`
- PDFs/ZIPs não necessários ao funcionamento:
  - `Modelo de Escalas Verticais/`
  - `Modelo de Escalas Verticais-(1)/`
  - `Modelo de Escalas Verticais.zip`
- Artefatos de edição/export possivelmente internos:
  - `assets/ICA_63-33_Escala_Vertical_Template.pdf`
  - `assets/ICA_63-33_Escala_Vertical_Template_CLEAN.pdf`
  - `assets/ICA_63-33_Escala_Vertical_Template_CLEAN.odg`
- Template público mantido no repositório:
  - `assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx`
- Pontos de código com nomes reais:
  - `artifacts/escala-generator/[REDACTED]`
  - `artifacts/escala-generator/[REDACTED]`
  - `artifacts/escala-generator/[REDACTED]`
  - testes relacionados em `artifacts/escala-generator/[REDACTED]`

## Notas

- Remover do rastreamento não limpa o histórico antigo; isso será tratado na Fase 4.
- A meta desta fase é reduzir imediatamente o risco no estado atual da branch.
- Permanecem no frontend apenas primeiros nomes, por decisão operacional consciente para manter a demo utilizável.
- Em `2026-08-02`, o histórico local da branch `dev` foi reescrito para remover os arquivos sensíveis listados neste checklist.
- Depois da reescrita do histórico, o próximo `push` da branch `dev` para o remoto deve ser feito com `--force-with-lease`.
