import {describe,it,expect,jest} from '@jest/globals';
import {VectorAPI} from '../../src/vector';
const input={content:'scope fixture',contentType:'raw' as const,source:{type:'system' as const,timestamp:1},metadata:{importance:50,tags:[]}};
describe('vector.store constructor scope admission',()=>{
 it.each([{configured:'A',explicit:undefined,expected:'A'},{configured:'A',explicit:'A',expected:'A'},{configured:undefined,explicit:'B',expected:'B'},{configured:undefined,explicit:undefined,expected:undefined}])('stores exact configured/explicit tenant (%p)',async({configured,explicit,expected})=>{
  const mutation=jest.fn<(...args:unknown[])=>Promise<unknown>>().mockResolvedValue({_id:'physical',memoryId:'logical'}),api=new VectorAPI({mutation} as never,undefined,undefined,configured?{tenantId:configured,userId:'user'}:undefined);
  await api.store('space',{...input,tenantId:explicit},{syncToGraph:false});expect(mutation).toHaveBeenCalledTimes(1);expect((mutation.mock.calls[0][1] as {tenantId?:string}).tenantId).toBe(expected);
 });
 it('conflicting explicit tenant refuses before resilience, primary callback or graph effects',async()=>{
  const mutation=jest.fn(),execute=jest.fn(),managedTransaction=jest.fn(),api=new VectorAPI({mutation} as never,{managedTransaction} as never,{execute} as never,{tenantId:'A',userId:'user'});
  await expect(api.store('space',{...input,tenantId:'B'})).rejects.toThrow(/tenant/i);expect(mutation).not.toHaveBeenCalled();expect(execute).not.toHaveBeenCalled();expect(managedTransaction).not.toHaveBeenCalled();
 });
});
