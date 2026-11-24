import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  _id: String, purpose: String, subject: String, binding: String,
  codeHash: String, currentCodeHash: String, attempts: {type:Number,default:0},
  expiresAt: {type:Date,required:true}, usedAt: {type:Date,default:null}
});
schema.index({expiresAt:1},{expireAfterSeconds:0});
export default mongoose.models.SecurityChallenge || mongoose.model('SecurityChallenge',schema);
