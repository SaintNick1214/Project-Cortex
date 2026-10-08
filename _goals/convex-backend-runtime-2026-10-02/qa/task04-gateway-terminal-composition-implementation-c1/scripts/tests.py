from pathlib import Path
s=Path('tests/unit/runtime/gateway-dispatch.test.ts').read_text()
s=s.replace('/** Credential-free native peers and official injected-fetch transform fixtures only.','/** CURRENT atomic composition: actual product import, adapted unaffected outcome regressions.\n * Historical assertions remain byte-exact in gateway-dispatch.test.ts. Credential-free peers only.')
s=s.replace('let ledgerSettled = false;', '''let ledgerSettled = false;
  const accounting = { settledUnits: 0, uncertainUnits: 10000, activeSlots: 1, attached: undefined as string | undefined, outputVisible: false }; const attachments: Parameters<GatewayLedgerPort["attachTerminalResult"]>[0][] = [];''')
a=s.index('    settle: async');b=s.index('\n  };',a)
s=s[:a]+'''    attachTerminalResult: async (args) => { events.push("attach"); attachments.push(args);
      if (revoked || !ledgerSettled) return { attached: false, resultWithheld: true };
      accounting.attached = args.privateResultCanonical; accounting.outputVisible = true;
      return { attached: true, resultWithheld: false }; },'''+s[b:]
s=s.replace('receipts.push(e.receiptCanonical); return { evidenceId: "durable-evidence" };', '''receipts.push(e.receiptCanonical); const receipt = JSON.parse(e.receiptCanonical) as { costSource: string; aggregateCostUsd?: string };
      ledgerSettled = receipt.costSource !== "unavailable"; accounting.activeSlots = 0;
      accounting.uncertainUnits = ledgerSettled ? 0 : 10000; accounting.settledUnits = ledgerSettled ? Math.ceil(Number(receipt.aggregateCostUsd) * 1e6) : 0;
      return { evidenceId: "durable-evidence" };''')
s=s.replace('return { r, b, events, receipts, admissions,','return { r, b, events, receipts, accounting, attachments, admissions,')
s=s.replace('["admit", "checkpoint", "native", "capture", "visible", "settle"]','["admit", "checkpoint", "native", "capture", "attach"]')
s=s.replace('captures known charge durably before revocation denies ordinary settle','captures known charge durably before revocation withholds current attachment')
s=s.replace('code: "TERMINAL_RECONCILIATION_PENDING" }); expect(f.receipts).toHaveLength(1); expect(f.events).toEqual(["admit", "checkpoint", "native", "capture", "attach"])','code: "TERMINAL_RESULT_WITHHELD" }); expect(f.receipts).toHaveLength(1); expect(f.events).toEqual(["admit", "checkpoint", "native", "capture", "attach"])')
s=s.replace('expect(f.events).toContain("settle"); expect(f.events).not.toContain("visible")','expect(f.events).not.toContain("attach"); expect(f.events).not.toContain("visible")')
s=s.replace('release.resolve(); await pause(0); expect(await h.lifecycle.retryPendingTerminalEvidence()).toBe(true);','release.resolve(); await pause(0); expect(await h.lifecycle.retryPendingTerminalEvidence()).toBe(false);')
s=s.replace('ledger.settle','ledger.attachTerminalResult').replace('x === "settle"','x === "attach"')
a=s.index('  it("cancel while terminal visibility');b=s.index('  it("cancel while settlement',a)
s=s[:a]+'''  it("cancel during capture retains full charge and never issues private attachment", async () => {
    const f = fixture(); const entered = gate<void>(); const release = gate<void>(); const prior = f.composition.terminalSink.capture;
    f.composition.terminalSink.capture = async (args) => { const result = await prior(args); entered.resolve(); await release.promise; return result; };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const operation = h.model.doGenerate(params()); const rejected = expect(operation).rejects.toMatchObject({ code: "RUN_CANCELLED" });
    await entered.promise; h.lifecycle.cancel(); release.resolve(); await rejected;
    expect(f.accounting).toEqual({ settledUnits: 500, uncertainUnits: 0, activeSlots: 0, attached: undefined, outputVisible: false });
    expect(f.attachments).toEqual([]); expect(f.count()).toBe(1);
  });
'''+s[b:]
a=s.index('describe("C2 terminal visibility');b=s.index('describe("C2 replay',a)
s=s[:a]+'''describe("original terminal capture and attachment share a single persistence deadline", () => {
  it("capture consumes the budget and attachment receives only the remaining time", async () => {
    const f = fixture(); f.composition.ownedTiming = { ...shortOwnedTiming, terminalPersistenceMs: 80 };
    const release = gate<void>(); const entered = gate<void>(); const prior = f.composition.terminalSink.capture;
    f.composition.terminalSink.capture = async (args) => { await pause(50); return prior(args); };
    f.composition.ledger.attachTerminalResult = async () => { entered.resolve(); await release.promise; return { attached: true, resultWithheld: false }; };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const start = Date.now();
    const operation = h.model.doGenerate(params()); const rejected = expect(operation).rejects.toMatchObject({ code: "TERMINAL_RECONCILIATION_PENDING" });
    await entered.promise; await rejected; expect(Date.now() - start).toBeLessThan(125);
    expect(f.accounting.settledUnits).toBe(500); expect(h.lifecycle.pendingWork().settlement).toBe(1);
    release.resolve(); await pause(0); expect(await h.lifecycle.retryPendingTerminalAttachment()).toBeUndefined(); expect(f.count()).toBe(1);
  });
});

'''+s[b:]
Path('tests/unit/runtime/gateway-terminal-composition.test.ts').write_text(s)
