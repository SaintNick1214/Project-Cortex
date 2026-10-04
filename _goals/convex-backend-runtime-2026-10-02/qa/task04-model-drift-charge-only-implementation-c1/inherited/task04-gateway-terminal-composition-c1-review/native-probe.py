import pathlib,json,subprocess,os,datetime,hashlib
root=pathlib.Path('/workspace/Project-Cortex');qa=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-gateway-terminal-composition-c1-review';work=root/'work/resume/task04-gateway-terminal-composition-c1-review';src=(root/'tests/unit/runtime/model-policy-admission.test.ts').read_text();src=src.replace('../../../',str(root)+'/').replace('"../runtimeMemory/fixture"','"'+str(root)+'/tests/unit/runtimeMemory/fixture"')
src+='''
// REVIEWER offline source-to-source adapter probe; synthetic observation, not provider money/OCC.
it("reviewer actual Gateway receipt reaches real capture identity rejection without any accounting writes", async () => {
  root.dispatchEvidence[0]!.providerVersion = "0.2.1";
  const f = fixture(); await f.install(); const b = await f.bind();
  const { governGatewayLanguageModel } = await import("/workspace/Project-Cortex/convex-dev/runtimeGateway");
  const binding = { reference: f.reference, operationKey: "agent.respond" as const, runBudgetId: b.runBudgetId, semanticId: "semantic", ordinal: 0 };
  const resolution = await f.invoke<any>("resolve", { reference: f.reference, operationKey: "agent.respond", runBudgetId: b.runBudgetId });
  const receipts: string[] = []; let beforeCapture = ""; let writes = 0; let attemptId = ""; let nativeCalls = 0; let attachments = 0;
  const composition: any = { now: () => clock, ledger: {
    resolve: (args: unknown) => f.invoke("resolve", args), admit: (args: unknown) => f.invoke("admit", args), checkpoint: (args: unknown) => f.invoke("checkpoint", args), markVisible: (args: unknown) => f.invoke("markVisible", args),
    attachTerminalResult: (args: unknown) => { attachments++; return f.invoke("attachTerminalResult", args); },
  }, terminalSink: { capture: (args: any) => { receipts.push(args.receiptCanonical); beforeCapture = JSON.stringify([...f.db.rows]); writes=f.db.writes; attemptId=args.attemptId; return f.invoke("captureTerminalEvidence",args); } } };
  const model: any = { specificationVersion: "v4", modelId: "openai/gpt-4o-mini", provider: "convexGateway.chat", supportedUrls: {}, doStream: async () => {throw Error("unused");},
    doGenerate: async () => {nativeCalls++; return {content:[{type:"text",text:"answer"}],finishReason:{unified:"stop",raw:"stop"},usage:{inputTokens:{total:15},outputTokens:{total:2}},warnings:[],response:{body:{id:"truthful-observation",model:"foreign/model",choices:[{finish_reason:"stop"}],usage:{prompt_tokens:15,completion_tokens:2,total_tokens:17,cost:"0.000150"}}}};}
  };
  const h = governGatewayLanguageModel(model,composition,binding,resolution);
  await expect(h.model.doGenerate({prompt:[{role:"user",content:[{type:"text",text:"hello"}]}],maxOutputTokens:20})).rejects.toMatchObject({code:"TERMINAL_CAPTURE_PENDING"});
  expect(receipts).toHaveLength(1); expect(JSON.parse(receipts[0]!)).toMatchObject({actualModel:"foreign/model",modelId:"openai/gpt-4o-mini",aggregateCostUsd:"0.000150",proof:"provider-terminal-v1"});
  expect(JSON.stringify([...f.db.rows])).toBe(beforeCapture);expect(f.db.writes).toBe(writes);expect(f.attempt(attemptId)).toMatchObject({state:"dispatch_pending",slotReleased:false});
  expect(f.account("tenant")).toMatchObject({reservedUnits:100,settledUnits:0,activeConcurrency:1});expect(attachments).toBe(0);expect(nativeCalls).toBe(1);
  await expect(h.lifecycle.complete()).rejects.toMatchObject({code:"TERMINAL_CAPTURE_PENDING"});
});
'''
(qa/'native-adapter-probe.test.ts').write_text(src)
c=json.loads((qa/'jest.current.json').read_text());c['roots']=[str(qa)];c['testMatch']=[str(qa/'native-adapter-probe.test.ts')];c['resolver']=str(qa/'native-probe-resolver.cjs');(qa/'jest.native-probe.json').write_text(json.dumps(c,indent=2)+'\n')
(qa/'native-probe-resolver.cjs').write_text('''const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');module.exports=(request,options)=>{const resolved=['./profile.js','./extraction.js'].includes(request)&&options.basedir==='/workspace/Project-Cortex/src/domain'?options.defaultResolver(request.slice(0,-3)+'.ts',options):options.defaultResolver(request,options);if(path.isAbsolute(resolved)){fs.appendFileSync(__dirname+'/native-imports.ndjson',JSON.stringify({request,resolved,sha256:crypto.createHash('sha256').update(fs.readFileSync(resolved)).digest('hex')})+'\\n');}return resolved;};''')
node='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node';env={'PATH':str(root/'work/resume/toolchain-bin')+':'+str(pathlib.Path(node).parent)+':/usr/bin:/bin','TMPDIR':str(work),'NO_COLOR':'1'}
argv=[node,'--experimental-vm-modules',str(root/'node_modules/jest/bin/jest.js'),'--config',str(qa/'jest.native-probe.json'),'--runInBand','--no-cache','--json','--outputFile',str(qa/'native-probe-results.json')];start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(argv,cwd=root,env=env,capture_output=True,text=True,timeout=60);(qa/'native-probe.stdout').write_text(p.stdout);(qa/'native-probe.stderr').write_text(p.stderr);(qa/'native-probe-execution.json').write_text(json.dumps(dict(argv=argv,cwd=str(root),environment=env,startUTC=start,endUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),exit=p.returncode),indent=2)+'\n');print(p.returncode,p.stderr[-1500:])
