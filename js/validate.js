/* 批量导入校验: 字段缺失 / 身份证·电话格式 / 门牌·经纬度异常 / 重复户 */
const Validate={
  init(){
    document.getElementById('validateCurrent').onclick=()=>{
      const r=this.run(Store.all());
      this.render(r,`当前台账共 ${Store.all().length} 户`);
      Store.addLog('数据校验','当前台账',`问题${r.total}项`);
    };
    document.getElementById('validateFile').onchange=async e=>{
      const f=e.target.files[0]; if(!f)return;
      try{ const list=await IO.parseExcel(f); const r=this.run(list);
        this.render(r,`文件 ${f.name} 解析 ${list.length} 户`); }
      catch(err){ U.toast('解析失败: '+err.message); }
      e.target.value='';
    };
  },
  run(list){
    const cats={missing:[],idfmt:[],phonefmt:[],geo:[],dup:[]};
    const headSeen={},doorSeen={},memberSeen={};
    list.forEach(h=>{
      const head=(h.members||[])[0]||{};
      const tag=h.id||`组${h.group}#${h.seq||'?'}`;
      // 缺失
      if(!head.code) cats.missing.push(`${tag}：缺少户主编号`);
      if(!(h.doorplate||'').trim()) cats.missing.push(`${tag}：缺少门牌`);
      if(!(h.phone||'').trim()) cats.missing.push(`${tag}：缺少联系电话`);
      if(!(h.members||[]).length) cats.missing.push(`${tag}：无任何成员`);
      // 身份证/电话格式
      (h.members||[]).forEach(m=>{
        if(m.idMask){ const v=U.validId(m.idMask); if(!v.ok) cats.idfmt.push(`${tag} / ${m.code||m.relation}：身份证「${m.idMask}」${v.reason}`); }
        if(m.phone){ const v=U.validPhone(m.phone); if(!v.ok) cats.phonefmt.push(`${tag} / ${m.code}：电话「${m.phone}」${v.reason}`); }
      });
      if(h.phone){ const v=U.validPhone(h.phone); if(!v.ok) cats.phonefmt.push(`${tag}：户电话「${h.phone}」${v.reason}`); }
      // 门牌 / 经纬度
      if(h.doorplate){ const v=U.validDoor(h.doorplate); if(!v.ok) cats.geo.push(`${tag}：门牌「${h.doorplate}」${v.reason}`); }
      if(h.x!=null&&(h.x<0||h.x>1)||h.y!=null&&(h.y<0||h.y>1)) cats.geo.push(`${tag}：地图点位坐标超出范围`);
      if(h.lat!=null||h.lng!=null){ const v=U.validGeo(h.lat,h.lng); if(!v.ok) cats.geo.push(`${tag}：经纬度${v.reason}`); }
      // 重复
      if(head.code){ if(headSeen[head.code]) cats.dup.push(`${tag}：户主编号「${head.code}」与 ${headSeen[head.code]} 重复`); else headSeen[head.code]=tag; }
      if((h.doorplate||'').trim()){ const d=h.doorplate.trim(); if(doorSeen[d]) cats.dup.push(`${tag}：门牌「${d}」与 ${doorSeen[d]} 重复`); else doorSeen[d]=tag; }
      (h.members||[]).forEach(m=>{ if(m.code){ if(memberSeen[m.code]&&memberSeen[m.code]!==tag) cats.dup.push(`${tag}：成员编号「${m.code}」在 ${memberSeen[m.code]} 已出现`); else memberSeen[m.code]=tag; }});
    });
    cats.total=Object.values(cats).filter(Array.isArray).reduce((a,b)=>a+b.length,0);
    return cats;
  },
  render(r,summary){
    document.getElementById('validateSummary').textContent=`${summary} · 发现 ${r.total} 项问题`;
    const defs=[
      ['missing','字段缺失','warn'],['idfmt','身份证格式异常','err'],
      ['phonefmt','联系方式格式异常','err'],['geo','门牌/经纬度异常','warn'],['dup','重复户/重复编号','err']];
    const box=document.getElementById('validateResult');
    box.innerHTML=defs.map(([k,title,lvl])=>{
      const items=r[k]; const cls=items.length?lvl:'ok';
      const head=`<div class="vh"><span>${title}</span><span>${items.length} 项</span></div>`;
      const body=items.length?items.slice(0,200).map(t=>`<div class="vr-item">${U.esc(t)}</div>`).join('')
        :`<div class="vr-item">✓ 未发现问题</div>`;
      return `<div class="vr-group ${cls}">${head}${body}</div>`;
    }).join('')+
    (r.total===0?'<p class="ai-note">🎉 全部校验通过，数据可放心使用。</p>':'');
  }
};
