# Regras de Negócio

Este documento descreve as regras operacionais oficiais conhecidas do gerador de
escalas.

## Regime Operacional

O projeto trabalha com escala em regime 2x2.

O ciclo base serve como referência inicial de trabalho e folga. O algoritmo pode
fazer ajustes quando necessário para preservar cobertura operacional, respeitar
ausências e reduzir desequilíbrios.

Regras de ciclo atualmente conhecidas:

- `ENC` segue ciclo de 8 dias: `A`, `A`, folga, folga, `B`, `B`, folga, folga.
- `SUB` e `OPE` seguem ciclo 2x2 de 4 dias: trabalha, trabalha, folga, folga.
- Quando há escala anterior importada, a posição do ciclo é inferida por
  funcionário.
- Sem escala anterior importada, o sistema usa posições padrão distribuídas.

## Papéis

- `ENC`: encarregado. Atua nos turnos A ou B e não deve ser alocado no turno
  intermediário.
- `SUB`: substituto. Pode reforçar a cobertura e conta como papel crítico para
  turnos que exigem presença de ENC ou SUB.
- `OPE`: operador.
- `ESP`: operador raro ou recurso excepcional. Deve ser preservado e usado com
  parcimônia.
- `ADM`: administrativo. Não participa da alocação operacional normal.

## Turnos

- `A`: 06:00 às 15:00.
- `INT`: 09:00 às 18:00.
- `B`: 13:00 às 22:00.

## Cobertura Mínima

Os mínimos operacionais atuais são:

- Turno `A`: 3 operadores.
- Turno `INT`: 2 operadores.
- Turno `B`: 2 operadores.

Turnos abaixo do mínimo devem gerar violação ou warning crítico, conforme o caso.

## Regras de Compatibilidade

- Um operador não pode ser alocado em `A` no dia seguinte a uma alocação em `B`.
- `ENC` não pode trabalhar no turno `INT`.
- Um operador não pode ter mais de uma alocação no mesmo dia.
- Operadores ausentes não podem ser alocados no período de ausência.
- Operadores marcados como FT no dia não devem receber alocação operacional no
  mesmo dia.
- Pessoas marcadas como `FT` não contam como membros do turno.

## Regras de Papel Crítico

- Deve haver no máximo um `ENC` por turno.
- Turnos `A` e `B` não devem ficar sem `ENC` ou `SUB`.
- Turnos `A` e `B` não devem ser compostos apenas por novatos.
- No turno `INT`, equipe composta apenas por novatos não gera violação.
- Novatos podem trabalhar junto com pelo menos um experiente, inclusive com
  múltiplos novatos no mesmo turno.

## Carga de Trabalho

A faixa de referência atual é:

- mínimo: 14 dias trabalhados no mês;
- máximo: 16 dias trabalhados no mês.

Quando a carga fica fora da faixa por férias, licença ou curso, o sistema pode
registrar warning em vez de violação.

## Ausências

Ausências documentadas:

- férias;
- licença;
- curso.

Ausências removem o operador da disponibilidade operacional nos dias cobertos
pelo período informado.

## Folga Técnica

FT é usada para representar folga atribuída por excedente operacional ou por
realocação.

O sistema deve evitar concentração excessiva de FT em poucos operadores. Quando
uma realocação transforma uma alocação anterior em FT, essa decisão deve ser
rastreável.

Sobras de ciclo podem virar `FT` ou ser realocadas para cobrir déficit de outro
dia ou turno.

Realocações automáticas:

- não podem deixar o turno de origem abaixo do mínimo;
- não podem deixar turnos `A` ou `B` sem `ENC` ou `SUB`;
- não podem deixar turnos `A` ou `B` apenas com novatos;
- preservam `ENC`, `ESP` e `ADM`;
- em geral movem apenas `SUB` e `OPE`.

## Finais de Semana

O sistema busca garantir ao menos um sábado e domingo consecutivos de folga para
cada operador operacional no mês, quando isso é possível.

Se não for possível garantir essa condição, o resultado deve registrar violação.

## Recursos Raros

Recursos `ESP` devem ser preservados. Quando usados para cobrir déficit
operacional, o resultado deve indicar warning crítico ou revisão manual
recomendada.

Regras específicas atuais:

- Carlos pode cobrir `A` em sextas-feiras até 2 vezes.
- Leandro pode cobrir `INT` em dias úteis até 4 vezes.

Essas regras são excepcionais e devem ser revisadas sempre que houver mudança na
equipe ou no desenho operacional.

## Administrativo

`ADM` não entra na cobertura operacional.

Em dias úteis sem feriado, aparece como `EXP`. Em fins de semana e feriados,
fica `OFF`.

Feriados afetam o expediente administrativo, mas não removem automaticamente a
necessidade de cobertura operacional.

## Critério de Publicação

Uma escala publicável deve:

- cobrir os mínimos operacionais;
- respeitar as restrições críticas;
- manter warnings e violações visíveis;
- permitir auditoria das decisões relevantes;
- ser comparável com outras alternativas por métricas de ranking.

Status finais conhecidos:

- `gerada_ok`;
- `gerada_com_ajustes`;
- `gerada_com_warning_critico`.
