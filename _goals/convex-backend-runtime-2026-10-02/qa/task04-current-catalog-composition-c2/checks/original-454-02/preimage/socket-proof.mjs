import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import dgram from 'node:dgram';
import {pathToFileURL} from 'node:url';
const guard=process.argv[2];let transportCalls=0;
const stub=()=>{transportCalls++;return {}};
net.Socket.prototype.connect=stub;tls.TLSSocket.prototype.connect=stub;
net.connect=net.createConnection=tls.connect=http.request=http.get=https.request=https.get=http2.connect=stub;
http.Agent.prototype.createConnection=https.Agent.prototype.createConnection=stub;
net.Server.prototype.listen=dgram.Socket.prototype.send=dgram.Socket.prototype.bind=dgram.Socket.prototype.connect=stub;
globalThis.fetch=async()=>stub();
await import(pathToFileURL(guard).href+'?proof='+Date.now());
if(process.argv[3]==='legacy'){
 net.Socket.prototype.connect.call({});assert.equal(transportCalls,1);console.log(JSON.stringify({scope:'OWNED_STUB_TRANSPORT_ONLY',legacy:'DIRECT_SOCKET_BYPASS_REPRODUCED',transportCalls,realNetwork:0}));
}else{
 const cases=[['direct Socket.connect',()=>net.Socket.prototype.connect.call({})],['direct TLSSocket.connect',()=>tls.TLSSocket.prototype.connect.call({})],['net.connect',()=>net.connect()],['net.createConnection',()=>net.createConnection()],['tls.connect',()=>tls.connect()],['HTTP request',()=>http.request()],['HTTP get',()=>http.get()],['HTTPS request',()=>https.request()],['HTTPS get',()=>https.get()],['HTTP2 connect',()=>http2.connect()],['HTTP Agent transport',()=>http.Agent.prototype.createConnection.call({})],['HTTPS Agent transport',()=>https.Agent.prototype.createConnection.call({})],['server listen',()=>net.Server.prototype.listen.call({})],['UDP connect',()=>dgram.Socket.prototype.connect.call({})],['UDP send',()=>dgram.Socket.prototype.send.call({})],['UDP bind',()=>dgram.Socket.prototype.bind.call({})]];
 for(const [,call] of cases)assert.throws(call,/CURRENT_COMPOSITION_NETWORK_FORBIDDEN/);await assert.rejects(fetch(),/CURRENT_COMPOSITION_NETWORK_FORBIDDEN/);
 assert.equal(transportCalls,0);console.log(JSON.stringify({scope:'INDEPENDENT_STUB_TRANSPORT_NO_SOCKET_OPENED',denyCases:cases.map(([name])=>name).concat('fetch'),transportCalls,realNetwork:0}));
}
