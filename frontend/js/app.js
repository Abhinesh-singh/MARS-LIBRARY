const App = {
  pages:{
    dashboard:{title:'Dashboard',render:()=>Pages.dashboard()},
    books:{title:'Books',render:()=>Pages.books()},
    members:{title:'Members',render:()=>Pages.members()},
    transactions:{title:'Transactions',render:()=>Pages.transactions()},
    categories:{title:'Categories',render:()=>Pages.categories()},
    reports:{title:'Reports',render:()=>Pages.reports()}
  },
  async start(){
    document.getElementById('login-form').addEventListener('submit',async e=>{
      e.preventDefault();const error=document.getElementById('login-error');error.textContent='';
      const btn=e.currentTarget.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Signing in…';
      try{await Auth.login(document.getElementById('email').value.trim(),document.getElementById('password').value);await this.showDashboard()}
      catch(err){error.textContent=err.message}
      finally{btn.disabled=false;btn.textContent='Sign In'}
    });
    document.getElementById('logout-btn').addEventListener('click',()=>Auth.logout());
    document.getElementById('menu-toggle').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
    document.getElementById('modal-close').addEventListener('click',()=>UI.closeModal());
    document.getElementById('modal-overlay').addEventListener('click',e=>{if(e.target.id==='modal-overlay')UI.closeModal()});
    document.querySelectorAll('.nav-link').forEach(link=>link.addEventListener('click',e=>{e.preventDefault();this.navigate(link.dataset.page)}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape')UI.closeModal()});
    if(Api.token()){const user=await Auth.profile();if(user){localStorage.setItem('library_user',JSON.stringify(user));await this.showDashboard();return}Auth.logout(false)}
    document.getElementById('login-page').classList.add('active');
  },
  async showDashboard(){
    document.getElementById('login-page').classList.remove('active');
    document.getElementById('dashboard-page').classList.add('active');
    const user=Auth.user();document.getElementById('user-name').textContent=user?.username||'Librarian';
    await this.navigate('dashboard');
  },
  async navigate(name){
    const page=this.pages[name];if(!page)return;
    document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.page===name));
    document.getElementById('page-title').textContent=page.title;
    document.getElementById('sidebar').classList.remove('open');
    try{await page.render()}catch(e){document.getElementById('page-content').innerHTML=`<div class="inline-error"><strong>Could not load ${UI.escape(page.title)}.</strong><br>${UI.escape(e.message)}<br><button class="btn btn-outline" style="margin-top:12px" onclick="App.navigate('${name}')">Try again</button></div>`}
  }
};
window.App=App;
document.addEventListener('DOMContentLoaded',()=>App.start());
