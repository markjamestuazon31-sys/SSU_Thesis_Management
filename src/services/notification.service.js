import { createKey, getValue, setValue, updateValue } from './db.service.js';
export async function createNotification(uid,{title,message,type='info',route='/dashboard',actorUid=''}){if(!uid)return null;const id=createKey(`notifications/${uid}`);await setValue(`notifications/${uid}/${id}`,{title,message,type,route,actorUid,read:false,createdAt:Date.now()});return id;}
export async function getNotifications(uid){const d=await getValue(`notifications/${uid}`);if(!d)return[];return Object.entries(d).map(([id,item])=>({id,...item})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));}
export async function markNotificationRead(uid,id){await updateValue(`notifications/${uid}/${id}`,{read:true});}
export async function markAllNotificationsRead(uid){const items=await getNotifications(uid);await Promise.all(items.filter(i=>!i.read).map(i=>markNotificationRead(uid,i.id)));}
