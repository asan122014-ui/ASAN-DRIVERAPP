import Record from './models/Record.js';
import Driver from '../models/Driver.js';
import Parent from '../models/Parent.js';
import Child from '../models/Child.js';
import {enrollmentError} from './enrollmentPolicy.js';
import {enrollBatch} from './enrollment.js';
import {fixedMonthlyAmount} from './fixedFees.js';
export async function routeDriver(instituteName,data,currentId) {
 if(!data['Assigned driver'] && !data['Assigned driver ID'])return null;
 let driver;
 if(data['Assigned driver ID'])driver=await Driver.findOne({driverId:data['Assigned driver ID'],instituteName,accountSource:'institute',status:'approved'});
 else {const matches=await Driver.find({name:data['Assigned driver'],instituteName,accountSource:'institute',status:'approved'});if(matches.length===1)driver=matches[0];}
 if(!driver)throw enrollmentError('Select one enrolled, approved Institute driver.');
 const conflict=await Record.findOne({module:'Routes',instituteName,...(currentId?{id:{$ne:currentId}}:{}),$or:[{routeDriverId:driver.driverId},{'data.Assigned driver ID':driver.driverId},{routeDriverId:{$exists:false},'data.Assigned driver':driver.name}]});
 if(conflict)throw enrollmentError(`${driver.name} already belongs to route ${conflict.data?.['Route name']}. A driver can have only one route.`,409);
 data['Assigned driver']=driver.name;data['Assigned driver ID']=driver.driverId;return driver;
}
export async function routeFamilies(user,id) {
 const route=await Record.findOne({id,module:'Routes',instituteName:user.instituteName});if(!route)throw enrollmentError('Route not found.',404);
 const driver=await routeDriver(user.instituteName,route.data,route.id);if(!driver)throw enrollmentError('Assign an enrolled driver to this route first.');
 const parents=await Parent.find({instituteId:driver.instituteId,accountSource:'institute',isActive:{$ne:false}}).sort({name:1}).lean();
 const children=await Child.find({instituteId:driver.instituteId,accountSource:'institute',parentId:{$in:parents.map(parent=>parent._id)}}).lean();
 const records=await Record.find({module:'Students',instituteName:user.instituteName,'coreLink.model':'Child','coreLink.id':{$in:children.map(child=>child._id)}}).lean();
 const families=parents.map(parent=>{const siblings=children.filter(child=>String(child.parentId)===String(parent._id));const suggested=parent.driverId===driver.driverId||(parent.driverIds||[]).includes(driver.driverId)||siblings.some(child=>child.driverId===driver.driverId);return {id:String(parent._id),name:parent.name,email:parent.email,suggested,children:siblings.map(child=>{const record=records.find(row=>String(row.coreLink.id)===String(child._id));if(!record)return null;return {studentId:record.id,name:child.name,assignedRoute:child.assignedRouteName||'',monthlyFee:child.monthlyTransportFee??'',pickupStopId:child.assignedRouteId===route.id?child.pickupStopId||'':'',selected:suggested||child.assignedRouteId===route.id||child.assignedRouteName===route.data['Route name']};}).filter(Boolean)};});
 return {families,driverId:driver.driverId};
}
export async function assignRouteFamilies(user,id,items) {
 if(user.role!=='Institute Admin')throw enrollmentError('Only the Institute Admin can save family assignments.',403);
 if(!Array.isArray(items)||!items.length||items.length>100||items.some(item=>!item||typeof item.studentId!=='string')||new Set(items.map(item=>item.studentId)).size!==items.length)throw enrollmentError('Select between 1 and 100 unique students.');
 const route=await Record.findOne({id,module:'Routes',instituteName:user.instituteName});if(!route)throw enrollmentError('Route not found.',404);
 const driver=await routeDriver(user.instituteName,route.data,route.id);if(!driver)throw enrollmentError('Assign an enrolled driver first.');
 const records=await Record.find({id:{$in:items.map(item=>item.studentId)},module:'Students',instituteName:user.instituteName,'coreLink.model':'Child'}).lean();
 const children=await Child.find({_id:{$in:records.map(row=>row.coreLink.id)},instituteId:driver.instituteId,accountSource:'institute'}).lean();
 const parents=await Parent.find({_id:{$in:children.map(child=>child.parentId)},instituteId:driver.instituteId,accountSource:'institute'}).lean();
 const rows=items.map(item=>{const record=records.find(row=>row.id===item.studentId);const child=children.find(child=>String(child._id)===String(record?.coreLink?.id));const parent=parents.find(parent=>String(parent._id)===String(child?.parentId));if(!child||!parent)throw enrollmentError('A selected student does not belong to this Institute. Reload and review the selection.');return {kind:'child',reference:child.instituteReference,name:child.name,grade:child.grade,parentEmail:parent.email,driverEmail:driver.email,assignedRoute:route.data['Route name'],assignedVehicle:route.data['Assigned vehicle']||'',monthlyFee:fixedMonthlyAmount(item.monthlyFee),pickupStopId:item.pickupStopId||'',pickupTime:child.pickupTime,dropoffTime:child.eveningPickup};});
 await enrollBatch(user,rows);return {count:rows.length};
}
