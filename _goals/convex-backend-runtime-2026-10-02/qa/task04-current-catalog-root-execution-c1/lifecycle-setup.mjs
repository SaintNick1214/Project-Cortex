import '../task04-current-catalog-release-c4/offline-guard.mjs';
import {version} from 'convex';
import assert from 'node:assert/strict';
globalThis.__offlineLifecycleCounts={constructed:0,closed:0,sent:0,realTransports:0};
globalThis.WebSocket=class {
  static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3;
  readyState=0;
  _open; _openRegistrations=0;
  get onopen(){return this._open;}
  set onopen(handler){this._open=handler;this._openRegistrations++;assert.ok(this._openRegistrations<=2);if(this._openRegistrations===2)queueMicrotask(()=>{this.readyState=1;this._open?.({});});}
  constructor(url){assert.equal(url,`wss://example.convex.cloud/api/${version}/sync`);globalThis.__offlineLifecycleCounts.constructed++;}
  close(){globalThis.__offlineLifecycleCounts.closed++;this.readyState=3;queueMicrotask(()=>this.onclose?.({code:1000,reason:'DUMMY_OFFLINE_CLOSE',wasClean:true}));}
  send(){globalThis.__offlineLifecycleCounts.sent++;throw new Error('OFFLINE_LIFECYCLE_SEND_FORBIDDEN');}
};
