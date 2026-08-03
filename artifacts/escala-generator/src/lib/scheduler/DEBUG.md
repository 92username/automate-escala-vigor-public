# Sistema de Debug e Rastreio - Scheduler

## Visão Geral

O sistema de debug permite rastrear todas as decisões do motor de escala: por que cada operador foi escolhido ou rejeitado em cada turno.

## Como Usar

### Ativar Debug

```typescript
import { generateSchedule } from "@/lib/scheduler";

const result = generateSchedule(input, { debug: true });
```

### Acessar Logs

```typescript
if (result.debug) {
  console.log("Decision logs:", result.debug.decisions);
  
  // Filtrar decisões de um dia específico
  const day5Decisions = result.debug.decisions.filter(log => log.day === 5);
  
  // Filtrar apenas seleções
  const selected = result.debug.decisions.filter(log => log.action === "selected");
  
  // Filtrar apenas rejeições
  const rejected = result.debug.decisions.filter(log => log.action === "rejected");
}
```

## Estrutura de DecisionLog

```typescript
type DecisionLog = {
  day: number;              // Dia do mês (1..31)
  shift: "A" | "B" | "INT"; // Turno
  employeeId: string;       // ID do operador
  action: "selected" | "rejected"; // Ação tomada
  reason: string;           // Motivo da decisão
};
```

## Exemplos de Razões

### Rejeições (rejected)

- `"B → A transition blocked"` - Operador trabalhou B ontem, não pode trabalhar A hoje
- `"ENC cannot work INT"` - Coordenador não pode trabalhar turno intermediário
- (outros motivos específicos da regra violada)

### Seleções (selected)

- `"assigned to shift"` - Atribuído ao turno (resultado de fairness)
- `"fairness: imbalance=5, worked=8"` - Selecionado por critério de fairness com métricas

## Performance

O sistema de debug é **opcional** e sem overhead quando desativado:
- Quando `debug: false` (padrão): nenhum log é gerado, sem custo de performance
- Quando `debug: true`: logs são coletados durante a execução

## Casos de Uso

1. **Debugging de violações**: Entender por que uma regra foi violada
2. **Análise de fairness**: Ver como o algoritmo balanço as alocações
3. **Validação de regras**: Confirmar que as regras de negócio estão sendo aplicadas corretamente
4. **Testes e CI/CD**: Adicionar assertions sobre decisões esperadas

## Exemplo Completo

```typescript
import { generateSchedule } from "@/lib/scheduler";

const input = {
  year: 2025,
  month: 1,
  scenario: "operacional",
  employees: [...],
  absences: [],
  holidays: []
};

const result = generateSchedule(input, { debug: true });

// Analisar decisões
if (result.debug) {
  // Por dia e turno
  for (let day = 1; day <= 31; day++) {
    for (const shift of ["A", "INT", "B"] as const) {
      const decisions = result.debug.decisions.filter(
        d => d.day === day && d.shift === shift
      );
      
      const selected = decisions.filter(d => d.action === "selected");
      const rejected = decisions.filter(d => d.action === "rejected");
      
      console.log(`Dia ${day} - ${shift}: ${selected.length} selecionados, ${rejected.length} rejeitados`);
    }
  }
  
  // Encontrar decisões específicas
  const empDecisions = result.debug.decisions.filter(d => d.employeeId === "emp-123");
  console.log(`Operador emp-123: ${empDecisions.length} decisões`);
}
```

## Notas Técnicas

- Logs são apenas informativos, não afetam o resultado
- Ordem dos logs reflete a ordem de decisão do algoritmo
- Performance negligenciável quando desativado
- Estrutura extensível para futuros atributos de debug
