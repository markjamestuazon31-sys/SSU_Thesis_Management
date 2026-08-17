import { createKey, setValue } from './db.service.js';
export async function logAudit(actorUid,action,details={}){if(!actorUid)return; const id=createKey('auditLogs'); await setValue(`auditLogs/${id}`,{actorUid,action,details,createdAt:Date.now()});}
