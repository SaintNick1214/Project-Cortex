import { expect, it } from "@jest/globals";
import { parseNpmPackFilename } from "../npm-pack.js";
const expected={name:"@cortexmemory/sdk",version:"0.38.0"};
const entry={...expected,id:"@cortexmemory/sdk@0.38.0",filename:"cortexmemory-sdk-0.38.0.tgz"};
it.each([{value:[entry]},{value:{[expected.name]:entry}}])("accepts the exact observed npm array/object ABI: %j",({value})=>{
  expect(parseNpmPackFilename(JSON.stringify(value),expected)).toBe(entry.filename);
});
it.each([
  [],[entry,entry],null,"text",{}, {[expected.name]:[entry]}, {other:entry},
  [{...entry,name:"other"}],[{...entry,version:"0.37.0"}],[{...entry,id:"@cortexmemory/sdk@0.37.0"}],
  [{...entry,filename:"../escape.tgz"}],[{...entry,filename:"/absolute.tgz"}],[{...entry,filename:"nested\\escape.tgz"}],
  [{...entry,filename:".hidden.tgz"}],[{...entry,filename:"sdk.zip"}],[{...entry,filename:null}],
].map(value=>({value})))("refuses ambiguous, substituted or unsafe pack metadata: %j",({value})=>{
  expect(()=>parseNpmPackFilename(JSON.stringify(value),expected)).toThrow("NPM_PACK_RESULT_INVALID");
});
it("refuses diagnostic-prefixed and oversized output without echoing its contents",()=>{
  for(const value of ["diagnostic\n"+JSON.stringify([entry]),"x".repeat(4*1024*1024+1)])
    expect(()=>parseNpmPackFilename(value,expected)).toThrow("NPM_PACK_RESULT_INVALID");
});
