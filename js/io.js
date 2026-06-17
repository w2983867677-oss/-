/* 导入导出: Excel解析(抽象模板) / 备份恢复 / 导出Excel·PDF·图片 / 模板 */
const IO={
  GROUP_CN:{'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'1':1,'2':2,'3':3,'4':4,'5':5,'6':6},
  GROUP_TO_MAP:{1:'g1',2:'g235',3:'g235',5:'g235',4:'g46',6:'g46'},
  init(){
    document.getElementById('importFile').onchange=e=>this.doImport(e);
    document.getElementById('restoreFile').onchange=e=>this.doRestore(e);
    document.getElementById('backupBtn').onclick=()=>this.backup();
    document.getElementById('exportExcel').onclick=()=>this.exportExcel();
    document.getElementById('exportPdf').onclick=()=>this.exportPdf();
    document.getElementById('exportImg').onclick=()=>this.exportImg();
    document.getElementById('downloadTemplate').onclick=()=>this.template();
    document.getElementById('resetData').onclick=()=>{ if(confirm('恢复到初始演示数据？当前修改将丢失。')){ Store.reset(); U.toast('已恢复初始数据'); } };
  },
  // --- 解析 Excel 为 households(按表头关键字映射列, 适配其他村模板) ---
  parseExcel(file){
    return new Promise((resolve,reject)=>{
      const r=new FileReader();
      r.onload=ev=>{
        try{
          const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
          const out=[];
          wb.SheetNames.forEach(sn=>{
            const gm=String(sn).match(/[一二三四五六1-6]/); const group=gm?this.GROUP_CN[gm[0]]:0;
            const rows=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:true});
            // 找表头行
            let hi=rows.findIndex(rw=>rw.some(c=>/序号/.test(c))&&rw.some(c=>/户主|成员/.test(c)));
            if(hi<0) hi=rows.findIndex(rw=>rw.some(c=>/户主|成员/.test(c)));
            if(hi<0) return;
            const H=rows[hi].map(c=>String(c));
            const col=key=>H.findIndex(c=>key.test(c));
            const idx={seq:col(/序号/),head:col(/户主/),mem:col(/成员/),rel:col(/关系/),
              id:col(/身份证/),sex:col(/性别/),tel:col(/电话|联系/),door:col(/门牌|地址/),
              plant:col(/种植/),breed:col(/养殖/),note:col(/其他|备注/),lat:col(/纬度|lat/i),lng:col(/经度|lng/i)};
            let cur=null;
            for(let r0=hi+1;r0<rows.length;r0++){
              const rw=rows[r0]; const g=v=>idx[v]>=0?String(rw[idx[v]]||'').trim():'';
              const seq=g('seq'),head=g('head'),mem=g('mem'),code=head||mem;
              if(!code&&!g('rel')&&!g('id')) continue;
              if(seq){ cur={group,seq,id:`H${group}_${String(seq).padStart(3,'0')}`,
                doorplate:g('door'),phone:g('tel'),planting:g('plant'),breeding:g('breed'),
                houseNote:code?'':g('note'),members:[],housePhotos:[],tags:[],
                mapId:this.GROUP_TO_MAP[group]||'cunbu',x:.5,y:.5,
                lat:g('lat')||null,lng:g('lng')||null}; out.push(cur); }
              if(!cur) continue;
              if(code) cur.members.push({code,relation:g('rel')||(seq?'户主':'成员'),
                gender:g('sex'),idMask:g('id'),note:g('note'),phone:'',photos:[]});
              if(g('tel')&&!cur.phone) cur.phone=g('tel');
              if(g('plant')&&!cur.planting) cur.planting=g('plant');
              if(g('breed')&&!cur.breeding) cur.breeding=g('breed');
            }
          });
          resolve(out);
        }catch(err){ reject(err); }
      };
      r.onerror=()=>reject(new Error('读取失败'));
      r.readAsArrayBuffer(file);
    });
  },
  async doImport(e){
    if(!requireEdit()){ e.target.value=''; return; }
    const f=e.target.files[0]; if(!f)return;
    const mode=document.querySelector('input[name=importMode]:checked').value;
    try{
      const list=await this.parseExcel(f);
      const vr=Validate.run(list);
      let go=true;
      if(vr.total>0){ go=confirm(`校验发现 ${vr.total} 项问题（详见“导入校验”页）。仍要${mode==='replace'?'覆盖':'合并'}导入 ${list.length} 户吗？`); }
      if(go){ const res=Store.importHouseholds(list,mode);
        U.toast(`导入完成：新增${res.added} / 更新${res.merged}`);
        document.getElementById('ioStatus').textContent=`最近导入 ${f.name}：${list.length}户，校验问题${vr.total}项`;
        Validate.render(vr,`文件 ${f.name} 解析 ${list.length} 户`); }
    }catch(err){ U.toast('导入失败: '+err.message); }
    e.target.value='';
  },
  backup(){
    const blob=JSON.stringify({_backup:'村户慧眼台账',time:U.now(),data:Store.data,log:Store.log},null,1);
    U.download(`村户台账备份_${U.now().replace(/[: ]/g,'-')}.json`,blob,'application/json');
    Store.addLog('备份','全量',`${Store.all().length}户`); U.toast('已生成备份文件');
  },
  doRestore(e){
    if(!requireEdit()){ e.target.value=''; return; }
    const f=e.target.files[0]; if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{ try{ const o=JSON.parse(ev.target.result); const data=o.data||o;
      if(!data.households) throw new Error('非法备份文件');
      Store.replaceAll(data); if(o.log)Store.log=o.log,Store._persistLog();
      U.toast('已恢复备份'); }catch(err){ U.toast('恢复失败: '+err.message); } };
    r.readAsText(f); e.target.value='';
  },
  exportExcel(){
    const wb=XLSX.utils.book_new();
    const groups={}; Store.all().forEach(h=>(groups[h.group]=groups[h.group]||[]).push(h));
    Object.keys(groups).sort().forEach(g=>{
      const aoa=[[`村：${U.groupZh[g]||g}`,'',`组长：${(Store.meta().groupLeaders||{})[g]||''}`],
        ['序号','户主','成员','关系','身份证号','性别','电话','门牌','种植','养殖','重点人群','其他']];
      groups[g].forEach(h=>{ const ms=h.members||[];
        ms.forEach((m,i)=>aoa.push([ i===0?h.seq:'', i===0?(m.code||''):'', i===0?'':(m.code||''),
          m.relation||'', m.idMask||'', m.gender||'', i===0?h.phone:'', i===0?h.doorplate:'',
          i===0?h.planting:'', i===0?h.breeding:'', i===0?(h.tags||[]).join('/'):'', m.note||'' ]));
        if(!ms.length) aoa.push([h.seq,'','','','','',h.phone,h.doorplate,h.planting,h.breeding,(h.tags||[]).join('/'),h.houseNote||'']);
      });
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),U.groupZh[g]||('组'+g));
    });
    XLSX.writeFile(wb,`村户台账导出_${U.now().slice(0,10)}.xlsx`);
    Store.addLog('导出Excel','全量',`${Store.all().length}户`); U.toast('Excel 已导出');
  },
  template(){
    const aoa=[['村：示例组','','组长：'],
      ['序号','户主','成员','关系','身份证号','性别','电话','门牌','种植','养殖','其他'],
      [1,'张三','','户主','110101********0011','男','138****0000','1-1','玉米10亩','牛2头','脱贫户'],
      ['','','李四','配偶','110101********0022','女','','','','','']];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(aoa),'一组');
    XLSX.writeFile(wb,'村户台账_空白模板.xlsx'); U.toast('模板已下载');
  },
  async _capture(){
    switchView('dashboard'); Dashboard.render(); await new Promise(r=>setTimeout(r,350));
    const node=document.getElementById('view-dashboard');
    return await html2canvas(node,{scale:2,backgroundColor:'#f4f6f4',useCORS:true});
  },
  async exportImg(){
    U.toast('正在生成图片…');
    try{ const cv=await this._capture(); cv.toBlob(b=>{ U.download(`村户汇报看板_${U.now().slice(0,10)}.png`,b,'image/png');
      Store.addLog('导出图片','看板',''); U.toast('看板图片已导出'); }); }
    catch(e){ U.toast('生成失败: '+e.message); }
  },
  async exportPdf(){
    U.toast('正在生成 PDF…');
    try{
      const cv=await this._capture(); const img=cv.toDataURL('image/jpeg',0.92);
      const {jsPDF}=window.jspdf; const pdf=new jsPDF('p','mm','a4');
      const pw=210, ph=297, iw=pw-16, ih=iw*cv.height/cv.width; let y=10, left=ih;
      pdf.setFillColor(46,125,50); pdf.rect(0,0,pw,8,'F');
      if(ih<=ph-16){ pdf.addImage(img,'JPEG',8,10,iw,ih); }
      else { // 分页
        let sy=0; const pageH=(ph-20)*cv.width/iw;
        while(sy<cv.height){ const c2=document.createElement('canvas'); c2.width=cv.width; c2.height=Math.min(pageH,cv.height-sy);
          c2.getContext('2d').drawImage(cv,0,sy,cv.width,c2.height,0,0,cv.width,c2.height);
          if(sy>0)pdf.addPage(); pdf.addImage(c2.toDataURL('image/jpeg',0.92),'JPEG',8,10,iw,c2.height*iw/cv.width); sy+=pageH; }
      }
      pdf.save(`村户汇报页_${U.now().slice(0,10)}.pdf`);
      Store.addLog('导出PDF','看板',''); U.toast('PDF 已导出');
    }catch(e){ U.toast('生成失败: '+e.message); }
  }
};
