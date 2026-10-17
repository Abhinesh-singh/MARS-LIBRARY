const UI = {
  toast(message,type='success'){
    const wrap=document.getElementById('toast-container'); if(!wrap)return;
    const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;wrap.appendChild(el);
    setTimeout(()=>el.remove(),3800);
  },
  escape(value=''){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  money(value){return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(Number(value||0));},
  date(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?String(value).slice(0,10):d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});},
  badge(status){const s=String(status||'unknown').toLowerCase();return `<span class="badge badge-${this.escape(s)}">${this.escape(s.replace('_',' '))}</span>`;},
  openModal(title,body,footer){
    document.getElementById('modal-title').textContent=title;
    document.getElementById('modal-body').innerHTML=body;
    document.getElementById('modal-footer').innerHTML=footer;
    document.getElementById('modal-overlay').classList.remove('hidden');
  },
  closeModal(){document.getElementById('modal-overlay').classList.add('hidden');},
  async run(action){try{await action()}catch(e){this.toast(e.message||'Something went wrong','error');}},
  async selectOptions(path,selected=''){
    const d=await Api.get(path);return (d.data||[]).map(x=>`<option value="${x.id}" ${String(x.id)===String(selected)?'selected':''}>${this.escape(x.name)}</option>`).join('');
  }
};
window.UI=UI;
