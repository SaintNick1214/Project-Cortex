import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import {syncBuiltinESMExports} from 'node:module';
export function installNetworkGuards(){
 const denied=()=>{throw new Error('CURRENT_COMPOSITION_NETWORK_FORBIDDEN')};
 globalThis.fetch=async()=>denied();
 if('WebSocket' in globalThis)globalThis.WebSocket=class{constructor(){denied()}};
 for(const [target,names] of [[http,['request','get']],[https,['request','get']],[http2,['connect']],[net,['connect','createConnection']],[tls,['connect']],
  [net.Socket.prototype,['connect']],[tls.TLSSocket.prototype,['connect']],[http.Agent.prototype,['createConnection']],[https.Agent.prototype,['createConnection']],
  [net.Server.prototype,['listen']],[dgram.Socket.prototype,['connect','send','bind']]])for(const name of names)target[name]=denied;
 syncBuiltinESMExports();
}
installNetworkGuards();
