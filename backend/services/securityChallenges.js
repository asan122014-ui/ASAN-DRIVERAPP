import crypto from 'node:crypto';
import Challenge from '../models/SecurityChallenge.js';
export const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const code = () => String(crypto.randomInt(100000,1000000));
export async function sendSecurityCode(email, otp, purpose) {
  if (!process.env.RESEND_API_KEY) throw new Error('Security email unavailable');
  const response = await fetch('https://api.resend.com/emails', {
    method:'POST', signal:AbortSignal.timeout(10000), headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
    body:JSON.stringify({from:process.env.PASSWORD_RESET_FROM_EMAIL || 'ASAN Rides <security@asanrides.com>',to:[email],
      subject:`ASAN Rides: ${purpose}`,text:`Your verification code is ${otp}. It expires in 5 minutes. Do not share this code. If you did not request this, contact ASAN Rides support.`})
  });
  if(!response.ok) throw new Error('Security email unavailable');
}
export async function notifyEmailChanged(email) {
  try {
    const response=await fetch('https://api.resend.com/emails',{
      method:'POST',signal:AbortSignal.timeout(10000),headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:process.env.PASSWORD_RESET_FROM_EMAIL || 'ASAN Rides <security@asanrides.com>',to:[email],subject:'ASAN Rides: your login email changed',text:'Your ASAN Rides login email was changed after verification. Previous sessions have been revoked. If you did not approve this, contact ASAN Rides support immediately.'})
    });
    if(!response.ok)throw new Error('Delivery failed');
  }catch{console.warn('Email-change security notice delivery failed.');}
}
export async function startChallenge({purpose,subject,binding,email,currentEmail}) {
  const id = crypto.randomBytes(24).toString('hex'), otp=code(), currentOtp=currentEmail?code():null;
  await Challenge.create({_id:id,purpose,subject:String(subject),binding,codeHash:digest(id+':'+otp),
    currentCodeHash:currentOtp?digest(id+':'+currentOtp):null,expiresAt:new Date(Date.now()+300000)});
  try {
    if(currentEmail) await sendSecurityCode(currentEmail,currentOtp,'Approve your email change');
    await sendSecurityCode(email,otp,purpose==='admin-login'?'Admin sign-in':'Verify your new email');
  } catch(error) {await Challenge.deleteOne({_id:id});throw error;}
  return id;
}
export async function consumeChallenge({id,purpose,subject,binding,otp,currentOtp}) {
  if(!/^[a-f0-9]{48}$/.test(String(id||''))) return false;
  // Reserve an attempt atomically before comparing; concurrent requests cannot bypass the cap.
  const filter={_id:id,purpose,subject:String(subject),binding,usedAt:null,expiresAt:{$gt:new Date()},attempts:{$lt:5}};
  const challenge=await Challenge.findOneAndUpdate(filter,{$inc:{attempts:1}},{returnDocument:'after'}).lean();
  if(!challenge) return false;
  const matches=(expected,value)=>typeof value==='string'&&/^\d{6}$/.test(value)&&expected===digest(id+':'+value);
  if(!matches(challenge.codeHash,otp)||(challenge.currentCodeHash&&!matches(challenge.currentCodeHash,currentOtp))) return false;
  const claimed=await Challenge.updateOne({...filter,attempts:{$lte:5}},{$set:{usedAt:new Date()}});
  return claimed.modifiedCount===1;
}
