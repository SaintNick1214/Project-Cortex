import {afterAll,expect} from '@jest/globals';
afterAll(()=>{expect(globalThis.__offlineLifecycleCounts).toEqual({constructed:1,closed:1,sent:0,realTransports:0});});
