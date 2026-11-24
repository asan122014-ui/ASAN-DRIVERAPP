// Multer storage adapter for the current Cloudinary SDK. The legacy external
// adapter pins SDK v1 as a peer dependency; keeping it would prevent a normal
// production install of the patched SDK v2.
export class CloudinaryImageStorage {
  constructor({cloudinary,params}){this.cloudinary=cloudinary;this.params=params;}
  async _handleFile(req,file,callback){
    let finished=false;
    const done=(error,value)=>{if(finished)return;finished=true;callback(error,value);};
    try{
      const options=typeof this.params==='function'?await this.params(req,file):{...this.params};
      const upload=this.cloudinary.uploader.upload_stream(options,(error,result)=>{
        if(error)return done(error);
        if(!result?.public_id||!result?.secure_url)return done(new Error('Invalid image upload response'));
        done(null,{path:result.secure_url,filename:result.public_id,size:result.bytes,format:result.format,resource_type:'image',deliveryType:options.type||'upload'});
      });
      upload.once('error',done);
      file.stream.once('error',error=>{upload.destroy();done(error);});
      file.stream.pipe(upload);
    }catch(error){done(error);}
  }
  _removeFile(_req,file,callback){
    this.cloudinary.uploader.destroy(file.filename,{resource_type:'image',type:file.deliveryType||'upload',invalidate:true})
      .then(()=>callback(null)).catch(callback);
  }
}
