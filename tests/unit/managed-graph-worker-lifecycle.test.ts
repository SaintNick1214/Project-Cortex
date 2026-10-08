import {describe,it,expect,jest,beforeEach} from '@jest/globals';
import type {GraphAdapter} from '../../src/graph/types';
let release:()=>void;let readiness:Promise<void>;
const schema=jest.fn<()=>Promise<void>>(()=>readiness);
jest.unstable_mockModule('../../src/graph/schema/initSchema',()=>({assertManagedGraphCompatibility:schema}));
const {GraphSyncWorker}=await import('../../src/graph/worker/GraphSyncWorker');
beforeEach(()=>{readiness=new Promise<void>(resolve=>{release=resolve;});jest.clearAllMocks();});
describe('public worker startup/stop lifetime',()=>{
 it('stop joins an in-flight schema check and prevents a late subscription',async()=>{
  const onUpdate=jest.fn(),worker=new GraphSyncWorker({onUpdate} as never,{} as GraphAdapter);
  const starting=worker.start();let stopped=false;const stopping=worker.stop().then(()=>{stopped=true;});
  await Promise.resolve();expect(stopped).toBe(false);expect(onUpdate).not.toHaveBeenCalled();
  release();await Promise.all([starting,stopping]);expect(stopped).toBe(true);expect(worker.getMetrics().isRunning).toBe(false);expect(onUpdate).not.toHaveBeenCalled();
 });
 it('concurrent start shares readiness; stopped worker can explicitly restart once',async()=>{
  const unsubscribe=jest.fn(),onUpdate=jest.fn(()=>unsubscribe),worker=new GraphSyncWorker({onUpdate} as never,{} as GraphAdapter);
  const first=worker.start(),second=worker.start();expect(schema).toHaveBeenCalledTimes(1);release();await Promise.all([first,second]);expect(onUpdate).toHaveBeenCalledTimes(1);
  await worker.stop();expect(unsubscribe).toHaveBeenCalledTimes(1);await worker.start();expect(onUpdate).toHaveBeenCalledTimes(2);await worker.stop();expect(unsubscribe).toHaveBeenCalledTimes(2);
 });
});
