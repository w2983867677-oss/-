/* 数据仓库: localStorage 持久化 + CRUD + 操作日志 + 角色 */
const Store = {
  KEY:'vhl.data.v1', LOG:'vhl.log.v1', SESS:'vhl.sess.v1',
  data:null, log:[], role:'viewer',
  listeners:[],

  init(){
    let raw=null;
    try{ raw=JSON.parse(localStorage.getItem(this.KEY)); }catch(e){}
    if(raw && raw.households){ this.data=raw; }
    else { this.data=this._clone(window.INITIAL_DATA); this._persist(); }
    try{ this.log=JSON.parse(localStorage.getItem(this.LOG))||[]; }catch(e){ this.log=[]; }
    try{ this.role=(JSON.parse(localStorage.getItem(this.SESS))||{}).role||'viewer'; }catch(e){}
    // 重建索引
    this._reindex();
  },
  _clone(o){ return JSON.parse(JSON.stringify(o)); },
  _reindex(){
    this.byUid={}; (this.data.households||[]).forEach(h=>this.byUid[h.uid]=h);
  },
  _persist(){ try{ localStorage.setItem(this.KEY,JSON.stringify(this.data)); }catch(e){ U.toast('存储空间不足'); } this._reindex(); },
  _persistLog(){ try{ localStorage.setItem(this.LOG,JSON.stringify(this.log.slice(0,2000))); }catch(e){} },

  onChange(fn){ this.listeners.push(fn); },
  emit(){ this.listeners.forEach(f=>{try{f();}catch(e){console.error(e);}}); },

  // ---- 角色 ----
  setRole(r){ this.role=r; try{localStorage.setItem(this.SESS,JSON.stringify({role:r}));}catch(e){} this.emit(); },
  canEdit(){ return this.role==='editor'; },

  // ---- 日志 ----
  addLog(action,target,detail){
    this.log.unshift({time:U.now(),role:this.role==='editor'?'编辑':'查看',action,target:target||'',detail:detail||''});
    this._persistLog();
  },
  clearLog(){ this.log=[]; this._persistLog(); this.emit(); },

  // ---- 查询 ----
  all(){ return this.data.households; },
  get(uid){ return this.byUid[uid]; },
  maps(){ return this.data.maps; },
  meta(){ return this.data.meta; },

  // ---- 写操作 ----
  _newUid(){ let i=1; while(this.byUid['hh-'+String(i).padStart(4,'0')]) i++; return 'hh-'+String(i).padStart(4,'0'); },
  refreshTags(h){
    const text=[h.houseNote||''].concat((h.members||[]).map(m=>m.note||'')).join(' ');
    h.tags=U.detectTags(text); return h;
  },
  addHousehold(h){
    h.uid=this._newUid();
    h.members=h.members||[]; h.tags=h.tags||[]; h.housePhotos=h.housePhotos||[];
    this.refreshTags(h);
    this.data.households.push(h); this._persist();
    this.addLog('新增户',h.id||h.uid,`组${h.group} 户主${(h.members[0]||{}).code||''}`);
    this.emit(); return h;
  },
  updateHousehold(uid,patch){
    const h=this.byUid[uid]; if(!h) return;
    Object.assign(h,patch); this.refreshTags(h); this._persist();
    this.addLog('编辑户',h.id||uid,patch._reason||'修改台账信息');
    this.emit(); return h;
  },
  deleteHousehold(uid){
    const h=this.byUid[uid]; if(!h) return;
    this.data.households=this.data.households.filter(x=>x.uid!==uid); this._persist();
    this.addLog('删除户',h.id||uid,`户主${(h.members[0]||{}).code||''}`);
    this.emit();
  },
  setPos(uid,x,y){
    const h=this.byUid[uid]; if(!h) return;
    h.x=x; h.y=y; this._persist(); // 点位调整不写日志(频繁)
  },

  // ---- 导入(合并/覆盖) ----
  importHouseholds(list,mode){
    if(mode==='replace'){ this.data.households=[]; this._reindex(); }
    let added=0,merged=0;
    list.forEach(nh=>{
      const exist=this.data.households.find(h=>h.group===nh.group && h.seq===nh.seq && nh.seq);
      if(exist && mode==='merge'){ Object.assign(exist,nh,{uid:exist.uid}); this.refreshTags(exist); merged++; }
      else { nh.uid=this._newUid(); this.refreshTags(nh); this.data.households.push(nh); this.byUid[nh.uid]=nh; added++; }
    });
    this._persist();
    this.addLog('批量导入',`${mode==='replace'?'覆盖':'合并'}`,`新增${added}户/更新${merged}户`);
    this.emit(); return {added,merged};
  },
  replaceAll(data){ this.data=data; this._persist(); this.addLog('恢复备份','全量',`${data.households.length}户`); this.emit(); },
  // 数据替换向导应用整套新数据(户+地图+meta)
  applyDataset(data,summary){ this.data=data; this._persist(); this.addLog('数据替换','整库导入',summary||`${(data.households||[]).length}户`); this.emit(); },
  reset(){ this.data=this._clone(window.INITIAL_DATA); this._persist(); this.addLog('恢复初始数据','全量',''); this.emit(); },

  // ---- 统计 ----
  stats(){
    const hs=this.data.households, s={
      households:hs.length, members:0, groups:{}, tags:{}, mu:0, livestock:0,
      plantHH:0, breedHH:0, withPhoto:0, leaders:0
    };
    hs.forEach(h=>{
      s.members+=(h.members||[]).length;
      s.groups[h.group]=s.groups[h.group]||{hh:0,people:0};
      s.groups[h.group].hh++; s.groups[h.group].people+=(h.members||[]).length;
      (h.tags||[]).forEach(t=>s.tags[t]=(s.tags[t]||0)+1);
      s.mu+=U.parseMu(h.planting); s.livestock+=U.parseLivestock(h.breeding);
      if((h.planting||'').trim()) s.plantHH++;
      if((h.breeding||'').trim()) s.breedHH++;
      if(h.housePhotos&&h.housePhotos.length || (h.members||[]).some(m=>m.photos&&m.photos.length)) s.withPhoto++;
      if(h.isLeader) s.leaders++;
    });
    s.keyPeople=hs.filter(h=>(h.tags||[]).some(t=>U.KEY_GROUP.includes(t)));
    return s;
  }
};
