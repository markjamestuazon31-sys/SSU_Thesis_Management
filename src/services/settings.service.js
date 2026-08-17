import { getValue, updateValue } from './db.service.js';
export async function getSystemSettings(){return(await getValue('system/settings'))||{academicYear:`${new Date().getFullYear()}-${new Date().getFullYear()+1}`,submissionOpen:true,repositoryTitle:'SSU Institutional Repository'};}
export async function updateSystemSettings(patch){await updateValue('system/settings',{...patch,updatedAt:Date.now()});return getSystemSettings();}
