import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import Otp from '../models/Otp.js';
import {verifiedRegistrationUpload,claimRegistrationOtp,boundedRegistrationMemory,registrationFields} from '../services/verifiedRegistrationUpload.js';
const query=value=>({lean:async()=>value});
function otpStore(t){
 const row={_id:'synthetic-otp',email:'driver@example.com',purpose:'driver_register',otpHash:crypto.createHash('sha256').update('123456').digest('hex'),used:false,attempts:0,expiresAt:new Date(Date.now()+60000)};
 const matches=f=>f.email===row.email&&f.purpose===row.purpose&&!row.used&&row.expiresAt>new Date()&&row.attempts<(f.attempts.$lt??6);
 t.mock.method(Otp,'findOneAndUpdate',(f)=>{if(!matches(f))return query(null);row.attempts++;return query({...row});});
 t.mock.method(Otp,'updateOne',async(f,u)=>{if(!matches({...f,attempts:{$lt:6}})||f._id!==row._id)return {modifiedCount:0};Object.assign(row,u.$set);return {modifiedCount:1};});
 return row;
}
async function serve(t,middleware){
 const app=express();app.post('/register',middleware);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 return `http://127.0.0.1:${server.address().port}/register`;
}
function form(otp='123456',files=['licenseFront']){const body=new FormData();body.set('email','driver@example.com');body.set('otp',otp);for(const name of files)body.set(name,new Blob(['small-image'],{type:'image/jpeg'}),'image.jpg');return body;}
function fakeStorage(events){return {_handleFile(req,file,done){assert.equal(req.registrationProof.email,'driver@example.com');events.push('upload:'+file.fieldname);file.stream.resume();file.stream.on('end',()=>done(null,{path:'private:test',filename:file.fieldname}));},_removeFile(_req,file,done){events.push('remove:'+file.fieldname);done();}};}
test('invalid and replayed OTPs cannot invoke cloud storage; valid signup retains its multipart API',async t=>{
 const row=otpStore(t),events=[];
 const url=await serve(t,verifiedRegistrationUpload({storage:fakeStorage(events),complete:async(req,res)=>{events.push('complete');assert.ok(req.files.licenseFront[0].path);res.status(201).json({success:true});}}));
 assert.equal((await fetch(url,{method:'POST',body:form('000000')})).status,400);assert.equal(events.length,0);assert.equal(row.used,false);
 assert.equal((await fetch(url,{method:'POST',body:form()})).status,201);assert.deepEqual(events,['upload:licenseFront','complete']);assert.equal(row.used,true);
 assert.equal((await fetch(url,{method:'POST',body:form()})).status,400);assert.equal(events.length,2);
});
test('parallel claims consume one OTP once; attempts, identity and expiry cannot be bypassed',async t=>{
 const row=otpStore(t);
 await assert.rejects(claimRegistrationOtp({email:{$ne:''},otp:'123456'}));
 await assert.rejects(claimRegistrationOtp({email:row.email,otp:['123456']}));
 const results=await Promise.allSettled([1,2].map(()=>claimRegistrationOtp({email:row.email,otp:'123456'})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 row.used=false;row.attempts=0;for(let n=0;n<5;n++)await assert.rejects(claimRegistrationOtp({email:row.email,otp:'000000'}));
 await assert.rejects(claimRegistrationOtp({email:row.email,otp:'123456'}));assert.equal(row.used,false);
 row.attempts=0;row.expiresAt=new Date(0);await assert.rejects(claimRegistrationOtp({email:row.email,otp:'123456'}));
});
test('aggregate-size, file-count, MIME and malformed-boundary rejection happens before OTP or provider work',async t=>{
 let claims=0,uploads=0;
 const parse=multer({storage:boundedRegistrationMemory(8),limits:{files:8,fields:20,fieldSize:8192,parts:28},fileFilter(_r,file,done){done(file.mimetype==='image/jpeg'?null:new Error('Bad image type'),true);}}).fields(registrationFields);
 const url=await serve(t,verifiedRegistrationUpload({storage:{_handleFile(){uploads++;}},parse,claim:async()=>{claims++;return {email:'driver@example.com'};},complete:async(_q,res)=>res.end()}));
 assert.equal((await fetch(url,{method:'POST',body:form()})).status,413);
 const wrong=form('123456',['unexpected']);assert.equal((await fetch(url,{method:'POST',body:wrong})).status,413);
 const bad=form();bad.set('licenseFront',new Blob(['x'],{type:'text/html'}),'x.html');assert.equal((await fetch(url,{method:'POST',body:bad})).status,503);
 assert.equal((await fetch(url,{method:'POST',headers:{'Content-Type':'multipart/form-data; boundary='+'x'.repeat(200)},body:'x'})).status,400);
 assert.equal(claims,0);assert.equal(uploads,0);
});
test('partial cloud failures clean prior files and release the registration slot',async t=>{
 const events=[],storage=fakeStorage(events),original=storage._handleFile;let fail=true;
 storage._handleFile=(req,file,done)=>{if(fail&&file.fieldname==='licenseBack')return done(new Error('Synthetic provider failure'));original(req,file,done);};
 const url=await serve(t,verifiedRegistrationUpload({storage,claim:async()=>({email:'driver@example.com'}),complete:async(_q,res)=>res.status(201).end()}));
 assert.equal((await fetch(url,{method:'POST',body:form('123456',['licenseFront','licenseBack'])})).status,503);assert.ok(events.includes('remove:licenseFront'));
 fail=false;assert.equal((await fetch(url,{method:'POST',body:form()})).status,201);
});
test('concurrency limit rejects a second registration before parsing its body or uploading',async t=>{
 let release,started;const ready=new Promise(r=>started=r);
 const storage={_handleFile(_req,file,done){file.stream.resume();release=()=>done(null,{path:'private:test',filename:'test'});started();},_removeFile(_q,_f,done){done();}};
 const url=await serve(t,verifiedRegistrationUpload({storage,claim:async()=>({email:'driver@example.com'}),complete:async(_q,res)=>res.status(201).end()}));
 const first=fetch(url,{method:'POST',body:form()});await ready;
 assert.equal((await fetch(url,{method:'POST',body:form()})).status,503);release();assert.equal((await first).status,201);
});
test('a request that times out during provider work cleans its files and frees the slot',async t=>{
 let slow=true,cleaned;const cleanup=new Promise(resolve=>cleaned=resolve);
 const storage={_handleFile(_req,file,done){file.stream.resume();if(slow)setTimeout(()=>done(null,{path:'private:test',filename:'test'}),600);else done(null,{path:'private:test',filename:'test'});},_removeFile(_q,_f,done){cleaned();done();}};
 const url=await serve(t,verifiedRegistrationUpload({storage,timeoutMs:300,claim:async()=>({email:'driver@example.com'}),complete:async(_q,res)=>res.status(201).end()}));
 await assert.rejects(fetch(url,{method:'POST',body:form()}));await cleanup;slow=false;
 assert.equal((await fetch(url,{method:'POST',body:form()})).status,201);
});
test('registration and OTP-login response paths authorize private media only as the verified driver',async()=>{
 const source=await readFile(new URL('../controllers/driverAuthController.js',import.meta.url),'utf8');
 for(const controller of ['verifyRegisterOtp','verifyLoginOtp']){
  const start=source.indexOf("      const session = await issueSession(driver, 'driver');",source.indexOf('export const '+controller));
  const end=source.indexOf('    } catch (',start);assert.ok(start>0&&end>start);
  const driver={_id:'verified-driver',driverId:'ASAN-SYNTHETIC',licenseFront:'private-reference'};
  const req={body:{driver:{_id:'foreign-driver'}}};let result;
  const res={status(){return this;},json(value){assert.equal(req.driver,driver);result=value;return value;}};
  await vm.runInNewContext('(async()=>{'+source.slice(start,end)+'})()',{
   req,res,driver,issueSession:async()=>({token:'synthetic-token',data:driver}),getSafeDriver:value=>value,
   getDriverStatusInfo:()=>({message:'Ready',status:'approved',nextStep:'app'})
  });
  assert.equal(result.data._id,driver._id);assert.equal(req.driver._id,'verified-driver');
 }
});
