import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {Readable,Writable} from 'node:stream';
import sharp from 'sharp';
import {Resend} from 'resend';
import {v2 as cloudinary} from 'cloudinary';
import {deleteApp} from 'firebase-admin/app';

test('upgraded Firebase initializes both apps and preserves messaging/auth interfaces without provider requests',async()=>{
 const {privateKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
 for(const prefix of ['FIREBASE','PARENT_FIREBASE']){
  process.env[prefix+'_PROJECT_ID']='synthetic-project';process.env[prefix+'_CLIENT_EMAIL']='sdk-test@example.com';process.env[prefix+'_PRIVATE_KEY']=privateKey;
 }
 const adapter=await import('../config/firebaseAdmin.js');
 try{for(const name of ['driverMessaging','parentMessaging'])assert.equal(typeof adapter[name].sendEachForMulticast,'function');for(const name of ['driverAuth','parentAuth'])assert.equal(typeof adapter[name].verifyIdToken,'function');}
 finally{await Promise.all([adapter.driverApp,adapter.parentApp].map(deleteApp));}
});
test('upgraded Sharp transforms uploaded images and Resend retains the used email interface',async()=>{
 const data=await sharp({create:{width:8,height:8,channels:3,background:'white'}}).png().toBuffer();
 const result=await sharp(data,{limitInputPixels:40000000}).rotate().resize({width:4,height:4,fit:'inside',withoutEnlargement:true}).jpeg({quality:88}).toBuffer();
 assert.equal((await sharp(result).metadata()).format,'jpeg');assert.equal(typeof new Resend('re_test_not_valid').emails.send,'function');
});
test('upgraded Cloudinary SDK works with the existing storage adapter and keeps documents authenticated',async t=>{
 process.env.CLOUDINARY_CLOUD_NAME='sdk-test';process.env.CLOUDINARY_API_KEY='test-key';process.env.CLOUDINARY_API_SECRET='test-secret';
 const saved=Object.fromEntries(['R2_ACCOUNT_ID','R2_BUCKET_NAME','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY'].map(key=>[key,process.env[key]]));
 for(const key of Object.keys(saved))delete process.env[key];
 t.mock.method(cloudinary.uploader,'upload_stream',(options,done)=>{
  assert.equal(options.type,'authenticated');assert.equal(options.resource_type,'image');
  return new Writable({write(_chunk,_encoding,callback){callback();},final(callback){done(null,{public_id:'asan/drivers/synthetic',secure_url:'https://res.cloudinary.com/sdk-test/image/authenticated/synthetic.jpg',bytes:5,format:'jpg'});callback();}});
 });
 try{
  const {driverUpload}=await import('../config/cloudinary.js');
  const result=await new Promise((resolve,reject)=>driverUpload.storage._handleFile({}, {fieldname:'licenseFront',stream:Readable.from(Buffer.from('image'))},(error,value)=>error?reject(error):resolve(value)));
  assert.ok(result.path.startsWith('clda://'));assert.equal(result.path.includes('http'),false);
 }finally{for(const [key,value]of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
