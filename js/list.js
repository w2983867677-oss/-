/* 户表管理: 表格 + 筛选/搜索 + 全局搜索；Drawer: 详情/编辑 */
const ListView={
  init(){
    ['listSearch','filterGroup','filterTag','filterIndustry'].forEach(id=>{
      const el=document.getElementById(id); el.addEventListener('input',()=>this.render()); el.addEventListener('change',()=>this.render());
    });
    const fg=document.getElementById('filterGroup');
    [1,2,3,4,5,6].forEach(g=>fg.insertAdjacentHTML('beforeend',`<option value="${g}">${U.groupZh[g]}</option>`));
    document.getElementById('addHouseholdBtn').onclick=()=>{ if(!requireEdit())return; Drawer.openNew(); };
    Store.onChange(()=>{ if(isActive('list')) this.render(); });
  },
  refreshTagFilter(){
    const tf=document.getElementById('filterTag'); const cur=tf.value;
    const tags=new Set(); Store.all().forEach(h=>(h.tags||[]).forEach(t=>tags.add(t)));
    tf.innerHTML='<option value="">全部重点人群</option>'+[...tags].map(t=>`<option ${t===cur?'selected':''}>${t}</option>`).join('');
  },
  filtered(){
    const q=document.getElementById('listSearch').value.trim().toLowerCase();
    const g=document.getElementById('filterGroup').value;
    const tag=document.getElementById('filterTag').value;
    const ind=document.getElementById('filterIndustry').value;
    return Store.all().filter(h=>{
      if(g&&String(h.group)!==g) return false;
      if(tag&&!(h.tags||[]).includes(tag)) return false;
      if(ind==='plant'&&!(h.planting||'').trim()) return false;
      if(ind==='breed'&&!(h.breeding||'').trim()) return false;
      if(ind==='none'&&((h.planting||'').trim()||(h.breeding||'').trim())) return false;
      if(q){
        const hay=[h.id,h.doorplate,h.phone,h.planting,h.breeding,h.houseNote,
          ...(h.members||[]).map(m=>`${m.code} ${m.relation} ${m.note} ${m.phone}`)].join(' ').toLowerCase();
        if(!hay.includes(q)) return false;
      }
      return true;
    });
  },
  render(){
    this.refreshTagFilter();
    const list=this.filtered();
    document.getElementById('listCount').textContent=`${list.length} 户 / ${list.reduce((a,h)=>a+(h.members||[]).length,0)} 人`;
    const body=document.getElementById('ledgerBody');
    body.innerHTML=list.map(h=>{
      const head=(h.members||[])[0]||{};
      const tags=(h.tags||[]).map(t=>`<span class="mini-tag">${U.esc(t)}</span>`).join('')+(h.isLeader?'<span class="mini-tag leader-flag">组长</span>':'');
      const thumb=(h.housePhotos&&h.housePhotos[0])||(head.photos&&head.photos[0])||'';
      return `<tr data-uid="${h.uid}">
        <td>${U.esc(h.id)}</td><td>${U.groupZh[h.group]||h.group}</td>
        <td>${U.esc(head.code||'')}</td><td>${U.esc(h.doorplate||'—')}</td>
        <td>${(h.members||[]).length}</td><td>${U.esc(h.phone||'—')}</td>
        <td class="wrap">${U.esc(h.planting||'—')}</td><td class="wrap">${U.esc(h.breeding||'—')}</td>
        <td class="wrap">${tags||'—'}</td>
        <td>${thumb?`<img class="thumb-mini" src="${U.esc(U.img(thumb))}" loading="lazy"/>`:'—'}</td>
        <td>
          <button class="icon-btn" data-act="view" title="详情">👁</button>
          <button class="icon-btn" data-act="edit" title="编辑">✎</button>
          <button class="icon-btn" data-act="del" title="删除">🗑</button>
        </td></tr>`;
    }).join('')||`<tr><td colspan="11" style="text-align:center;color:#999;padding:30px">无匹配记录</td></tr>`;
    body.onclick=e=>{
      const tr=e.target.closest('tr'); if(!tr)return; const uid=tr.dataset.uid;
      const act=e.target.closest('button')?.dataset.act;
      if(act==='edit'){ if(!requireEdit())return; Drawer.open(uid,true); }
      else if(act==='del'){ if(!requireEdit())return; Drawer.confirmDelete(uid); }
      else Drawer.open(uid);
    };
  }
};

