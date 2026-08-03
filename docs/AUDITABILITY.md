# Auditabilidade

Este documento descreve como o projeto deve permitir revisão e explicação das
escalas geradas.

## Objetivo

Toda escala gerada deve permitir responder:

- por que um operador foi alocado;
- por que um operador foi rejeitado;
- por que uma FT foi atribuída;
- por que uma realocação aconteceu;
- quais violações ou warnings existem;
- por que uma alternativa venceu outra no ranking;
- qual status final foi atribuído à escala.

## Mecanismos

### Decision Log

`decisionLog` contém mensagens textuais de alto nível sobre a geração.

Exemplos de eventos:

- início e fim da geração;
- déficits detectados;
- busca por excedentes;
- realocações;
- concessão de FT;
- uso de recurso raro;
- warnings críticos;
- resumo de otimização.

### Debug Estruturado

Quando o modo debug está ativo, o scheduler também pode registrar decisões
estruturadas por dia, turno e operador.

Campos:

- `day`;
- `shift`;
- `employeeId`;
- `action`;
- `reason`.

Esse modo é voltado para investigação técnica, testes e análise fina do
comportamento do algoritmo.

### Warnings

Warnings representam condições relevantes que não impedem necessariamente a
geração da escala.

Exemplos:

- carga reduzida por ausência registrada;
- realocação aplicada para cobertura;
- uso de recurso raro com recomendação de revisão manual;
- conflito entre encarregados que transforma uma alocação em FT.

### Violations

Violations representam problemas que afetam a validade operacional da escala.

Exemplos:

- operador abaixo ou acima da faixa esperada sem justificativa;
- turno abaixo do mínimo;
- mais de um ENC no mesmo turno;
- turno A ou B sem ENC/SUB;
- equipe A ou B formada apenas por novatos;
- impossibilidade de garantir folga consecutiva de sábado e domingo.

### Métricas

As métricas permitem comparar alternativas e auditar trade-offs.

Uma alternativa com menos violações deve ser preferida a uma alternativa mais
balanceada, mas operacionalmente inválida.

## Princípios

- Logs devem explicar decisões relevantes, não apenas o resultado final.
- Métricas devem ser interpretáveis por mantenedores e usuários operacionais.
- Warnings críticos devem chamar revisão manual.
- Alterações nas regras devem atualizar documentação, testes e exemplos.

## Limitações Atuais

- Nem todo log textual é estruturado.
- A explicação para o usuário final ainda pode ser aprimorada.
- A documentação deve evoluir junto com os testes de regra de negócio.
