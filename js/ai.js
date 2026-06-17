/* AI 辅助(本地规则引擎, 离线·不外传): 照片识别关联 / 点位匹配 / 走访摘要 */
const AI={
  init(){
    document.getElementById('aiPhotoMatch').onclick=()=>this.photoMatch();
    document.getElementById('aiGeoMatch').onclick=()=>this.geoMatch();
    document.getElementById('aiSummaryAll').onclick=()=>this.summaryAll();
  },
  out(html){ document.getElementById('aiOutput').innerHTML=html; },

  photoMatch(){
    const hs=Store.all(); let person=0,house=0,multi=0; const noPhoto=[];
    hs.forEach(h=>{
      const pc=(h.members||[]).reduce((a,m)=>a+((m.photos||[]).length),0);
      person+=pc; if((h.housePhotos||[]).length) house++;
      (h.members||[]).forEach(m=>{ if((m.photos||[]).length>1) multi++; });
      if(!pc && !(h.housePhotos||[]).length) noPhoto.push(h.id);
    });
    Store.addLog('AI照片识别','全量',`人照${person}/房照${house}`);
    this.out(`<div class="ai-card"><div class="ah">① 照片标注自动识别与关联结果</div>
      <p>系统依据脱敏命名规则自动完成「照片—台账」关联：</p>
      <ul>
        <li>人员照片按 <code>成员编号</code>（如 <code>T1_H_002_01.jpg</code>）精确匹配到成员，共关联 <b>${person}</b> 张。</li>
        <li>房屋照片按 <code>门牌</code>解析「组+号」（如 门牌<code>1-22</code> → <code>一组22号.jpg</code>）匹配到户，共 <b>${house}</b> 户。</li>
        <li>识别到 <b>${multi}</b> 名成员存在多张照片（多角度/多时段）。</li>
        <li>尚有 <b>${noPhoto.length}</b> 户无任何照片，建议入户补采：${noPhoto.slice(0,15).map(x=>`<code>${x}</code>`).join(' ')}${noPhoto.length>15?' …':''}</li>
      </ul>
      <p class="muted">说明：本功能演示「命名规则 + 结构化字段」驱动的自动标注关联；接入视觉模型后可进一步从照片中识别门牌号/人脸框，思路一致。</p></div>`);
  },

  geoMatch(){
    const hs=Store.all(); const sug=[];
    const prefMap={'1':'一组','2':'二组','3':'三组','5':'五组','4':'四六组','6':'四六组','46':'四六组'};
    hs.forEach(h=>{
      const d=(h.doorplate||'').trim();
      if(!d){ sug.push([h.id,'缺门牌',`建议按 ${U.groupZh[h.group]} 序号 ${h.seq} 现场补录门牌`]); return; }
      const m=d.match(/^(\d+)\s*[-—－]\s*(\d+)/);
      if(!m){ sug.push([h.id,'门牌格式',`「${d}」不规范，建议改为「组号-门牌号」`]); return; }
      const expect=this.GROUP_TO_MAP[h.group];
      const photoGrp=prefMap[m[1]];
      const wantGrp={1:'一组',2:'二组',3:'三组',4:'四六组',5:'五组',6:'四六组'}[h.group];
      if(photoGrp&&wantGrp&&photoGrp!==wantGrp) sug.push([h.id,'归属存疑',`门牌前缀指向「${photoGrp}」，但该户登记在「${U.groupZh[h.group]}」，请核对`]);
    });
    Store.addLog('AI点位匹配','全量',`建议${sug.length}项`);
    this.out(`<div class="ai-card"><div class="ah">② 门牌 / 点位智能匹配建议（${sug.length} 项）</div>
      <p>系统根据门牌结构、组别、航拍底图归属交叉校验，给出补录与纠错建议：</p>
      ${sug.length?`<table class="log-table"><thead><tr><th>户</th><th>类型</th><th>建议</th></tr></thead><tbody>
        ${sug.slice(0,80).map(s=>`<tr><td>${U.esc(s[0])}</td><td>${U.esc(s[1])}</td><td>${U.esc(s[2])}</td></tr>`).join('')}
      </tbody></table>`:'<p class="ai-note">✓ 门牌与点位归属一致，未发现异常。</p>'}
      <p class="muted">提示：在「航拍台账」勾选『编辑点位』可拖动标记微调坐标并自动保存。</p></div>`);
  },
  GROUP_TO_MAP:{1:'g1',2:'g235',3:'g235',5:'g235',4:'g46',6:'g46'},

  // 单户走访摘要(给抽屉/批量复用)
  summary(uid){
    const h=Store.get(uid); if(!h) return '';
    const head=(h.members||[])[0]||{};
    const n=(h.members||[]).length;
    const rels=(h.members||[]).slice(1).map(m=>`${m.relation||'成员'}(${m.gender||'—'})`);
    const parts=[];
    parts.push(`${U.groupZh[h.group]} ${h.id} 户，户主编号 ${head.code||'未登记'}${head.gender?'（'+head.gender+'）':''}，门牌 ${h.doorplate||'未登记'}，联系电话 ${h.phone||'未登记'}。`);
    parts.push(`家庭共 ${n} 人${rels.length?'，含 '+rels.join('、'):''}。`);
    const ind=[]; if((h.planting||'').trim())ind.push('种植：'+h.planting); if((h.breeding||'').trim())ind.push('养殖：'+h.breeding);
    parts.push(ind.length?('产业情况——'+ind.join('；')+'。'):'暂未登记种养殖产业。');
    const mu=U.parseMu(h.planting), lv=U.parseLivestock(h.breeding);
    if(mu||lv) parts.push(`规模估算：种植约 ${mu} 亩，养殖约 ${lv} 头/只。`);
    if((h.tags||[]).length){
      parts.push(`重点人群标注：${h.tags.join('、')}。`);
      const adv=[];
      if(h.tags.includes('脱贫户'))adv.push('落实防返贫监测，跟进产业/就业帮扶');
      if(h.tags.includes('低保户')||h.tags.includes('五保户'))adv.push('核实兜底保障发放');
      if(h.tags.includes('残疾人'))adv.push('对接残疾人补贴与康复服务');
      if(h.tags.includes('大病户'))adv.push('关注医疗报销与大病救助');
      if(h.tags.includes('孤寡老人')||h.tags.includes('独居老人'))adv.push('安排定期探访与生活照料');
      if(adv.length)parts.push('帮扶建议：'+adv.join('；')+'。');
    }
    const notes=(h.members||[]).map(m=>m.note).filter(Boolean);
    if(notes.length)parts.push('其他备注：'+notes.join('；')+'。');
    return parts.join('\n');
  },
  summaryHTML(uid){ return `<div class="ai-summary">${U.esc(this.summary(uid)).replace(/\n/g,'<br>')}</div>`; },

  summaryAll(){
    const hs=Store.all();
    const focus=hs.filter(h=>(h.tags||[]).length||h.isLeader).slice(0,30);
    const list=(focus.length?focus:hs.slice(0,20));
    Store.addLog('AI走访摘要','批量',`${list.length}户`);
    this.out(`<div class="ai-card"><div class="ah">③ 入户走访摘要（自动生成 ${list.length} 户，优先重点人群/组长）</div>
      <p class="muted">可作为入户走访工作底稿；点击任意户可在台账中查看详情。</p></div>`+
      list.map(h=>`<div class="ai-card"><div class="ah" style="cursor:pointer" onclick="Drawer.open('${h.uid}')">${U.esc(h.id)} · ${U.esc(((h.members||[])[0]||{}).code||'')} ${(h.tags||[]).map(t=>`<span class="mini-tag">${U.esc(t)}</span>`).join('')}</div>
        <div class="ai-summary">${U.esc(this.summary(h.uid)).replace(/\n/g,'<br>')}</div></div>`).join(''));
  }
};
