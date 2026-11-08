import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import AuthSession from '../models/AuthSession.js';
import Parent from '../models/Parent.js';
import Driver from '../models/Driver.js';
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
const nextSecret = raw => crypto.createHmac('sha256',process.env.JWT_SECRET).update('session-renewal:'+raw).digest('hex');
export function parseRefresh(raw) {
 if(typeof raw!=='string'||raw.length>200)return null;
 const match=/^([a-f0-9]{24})\.([a-f0-9]{64})$/.exec(raw);
 return match?{id:match[1],secret:match[2]}:null;
}
export function safeAccount(account) {
 const data=account.toObject?account.toObject():{...account};
 for(const key of ['password','firebaseUid','__v','fcmTokens'])delete data[key];
 return data;
}
const fault=(message,code='SESSION_INVALID',status=401)=>Object.assign(new Error(message),{code,status});
export function assertAvailable(account,kind) {
 if(!account || account.isActive===false || (kind==='driver' && ['suspended','blocked','rejected'].includes(account.status)))throw fault('This account cannot renew its session.','SESSION_ACCOUNT_UNAVAILABLE',403);
}
function credentials(session,secret,account) {
 const token=jwt.sign({id:String(account._id),tokenType:session.kind,sid:String(session._id)},process.env.JWT_SECRET,{algorithm:'HS256',expiresIn:'7d'});
 return {success:true,token,accessToken:token,refreshToken:`${session._id}.${secret}`,sessionId:String(session._id),expiresIn:'7d',data:safeAccount(account)};
}
export async function issueSession(account,kind) {
 const secret=crypto.randomBytes(32).toString('hex');
 const session=await AuthSession.create({accountId:account._id,kind,currentHash:hash(secret)});
 return credentials(session,secret,account);
}
export async function refreshSession(raw,kind,rotationId) {
 const operation=typeof rotationId==='string'&&/^[a-zA-Z0-9_-]{16,128}$/.test(rotationId)?hash(rotationId):null;
 const parsed=parseRefresh(raw);if(!parsed)throw fault('Invalid session credentials.');
 let session=await AuthSession.findOne({_id:parsed.id,kind,revokedAt:null}).lean();
 if(!session)throw fault('Session was revoked.','SESSION_REVOKED');
 const account=await (kind==='parent'?Parent:Driver).findById(session.accountId);
 assertAvailable(account,kind);
 const digest=hash(parsed.secret),now=new Date();
 if(session.currentHash===digest) {
  const secret=nextSecret(parsed.secret);
  const changed=await AuthSession.findOneAndUpdate({_id:session._id,kind,currentHash:digest,revokedAt:null},{$set:{currentHash:hash(secret),previousHash:digest,rotationHash:operation,previousUntil:new Date(now.getTime()+30000),lastRenewedAt:now}},{returnDocument:'after'}).lean();
  if(changed)return credentials(changed,secret,account);
  session=await AuthSession.findOne({_id:parsed.id,kind,revokedAt:null}).lean();
 }
 // Deterministic successor permits concurrent requests/retries without storing plaintext.
 if(session?.previousHash===digest && (new Date(session.previousUntil)>now || (operation && session.rotationHash===operation)) && session.currentHash===hash(nextSecret(parsed.secret)))return credentials(session,nextSecret(parsed.secret),account);
 throw fault('Session credential is no longer valid.','SESSION_INVALID');
}
export async function checkAccessSession(decoded,kind,res) {
 if(!decoded.sid)return true; // Existing signed access tokens can migrate until their expiry.
 try {
  if(!mongoose.Types.ObjectId.isValid(decoded.sid)||!await AuthSession.exists({_id:decoded.sid,kind,accountId:decoded.id,revokedAt:null})) {res.status(401).json({success:false,code:'SESSION_REVOKED',message:'Session was revoked.'});return false;}
  return true;
 }catch {res.status(503).json({success:false,message:'Session validation temporarily unavailable.'});return false;}
}
export async function validateSocketSession(token) {
 const decoded=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']});
 if(!['parent','driver'].includes(decoded.tokenType))return decoded;
 if(decoded.sid && !await AuthSession.exists({_id:decoded.sid,kind:decoded.tokenType,accountId:decoded.id,revokedAt:null}))throw fault('Session revoked.','SESSION_REVOKED');
 const account=await(decoded.tokenType==='parent'?Parent:Driver).findById(decoded.id);
 assertAvailable(account,decoded.tokenType);
 return decoded;
}
export async function revokeRequestSession(req,kind) {
 const sid=req.authSessionId;
 if(sid){await AuthSession.updateOne({_id:sid,kind,accountId:req[kind]._id},{$set:{revokedAt:new Date()}});req.app.get('io')?.in('auth-session:'+sid).disconnectSockets(true);}
}
export function sessionHandlers(kind) {
 return {
  refresh:async(req,res)=>{try{return res.json(await refreshSession(req.body?.refreshToken,kind,req.body?.rotationId));}catch(error){return res.status(error.status||503).json({success:false,code:error.code||'SESSION_SERVICE_UNAVAILABLE',message:error.status?error.message:'Session renewal temporarily unavailable.'});}},
  migrate:async(req,res)=>{
   try {
    const token=req.headers.authorization?.replace(/^Bearer /,'');
    const decoded=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']});
    if(decoded.tokenType!==kind||!mongoose.Types.ObjectId.isValid(decoded.id))throw fault('Invalid access token.');
    if(decoded.sid)throw fault('Session credentials missing. Please sign in again.','SESSION_EXISTS',409);
    const account=await(kind==='parent'?Parent:Driver).findById(decoded.id);assertAvailable(account,kind);
    return res.json(await issueSession(account,kind));
   }catch(error){return res.status(error.status||(['TokenExpiredError','JsonWebTokenError'].includes(error.name)?401:503)).json({success:false,code:error.code||'SESSION_INVALID',message:'Unable to migrate session. Please sign in again.'});}
  },
  logout:async(req,res)=>{
   try {
    const parsed=parseRefresh(req.body?.refreshToken);
    let revokedId=null;
    if(parsed){const result=await AuthSession.updateOne({_id:parsed.id,kind,$or:[{currentHash:hash(parsed.secret)},{previousHash:hash(parsed.secret)}]},{$set:{revokedAt:new Date()}});if(result.matchedCount)revokedId=parsed.id;}
    else if(req.headers.authorization?.startsWith('Bearer ')){
     const decoded=jwt.verify(req.headers.authorization.slice(7),process.env.JWT_SECRET,{algorithms:['HS256']});
     if(decoded.tokenType===kind&&decoded.sid){await AuthSession.updateOne({_id:decoded.sid,kind,accountId:decoded.id},{$set:{revokedAt:new Date()}});req.app.get('io')?.in('auth-session:'+decoded.sid).disconnectSockets(true);}
    }
    if(revokedId)req.app.get('io')?.in('auth-session:'+revokedId).disconnectSockets(true);
    return res.json({success:true});
   }catch(error){return res.status(['TokenExpiredError','JsonWebTokenError'].includes(error.name)?401:503).json({success:false,message:'Could not revoke session.'});}
  },
 };
}
