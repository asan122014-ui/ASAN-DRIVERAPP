import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { r2Enabled, isR2Reference, uploadR2Image, deleteR2Image, r2ReadUrl, resolveMediaReferences, combinedStorage, privateMediaResponses } from '../services/r2Storage.js';

const reference = 'r2://asan/drivers/12345678-1234-1234-1234-123456789abc.jpg';
test('R2 is opt-in and incomplete configuration fails instead of silently using another provider', () => {
  assert.equal(r2Enabled({}),false);
  assert.throws(()=>r2Enabled({R2_ACCOUNT_ID:'test'}),/incomplete/);
  assert.equal(r2Enabled({R2_ACCOUNT_ID:'test',R2_BUCKET_NAME:'test',R2_ACCESS_KEY_ID:'test',R2_SECRET_ACCESS_KEY:'test'}),true);
  assert.equal(isR2Reference(reference),true);
  for (const value of ['r2://other/file','https://example.com/photo.jpg','r2://asan/drivers/../../secret.jpg']) assert.equal(isR2Reference(value),false);
});
test('serialization signs file links once while retaining provider identifiers and old Cloudinary URLs',async()=>{
  const original={licenseFront:reference, imageUrl:reference, publicId:reference, profilePhoto:'https://res.cloudinary.com/test/photo.jpg',date:new Date('2026-11-12')};
  let calls=0;
  const result=await resolveMediaReferences(original,async value=>{calls++;assert.equal(value,reference);return 'https://example.com/temporary';});
  assert.equal(calls,1);
  assert.equal(result.licenseFront,'https://example.com/temporary');
  assert.equal(result.imageUrl,result.licenseFront);
  assert.equal(result.publicId,reference);
  assert.equal(result.profilePhoto,original.profilePhoto);
  assert.equal(original.licenseFront,reference);
  assert.equal(await resolveMediaReferences(undefined),undefined);
});
test('R2 image uploads are compressed, private and deletable; read links expire',async t=>{
  const names=['R2_ACCOUNT_ID','R2_BUCKET_NAME','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'];
  const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
  Object.assign(process.env,{R2_ACCOUNT_ID:'a'.repeat(32),R2_BUCKET_NAME:'synthetic-test',R2_ACCESS_KEY_ID:'synthetic-key',R2_SECRET_ACCESS_KEY:'synthetic-secret'});
  t.after(()=>names.forEach(name=>previous[name]===undefined?delete process.env[name]:process.env[name]=previous[name]));
  const commands=[];
  t.mock.method(S3Client.prototype,'send',async command=>{commands.push(command);return {};});
  const buffer=await sharp({create:{width:20,height:20,channels:3,background:'white'}}).png().toBuffer();
  const uploaded=await uploadR2Image(buffer,'drivers');
  assert.ok(isR2Reference(uploaded.public_id));
  const put=commands[0].input;
  assert.equal(put.Bucket,'synthetic-test');
  assert.equal(put.ContentType,'image/jpeg');
  assert.equal(put.ACL,undefined);
  assert.equal((await sharp(put.Body).metadata()).format,'jpeg');
  const link=new URL(await r2ReadUrl(uploaded.public_id));
  assert.equal(link.searchParams.get('X-Amz-Expires'),'3600');
  assert.equal(link.protocol,'https:');
  await deleteR2Image(uploaded.public_id);
  assert.equal(commands[1].input.Key,put.Key);
  await assert.rejects(()=>uploadR2Image(Buffer.from('bad image'),'drivers'));
});
test('profile uploads remain on Cloudinary and legacy mode still works',async()=>{
  const storage={_handleFile(req,file,cb){cb(null,{path:'cloudinary'});},_removeFile(req,file,cb){cb(null);}};
  const original=process.env.R2_ACCOUNT_ID;
  // The mocked empty environment is tested separately; preserve the real runtime settings.
  const engine=combinedStorage(storage,'drivers',{profileOnCloudinary:true});
  const result=await new Promise((resolve,reject)=>engine._handleFile({}, {fieldname:'profilePhoto',stream:Readable.from([])},(e,r)=>e?reject(e):resolve(r)));
  assert.equal(result.path,'cloudinary');
  assert.equal(process.env.R2_ACCOUNT_ID,original);
});
test('ordinary JSON responses retain their synchronous behavior',()=>{
  const payload={success:true, count:1};let received;
  const res={json(value){received=value;return this;}};
  let next=false;privateMediaResponses({},res,()=>{next=true;});
  assert.equal(res.json(payload),res);
  assert.equal(received,payload);
  assert.equal(next,true);
});
