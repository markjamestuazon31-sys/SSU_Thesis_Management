import { getAssignedTheses } from '../../services/thesis.service.js';
import { pageHeader, thesisTable } from '../../components/ui.js';
export async function render({profile}){const rows=await getAssignedTheses(profile.uid);return `${pageHeader('Research Submitted to Me','Review manuscripts from students who selected you as their thesis adviser.')}<section class="panel"><div class="panel-body no-pad">${thesisTable(rows,{showOwner:true,actionLabel:'Review',actionRoute:id=>`/adviser/review/${id}`})}</div></section>`;} export function mount(){}
