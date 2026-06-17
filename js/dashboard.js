/* 汇报看板: 统计卡片 + 轻量Canvas图表 (无外部依赖) */
const Dashboard={
  PALETTE:['#2e7d32','#ef6c00','#1565c0','#6a1b9a','#00838f','#c62828','#558b2f','#f9a825','#4e342e','#0277bd'],
  init(){ Store.onChange(()=>{ if(isActive('dashboard')) this.render(); }); },
  render(){
    const s=Store.stats();
    document.getElementById('dashCards').innerHTML=[
      ['总户数',s.households,''],['总人口',s.members,''],
      ['重点人群',s.keyPeople.length,'amber'],['组长/网格',s.leaders,'blue'],
      ['有种植户',s.plantHH,''],['有养殖户',s.breedHH,'amber'],
      ['种植面积估算',s.mu.toFixed(0)+' 亩',''],['养殖估算',s.livestock+' 头/只','blue'],
    ].map(([l,n,c])=>`<div class="dash-card ${c}"><div class="num">${n}</div><div class="lbl">${l}</div></div>`).join('');

    // 各组户数/人口 双柱
    const gKeys=Object.keys(s.groups).sort();
    this.barGrouped('chartGroups',gKeys.map(g=>U.groupZh[g]||g),
      gKeys.map(g=>s.groups[g].hh), gKeys.map(g=>s.groups[g].people),'户数','人口');
    // 重点人群 donut
    const te=Object.entries(s.tags).sort((a,b)=>b[1]-a[1]);
    this.donut('chartTags',te.map(x=>x[0]),te.map(x=>x[1]));
    // 产业结构 donut
    const both=Store.all().filter(h=>(h.planting||'').trim()&&(h.breeding||'').trim()).length;
    this.donut('chartIndustry',['仅种植','仅养殖','种养兼有','无产业'],[
      s.plantHH-both, s.breedHH-both, both, s.households-(s.plantHH+s.breedHH-both)]);

    document.getElementById('scaleStats').innerHTML=`
      <div class="scale-row"><span>种植总面积(估算)</span><b>${s.mu.toFixed(0)} 亩</b></div>
      <div class="scale-row"><span>户均种植面积</span><b>${s.plantHH?(s.mu/s.plantHH).toFixed(1):0} 亩</b></div>
      <div class="scale-row"><span>养殖规模(估算)</span><b>${s.livestock} 头/只</b></div>
      <div class="scale-row"><span>建档照片覆盖</span><b>${s.households?(s.withPhoto/s.households*100).toFixed(0):0}%</b> (${s.withPhoto}/${s.households})</div>
      <div class="scale-row"><span>重点人群占比</span><b>${s.households?(s.keyPeople.length/s.households*100).toFixed(0):0}%</b></div>`;

    document.getElementById('keyPeople').innerHTML=s.keyPeople.map(h=>{const head=(h.members||[])[0]||{};
      return `<div class="kp-card" onclick="Drawer.open('${h.uid}')" style="cursor:pointer">
        <div class="h">${U.esc(h.id)} · ${U.esc(head.code||'')}</div>
        <div class="muted">${U.groupZh[h.group]} · 门牌${U.esc(h.doorplate||'—')} · ${(h.members||[]).length}人</div>
        <div class="tags">${(h.tags||[]).map(t=>`<span class="mini-tag">${U.esc(t)}</span>`).join('')}</div>
      </div>`;}).join('')||'<p class="muted">暂无重点人群标注</p>';
  },

  _ctx(id){ const c=document.getElementById(id); const w=c.clientWidth||c.parentElement.clientWidth-32; c.width=w; c.height=c.height||220;
    const x=c.getContext('2d'); x.clearRect(0,0,c.width,c.height); return {c,x,w,h:c.height}; },

  barGrouped(id,labels,a,b,la,lb){
    const {c,x,w,h}=this._ctx(id); const pad=34, bw=(w-pad*2)/labels.length;
    const max=Math.max(1,...a,...b); const base=h-24;
    x.font='12px sans-serif'; x.textAlign='center';
    labels.forEach((lb0,i)=>{
      const cx=pad+bw*i+bw/2; const bar=bw*0.32;
      const ha=(a[i]/max)*(base-20), hb=(b[i]/max)*(base-20);
      x.fillStyle='#2e7d32'; x.fillRect(cx-bar-2,base-ha,bar,ha);
      x.fillStyle='#ef6c00'; x.fillRect(cx+2,base-hb,bar,hb);
      x.fillStyle='#333'; x.fillText(a[i],cx-bar/2-2,base-ha-4); x.fillText(b[i],cx+bar/2+2,base-hb-4);
      x.fillStyle='#666'; x.fillText(lb0,cx,h-6);
    });
    // 图例
    x.textAlign='left'; x.fillStyle='#2e7d32'; x.fillRect(pad,4,10,10); x.fillStyle='#333'; x.fillText(la,pad+14,13);
    x.fillStyle='#ef6c00'; x.fillRect(pad+60,4,10,10); x.fillStyle='#333'; x.fillText(lb,pad+74,13);
  },

  donut(id,labels,vals){
    const {c,x,w,h}=this._ctx(id); const total=vals.reduce((a,b)=>a+b,0)||1;
    const cx=h*0.5+10, cy=h*0.5, r=h*0.36, ir=r*0.58; let ang=-Math.PI/2;
    vals.forEach((v,i)=>{ const a2=ang+v/total*Math.PI*2;
      x.beginPath(); x.moveTo(cx,cy); x.arc(cx,cy,r,ang,a2); x.closePath();
      x.fillStyle=this.PALETTE[i%this.PALETTE.length]; x.fill(); ang=a2; });
    x.fillStyle='#fff'; x.beginPath(); x.arc(cx,cy,ir,0,Math.PI*2); x.fill();
    x.fillStyle='#333'; x.textAlign='center'; x.font='bold 16px sans-serif'; x.fillText(total,cx,cy+5);
    // 图例
    x.textAlign='left'; x.font='12px sans-serif'; let ly=18;
    labels.forEach((lb,i)=>{ if(vals[i]<=0)return; x.fillStyle=this.PALETTE[i%this.PALETTE.length];
      x.fillRect(cx+r+18,ly-9,11,11); x.fillStyle='#333';
      x.fillText(`${lb} ${vals[i]}`,cx+r+33,ly); ly+=19; });
  }
};
