/* 工具函数: 转义/解析/校验/标签 */
const U = {
  esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  // 图片引用解析: "idb:xxx"(导入的真实照片) -> 对象URL; 其余(assets/路径)原样返回
  img(ref){ if(!ref) return ''; if(ref.indexOf('idb:')===0) return (window.Photos&&Photos.urls[ref])||''; return ref; },
  now(){ const d=new Date(),p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; },
  groupZh:{1:'一组',2:'二组',3:'三组',4:'四组',5:'五组',6:'六组'},

  KEY_TAGS:[['脱贫','脱贫户'],['低保','低保户'],['五保','五保户'],['残疾','残疾人'],
    ['孤寡','孤寡老人'],['独居','独居老人'],['大病','大病户'],['重病','大病户'],
    ['村医','村医'],['党员','党员'],['退役','退役军人'],['低收入','低收入户']],

  detectTags(text){
    const t=text||'',out=[];
    for(const [kw,tag] of this.KEY_TAGS){ if(t.includes(kw)&&!out.includes(tag)) out.push(tag); }
    return out;
  },
  // 重点(困难)人群标签
  KEY_GROUP:['脱贫户','低保户','五保户','残疾人','孤寡老人','独居老人','大病户','低收入户'],

  // 从产业文本估算亩数
  parseMu(text){
    if(!text) return 0; let sum=0;
    const re=/(\d+(?:\.\d+)?)\s*亩/g; let m;
    while((m=re.exec(text))) sum+=parseFloat(m[1]);
    return sum;
  },
  // 估算牲畜头数
  parseLivestock(text){
    if(!text) return 0; let sum=0;
    const re=/(\d+)\s*(头|只|匹|箱|群)|(头|只|匹)\s*(\d+)|(\d+)\s*(牛|羊|猪|鸡|鸭|马|蜂)/g; let m;
    while((m=re.exec(text))){ const n=m[1]||m[4]||m[5]; if(n) sum+=parseInt(n,10); }
    return sum;
  },

  // 身份证(脱敏)格式: 6位 + ******** + 4位(末位可X)  或 完整18位
  validId(id){
    if(!id) return {ok:false,reason:'缺失'};
    const s=String(id).trim();
    if(/^\d{6}\*{6,}[\dxX]{3,4}$/.test(s)) return {ok:true};
    if(/^\d{17}[\dxX]$/.test(s)) return {ok:true};
    return {ok:false,reason:'格式异常'};
  },
  // 电话(脱敏)格式: 3位+****+4位 或 11位手机 或 固话
  validPhone(p){
    if(!p) return {ok:false,reason:'缺失'};
    const s=String(p).trim();
    if(/^\d{3}\*{3,4}\d{4}$/.test(s)) return {ok:true};
    if(/^1[3-9]\d{9}$/.test(s)) return {ok:true};
    if(/^0\d{2,3}-?\d{7,8}$/.test(s)) return {ok:true};
    return {ok:false,reason:'格式异常'};
  },
  validDoor(d){
    if(!d) return {ok:false,reason:'缺失'};
    if(/^\d+\s*[-—－]\s*\d+/.test(String(d).trim())) return {ok:true};
    if(/^\d+$/.test(String(d).trim())) return {ok:true,reason:'仅门牌号'};
    return {ok:false,reason:'格式异常'};
  },
  validGeo(lat,lng){
    if(lat==null||lng==null||lat===''||lng==='') return {ok:false,reason:'缺失'};
    const a=parseFloat(lat),b=parseFloat(lng);
    if(isNaN(a)||isNaN(b)) return {ok:false,reason:'非数值'};
    if(a< -90||a>90||b< -180||b>180) return {ok:false,reason:'超出范围'};
    return {ok:true};
  },

  toast(msg){
    const t=document.getElementById('toast'); t.textContent=msg; t.hidden=false;
    clearTimeout(this._tt); this._tt=setTimeout(()=>t.hidden=true,2200);
  },
  download(filename,blobOrText,mime){
    const blob = blobOrText instanceof Blob ? blobOrText : new Blob([blobOrText],{type:mime||'application/octet-stream'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  },
  lightbox(src){
    const lb=document.createElement('div'); lb.className='lightbox';
    lb.innerHTML=`<img src="${U.esc(src)}"/>`; lb.onclick=()=>lb.remove();
    document.body.appendChild(lb);
  }
};
