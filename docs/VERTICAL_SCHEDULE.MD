# Epic: Exportador da Escala Vertical ICA 63-33

## Objetivo

Gerar automaticamente uma Escala de Serviço Operacional ICA 63-33 em DOCX
editável, utilizando dados reais de CSV ou a escala horizontal já produzida pelo
sistema.

O projeto não gera mais PDF diretamente. O PDF final é responsabilidade do
usuário ou supervisor, que deve revisar o DOCX no Microsoft Word e salvar ou
imprimir como PDF manualmente.

## Fluxo Operacional Final

```text
CSV real
-> Parser
-> VerticalSchedule
-> Preenchedor de Template DOCX
-> DOCX editável
-> Supervisor edita/revisa no Microsoft Word
-> Supervisor salva/imprime PDF manualmente
```

## Template

O template oficial usado pelo sistema é:

```text
assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx
```

Esse arquivo preserva o layout da ICA 63-33 como tabelas reais do Microsoft
Word. Por isso, a geração deve preencher células/tabelas do DOCX, não desenhar
coordenadas em PDF.

## Milestone 1 — Engenharia Reversa

Objetivo: entender completamente o formulário e suas fontes de dados.

### Task 1.1 — Catalogar todos os campos

Criar um documento contendo:

- nome do campo;
- localização no formulário Word;
- obrigatório?;
- editável?;
- origem do dado.

Exemplo:

| Campo | Origem |
| --- | --- |
| CRCEA | Configuração |
| Órgão | Configuração |
| Escalante | Configuração |
| Efetivo | Calculado |
| Hora instrução | Configuração |

### Task 1.2 — Mapear tabelas e campos do DOCX

Resultado esperado:

```text
header.crcea
header.orgao
header.escalante

dia01.turnoA
dia01.turnoINT
dia01.turnoB
dia01.folga
dia01.obs

legenda.a01
```

Esse mapa deve apontar para tabelas, linhas, colunas ou controles do DOCX.
Mapeamentos por coordenada de PDF estão removidos.

### Task 1.3 — Definir modelo interno

Criar e manter uma estrutura de dados única:

```text
VerticalSchedule
```

contendo:

- cabeçalho;
- dias;
- turnos;
- folgas/indisponibilidades;
- legenda;
- observações;
- horas e totais.

## Milestone 2 — Conversão Horizontal/CSV para Vertical

Objetivo: transformar a escala existente ou o CSV real em um modelo ICA.

### Task 2.1 — Converter operadores

```text
Flávio
-> A01
```

### Task 2.2 — Montar automaticamente os turnos

```text
Dia 14
Turno A
-> A01 A02 A05
```

### Task 2.3 — Montar automaticamente folgas e indisponibilidades

### Task 2.4 — Gerar automaticamente a legenda

Resultado do milestone:

```json
{
  "dias": [],
  "legenda": []
}
```

## Milestone 3 — Cabeçalho

Criar uma tela ou configuração para:

- CRCEA;
- Localidade;
- Órgão;
- Escalante;
- Chefe;
- Efetivo;
- Hora instrução;
- Tipo: Prevista ou Cumprida.

## Milestone 4 — Congelamento do Contrato de Dados

Objetivo: manter estável o contrato entre modelo de domínio, parser, mappers e
preenchimento do DOCX.

## Milestone 5 — Layout Engine PDF Removido

Status: removido.

O antigo `layout.ts` era específico de coordenadas de PDF. Com o template DOCX
limpo, esse milestone deixa de existir como layout engine de coordenadas.

O trabalho equivalente agora é mapear tabelas, linhas, colunas e controles do
DOCX em um futuro preenchimento de template.

## Milestone 6 — PDF Renderer Removido

Status: removido.

O antigo renderer PDF direto foi descontinuado. O sistema não deve produzir PDF
final diretamente.

## Milestone 6 Atual — DOCX Template Filler

Objetivo: preencher o template DOCX oficial com `VerticalSchedule`.

### Task 6.1 — Abrir template DOCX

Usar:

```text
assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx
```

### Task 6.2 — Preencher cabeçalho

### Task 6.3 — Preencher tabela diária

### Task 6.4 — Preencher legenda

### Task 6.5 — Preencher observações

### Task 6.6 — Exportar DOCX editável

O resultado do sistema é um arquivo `.docx`.

## Milestone 7 — Horas

Provavelmente a parte mais trabalhosa.

Precisamos calcular:

```text
CTOp
CTP
CTR
CTM
```

Hoje ainda faltam regras confirmadas.

Além disso, o campo `MÉDIA HORA MENSAL` ainda não pode ser calculado com
segurança. A ICA descreve o valor como a combinação entre carga de trabalho
mensal base prevista para o órgão e média mensal de horas trabalhadas no órgão
operacional, considerando todo o efetivo operacional do mês, inclusive pessoal
em manutenção operacional ou indisponível ao longo do mês. O exemplo conhecido é
`144/152`, mas ainda falta confirmar a regra operacional que gera cada lado
desse par.

Até essa confirmação, `monthlyWorkloadBase` e `averageMonthlyHours` devem ser
informados manualmente por configuração.

## Marcos Removidos

- Renderização direta em PDF.
- Layout por coordenadas de PDF.
- Testes de renderer/layout PDF.
- Dependência `pdf-lib`.

## Próximo Passo

Implementar o DOCX template filler que carrega
`assets/ICA_63-33_Escala_Vertical_Template_CLEAN.docx`, preenche as tabelas com
`VerticalSchedule` e retorna um DOCX editável para revisão no Microsoft Word.
