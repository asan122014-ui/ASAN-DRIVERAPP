import {ipKeyGenerator} from 'express-rate-limit';
import Budget from '../models/LoginBudget.js';
import {digest} from '../services/securityChallenges.js';
export async function reserveBudget(scope,key,limit,windowMs=900000) {
  const slot=Math.floor(Date.now()/windowMs);
  const _id=digest(`${scope}:${key}:${slot}`);
  let row;
  try {row=await Budget.findOneAndUpdate({_id},{$inc:{count:1},$setOnInsert:{expiresAt:new Date((slot+2)*windowMs)}},{upsert:true,returnDocument:'after'}).lean();}
  catch(error) {if(error.code!==11000)throw error;row=await Budget.findOneAndUpdate({_id},{$inc:{count:1}},{returnDocument:'after'}).lean();}
  return row.count<=limit;
}
export const protectLogin = (scope='admin') => async(req,res,next)=>{
  try {
    const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
    if(!await reserveBudget(scope+':client',ipKeyGenerator(req.ip||req.socket.remoteAddress),40)||
       !await reserveBudget(scope+':account',email,10)) {
      res.set('Retry-After','900');
      return res.status(429).json({success:false,message:'Too many sign-in attempts. Please wait 15 minutes.'});
    }
    next();
  } catch {return res.status(503).json({success:false,message:'Sign-in protection temporarily unavailable. Please try again.'});}
};
