import { escapeHtml } from '../utils/dom.js';
import { formatDate } from '../utils/date.js';
import { titleCase } from '../utils/format.js';
import { icon } from './icons.js';

export function statusBadge(status='submitted'){return `<span class="status status-${escapeHtml(status)}">${escapeHtml(titleCase(status))}</span>`;}
export function pageHeader(title,description='',actions=''){return `<div class="page-header"><div><p class="eyebrow">SSU Research Portal</p><h1>${escapeHtml(title)}</h1>${description?`<p>${escapeHtml(description)}</p>`:''}</div>${actions?`<div class="page-actions">${actions}</div>`:''}</div>`;}
export function statCard({label,value,iconName='file',helper=''}){return `<article class="stat-card"><div class="stat-icon">${icon(iconName,22)}</div><div class="stat-main"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong>${helper?`<small>${escapeHtml(helper)}</small>`:''}</div></article>`;}
export function emptyState(title,description,action=''){return `<div class="empty-state"><div class="empty-icon">${icon('repository',30)}</div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${action}</div>`;}
export function loadingState(label='Loading records...'){return `<div class="loading-state"><span class="spinner"></span><p>${escapeHtml(label)}</p></div>`;}
export function thesisTable(rows=[],opts={}){
  const {showOwner=false,showAdviser=false,showProgram=false,showYear=false,actionLabel='View',actionRoute=(id)=>`/repository/${id}`}=opts;
  if(!rows.length)return emptyState('No thesis records found','Records matching this view will appear here.');
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Title</th>${showOwner?'<th>Student / Researchers</th>':''}${showProgram?'<th>Course / Program</th>':''}${showYear?'<th>Research Year</th>':''}${showAdviser?'<th>Adviser</th>':''}<th>Status</th><th>Updated</th><th></th></tr></thead><tbody>${rows.map(item=>{const label=typeof actionLabel==='function'?actionLabel(item):actionLabel;return `<tr><td><div class="table-title">${escapeHtml(item.title||'Untitled Thesis')}</div>${showProgram?'':`<div class="table-subtitle">${escapeHtml(item.program||'')}</div>`}</td>${showOwner?`<td><div>${escapeHtml(item.authors||item.studentName||item.ownerName||'—')}</div>${item.authors&&item.studentName?`<div class="table-subtitle">Submitted by ${escapeHtml(item.studentName)}</div>`:''}</td>`:''}${showProgram?`<td>${escapeHtml(item.program||'Not specified')}</td>`:''}${showYear?`<td><div>${escapeHtml(item.year||'—')}</div><div class="table-subtitle">${escapeHtml(item.academicYear||'')}</div></td>`:''}${showAdviser?`<td>${escapeHtml(item.adviserName||'Unassigned')}</td>`:''}<td>${statusBadge(item.status)}</td><td>${formatDate(item.updatedAt||item.createdAt)}</td><td class="table-action"><a class="text-link" href="#${actionRoute(item.id)}">${escapeHtml(label)} ${icon('arrow',15)}</a></td></tr>`;}).join('')}</tbody></table></div>`;
}
export function sectionCard(title,body,actions=''){return `<section class="panel"><div class="panel-header"><h2>${escapeHtml(title)}</h2>${actions?`<div>${actions}</div>`:''}</div><div class="panel-body">${body}</div></section>`;}
export function infoRow(label,value){return `<div class="info-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value??'—')}</strong></div>`;}
export function roleBadge(role='student'){return `<span class="role-badge role-${escapeHtml(role)}">${escapeHtml(titleCase(role))}</span>`;}
