import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import express from 'express';
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import AdminLog from '../models/AdminLog.js';
import Parent from '../models/Parent.js';
import AuthSession from '../models/AuthSession.js';
import Challenge from '../models/SecurityChallenge.js';
import Budget from '../models/LoginBudget.js';
import verifyAdmin from '../middleware/verifyAdmin.js';
import {loginAdmin,logoutAdmin} from '../controllers/adminAuthController.js';
import {startChallenge,consumeChallenge} from '../services/securityChallenges.js';
import {protectLogin} from '../middleware/adminLoginProtection.js';
import {checkAccessSession,refreshSession,validateSocketSession,sessionHandlers} from '../services/authSessions.js';
process.env.JWT_SECRET='round-two-synthetic-secret';
process.env.RESEND_API_KEY='re_test_not_valid';
const id='507f1f77bcf86cd799439011';
const query=value=>({lean:async()=>value,select(){return this;},then(resolve,reject){return Promise.resolve(value).then(resolve,reject);}});
const response=()=>({code:200,body:null,status(code){this.code=code;return this;},json(body){this.body=body;return this;},set(){return this;}});
function challengeStore(t){
 const rows=new Map(),mails=[];
 t.mock.method(globalThis,'fetch',async(_url,options)=>{mails.push(JSON.parse(options.body));return {ok:true};});
 t.mock.method(Challenge,'create',async row=>{rows.set(row._id,{attempts:0,usedAt:null,...row});return row;});
 t.mock.method(Challenge,'deleteOne',async f=>rows.delete(f._id));
 const matches=(row,f)=>row&&row.purpose===f.purpose&&row.subject===f.subject&&row.binding===f.binding&&!row.usedAt&&row.expiresAt>new Date()&&row.attempts<(f.attempts.$lt??6);
 t.mock.method(Challenge,'findOneAndUpdate',(f,u)=>{const row=rows.get(f._id);if(!matches(row,f))return query(null);row.attempts++;return query({...row});});
 t.mock.method(Challenge,'updateOne',async(f,u)=>{const row=rows.get(f._id);if(!matches(row,{...f,attempts:{$lt:6}}))return {modifiedCount:0};Object.assign(row,u.$set);return {modifiedCount:1};});
 return {rows,mails,otp:mail=>mail.text.match(/\b\d{6}\b/)[0]};
}
test('email changes require separate current and new mailbox codes; replay, wrong purpose and expiry fail',async t=>{
 const state=challengeStore(t);
 const challengeId=await startChallenge({purpose:'parent-email-change',subject:id,binding:'old:new',email:'new@example.com',currentEmail:'old@example.com'});
 const params={id:challengeId,purpose:'parent-email-change',subject:id,binding:'old:new',otp:state.otp(state.mails[1])};
 assert.equal(await consumeChallenge(params),false);
 assert.equal(await consumeChallenge({...params,currentOtp:state.otp(state.mails[0]),purpose:'admin-login'}),false);
 assert.equal(await consumeChallenge({...params,currentOtp:state.otp(state.mails[0])}),true);
 assert.equal(await consumeChallenge({...params,currentOtp:state.otp(state.mails[0])}),false);
 const second=await startChallenge({purpose:'admin-login',subject:id,binding:'v1',email:'admin@example.com'});
 state.rows.get(second).expiresAt=new Date(0);
 assert.equal(await consumeChallenge({id:second,purpose:'admin-login',subject:id,binding:'v1',otp:state.otp(state.mails[2])}),false);
});
test('challenge attempts are capped and concurrent valid submissions consume only once',async t=>{
 const state=challengeStore(t);const cid=await startChallenge({purpose:'admin-login',subject:id,binding:'v1',email:'admin@example.com'});
 const params={id:cid,purpose:'admin-login',subject:id,binding:'v1'};
 for(let i=0;i<5;i++)assert.equal(await consumeChallenge({...params,otp:'bad'}),false);
 assert.equal(await consumeChallenge({...params,otp:state.otp(state.mails[0])}),false);
 const next=await startChallenge({purpose:'admin-login',subject:id,binding:'v1',email:'admin@example.com'});
 const results=await Promise.all([1,2].map(()=>consumeChallenge({...params,id:next,otp:state.otp(state.mails[1])})));
 assert.equal(results.filter(Boolean).length,1);
});
test('admin password alone cannot issue access; verified email code succeeds and logout revokes old tokens',async t=>{
 const state=challengeStore(t);let version=2;
 const admin={_id:id,email:'admin@example.com',role:'superadmin',sessionVersion:version,password:'hashed-password',comparePassword:async p=>p==='correct',save:async()=>{}};
 t.mock.method(Admin,'findOne',()=>query(admin));
 t.mock.method(Admin,'findById',()=>query({...admin,sessionVersion:version}));
 t.mock.method(Admin,'updateOne',async()=>{version++;return {modifiedCount:1};});
 t.mock.method(AdminLog,'create',async()=>({}));
 const req={body:{email:admin.email,password:'correct'},headers:{},ip:'127.0.0.1',app:{get:()=>null},admin};
 let res=response();await loginAdmin(req,res);assert.equal(res.body.mfaRequired,true);assert.equal(res.body.token,undefined);
 const cid=res.body.challengeId;req.body={...req.body,challengeId:cid,otp:'wrong'};res=response();await loginAdmin(req,res);assert.equal(res.code,401);
 req.body.otp=state.otp(state.mails[0]);res=response();await loginAdmin(req,res);assert.ok(res.body.token);
 const token=res.body.token,authReq={headers:{authorization:'Bearer '+token}};
 let accepted=0;await verifyAdmin(authReq,response(),()=>accepted++);assert.equal(accepted,1);
 await logoutAdmin(req,response());const rejected=response();await verifyAdmin(authReq,rejected,()=>accepted++);assert.equal(rejected.code,401);assert.equal(accepted,1);
 const legacy=jwt.sign({id,tokenType:'admin',role:'superadmin'},process.env.JWT_SECRET);const legacyRes=response();await verifyAdmin({headers:{authorization:'Bearer '+legacy}},legacyRes,()=>accepted++);assert.equal(legacyRes.code,401);
});
test('login account budget survives middleware recreation and changing client addresses',async t=>{
 const counts=new Map();t.mock.method(Budget,'findOneAndUpdate',(f)=>{counts.set(f._id,(counts.get(f._id)||0)+1);return query({count:counts.get(f._id)});});
 for(let n=0;n<10;n++){let next=false;await protectLogin()({body:{email:n%2?' ADMIN@example.com ':'admin@example.com'},ip:`192.0.2.${n+1}`},response(),()=>next=true);assert.equal(next,true);}
 const limited=response();await protectLogin()({body:{email:'admin@example.com'},ip:'198.51.100.1'},limited,()=>assert.fail('must limit'));assert.equal(limited.code,429);
 const other=response();await protectLogin()({body:{email:'other@example.com'},ip:'198.51.100.2'},other,()=>{});assert.equal(other.code,200);
});
test('identity version change revokes legacy HTTP, socket, refresh and migration access',async t=>{
 t.mock.method(Parent,'findById',()=>query({_id:id,isActive:true,sessionVersion:1}));
 t.mock.method(AuthSession,'findOne',()=>query({_id:id,kind:'parent',accountId:id,accountVersion:0,currentHash:'old',revokedAt:null}));
 const token=jwt.sign({id,tokenType:'parent'},process.env.JWT_SECRET);
 const res=response();assert.equal(await checkAccessSession(jwt.decode(token),'parent',res),false);assert.equal(res.code,401);
 await assert.rejects(validateSocketSession(token),{code:'SESSION_REVOKED'});
 await assert.rejects(refreshSession(id+'.'+'a'.repeat(64),'parent'),{code:'SESSION_REVOKED'});
 const migrate=response();await sessionHandlers('parent').migrate({headers:{authorization:'Bearer '+token}},migrate);assert.equal(migrate.code,401);
});
test('ordinary profile update rejects changed login email but permits unchanged email and legitimate fields',async()=>{
 const source=await readFile(new URL('../routes/parentRoutes.js',import.meta.url),'utf8');
 const start=source.indexOf('const buildParentUpdates');const end=source.indexOf('\n/* ===',source.indexOf('return updates;',start));
 assert.ok(start>=0&&end>start);
 const context={console,Parent:{},Driver:{},result:null};vm.createContext(context);
 vm.runInContext(source.slice(start,end)+'\nthis.build=buildParentUpdates;',context);
 const bad=response();assert.equal(await context.build({body:{email:'attacker@example.com'},parent:{_id:id,email:'old@example.com'}},bad),null);assert.equal(bad.code,403);
 const good=await context.build({body:{email:'old@example.com',name:'Updated'},parent:{_id:id,email:'old@example.com'}},response());assert.equal(good.name,'Updated');assert.equal(good.email,undefined);
});
test('Institute logout, password recovery and password change revoke signed tokens; reset cannot be replayed',async t=>{
 process.env.INSTITUTE_SESSION_SECRET='round-two-institute-secret';
 const {default:router}=await import('../institute/router.js');
 const {default:User}=await import('../institute/models/User.js');
 const ready=Object.getOwnPropertyDescriptor(mongoose.connection,'readyState');
 Object.defineProperty(mongoose.connection,'readyState',{value:1,configurable:true});
 const user={_id:id,name:'Staff',role:'Institute Admin',instituteName:'School A',sessionVersion:0,password:await bcrypt.hash('original-password',4),passwordResetTokenHash:'',passwordResetExpiresAt:null};
 t.mock.method(User,'findById',()=>query({...user}));
 t.mock.method(User,'findOne',f=>query(f.passwordResetTokenHash===user.passwordResetTokenHash&&user.passwordResetExpiresAt>new Date()?{...user}:null));
 t.mock.method(User,'updateOne',async(f,u)=>{
  if(f.password&&f.password!==user.password)return {modifiedCount:0};
  if(f.passwordResetTokenHash&&f.passwordResetTokenHash!==user.passwordResetTokenHash)return {modifiedCount:0};
  Object.assign(user,u.$set||{});user.sessionVersion+=u.$inc.sessionVersion;return {modifiedCount:1};
 });
 const token=(sv=user.sessionVersion)=>{const payload=Buffer.from(JSON.stringify({sub:id,sv,exp:Date.now()+60000})).toString('base64url');return payload+'.'+crypto.createHmac('sha256',process.env.INSTITUTE_SESSION_SECRET).update('institute:'+payload).digest('base64url');};
 const app=express();app.use('/api/institute',router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const call=(path,auth,body)=>fetch(`http://127.0.0.1:${server.address().port}/api/institute`+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Authorization:'Bearer '+auth}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try {
  const first=token();assert.equal((await call('/auth/me',first)).status,200);
  assert.equal((await call('/auth/sign-out',first,{})).status,204);assert.equal((await call('/auth/me',first)).status,401);
  const second=token(),reset='synthetic-reset';user.passwordResetTokenHash=crypto.createHash('sha256').update(reset).digest('hex');user.passwordResetExpiresAt=new Date(Date.now()+60000);
  assert.equal((await call('/auth/reset-password',null,{token:reset,password:'recovered-password'})).status,200);
  assert.equal((await call('/auth/me',second)).status,401);assert.equal((await call('/auth/reset-password',null,{token:reset,password:'another-password'})).status,400);
  const third=token();assert.equal((await call('/auth/change-password',third,{currentPassword:'recovered-password',newPassword:'changed-password'})).status,200);assert.equal((await call('/auth/me',third)).status,401);
  assert.equal((await call('/auth/me',token())).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));if(ready)Object.defineProperty(mongoose.connection,'readyState',ready);else delete mongoose.connection.readyState;}
});
test('parent email endpoints preserve identity until both codes pass, then revoke previous sessions',async t=>{
 const realFetch=globalThis.fetch,state=challengeStore(t);
 const {default:router}=await import('../routes/parentEmailChange.js');
 const user={_id:id,email:'old@example.com',isActive:true,sessionVersion:0};let writes=0,revocations=0;
 t.mock.method(Parent,'findById',()=>query({...user}));
 t.mock.method(Parent,'exists',async()=>null);
 t.mock.method(Parent,'updateOne',async(f,u)=>{assert.equal(f.email,'old@example.com');writes++;Object.assign(user,u.$set);user.sessionVersion++;return {modifiedCount:1};});
 t.mock.method(AuthSession,'updateMany',async()=>{revocations++;return {modifiedCount:1};});
 t.mock.method(Budget,'findOneAndUpdate',()=>query({count:1}));
 const token=jwt.sign({id,tokenType:'parent',sv:0},process.env.JWT_SECRET);
 const app=express();app.use(express.json());app.use('/email',router);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const call=(path,body)=>realFetch(`http://127.0.0.1:${server.address().port}/email`+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
 try{
  const sent=await call('/send-otp',{email:'new@example.com'});assert.equal(sent.status,200);const {challengeId}=await sent.json();assert.equal(user.email,'old@example.com');assert.equal(writes,0);
  const params={email:'new@example.com',challengeId,otp:state.otp(state.mails[1])};assert.equal((await call('/verify-otp',params)).status,400);assert.equal(writes,0);
  const done=await call('/verify-otp',{...params,currentOtp:state.otp(state.mails[0])});assert.equal(done.status,200);assert.equal((await done.json()).signInRequired,true);assert.equal(user.email,'new@example.com');assert.equal(writes,1);assert.equal(revocations,1);
  assert.equal((await call('/send-otp',{email:'third@example.com'})).status,401);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
