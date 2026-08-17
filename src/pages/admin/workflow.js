import { getAllTheses } from '../../services/thesis.service.js';
import { pageHeader, thesisTable } from '../../components/ui.js';
export async function render(){const rows=(await getAllTheses()).filter(t=>t.status!=='archived');return `${pageHeader('Thesis Workflow','Monitor every active thesis from submission through publication.')}<section class="panel"><div class="panel-body no-pad">${thesisTable(rows,{showOwner:true,showAdviser:true,actionLabel:'Manage',actionRoute:id=>`/admin/thesis/${id}`})}</div></section>`;} export function mount(){}
