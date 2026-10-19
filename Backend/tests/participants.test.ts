import { describe, expect, test } from "bun:test";
import { participantIds } from "../src/services/admin/participants";
describe("participantes de administración", () => {
  test("excluye todos los administradores y conserva perfiles antiguos", () => {
    expect(participantIds(["admin-a", "user", "admin-b", "legacy"], [
      { id: "admin-a", role: "admin" }, { id: "admin-b", role: "admin" },
      { id: "user", role: "user" }, { id: "orphan" }
    ])).toEqual(["legacy", "orphan", "user"]);
  });
  test("una promoción cambia los participantes y una revocación los recupera", () => {
    expect(participantIds(["a"], [{ id: "a", role: "user" }])).toEqual(["a"]);
    expect(participantIds(["a"], [{ id: "a", role: "admin" }])).toEqual([]);
    expect(participantIds(["a"], [{ id: "a", role: "user" }])).toEqual(["a"]);
  });
});
