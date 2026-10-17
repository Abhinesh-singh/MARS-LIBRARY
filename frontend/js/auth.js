const Auth = {
  user(){ try{return JSON.parse(localStorage.getItem('library_user')||'null')}catch{return null} },
  async login(email,password){
    const data=await Api.post('/auth/login',{email,password});
    localStorage.setItem('library_token',data.token);
    localStorage.setItem('library_user',JSON.stringify(data.user));
    return data.user;
  },
  logout(showToast=true){
    localStorage.removeItem('library_token'); localStorage.removeItem('library_user');
    document.getElementById('dashboard-page')?.classList.remove('active');
    document.getElementById('login-page')?.classList.add('active');
    if(showToast) UI.toast('You have signed out.','success');
  },
  async profile(){
    if(!Api.token()) return null;
    try { const d=await Api.get('/auth/profile'); return d.user; }
    catch { return null; }
  }
};
window.Auth=Auth;
