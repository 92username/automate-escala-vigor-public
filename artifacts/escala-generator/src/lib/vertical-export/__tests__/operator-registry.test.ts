import { describe, expect, it } from "vitest";
import {
  VERTICAL_OPERATOR_REGISTRY,
  createVerticalOperatorRegistry,
  deactivateOperator,
  findOperatorByCode,
  findOperatorsByName,
  listActiveOperators,
  upsertOperator,
} from "../operator-registry";

describe("vertical operator registry", () => {
  it("looks up operators by code", () => {
    const operator = findOperatorByCode("a04");

    expect(operator).toEqual(
      expect.objectContaining({
        code: "A04",
        name: "William",
        group: "A",
        active: true,
        status: "active",
      }),
    );
  });

  it("looks up operators by name", () => {
    const matches = findOperatorsByName("  william  ");

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual(
      expect.objectContaining({
        code: "A04",
        name: "William",
      }),
    );
  });

  it("ignores trailing JG identifiers for clear official-name matches", () => {
    expect(findOperatorsByName("7000001 - GUILHERME - JG00001")).toEqual([
      expect.objectContaining({ code: "B08" }),
    ]);
    expect(findOperatorsByName("7000002 - LUIZ - JG00002")).toEqual([
      expect.objectContaining({ code: "B09" }),
    ]);
  });

  it("matches controlled aliases used by the operational spreadsheet", () => {
    expect(findOperatorsByName("7000003 - LEANDRO")).toEqual([expect.objectContaining({ code: "C02" })]);
    expect(findOperatorsByName("7000004 - CLAUDIUS")).toEqual([
      expect.objectContaining({ code: "A06" }),
    ]);
    expect(findOperatorsByName("7000005 - ROGERIO")).toEqual([
      expect.objectContaining({ code: "A07" }),
    ]);
    expect(findOperatorsByName("7000006 - BRUNO")).toEqual([
      expect.objectContaining({ code: "A08" }),
    ]);
    expect(findOperatorsByName("7000007 - LUIS - JG00003")).toEqual([
      expect.objectContaining({ code: "B07" }),
    ]);
  });

  it("supports editing and deactivating registry entries immutably", () => {
    const registry = createVerticalOperatorRegistry();
    const updated = upsertOperator(registry, {
      code: "B10",
      name: "NOVO OPERADOR",
      group: "B",
    });
    const deactivated = deactivateOperator(updated, "B10");

    expect(registry).toHaveLength(VERTICAL_OPERATOR_REGISTRY.length);
    expect(updated).toHaveLength(VERTICAL_OPERATOR_REGISTRY.length + 1);
    expect(findOperatorByCode("B10", updated)).toEqual(
      expect.objectContaining({
        code: "B10",
        name: "NOVO OPERADOR",
        group: "B",
        active: true,
        status: "active",
      }),
    );
    expect(findOperatorByCode("B10", deactivated)).toEqual(
      expect.objectContaining({
        code: "B10",
        active: false,
        status: "inactive",
      }),
    );
    expect(listActiveOperators(deactivated)).not.toContainEqual(
      expect.objectContaining({ code: "B10" }),
    );
  });
});
