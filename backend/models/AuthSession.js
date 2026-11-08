import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  accountId:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
  kind:{type:String,enum:['parent','driver'],required:true},
  currentHash:{type:String,required:true},previousHash:String,previousUntil:Date,rotationHash:String,
  revokedAt:{type:Date,default:null},lastRenewedAt:{type:Date,default:Date.now},
},{timestamps:true});
export default mongoose.models.AuthSession || mongoose.model('AuthSession',schema);
