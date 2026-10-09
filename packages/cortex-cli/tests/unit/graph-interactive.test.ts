import { jest, test, expect, beforeEach } from "@jest/globals";
const prompt = jest.fn<(...args: unknown[]) => Promise<Record<string, unknown>>>();
jest.unstable_mockModule("prompts", () => ({ default: prompt }));
const { resolveInteractiveGraph } = await import("../../src/utils/graph/interactive.js");
const tty = { stdinTTY: true, stdoutTTY: true };
beforeEach(() => prompt.mockReset());
test.each([
  [{}, { yes: true }, tty], [{}, { quiet: true }, tty],
  [{}, { format: "json" }, tty], [{}, { format: "csv" }, tty],
  [{}, {}, { ...tty, stdinTTY: false }], [{}, {}, { ...tty, stdoutTTY: false }],
  [{ graph: "none" }, {}, { ...tty, graphExplicit: true }],
  [{ skipGraph: true }, {}, tty],
] as const)("deterministic selection never prompts %#", async (selected, output, interaction) => {
  expect(await resolveInteractiveGraph(selected, output, interaction)).toEqual(selected);
  expect(prompt).not.toHaveBeenCalled();
});
test("guided local choice retains selected ports and private password", async () => {
  for (const value of ["memgraph", "local", "cortexadmin", "synthetic-private-password"])
    prompt.mockResolvedValueOnce({ value });
  const result = await resolveInteractiveGraph({ boltPort: 48423 }, {}, tty);
  expect(result).toEqual({ graph: "memgraph", graphMode: "local", boltPort: 48423,
    credentials: { username: "cortexadmin", password: "synthetic-private-password" } });
  expect((prompt.mock.calls[3][0] as { type: string }).type).toBe("password");
});
test("guided existing choice has explicit URI and private credentials", async () => {
  for (const value of ["neo4j", "existing", "bolt://127.0.0.1:48422", "neo4j", "synthetic-password"])
    prompt.mockResolvedValueOnce({ value });
  const result = await resolveInteractiveGraph({}, {}, tty);
  expect(result.graphMode).toBe("existing");
  expect(result.graphUri).toBe("bolt://127.0.0.1:48422");
  expect(prompt).toHaveBeenCalledTimes(5);
});
test("explicit provider/file uses shared mode choice without private re-prompt", async () => {
  prompt.mockResolvedValueOnce({ value: "local" });
  expect((await resolveInteractiveGraph({ graph: "neo4j", credentialsFile: "private.json" }, {},
    { ...tty, graphExplicit: true })).graphMode).toBe("local");
  expect(prompt).toHaveBeenCalledTimes(1);
});
test("None returns clean off choice", async () => {
  prompt.mockResolvedValueOnce({ value: "none" });
  expect(await resolveInteractiveGraph({}, {}, tty)).toEqual({ graph: "none" });
  expect(prompt).toHaveBeenCalledTimes(1);
});
test.each([0, 1, 2, 3, 4])("cancellation before any consumer effect at step %i", async (step) => {
  const values = ["neo4j", "existing", "bolt://127.0.0.1:48422", "neo4j", "synthetic-password"];
  for (let i = 0; i < step; i++) prompt.mockResolvedValueOnce({ value: values[i] });
  prompt.mockResolvedValueOnce({});
  await expect(resolveInteractiveGraph({}, {}, tty)).rejects.toThrow("GRAPH_PROMPT_CANCELLED");
  expect(prompt).toHaveBeenCalledTimes(step + 1);
});
test("SIGINT prompt cancellation throws instead of resolving None", async () => {
  prompt.mockImplementationOnce(async (_question, options) => {
    (options as { onCancel: () => void }).onCancel(); return {};
  });
  await expect(resolveInteractiveGraph({}, {}, tty)).rejects.toThrow("GRAPH_PROMPT_CANCELLED");
});
