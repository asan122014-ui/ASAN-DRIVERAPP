import express from 'express';
import Parent from '../models/Parent.js';
import {buildParentUpdates} from './parentRoutes.js';
import AuthSession from '../models/AuthSession.js';
import verifyParent from '../middleware/verifyParent.js';
import {reserveBudget} from '../middleware/adminLoginProtection.js';
import {startChallenge,consumeChallenge,notifyEmailChanged} from '../services/securityChallenges.js';
const router=express.Router();
const emailValue=body=>typeof body?.email==='string'?body.email.trim().toLowerCase():'';
router.post('/send-otp',verifyParent,async(req,res)=>{
  try {
    const email=emailValue(req.body), currentEmail=req.parent.email;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||email===currentEmail) return res.status(400).json({message:'Enter a different valid email address.'});
    if(!await reserveBudget('parent-email-change',String(req.parent._id),4))return res.status(429).json({message:'Too many requests. Please wait 15 minutes.'});
    if(await Parent.exists({email}))return res.status(409).json({message:'Email is already registered.'});
    const challengeId=await startChallenge({purpose:'parent-email-change',subject:req.parent._id,binding:currentEmail+':'+email,email,currentEmail});
    res.json({success:true,challengeId,message:'Separate verification codes were sent to your current and new email.'});
  } catch {res.status(503).json({message:'Unable to send verification codes. Your email has not changed.'});}
});
router.post('/verify-otp',verifyParent,async(req,res)=>{
  try {
    const email=emailValue(req.body), oldEmail=req.parent.email;
    let updates={};
    if(req.body?.profileUpdates != null) {
      if(typeof req.body.profileUpdates!=='object'||Array.isArray(req.body.profileUpdates))return res.status(400).json({message:'Invalid profile changes.'});
      if(Object.keys(req.body.profileUpdates).length){
        updates=await buildParentUpdates({...req,body:req.body.profileUpdates},res);
        if(!updates)return;
      }
    }
    const valid=await consumeChallenge({id:req.body?.challengeId,purpose:'parent-email-change',subject:req.parent._id,binding:oldEmail+':'+email,otp:req.body?.otp,currentOtp:req.body?.currentOtp});
    if(!valid)return res.status(400).json({message:'Invalid or expired codes. Request new codes after five attempts.'});
    // The version change atomically invalidates every previous access/refresh token,
    // including legacy access tokens that had no server-side session.
    const changed=await Parent.updateOne({_id:req.parent._id,email:oldEmail},{$set:{...updates,email},$inc:{sessionVersion:1}},{runValidators:true});
    if(changed.modifiedCount!==1)return res.status(409).json({message:'Account changed. Please sign in again.'});
    await AuthSession.updateMany({accountId:req.parent._id,kind:'parent',revokedAt:null},{$set:{revokedAt:new Date()}});
    req.app.get('io')?.in(String(req.parent._id)).disconnectSockets(true);
    await notifyEmailChanged(oldEmail);
    res.json({success:true,signInRequired:true,message:'Email verified and changed. Sign in using your new email.'});
  }catch(error){res.status(error.code===11000?409:503).json({message:error.code===11000?'Email is already registered.':'Unable to complete the change. Please sign in again to check your account.'});}
});
export default router;
