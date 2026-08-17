import { getMyTheses } from '../../services/thesis.service.js';
import { pageHeader, thesisTable } from '../../components/ui.js';
export async function render({profile}){const rows=await getMyTheses(profile.uid);return `${pageHeader('My Theses','Monitor manuscript status, adviser feedback, revisions, approval, and publication.','<a class="btn btn-primary" href="#/student/submit">+ New submission</a>')}<section class="panel"><div class="panel-body no-pad">${thesisTable(rows,{showAdviser:true,actionRoute:id=>`/student/thesis/${id}`})}</div></section>`;} export function mount(){}
