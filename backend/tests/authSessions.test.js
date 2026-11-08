import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import AuthSession from '../models/AuthSession.js';
import Parent from '../models/Parent.js';
import Driver from '../models/Driver.js';
import {issueSession,refreshSession,parseRefresh,checkAccessSession,sessionHandlers,validateSocketSession,assertAvailable} from '../services/authSessions.js';
process.env.JWT_SECRET='isolated-session-test-not-production';
const account={_id:'507f1f77bcf86cd799439011',isActive:true,name:'Test',password:'never-return',accountSource:'institute'};
const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const q=value=>({lean:async()=>value});
function setup(t,kind='parent') {
 let row,available=account;
 t.mock.method(AuthSession,'create',async input=>row={...input,_id:'507f1f77bcf86cd799439012',revokedAt:null});
 t.mock.method(AuthSession,'findOne',filter=>q(row&&!row.revokedAt&&row.kind===filter.kind?{...row}:null));
 t.mock.method(AuthSession,'findOneAndUpdate',(filter,update)=>{if(row.revokedAt||row.currentHash!==filter.currentHash)return q(null);Object.assign(row,update.$set);return q({...row});});
 t.mock.method(AuthSession,'exists',async filter=>row&&!row.revokedAt&&String(row._id)===filter._id?{_id:row._id}:null);
 t.mock.method(AuthSession,'updateOne',async(filter,update)=>{if(filter.kind===row.kind&&(filter.accountId===row.accountId||filter.$or?.some(item=>item.currentHash===row.currentHash||item.previousHash===row.previousHash)))Object.assign(row,update.$set);return {matchedCount:1};});
 t.mock.method(kind==='parent'?Parent:Driver,'findById',async()=>available);
 return {row:()=>row,unavailable:()=>available=null};
}
test('login stores only refresh hash and issues 7-day access with account metadata',async t=>{
 const state=setup(t);const result=await issueSession(account,'parent');
 const decoded=jwt.verify(result.token,process.env.JWT_SECRET);
 assert.equal(decoded.exp-decoded.iat,7*86400);assert.equal(decoded.sid,result.sessionId);
 assert.equal(result.data.password,undefined);assert.equal(result.data.accountSource,'institute');
 const secret=parseRefresh(result.refreshToken).secret;assert.equal(state.row().currentHash,hash(secret));assert.ok(!JSON.stringify(state.row()).includes(secret));
});
test('rotation recovers concurrent requests and lost response after grace only with same persisted operation',async t=>{
 const state=setup(t);const original=await issueSession(account,'parent');
 const next=await refreshSession(original.refreshToken,'parent','operation_1234567890');
 assert.notEqual(next.refreshToken,original.refreshToken);
 assert.equal((await refreshSession(original.refreshToken,'parent','other_operation_123')).refreshToken,next.refreshToken);
 state.row().previousUntil=new Date(0);
 assert.equal((await refreshSession(original.refreshToken,'parent','operation_1234567890')).refreshToken,next.refreshToken);
 await assert.rejects(refreshSession(original.refreshToken,'parent','other_operation_123'),{code:'SESSION_INVALID'});
 await refreshSession(next.refreshToken,'parent','new_operation_12345');
 await assert.rejects(refreshSession(original.refreshToken,'parent','operation_1234567890'),{code:'SESSION_INVALID'});
});
test('long inactivity does not expire renewal; logout revokes refresh, HTTP and socket access',async t=>{
 const state=setup(t);const login=await issueSession(account,'parent');state.row().lastRenewedAt=new Date(0);
 const next=await refreshSession(login.refreshToken,'parent','operation_1234567890');
 let code,body;const res={status(value){code=value;return this;},json(value){body=value;return value;}};
 await sessionHandlers('parent').logout({body:{refreshToken:next.refreshToken},headers:{},app:{get:()=>null}},res);
 assert.equal(body.success,true);assert.ok(state.row().revokedAt);
 await assert.rejects(refreshSession(next.refreshToken,'parent','operation_1234567890'),{code:'SESSION_REVOKED'});
 assert.equal(await checkAccessSession(jwt.decode(next.token),'parent',res),false);assert.equal(code,401);
 await assert.rejects(validateSocketSession(next.token),{code:'SESSION_REVOKED'});
});
test('deleted account cannot renew and wrong-kind refresh never switches identity',async t=>{
 const state=setup(t);const login=await issueSession(account,'parent');
 await assert.rejects(refreshSession(login.refreshToken,'driver'),{code:'SESSION_REVOKED'});
 state.unavailable();await assert.rejects(refreshSession(login.refreshToken,'parent'),{code:'SESSION_ACCOUNT_UNAVAILABLE'});
});
test('migration accepts valid legacy token and refuses expired access or client-selected account',async t=>{
 setup(t);let code=200,body;const res={status(value){code=value;return this;},json(value){body=value;return value;}};
 const legacy=jwt.sign({id:account._id,tokenType:'parent'},process.env.JWT_SECRET,{expiresIn:'1h'});
 await sessionHandlers('parent').migrate({headers:{authorization:'Bearer '+legacy},body:{id:'attacker'}},res);
 assert.equal(jwt.decode(body.token).id,account._id);assert.ok(body.refreshToken);
 const expired=jwt.sign({id:account._id,tokenType:'parent'},process.env.JWT_SECRET,{expiresIn:-1});
 await sessionHandlers('parent').migrate({headers:{authorization:'Bearer '+expired}},res);assert.equal(code,401);
});

test('logout cannot disconnect a session using only a known session ID and false secret',async t=>{
 setup(t);const login=await issueSession(account,'parent');
 const update=t.mock.method(AuthSession,'updateOne',async()=>({matchedCount:0}));let disconnected=false;
 await sessionHandlers('parent').logout({body:{refreshToken:login.sessionId+'.'+'0'.repeat(64)},headers:{},app:{get:()=>({in:()=>({disconnectSockets:()=>{disconnected=true;}})})}},{json:()=>({})});
 assert.equal(update.mock.calls.length,1);assert.equal(disconnected,false);
});
test('pending drivers retain approval workflow, unavailable driver and parent accounts cannot renew',()=>{
 assert.doesNotThrow(()=>assertAvailable({...account,status:'pending'},'driver'));
 assert.doesNotThrow(()=>assertAvailable({...account,status:'approved'},'driver'));
 for(const status of ['suspended','blocked','rejected'])assert.throws(()=>assertAvailable({...account,status},'driver'),{code:'SESSION_ACCOUNT_UNAVAILABLE'});
 assert.throws(()=>assertAvailable({...account,isActive:false},'parent'),{code:'SESSION_ACCOUNT_UNAVAILABLE'});
});
