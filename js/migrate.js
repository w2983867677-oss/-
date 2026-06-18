/* 数据替换向导: 纯浏览器、零命令行，把脱敏数据整体替换为真实数据
   流程: ① 选 Excel 台账  ② 选人照文件夹  ③ 选房照文件夹  ④ 选航拍图(可选)
   自动按「成员编号→人照」「门牌→房照」「文件名→航拍图」关联，显示匹配报告，一键应用。
   照片存 IndexedDB(见 photos.js)；另提供「完整数据包」导出/导入，实现无命令行的跨机迁移。 */
const Migrate = {
  CN:{ '一':1,'二':2,'三':3,'四':4,'五':5,'六':6 },
  IMG_RE:/\.(jpe?g|png|webp|bmp|gif)$/i,
  draft:null,

  init(){
    this._reset();
    const $=id=>document.getElementById(id);
    $('mgExcel').onchange=e=>this._onExcel(e);
    $('mgPersonDir').onchange=e=>this._onPersonDir(e);
    $('mgHouseDir').onchange=e=>this._onHouseDir(e);
    $('mgAerial').onchange=e=>this._onAerial(e);
    $('mgApply').onclick=()=>this._apply();
    $('mgReset').onclick=()=>{ this._reset(); this.render(); U.toast('已清空向导草稿'); };
    $('mgExportPkg').onclick=()=>this._exportPackage();
    $('mgImportPkg').onchange=e=>this._importPackage(e);
    $('mgTemplate').onclick=()=>IO.template();
  },
  _reset(){
    this.draft={ households:[], personIndex:{}, houseIndex:{}, aerial:{}, photoBlobs:{},
      excelName:'', personCount:0, houseCount:0, village:(Store.meta&&Store.meta().village)||'' };
  },
  render(){
    if(document.getElementById('mgVillage')) document.getElementById('mgVillage').value=this.draft.village||'';
    this._renderReport();
  },

  // ---------- 工具 ----------
  _stem(name){ return name.replace(/\.[^.]+$/,''); },
  _imgs(fileList){ return [...fileList].filter(f=>this.IMG_RE.test(f.name)); },
  _groupNums(zhToken){ // "四六组"->[4,6]  "二组"->[2]
    const out=[]; for(const ch of zhToken){ if(this.CN[ch]&&!out.includes(this.CN[ch])) out.push(this.CN[ch]); } return out; },
  _parseDoor(door){ // "2-114" -> {g:'2',n:114}
    if(!door) return {}; const m=String(door).match(/(\d+)\s*[-—－]\s*(\d+)/); if(m) return {g:m[1],n:+m[2]};
    const m2=String(door).match(/^\s*(\d+)/); return m2?{g:m2[1]}:{};
  },

  // ---------- ① Excel ----------
  async _onExcel(e){
    const f=e.target.files[0]; if(!f) return;
    try{
      const list=await IO.parseExcel(f);
      this.draft.households=list; this.draft.excelName=f.name;
      this._relink();
      U.toast(`已解析 ${list.length} 户`);
    }catch(err){ U.toast('解析失败: '+err.message); }
    e.target.value=''; this._renderReport();
  },

  // ---------- ② 人照文件夹 ----------
  _onPersonDir(e){
    const files=this._imgs(e.target.files);
    const idx={};
    files.forEach(f=>{ idx[this._stem(f.name)]=f; });
    this.draft.personIndex=idx; this.draft.personCount=files.length;
    this._relink(); U.toast(`已载入人照 ${files.length} 张`);
    e.target.value=''; this._renderReport();
  },

  // ---------- ③ 房照文件夹 ----------
  _onHouseDir(e){
    const files=this._imgs(e.target.files);
    const idx={};
    files.forEach(f=>{
      const stem=this._stem(f.name);
      const gm=stem.match(/[一二三四五六]+组/);
      const nums=stem.match(/\d+/g);
      if(!gm||!nums) return;
      this._groupNums(gm[0]).forEach(gn=>nums.forEach(n=>{ idx[gn+'-'+n]=f; }));
    });
    this.draft.houseIndex=idx; this.draft.houseCount=files.length;
    this._relink(); U.toast(`已载入房照 ${files.length} 张`);
    e.target.value=''; this._renderReport();
  },

  // ---------- ④ 航拍图(可选) ----------
  _onAerial(e){
    const files=this._imgs(e.target.files);
    const pick=(f)=>{ const s=f.name;
      if(/村部|cunbu|全景/.test(s)) return 'cunbu';
      if(/四|六|46/.test(s)) return 'g46';
      if(/二|三|五|235/.test(s)) return 'g235';
      if(/一|1组|^g?1\b/.test(s)) return 'g1';
      return null; };
    files.forEach(f=>{ const id=pick(f); if(id) this.draft.aerial[id]=f; });
    U.toast(`已识别航拍图 ${Object.keys(this.draft.aerial).length} 张`);
    e.target.value=''; this._renderReport();
  },

  // ---------- 关联(把照片引用写入草稿 households) ----------
  _relink(){
    const d=this.draft, pIdx=d.personIndex, hIdx=d.houseIndex;
    d.photoBlobs={}; let pm=0, hm=0;
    d.households.forEach(h=>{
      (h.members||[]).forEach(m=>{
        m.photos=[];
        const code=m.code;
        if(code && pIdx[code]){ const key='p/'+code; d.photoBlobs[key]=pIdx[code]; m.photos=[Photos.ref(key)]; pm++; }
      });
      h.housePhotos=[];
      const dr=this._parseDoor(h.doorplate);
      if(dr.g && dr.n!=null){ const k=dr.g+'-'+dr.n; if(hIdx[k]){ const key='h/'+k; d.photoBlobs[key]=hIdx[k]; h.housePhotos=[Photos.ref(key)]; hm++; } }
    });
    d._personMatched=pm; d._houseMatched=hm;
  },

  // ---------- 匹配报告 ----------
  _renderReport(){
    const box=document.getElementById('mgReport'); if(!box) return;
    const d=this.draft;
    if(!d.households.length && !d.personCount && !d.houseCount){
      box.innerHTML='<p class="muted">请从第 ① 步开始：选择真实台账 Excel。可先「下载空白模板」按表头填写。</p>'; return;
    }
    const members=d.households.reduce((a,h)=>a+(h.members||[]).length,0);
    const houseWith=d.households.filter(h=>(h.housePhotos||[]).length).length;
    const memWith=d.households.reduce((a,h)=>a+(h.members||[]).filter(m=>(m.photos||[]).length).length,0);
    const groups=[...new Set(d.households.map(h=>h.group))].sort();
    const row=(k,v,extra)=>`<tr><td>${k}</td><td><b>${v}</b></td><td class="muted">${extra||''}</td></tr>`;
    box.innerHTML=`
      <table class="mg-report">
        <tbody>
          ${row('Excel 台账', d.excelName||'未选择', d.households.length?`解析 ${d.households.length} 户 / ${members} 人 / ${groups.length} 个组`:'')}
          ${row('人照关联', `${memWith} / ${members} 人`, d.personCount?`已载入 ${d.personCount} 张，按成员编号匹配`:'未选择人照文件夹')}
          ${row('房照关联', `${houseWith} / ${d.households.length} 户`, d.houseCount?`已载入 ${d.houseCount} 张，按门牌匹配`:'未选择房照文件夹')}
          ${row('航拍底图', `${Object.keys(d.aerial).length} 张`, '可选，按文件名(一组/二三五组/四六组/村部)识别')}
        </tbody>
      </table>
      <p class="muted">提示：人照请按「成员编号」命名(如 <code>T1_H_002_01.jpg</code>)；房照请保留「组+号」(如 <code>二组114号.jpg</code>)。匹配不到的不影响导入，可后续在户表里补充。</p>`;
  },

  // ---------- 网格点位(每张底图内均匀铺开，便于后续拖动微调) ----------
  _layout(households){
    const by={}; households.forEach(h=>(by[h.mapId]=by[h.mapId]||[]).push(h));
    Object.values(by).forEach(lst=>{
      const n=lst.length, cols=Math.max(1,Math.round(Math.sqrt(n)*1.3)), rows=Math.max(1,Math.ceil(n/cols));
      lst.forEach((h,i)=>{ const c=i%cols, r=Math.floor(i/cols);
        h.x=+(0.07+0.86*(c+0.5)/cols).toFixed(4); h.y=+(0.08+0.84*(r+0.5)/rows).toFixed(4); });
    });
  },

  // ---------- 应用到系统 ----------
  async _apply(){
    if(!requireEdit()) return;
    const d=this.draft;
    if(!d.households.length){ U.toast('请先选择 Excel 台账'); return; }
    if(!confirm(`确认用「${d.excelName}」整体替换当前台账？\n\n· ${d.households.length} 户将覆盖现有数据\n· 关联照片 ${Object.keys(d.photoBlobs).length} 张\n\n建议替换前先到「备份导出」做一次备份。`)) return;

    // 校验提示
    const vr=Validate.run(d.households);
    if(vr.total>0 && !confirm(`校验发现 ${vr.total} 项问题(详见"导入校验"页)。仍要继续替换吗？`)) return;

    U.toast('正在写入照片…');
    // 1) 旧导入照片清空，写入新照片
    if(Photos.available){ await Photos.clear(); await Photos.putMany(d.photoBlobs); }

    // 2) 组装数据集
    const maps=JSON.parse(JSON.stringify(Store.maps()));
    Object.keys(d.aerial).forEach(id=>{ const m=maps.find(x=>x.id===id); if(m){ m.image=Photos.ref('m/'+id); m.annotated=''; }});
    // 航拍图 blob 单独写入
    if(Photos.available && Object.keys(d.aerial).length){
      const ab={}; Object.keys(d.aerial).forEach(id=>ab['m/'+id]=d.aerial[id]); await Photos.putMany(ab);
    }
    let uid=0;
    d.households.forEach(h=>{
      h.uid='hh-'+String(++uid).padStart(4,'0');
      h.tags=U.detectTags([h.houseNote||''].concat((h.members||[]).map(m=>m.note||'')).join(' '));
      h.isLeader=h.isLeader||false;
    });
    this._layout(d.households);
    const dataset={
      meta:{ appName:'村户慧眼台账系统', village:(document.getElementById('mgVillage').value||d.village||'').trim()||'某村',
        generatedAt:U.now(), groupLeaders:{}, village_images:[], schemaVersion:1 },
      maps, households:d.households
    };
    Store.applyDataset(dataset, `${d.households.length}户/${Object.keys(d.photoBlobs).length}照片`);
    Validate.render(vr,`数据替换 ${d.excelName} · ${d.households.length} 户`);
    document.getElementById('mgStatus').textContent=`✓ 已替换为「${dataset.meta.village}」：${d.households.length} 户，关联照片 ${Object.keys(d.photoBlobs).length} 张。`;
    U.toast('数据替换完成');
    this._reset(); this._renderReport();
    switchView('map');
  },

  // ---------- 完整数据包(含图片) 导出/导入 ----------
  async _exportPackage(){
    U.toast('正在打包(含照片，请稍候)…');
    try{
      const photos={};
      const keys=Photos.available?await Photos.keys():[];
      for(const k of keys){ const blob=await Photos.get(k); if(blob) photos[k]=await this._blobToDataURL(blob); }
      const pkg={ _package:'村户慧眼台账·完整数据包', schemaVersion:1, time:U.now(),
        data:Store.data, log:Store.log, photos };
      const json=JSON.stringify(pkg);
      U.download(`村户台账完整数据包_${U.now().slice(0,10)}.json`, json, 'application/json');
      Store.addLog('导出数据包','完整',`${Store.all().length}户/${keys.length}照片`);
      U.toast(`已导出完整数据包(${keys.length} 张照片)`);
    }catch(err){ U.toast('打包失败: '+err.message); }
  },
  _importPackage(e){
    if(!requireEdit()){ e.target.value=''; return; }
    const f=e.target.files[0]; if(!f) return;
    if(!confirm(`确认从数据包「${f.name}」恢复？将覆盖当前全部数据与照片。`)){ e.target.value=''; return; }
    const r=new FileReader();
    r.onload=async ev=>{
      try{
        const pkg=JSON.parse(ev.target.result);
        const data=pkg.data||pkg; if(!data.households) throw new Error('非完整数据包格式');
        U.toast('正在恢复照片…');
        if(Photos.available){ await Photos.clear();
          const map={}; const ph=pkg.photos||{};
          for(const k of Object.keys(ph)){ map[k]=this._dataURLToBlob(ph[k]); }
          await Photos.putMany(map);
        }
        if(pkg.log){ Store.log=pkg.log; Store._persistLog(); }
        Store.applyDataset(data, `数据包恢复 ${data.households.length}户`);
        document.getElementById('mgStatus').textContent=`✓ 已从数据包恢复：${data.households.length} 户。`;
        U.toast('完整数据包已恢复'); switchView('map');
      }catch(err){ U.toast('恢复失败: '+err.message); }
    };
    r.readAsText(f); e.target.value='';
  },
  _blobToDataURL(blob){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(blob); }); },
  _dataURLToBlob(dataURL){
    const [head,b64]=dataURL.split(','); const mime=(head.match(/:(.*?);/)||[])[1]||'image/jpeg';
    const bin=atob(b64); const arr=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    return new Blob([arr],{type:mime});
  }
};
window.Migrate=Migrate;