/* ---------------- 详情 / 编辑 抽屉 ---------------- */
const Drawer={
  cur:null,
  close(){ document.getElementById('drawer').hidden=true; document.getElementById('drawerMask').hidden=true; this.cur=null; },
  _shell(html){
    const d=document.getElementById('drawer'); d.hidden=false; d.innerHTML=html; d.scrollTop=0;
    document.getElementById('drawerMask').hidden=false;
    document.getElementById('drawerMask').onclick=()=>this.close();
  },
  open(uid,edit){
    const h=Store.get(uid); if(!h)return; this.cur=uid;
    if(edit) return this.edit(uid);
    const head=(h.members||[])[0]||{};
    const members=(h.members||[]).map(m=>`
      <div class="member-card">
        <img src="${U.esc(U.img((m.photos&&m.photos[0])||''))}" onerror="this.style.visibility='hidden'"/>
        <div class="mi">
          <div><b>${U.esc(m.code||'(未命名)')}</b> <span class="rel">${U.esc(m.relation||'')}</span> ${m.gender?U.esc(m.gender):''}</div>
          <div class="muted">证件:${U.esc(m.idMask||'—')}</div>
          ${m.note?`<div class="muted">备注:${U.esc(m.note)}</div>`:''}
          ${m.photos&&m.photos.length>1?`<div class="muted">照片 ${m.photos.length} 张</div>`:''}
        </div></div>`).join('');
    const hp=(h.housePhotos||[]).map(p=>{const s=U.img(p);return `<img src="${U.esc(s)}" onclick="U.lightbox('${U.esc(s)}')" loading="lazy"/>`;}).join('');
    const allPhotos=[].concat(...(h.members||[]).map(m=>m.photos||[]));
    const pp=allPhotos.map(p=>{const s=U.img(p);return `<img src="${U.esc(s)}" onclick="U.lightbox('${U.esc(s)}')" loading="lazy"/>`;}).join('');
    const tags=(h.tags||[]).map(t=>`<span class="mini-tag">${U.esc(t)}</span>`).join('')+(h.isLeader?'<span class="mini-tag leader-flag">组长 ★</span>':'');
    this._shell(`
      <div class="drawer-head"><div><h3>${U.esc(h.id)} · ${U.groupZh[h.group]||''}</h3>
        <div style="font-size:12px;opacity:.85">户主 ${U.esc(head.code||'')} · 门牌 ${U.esc(h.doorplate||'—')}</div></div>
        <button class="x" onclick="Drawer.close()">×</button></div>
      <div class="drawer-body">
        <div class="dsec"><div class="kv">
          <span class="k">户编号</span><span>${U.esc(h.id)}</span>
          <span class="k">所在组</span><span>${U.groupZh[h.group]||h.group}</span>
          <span class="k">门牌</span><span>${U.esc(h.doorplate||'—')}</span>
          <span class="k">联系电话</span><span>${U.esc(h.phone||'—')}</span>
          <span class="k">家庭人口</span><span>${(h.members||[]).length} 人</span>
          <span class="k">重点人群</span><span>${tags||'—'}</span>
        </div></div>
        <div class="dsec"><h4>产业 / 种养殖</h4><div class="kv">
          <span class="k">种植</span><span>${U.esc(h.planting||'—')}</span>
          <span class="k">养殖</span><span>${U.esc(h.breeding||'—')}</span>
          ${h.houseNote?`<span class="k">户备注</span><span>${U.esc(h.houseNote)}</span>`:''}
        </div></div>
        <div class="dsec"><h4>家庭成员 (${(h.members||[]).length})</h4>${members||'<p class="muted">暂无成员</p>'}</div>
        ${hp?`<div class="dsec"><h4>房屋照片</h4><div class="photo-grid">${hp}</div></div>`:''}
        ${pp?`<div class="dsec"><h4>人员照片</h4><div class="photo-grid">${pp}</div></div>`:''}
        <div class="dsec"><h4>AI 入户走访摘要</h4>
          <div class="ai-note" id="drawerSummary">点击下方按钮生成…</div>
          <div class="drawer-actions"><button class="btn" onclick="document.getElementById('drawerSummary').innerHTML=AI.summaryHTML('${h.uid}')">生成走访摘要</button>
            <button class="btn" onclick="MapView.cur='${h.mapId}';switchView('map');MapView.render();Drawer.close()">在地图定位</button></div>
        </div>
        <div class="drawer-actions">
          <button class="btn primary" onclick="Drawer.edit('${h.uid}')">✎ 编辑</button>
          <button class="btn danger" onclick="Drawer.confirmDelete('${h.uid}')">🗑 删除该户</button>
        </div>
      </div>`);
  },

  edit(uid){
    if(!requireEdit())return;
    const h=uid?Store.get(uid):null; this.cur=uid; const isNew=!h;
    const d=h||{group:1,seq:'',doorplate:'',phone:'',planting:'',breeding:'',houseNote:'',members:[{code:'',relation:'户主',gender:'',idMask:'',note:'',photos:[]}],mapId:'g1',x:.5,y:.5};
    const memRows=(d.members||[]).map((m,i)=>this._memRow(m,i)).join('');
    this._shell(`
      <div class="drawer-head"><h3>${isNew?'新增户':'编辑 '+U.esc(d.id||'')}</h3>
        <button class="x" onclick="Drawer.close()">×</button></div>
      <div class="drawer-body"><div class="edit-form" id="ef">
        <div class="form-grid">
          <div><label>所在组</label><select id="f_group">${[1,2,3,4,5,6].map(g=>`<option value="${g}" ${d.group==g?'selected':''}>${U.groupZh[g]}</option>`).join('')}</select></div>
          <div><label>户编号(序号)</label><input id="f_seq" value="${U.esc(d.seq||'')}" placeholder="如 12"/></div>
          <div><label>门牌</label><input id="f_door" value="${U.esc(d.doorplate||'')}" placeholder="如 1-22"/></div>
          <div><label>联系电话</label><input id="f_phone" value="${U.esc(d.phone||'')}"/></div>
        </div>
        <label>种植情况</label><textarea id="f_plant">${U.esc(d.planting||'')}</textarea>
        <label>养殖情况</label><textarea id="f_breed">${U.esc(d.breeding||'')}</textarea>
        <label>户备注(其他)</label><textarea id="f_note">${U.esc(d.houseNote||'')}</textarea>
        <label>归属航拍图</label><select id="f_map">${Store.maps().map(m=>`<option value="${m.id}" ${d.mapId===m.id?'selected':''}>${U.esc(m.label)}</option>`).join('')}</select>
        <h4 style="color:var(--green-d);margin:14px 0 4px">家庭成员</h4>
        <div id="memList">${memRows}</div>
        <button class="btn ghost" type="button" onclick="Drawer.addMemRow()">＋ 添加成员</button>
        <div class="drawer-actions">
          <button class="btn primary" onclick="Drawer.save('${uid||''}')">💾 保存</button>
          <button class="btn" onclick="Drawer.close()">取消</button>
        </div>
      </div></div>`);
  },
  _memRow(m,i){
    return `<div class="member-card" data-mi="${i}" style="display:block">
      <div class="form-grid">
        <div><label>成员编号</label><input class="m_code" value="${U.esc(m.code||'')}"/></div>
        <div><label>关系</label><input class="m_rel" value="${U.esc(m.relation||'')}"/></div>
        <div><label>性别</label><select class="m_sex"><option ${m.gender===''?'selected':''}></option><option ${m.gender==='男'?'selected':''}>男</option><option ${m.gender==='女'?'selected':''}>女</option></select></div>
        <div><label>身份证(脱敏)</label><input class="m_id" value="${U.esc(m.idMask||'')}"/></div>
      </div>
      <label>成员备注</label><input class="m_note" value="${U.esc(m.note||'')}"/>
      <input type="hidden" class="m_photos" value="${U.esc((m.photos||[]).join('|'))}"/>
      <button class="btn ghost" type="button" style="margin-top:6px" onclick="this.closest('.member-card').remove()">删除成员</button>
    </div>`;
  },
  addMemRow(){ document.getElementById('memList').insertAdjacentHTML('beforeend',this._memRow({relation:'',gender:''},Date.now())); },
  save(uid){
    const $=s=>document.getElementById(s);
    const members=[...document.querySelectorAll('#memList .member-card')].map(c=>({
      code:c.querySelector('.m_code').value.trim(),
      relation:c.querySelector('.m_rel').value.trim(),
      gender:c.querySelector('.m_sex').value,
      idMask:c.querySelector('.m_id').value.trim(),
      note:c.querySelector('.m_note').value.trim(),
      phone:'',
      photos:c.querySelector('.m_photos').value?c.querySelector('.m_photos').value.split('|').filter(Boolean):[]
    })).filter(m=>m.code||m.relation||m.idMask);
    const group=+$('f_group').value, seq=$('f_seq').value.trim();
    const patch={group,seq,doorplate:$('f_door').value.trim(),phone:$('f_phone').value.trim(),
      planting:$('f_plant').value.trim(),breeding:$('f_breed').value.trim(),houseNote:$('f_note').value.trim(),
      mapId:$('f_map').value,members};
    if(uid){
      if(seq) patch.id=`H${group}_${String(seq).padStart(3,'0')}`;
      Store.updateHousehold(uid,patch); U.toast('已保存修改'); this.open(uid);
    }
    else{
      patch.id=`H${group}_${String(seq||Store.all().filter(h=>h.group===group).length+1).padStart(3,'0')}`;
      patch.housePhotos=[]; patch.x=.5; patch.y=.5;
      const h=Store.addHousehold(patch); U.toast('已新增户'); this.open(h.uid);
    }
  },
  openNew(){ this.edit(null); },
  confirmDelete(uid){
    const h=Store.get(uid); if(!h)return;
    if(confirm(`确认删除 ${h.id}（户主 ${(h.members[0]||{}).code||''}）？此操作会记入日志。`)){
      Store.deleteHousehold(uid); this.close(); U.toast('已删除');
    }
  }
};

