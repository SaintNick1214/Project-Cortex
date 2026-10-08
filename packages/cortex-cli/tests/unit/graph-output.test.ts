import {jest,describe,test,expect,afterEach} from '@jest/globals';
import {printGraphResult} from '../../src/commands/graph.js';
import {printInstallResult} from '../../src/commands/install.js';
const graph={provider:'memgraph' as const,mode:'local' as const,projectPath:'/selected',uri:'bolt://127.0.0.1:48423',status:'ready' as const,environmentSource:'.cortex/graph/credentials.json',sdkActivation:'Load the private selected map; enable CORTEX_GRAPH_SYNC=true and call Cortex.create with graphConnection.type set to the selected provider.'};
afterEach(()=>jest.restoreAllMocks());
describe('graph setup activation guidance and clean output',()=>{
 test('normal graph and installer output explain how the saved configuration enables the SDK',()=>{const log=jest.spyOn(console,'log').mockImplementation(()=>{});printGraphResult(graph,{});expect(log.mock.calls.flat().join('\n')).toContain('Cortex.create');expect(log.mock.calls.flat().join('\n')).toContain('graphConnection.type');log.mockClear();printInstallResult({projectPath:'/selected',sdkVersion:'0.37.0',convexVersion:'1.46.0',deployment:'staged',graph},{});expect(log.mock.calls.flat().join('\n')).toContain('memgraph graph ready');expect(log.mock.calls.flat().join('\n')).toContain('CORTEX_GRAPH_SYNC');});
 test('JSON remains exactly one parseable receipt and quiet is silent',()=>{const log=jest.spyOn(console,'log').mockImplementation(()=>{});printGraphResult(graph,{format:'json'});expect(log).toHaveBeenCalledTimes(1);expect(JSON.parse(String(log.mock.calls[0][0]))).toEqual(graph);log.mockClear();printGraphResult(graph,{quiet:true});printInstallResult({graph},{quiet:true});expect(log).not.toHaveBeenCalled();});
});
