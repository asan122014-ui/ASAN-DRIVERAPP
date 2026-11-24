import crypto from 'node:crypto';
import {Readable} from 'node:stream';
import multer from 'multer';
import Otp from '../models/Otp.js';

export const REGISTRATION_MAX_BYTES=32*1024*1024;
export const registrationFields=['licenseFront','licenseBack','rcFront','rcBack','insurance','idFront','idBack','profilePhoto'].map(name=>({name,maxCount:1}));
const fault=(message,status=400)=>Object.assign(new Error(message),{status});

// Only bounded, temporary memory is used before email proof. No cloud provider
// or image decoder is invoked by this storage engine.
export function boundedRegistrationMemory(maxBytes=REGISTRATION_MAX_BYTES) {
  return {
    _handleFile(req,file,done){
      let chunks=[],size=0,finished=false;
      const finish=(error,value)=>{if(finished)return;finished=true;chunks=[];done(error,value);};
      file.stream.on('data',chunk=>{
        if(finished)return;
        req.registrationBytes=(req.registrationBytes||0)+chunk.length;size+=chunk.length;
        if(req.registrationBytes>maxBytes){finish(fault('Combined registration images must be at most 32 MB.',413));file.stream.resume();return;}
        chunks.push(chunk);
      });
      file.stream.on('error',finish);
      file.stream.on('end',()=>{if(!finished){const buffer=Buffer.concat(chunks);finish(null,{buffer,size});}});
    },
    _removeFile(_req,file,done){delete file.buffer;done(null);}
  };
}

export async function claimRegistrationOtp(body) {
  const email=typeof body?.email==='string'?body.email.trim().toLowerCase():'';
  const otp=body?.otp;
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof otp!=='string'||!/^\d{6}$/.test(otp))throw fault('Enter a valid email and 6-digit OTP.');
  // Increment before comparing; parallel attempts share the same hard cap.
  const filter={email,purpose:'driver_register',used:false,expiresAt:{$gt:new Date()},attempts:{$lt:5}};
  const stored=await Otp.findOneAndUpdate(filter,{$inc:{attempts:1}},{returnDocument:'after'}).lean();
  const digest=crypto.createHash('sha256').update(otp).digest('hex');
  if(!stored||!/^[a-f0-9]{64}$/.test(stored.otpHash)||!crypto.timingSafeEqual(Buffer.from(digest,'hex'),Buffer.from(stored.otpHash,'hex')))throw fault('Invalid or expired OTP. Request a new code after five attempts.');
  const claimed=await Otp.updateOne({...filter,_id:stored._id,otpHash:stored.otpHash,attempts:{$lte:5}},{$set:{used:true}});
  if(claimed.modifiedCount!==1)throw fault('This OTP has already been used. Please request a new code.');
  return {email,otpId:stored._id};
}

export function registrationParser() {
  return multer({storage:boundedRegistrationMemory(),
    limits:{fileSize:10*1024*1024,files:8,fields:20,fieldSize:8192,parts:28},
    fileFilter(_req,file,done){done(['image/jpeg','image/png','image/webp'].includes(file.mimetype)?null:fault('Only JPG, PNG and WEBP images are allowed.'),true);}
  }).fields(registrationFields);
}

export function verifiedRegistrationUpload({storage,complete,parse=registrationParser(),claim=claimRegistrationOtp,maxConcurrent=1,timeoutMs=90000}) {
  let active=0;
  return async(req,res)=>{
    if(active>=maxConcurrent){res.set('Retry-After','10');return res.status(503).json({success:false,message:'Registration is busy. Please retry in a few seconds.'});}
    const contentType=req.get('content-type')||'';
    if(contentType.length>512||!/^multipart\/form-data\s*;/i.test(contentType)||!/boundary=(?:"[^"\r\n]{1,70}"|[^;\s]{1,70})(?:\s*;|\s*$)/i.test(contentType))return res.status(400).json({success:false,message:'A valid multipart registration form is required.'});
    const length=Number(req.get('content-length'));
    if(length>REGISTRATION_MAX_BYTES+256*1024)return res.status(413).json({success:false,message:'Combined registration images must be at most 32 MB.'});
    active++;
    const uploaded=[];let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;req.destroy();res.destroy();},timeoutMs);
    timer.unref();
    try {
      await new Promise((resolve,reject)=>{
        const aborted=()=>reject(fault('Registration upload interrupted.',408));
        req.once('aborted',aborted);
        parse(req,res,error=>{req.off('aborted',aborted);error?reject(error):resolve();});
      });
      req.registrationProof=await claim(req.body);
      // This server-held proof is bound to this request and email. Consume it
      // before cloud work so an OTP cannot authorize concurrent upload batches.
      for(const file of Object.values(req.files||{}).flat()){
        if(timedOut||req.aborted||res.destroyed)throw fault('Registration interrupted.',408);
        const metadata=await new Promise((resolve,reject)=>storage._handleFile(req,{...file,stream:Readable.from(file.buffer)},(error,value)=>error?reject(error):resolve(value)));
        delete file.buffer;Object.assign(file,metadata);uploaded.push(file);
      }
      if(timedOut||req.aborted||res.destroyed)throw fault('Registration interrupted.',408);
      await complete(req,res);
    }catch(error){
      await Promise.allSettled(uploaded.map(file=>new Promise((resolve,reject)=>storage._removeFile(req,file,error=>error?reject(error):resolve()))));
      if(!res.headersSent&&!res.destroyed)res.status(error.status||(error instanceof multer.MulterError?413:503)).json({success:false,message:error.status?error.message:error instanceof multer.MulterError?'Too many fields or files, or an image exceeds 10 MB.':'Registration could not be completed. Please request a new OTP and retry.'});
    }finally{
      clearTimeout(timer);for(const file of Object.values(req.files||{}).flat())delete file.buffer;active--;
    }
  };
}
