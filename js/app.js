/* 启动与导航 */
let CURRENT_VIEW='map';
function isActive(v){ return CURRENT_VIEW===v; }
const VIEWS=['map','list','dashboard','validate','io','ai','log'];
function switchView(v){
  if(!VIEWS.includes(v)) v='map';
  CURRENT_VIEW=v;
  if(location.hash!=='#'+v) try{history.replaceState(null,'','#'+v);}catch(e){}
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.view===v));
  document.querySelectorAll('.view').forEach(s=>s.classList.toggle('active',s.id==='view-'+v));
  const r={map:()=>MapView.render(),list:()=>ListView.render(),dashboard:()=>Dashboard.render(),
    validate:()=>{},io:()=>{},ai:()=>{},log:()=>LogView.render()}[v];
  if(r)r();
}
function requireEdit(){ if(Store.canEdit())return true; U.toast('该操作需要编辑角色，请点击右上角头衔切换'); Role.open(); return false; }

const Role={
  open(){ document.getElementById('roleModal').hidden=false; },
  close(){ document.getElementById('roleModal').hidden=true; },
  init(){
    document.getElementById('roleBadge').onclick=()=>this.open();
    document.getElementById('roleModalClose').onclick=()=>this.close();
    document.getElementById('roleModal').onclick=e=>{ if(e.target.id==='roleModal')this.close(); };
    document.querySelectorAll('#roleModal [data-role]').forEach(b=>b.onclick=()=>{
      const role=b.dataset.role;
      if(role==='editor'){ const pwd=document.getElementById('adminPwd').value;
        if(pwd && pwd!=='ysu2026'){ U.toast('口令错误'); return; } }
      Store.setRole(role); this.close();
      U.toast(role==='editor'?'已进入编辑角色':'已切换为查看角色');
      Store.addLog('切换角色',role==='editor'?'编辑':'查看','');
    });
    this.sync();
    Store.onChange(()=>this.sync());
  },
  sync(){ const b=document.getElementById('roleBadge'); const ed=Store.canEdit();
    b.textContent=ed?'编辑角色':'访客'; b.classList.toggle('editor',ed); }
};

const LogView={
  init(){ document.getElementById('clearLog').onclick=()=>{ if(confirm('确认清空操作日志？')){Store.clearLog();U.toast('日志已清空');} };
    Store.onChange(()=>{ if(isActive('log'))this.render(); }); },
  render(){
    document.getElementById('logCount').textContent=`共 ${Store.log.length} 条`;
    document.getElementById('logBody').innerHTML=Store.log.slice(0,500).map(l=>
      `<tr><td>${U.esc(l.time)}</td><td>${U.esc(l.role)}</td><td>${U.esc(l.action)}</td><td>${U.esc(l.target)}</td><td>${U.esc(l.detail)}</td></tr>`
    ).join('')||'<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">暂无日志</td></tr>';
  }
};

window.addEventListener('DOMContentLoaded',()=>{
  if(!window.INITIAL_DATA){ alert('未找到数据文件 data/ledger-data.js'); return; }
  Store.init();
  document.getElementById('tabs').onclick=e=>{ const t=e.target.closest('.tab'); if(t)switchView(t.dataset.view); };
  Role.init(); MapView.init(); ListView.init(); Dashboard.init();
  Validate.init(); IO.init(); AI.init(); LogView.init(); Search.init();
  const init=(location.hash||'').replace('#','');
  if(VIEWS.includes(init)) switchView(init); else MapView.render();
  window.addEventListener('hashchange',()=>{ const v=(location.hash||'').replace('#',''); if(VIEWS.includes(v)&&v!==CURRENT_VIEW) switchView(v); });
  console.log('村户慧眼台账系统 就绪 ·',Store.all().length,'户');
});
