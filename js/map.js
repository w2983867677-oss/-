/* 航拍地图视图: 底图切换 + 点位标注 + 拖动编辑 + 点击详情 */
const MapView = {
  cur:'g1', annotated:false,
  init(){
    const sw=document.getElementById('mapSwitch');
    sw.innerHTML=Store.maps().map(m=>`<button data-map="${m.id}">${U.esc(m.label)}</button>`).join('');
    sw.onclick=e=>{ const b=e.target.closest('button'); if(!b)return; this.cur=b.dataset.map; this.render(); };
    document.getElementById('toggleAnnotated').onchange=e=>{ this.annotated=e.target.checked; this.render(); };
    document.getElementById('toggleLabels').onchange=()=>this.render();
    document.getElementById('editPos').onchange=e=>{
      if(e.target.checked && !Store.canEdit()){ e.target.checked=false; U.toast('请切换到编辑角色'); return; }
      document.getElementById('mapCanvas').classList.toggle('editing',e.target.checked);
      document.getElementById('mapHint').textContent=e.target.checked?'拖动点位调整位置，自动保存':'点击点位查看该户台账';
    };
    // 填充筛选
    const gf=document.getElementById('mapGroupFilter');
    [1,2,3,4,5,6].forEach(g=>gf.insertAdjacentHTML('beforeend',`<option value="${g}">${U.groupZh[g]}</option>`));
    gf.onchange=()=>this.render();
    document.getElementById('mapTagFilter').onchange=()=>this.render();
    Store.onChange(()=>{ if(isActive('map')) this.render(); });
  },
  refreshTagFilter(){
    const tf=document.getElementById('mapTagFilter'); const cur=tf.value;
    const tags=new Set(); Store.all().forEach(h=>(h.tags||[]).forEach(t=>tags.add(t)));
    tf.innerHTML='<option value="">全部人群</option>'+[...tags].map(t=>`<option ${t===cur?'selected':''}>${t}</option>`).join('');
  },
  render(){
    this.refreshTagFilter();
    const map=Store.maps().find(m=>m.id===this.cur)||Store.maps()[0];
    document.querySelectorAll('#mapSwitch button').forEach(b=>b.classList.toggle('active',b.dataset.map===this.cur));
    const img=document.getElementById('mapImg');
    const annEl=document.getElementById('toggleAnnotated');
    annEl.disabled=!map.annotated;
    img.src=(this.annotated&&map.annotated)?map.annotated:map.image;
    const showLab=document.getElementById('toggleLabels').checked;
    const gf=document.getElementById('mapGroupFilter').value;
    const tf=document.getElementById('mapTagFilter').value;
    const box=document.getElementById('markers'); box.innerHTML='';
    const list=Store.all().filter(h=>h.mapId===this.cur
      && (!gf||String(h.group)===gf)
      && (!tf||(h.tags||[]).includes(tf)));
    list.forEach(h=>{
      const head=(h.members||[])[0]||{};
      const cls=h.isLeader?'leader':((h.tags||[]).length?'tag':'');
      const el=document.createElement('div');
      el.className='marker '+cls; el.style.left=(h.x*100)+'%'; el.style.top=(h.y*100)+'%';
      el.title=`${h.id} ${head.code||''}`;
      el.innerHTML=`<div class="pin"></div>`+(showLab?`<div class="lab">${U.esc(h.id)}${h.isLeader?' ★':''}</div>`:'');
      el.dataset.uid=h.uid;
      box.appendChild(el);
      this._bind(el,h);
    });
    document.getElementById('mapHint').textContent=
      document.getElementById('editPos').checked?'拖动点位调整位置，自动保存':`本图 ${list.length} 户 · 点击点位查看台账`;
  },
  _bind(el,h){
    let drag=false,moved=false;
    el.addEventListener('pointerdown',e=>{
      if(!document.getElementById('editPos').checked) return;
      drag=true; moved=false; el.setPointerCapture(e.pointerId); e.preventDefault();
    });
    el.addEventListener('pointermove',e=>{
      if(!drag) return; moved=true;
      const r=document.getElementById('mapImg').getBoundingClientRect();
      let x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
      x=Math.max(0,Math.min(1,x)); y=Math.max(0,Math.min(1,y));
      el.style.left=(x*100)+'%'; el.style.top=(y*100)+'%'; el._nx=x; el._ny=y;
    });
    el.addEventListener('pointerup',()=>{
      if(drag&&moved&&el._nx!=null){ Store.setPos(h.uid,+el._nx.toFixed(4),+el._ny.toFixed(4)); U.toast(`${h.id} 点位已保存`); }
      drag=false;
    });
    el.addEventListener('click',()=>{ if(!moved) Drawer.open(h.uid); });
  }
};
