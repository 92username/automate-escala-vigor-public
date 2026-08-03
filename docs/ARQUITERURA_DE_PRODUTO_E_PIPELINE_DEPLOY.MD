# Roadmap – Arquitetura do Produto e Pipeline de Deploy

## Objetivo

Reorganizar a aplicação em uma estrutura mais próxima de um produto final, separando claramente os módulos funcionais, profissionalizando o processo de deploy e preparando a base para futuras funcionalidades.

---

# Fase 1 – Pipeline de Deploy

## Objetivos

Implementar um fluxo de deploy automatizado utilizando GitHub Actions, permitindo separar versões estáveis das versões em desenvolvimento.

## Estrutura proposta

Branches:

* `main` → Produção (Stable)
* `develop` → Desenvolvimento (Unstable)

Ambientes:

### Stable

* Destinado ao uso do Sr. Leandro.
* Apenas funcionalidades testadas.
* Deploy controlado.
* Utilizado como ambiente de produção.

### Unstable

* Ambiente de testes.
* Recebe novas funcionalidades continuamente.
* Deploy automático após push na branch `develop`.
* Utilizado para validação antes da promoção para produção.

---

# Fase 2 – Reestruturação da Interface

## Objetivo

Transformar a página inicial em um painel de módulos, tornando o fluxo de utilização mais intuitivo.

## Estrutura proposta

### Módulo 1 — Escala Operacional

Descrição:

Criar a escala operacional do mês seguinte.

Ações futuras:

* Criar nova escala.
* Editar escala.
* Visualizar escala.

---

### Módulo 2 — Escala Vertical

Descrição:

Gerar a escala vertical a partir da escala operacional.

Subopções previstas:

#### Escala cumprida

Gerar a escala vertical referente ao mês anterior.

#### Escala prevista

Gerar a escala vertical referente ao mês seguinte.

---

# Fase 3 – Separação da Lógica

Após a reorganização visual, separar a lógica interna em módulos independentes.

Objetivos:

* Isolar a geração da escala operacional.
* Isolar a geração da escala vertical.
* Reduzir o acoplamento entre funcionalidades.
* Facilitar futuras expansões.

---

# Benefícios Esperados

## Para o usuário

* Interface mais simples.
* Fluxo de navegação intuitivo.
* Separação clara entre as funcionalidades.

## Para o desenvolvimento

* Deploy automatizado.
* Ambientes de produção e testes independentes.
* Menor risco durante atualizações.
* Base preparada para novas funcionalidades.

---

# Prioridade

**Status:** Planejado

**Prioridade:** Média

**Dependências:**

* Conclusão e estabilização do backend.
* Validação final do exportador da escala vertical.
* Definição da infraestrutura definitiva de hospedagem.

---

# Observação

Esta iniciativa possui caráter estrutural e deve ser executada após a estabilização das funcionalidades principais do sistema. O objetivo é evoluir o projeto de um protótipo funcional para um produto com arquitetura mais organizada, facilitando manutenção, expansão e uso em ambiente de produção.
