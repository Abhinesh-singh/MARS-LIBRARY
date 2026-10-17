window.Pages=window.Pages||{};
Pages.reports=async function(){
 const root=document.getElementById('page-content');
 root.innerHTML=`<div class="page-heading"><div><h2>Reports</h2><p>Review overdue books, borrowing patterns and available stock.</p></div></div>
 <div class="report-grid">
 <article class="report-card"><div class="stat-icon"><i class="fas fa-clock"></i></div><h3 style="margin-top:15px">Overdue books</h3><p>Books past their due date and member details.</p><button class="btn btn-primary" onclick="Pages.showReport('overdue')">View report</button></article>
 <article class="report-card"><div class="stat-icon"><i class="fas fa-fire"></i></div><h3 style="margin-top:15px">Most borrowed</h3><p>Books ranked by total borrowing count.</p><button class="btn btn-primary" onclick="Pages.showReport('most-borrowed')">View report</button></article>
 <article class="report-card"><div class="stat-icon"><i class="fas fa-book"></i></div><h3 style="margin-top:15px">Available stock</h3><p>Books that currently have copies available.</p><button class="btn btn-primary" onclick="Pages.showReport('available-books')">View report</button></article>
 <article class="report-card"><div class="stat-icon"><i class="fas fa-users"></i></div><h3 style="margin-top:15px">Member statistics</h3><p>Borrowing totals, active loans and fines by member.</p><button class="btn btn-primary" onclick="Pages.showReport('member-statistics')">View report</button></article>
 </div><div id="report-output" style="margin-top:22px"></div>`;
};
Pages.showReport=async function(type){
 const target=document.getElementById('report-output');target.innerHTML='<div class="panel loading">Loading report…</div>';
 const paths={'overdue':'/reports/overdue','most-borrowed':'/reports/most-borrowed','available-books':'/reports/available-books','member-statistics':'/reports/member-statistics'};
 try{const d=await Api.get(paths[type]);const rows=d.data||[];let cols=rows.length?Object.keys(rows[0]):[];
 target.innerHTML=`<div class="table-card"><div style="padding:18px 20px;display:flex;align-items:center;justify-content:space-between"><strong>${type.replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase())}</strong><button class="btn btn-outline btn-sm" onclick="Pages.exportReport('${type}')"><i class="fas fa-download"></i> Export CSV</button></div><div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${UI.escape(c.replaceAll('_',' '))}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${cols.map(c=>`<td>${UI.escape(r[c]??'—')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${Math.max(cols.length,1)}" class="table-empty">No records found.</td></tr>`}</tbody></table></div></div>`;
 }catch(e){target.innerHTML=`<div class="inline-error">${UI.escape(e.message)}</div>`}
};
Pages.exportReport=async function(type){const map={'overdue':'/reports/overdue','most-borrowed':'/reports/most-borrowed','available-books':'/reports/available-books','member-statistics':'/reports/member-statistics'};await UI.run(async()=>{const d=await Api.get(map[type]),rows=d.data||[];if(!rows.length){UI.toast('No data to export','error');return}const cols=Object.keys(rows[0]),csv=[cols.join(','),...rows.map(r=>cols.map(c=>`"${String(r[c]??'').replaceAll('"','""')}"`).join(','))].join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download=`${type}-report.csv`;a.click();URL.revokeObjectURL(a.href)})};
