from pathlib import Path
import hashlib,json,re,shutil,datetime
root=Path('/workspace/Project-Cortex');q=root/'_goals/convex-backend-runtime-2026-10-02/qa/task04-native-error-boundary-repair';w=root/'work/resume/task04-native-error-boundary-repair-01'
h=lambda b:hashlib.sha256(b).hexdigest()
before=(q/'pre-edit/model-policy-admission.test.ts').read_bytes();final=(root/'tests/unit/runtime/model-policy-admission.test.ts').read_bytes();assert final.startswith(before)
archive=q/'source-versions';archive.mkdir(exist_ok=True)
current=final.decode();extra=current[current.index('  it.each(["CAPABILITY_UNSUPPORTED"'):current.index('  it("checkpoint changed canonical')];noextra=current.replace(extra,'')
typed='''// Installed private registration runtime has no declaration entrypoint.
    const registrationImplPath = "../../../node_modules/convex/dist/esm/server/impl/registration_impl.js";
    const { invokeFunction } = await import(registrationImplPath) as {
      invokeFunction: (handler: Registration["_handler"], ctx: MutationCtx, args: [unknown]) => Promise<unknown>;
    };'''
sourceimport='const { invokeFunction } = await import("../../../node_modules/convex/src/server/impl/registration_impl");'
fixed=noextra.replace(typed,sourceimport)
early=fixed.replace('f.attempt(a.attemptId).canonical = canonicalModelJson({ forcedCollision: "different canonical with original hash" });','const collision = Uint8Array.from(Buffer.from(f.attempt(a.attemptId).hash, "hex")).buffer;\n    jest.spyOn(globalThis.crypto.subtle, "digest").mockResolvedValue(collision);').replace('await denial(() => f.admit(b), "IDEMPOTENCY_CONFLICT");','await denial(() => f.admit(b, 0, "collision private input"), "IDEMPOTENCY_CONFLICT");')
early=early.replace('''const { f, a } = await admitted();
    f.attempt(a.attemptId).canonical = canonicalModelJson({ forcedCollision: "checkpoint canonical mismatch" });
    const before = state(f), writes = f.db.writes;
    await denial(() => f.checkpoint(a), "IDEMPOTENCY_CONFLICT");''','''const { f, a } = await admitted(); const before = state(f), writes = f.db.writes;
    const changed = JSON.parse(a.requestCanonical) as ModelCallRequest; changed.outputTokens++;
    await denial(() => f.invoke("checkpoint", { reference: f.reference, attemptId: a.attemptId, requestCanonical: canonicalModelJson(changed) }), "IDEMPOTENCY_CONFLICT");''').replace('invokeFunction(registration._handler, f.ctx, [{ reference: f.reference,','invokeFunction(registration._handler, f.ctx, { reference: f.reference,').replace('requestCanonical: canonicalModelJson(request("changed private input")) }]); } catch','requestCanonical: canonicalModelJson(request("changed private input")) }); } catch')
versions=[before,final,noextra.encode(),fixed.encode(),early.encode(),early.replace('../../../node_modules/convex/src/server/impl/registration_impl','../../../node_modules/convex/dist/esm/server/impl/registration_impl.js').encode()]
for data in versions:(archive/(h(data)+'.test.ts')).write_bytes(data)
for p in [root/'convex-dev/runtimeModelPolicy.ts',q/'pre-edit/runtimeModelPolicy.ts']:
 data=p.read_bytes();(archive/(h(data)+'.backend.ts')).write_bytes(data)
matched={}
for path in sorted(q.glob('*/receipt.json')):
 rec=json.loads(path.read_text());sha=rec['sourceBefore']['tests/unit/runtime/model-policy-admission.test.ts'];matched[path.parent.name]={'testPreimageArchived':(archive/(sha+'.test.ts')).exists(),'sourcesStableDuringRun':rec['sourceBefore']==rec['sourceAfter'],'exitCode':rec['exitCode']}
assert all(v['testPreimageArchived'] for v in matched.values()),matched
original=(q/'red03-result.json').read_text();red=json.loads(original);green=json.loads((q/'accepted-deps-result.json').read_text())
oldtest=next(t for t in red['testResults'] if t['name'].endswith('model-policy-admission.test.ts'));newtest=next(t for t in green['testResults'] if t['name'].endswith('model-policy-admission.test.ts'))
originalnames=[a['fullName'] for a in oldtest['assertionResults'][:64]];assert len(originalnames)==64;newmap={a['fullName']:a for a in newtest['assertionResults']};assert all(newmap[n]['status']=='passed' for n in originalnames)
(q/'retention-map.json').write_text(json.dumps({'originalBytes':len(before),'originalSHA256':h(before),'exactBytePrefixPreserved':True,'original64Assertions':[{'fullName':n,'finalStatus':newmap[n]['status']} for n in originalnames]},indent=2))
pre=(q/'pre-edit/runtimeModelPolicy.ts').read_text();post=(root/'convex-dev/runtimeModelPolicy.ts').read_text();registrations=lambda s:re.findall(r'export const (\w+) = (internal(?:Mutation|Query))\(',s);assert registrations(pre)==registrations(post);assert len(registrations(post))==14
(q/'inventory.json').write_text(json.dumps({'registrationsUnchanged':True,'internalRegistrationCount':14,'registrations':registrations(post),'attempts':matched,'finalSources':json.loads((q/'accepted-deps/receipt.json').read_text())['sourceAfter'],'nativePass':False},indent=2))
conf=q/'check-inputs';conf.mkdir(exist_ok=True)
for path in w.iterdir():
 if path.is_file():shutil.copyfile(path,conf/path.name)
print(json.dumps({'retention':True,'registrationCount':14,'attempts':matched},indent=2))
