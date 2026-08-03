# Algoritmo e Ranking

Este documento descreve a estratégia atual de geração, otimização e seleção de
escalas candidatas.

## Entrada

O scheduler recebe:

- ano e mês;
- cenário;
- lista de operadores;
- papéis operacionais;
- ausências;
- feriados;
- histórico do mês anterior, quando disponível.

O histórico do mês anterior é usado para inferir o alinhamento do ciclo 2x2 no
primeiro dia do mês atual.

Quando o histórico não está disponível, o sistema usa posições padrão
distribuídas por papel operacional.

## Estratégia Geral

A geração segue esta ordem:

1. Criar o contexto mensal.
2. Inferir o ciclo inicial de cada operador.
3. Preencher alocações de encarregados.
4. Preencher alocações de substitutos e operadores.
5. Buscar folga de fim de semana.
6. Rebalancear déficits usando excedentes de outros dias.
7. Validar cobertura, carga e restrições.
8. Coletar métricas.
9. Repetir a geração com seeds diferentes.
10. Selecionar alternativas por perfil de otimização.

## Tentativas

Por padrão, o sistema avalia 48 tentativas de geração para o mesmo período.

Cada tentativa usa uma seed diferente para desempates. Isso permite gerar
alternativas distintas mantendo o algoritmo determinístico para a mesma seed.

## Alternativas

O sistema seleciona alternativas vencedoras a partir de perfis de otimização.

Perfis atuais:

- `best_overall`: equilibra ajustes, FT distribuída e carga de trabalho.
- `fewest_adjustments`: preserva melhor o ciclo 2x2 e reduz realocações.
- `most_balanced`: prioriza carga parecida e FT menos concentrada.

Uma mesma escala pode vencer mais de um perfil. Nesse caso, a alternativa deve
indicar duplicidade.

## Métricas

As métricas atuais incluem:

- `totalAdjustments`: total de ajustes no mês.
- `totalFtReallocations`: total de FT originadas por realocação.
- `maxFtReallocationsForOneEmployee`: maior concentração de FT por realocação em
  um único operador.
- `ftReallocationSquarePenalty`: penalidade quadrática para concentração de FT.
- `workloadMin`: menor carga mensal.
- `workloadMax`: maior carga mensal.
- `workloadSpread`: diferença entre maior e menor carga mensal.
- `shiftBalancePenalty`: desequilíbrio na distribuição de turnos por operador.
- `twoByTwoPenalty`: penalidade relacionada a ajustes e FT que distanciam a
  solução do ciclo base.
- `violationCount`: quantidade de violações.
- `warningCount`: quantidade de warnings.
- `criticalWarningCount`: quantidade de warnings críticos.

## Ranking

O ranking não usa uma nota única ponderada.

Cada perfil gera um vetor ordenado de métricas. A comparação é lexicográfica:
primeiro critério mais importante é comparado antes do segundo, e assim por
diante.

Violações e warnings críticos sempre aparecem no início dos vetores de ranking,
pois uma escala operacionalmente inválida não deve vencer uma escala válida por
ter melhor equilíbrio secundário.

## Desempate

Quando duas tentativas têm o mesmo score no perfil avaliado, a menor seed vence.

Dentro da alocação diária, desempates usam hash estável com seed para manter
variação controlada entre tentativas.

## Filosofia do Algoritmo

O algoritmo prioriza:

1. cobertura operacional;
2. respeito a restrições críticas;
3. preservação do ciclo 2x2;
4. uso controlado de realocações;
5. distribuição justa de carga e FT;
6. explicabilidade do resultado.

O sistema não busca apenas uma escala possível. Ele busca um conjunto pequeno de
boas alternativas, cada uma otimizada para uma leitura operacional diferente.

## Resultado

O resultado pode conter:

- linhas por operador;
- visão por dia;
- status final;
- warnings;
- violações;
- métricas;
- alternativas;
- alternativa selecionada;
- resumo de otimização;
- log de decisões.
