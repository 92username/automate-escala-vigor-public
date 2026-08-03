Sprint 2 — Escala Vertical UX
Objetivo

Melhorar a experiência de uso da tela Escala Vertical sem alterar sua arquitetura.

Não implementar persistência (IndexedDB) nesta sprint.

Não implementar Escala Cumprida nesta sprint.

Escopo
1. Biblioteca de Escalas
Renomear bloco superior.
Melhorar descrição.
Manter select existente.
2. Metadados

Exibir quando disponíveis:

mês
ano
versão
status
score
tentativas
operadores
avisos
violações

Campos inexistentes devem ser omitidos.

3. Preview

Mostrar:

mês
ano
dias
operadores
avisos
violações
4. Geração DOCX

Adicionar feedback visual durante processamento.

5. Escala Cumprida

Não implementar.

Somente comunicar fluxo futuro.

Fluxo esperado:

Importar XLSX

↓

Comparar com Prevista

↓

Gerar DOCX

6. Últimas exportações

Persistência apenas em memória da sessão.

Será substituída futuramente por IndexedDB.

Fora do escopo
IndexedDB
Upload XLSX
Comparação Prevista x Em Vigor
Refatoração grande
Backend novo