/* ---------------- 全局搜索 ---------------- */
const Search={
  init(){
    const ov=document.getElementById('searchOverlay'),inp=document.getElementById('globalSearch');
    document.getElementById('searchBtn').onclick=()=>this.toggle(true);
    ov.onclick=e=>{ if(e.target===ov) this.toggle(false); };
    inp.addEventListener('input',()=>this.run(inp.value));
    document.addEventListener('keydown',e=>{
      if(e.key==='/'&&!/input|textarea|select/i.test(document.activeElement.tagName)){ e.preventDefault(); this.toggle(true); }
      if(e.key==='Escape'){ this.toggle(false); Drawer.close(); }
    });
  },
  toggle(show){ const ov=document.getElementById('searchOverlay'); ov.hidden=!show; if(show){document.getElementById('globalSearch').focus();this.run('');} },
  run(q){
    q=q.trim().toLowerCase(); const box=document.getElementById('searchResults');
    if(!q){ box.innerHTML='<div class="sr-item d" style="padding:14px">输入关键词搜索全村台账…</div>'; return; }
    const res=Store.all().filter(h=>{
      const hay=[h.id,h.doorplate,h.phone,h.planting,h.breeding,h.houseNote,
        ...(h.members||[]).map(m=>`${m.code} ${m.relation} ${m.note}`)].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice(0,40);
    box.innerHTML=res.map(h=>{const head=(h.members||[])[0]||{};
      return `<div class="sr-item" data-uid="${h.uid}"><div class="t">${U.esc(h.id)} · ${U.esc(head.code||'')} <span class="muted">${U.groupZh[h.group]}</span></div>
      <div class="d">门牌${U.esc(h.doorplate||'—')} · ${U.esc(h.planting||'')} ${U.esc(h.breeding||'')} ${(h.tags||[]).join(' ')}</div></div>`;
    }).join('')||'<div class="sr-item d" style="padding:14px">无匹配</div>';
    box.onclick=e=>{ const it=e.target.closest('.sr-item'); if(!it||!it.dataset.uid)return; this.toggle(false); Drawer.open(it.dataset.uid); };
  }
};
