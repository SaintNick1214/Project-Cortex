import {describe,it,expect} from '@jest/globals';
import {graphRebuildPages} from '../../src/graph/sync/batchSync';
import type {GraphRebuildRange} from '../../src/graph/rebuildTransport';
const page=(values:unknown[],cursor:string,done:boolean,extra:Record<string,unknown>={})=>({schemaVersion:2,page:values,continueCursor:cursor,isDone:done,...extra});
const collect=async(load:(range:GraphRebuildRange)=>Promise<unknown>)=>{const result:unknown[]=[];for await(const p of graphRebuildPages(load))result.push(...p.page);return result;};
describe('native rebuild page protocol preserves complete ranges',()=>{
 it('discards provisional SplitRequired values and exhausts left/right ranges',async()=>{
  const calls:GraphRebuildRange[]=[];
  const result=await collect(async range=>{calls.push(range);if(range.cursor===null&&range.endCursor===null)return page(['provisional'],'unused',false,{pageStatus:'SplitRequired',splitCursor:'middle'});if(range.cursor===null)return page(['first'],'middle',false);return page(['last'],'end',true);});
  expect(result).toEqual(['first','last']);expect(calls.map(({cursor,endCursor})=>[cursor,endCursor])).toEqual([[null,null],[null,'middle'],['middle',null]]);
 });
 it('nested split does not omit the unsplit right tail',async()=>{
  const result=await collect(async range=>{if(range.cursor===null&&range.endCursor===null)return page([],'unused',false,{pageStatus:'SplitRequired',splitCursor:'b'});if(range.cursor===null&&range.endCursor==='b')return page(['discard'],'unused',false,{pageStatus:'SplitRequired',splitCursor:'a'});if(range.cursor===null)return page(['left'],'a',false);if(range.cursor==='a')return page(['middle'],'b',false);return page(['right'],'end',true);});expect(result).toEqual(['left','middle','right']);
 });
 it('an empty advancing page and SplitRecommended retain later selected rows',async()=>{
  let loads=0;const result=await collect(async range=>{loads++;if(range.cursor===null)return page([],'after-empty',false);if(range.cursor==='after-empty')return page(['first'],'after-first',false,{pageStatus:'SplitRecommended',splitCursor:'after-first'});return page(['last'],'end',true);});expect(result).toEqual(['first','last']);expect(loads).toBe(3);
 });
 it('empty terminal pages honestly exhaust a new scope',async()=>{expect(await collect(async()=>page([],'end',true))).toEqual([]);});
 it('nonadvancing pages refuse instead of spinning or claiming completion',async()=>{await expect(collect(async range=>page([],range.cursor??'',false))).rejects.toMatchObject({code:'GRAPH_REBUILD_NONADVANCING_CURSOR'});});
 it('a cyclic cursor refuses after retaining only previously observed pages',async()=>{
  const observed:unknown[]=[];try{for await(const p of graphRebuildPages(async range=>range.cursor===null?page(['first'],'a',false):range.cursor==='a'?page(['second'],'b',false):page([],'a',false)))observed.push(...p.page);throw Error('unexpected completion');}catch(error){expect(error).toMatchObject({code:'GRAPH_REBUILD_NONADVANCING_CURSOR'});}expect(observed).toEqual(['first','second']);
 });
 it('a late transport failure propagates without replaying already consumed ranges',async()=>{
  const calls:GraphRebuildRange[]=[];const observed:unknown[]=[];const failure=Error('selected native request failed');try{for await(const p of graphRebuildPages(async range=>{calls.push(range);if(range.cursor===null)return page(['confirmed'],'next',false);throw failure;}))observed.push(...p.page);throw Error('unexpected completion');}catch(error){expect(error).toBe(failure);}expect(observed).toEqual(['confirmed']);expect(calls.map(v=>v.cursor)).toEqual([null,'next']);
 });
 it('a split equal to its range boundary refuses before accepting its provisional rows',async()=>{await expect(collect(async()=>page(['provisional'],'end',false,{pageStatus:'SplitRequired',splitCursor:''}))).rejects.toMatchObject({code:'GRAPH_REBUILD_INVALID_PAGE'});});
});
