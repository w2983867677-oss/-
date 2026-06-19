/* 本地文件实时同步: 仅当经由本地服务(http://127.0.0.1)打开时启用。
   - Store 变更后(导入/编辑/删除/拖点)防抖把整库写回 data/ledger-data.js
   - 导入照片写入 assets/imported/ 真实文件
   用 file:// 直接打开时自动禁用, 回退到原 localStorage/IndexedDB 行为, 不破坏现有功能。 */
const Sync = {
  enabled: (location.protocol === 'http:' || location.protocol === 'https:'),
  _timer: null,

  init(){
    if(!this.enabled){ console.log('文件实时同步: 未启用(请用「启动.bat」打开以启用实时写文件)'); return; }
    const ping=()=>fetch('/__api/ping').catch(()=>{});
    ping(); setInterval(ping, 5000);
    Store.onChange(()=>this.scheduleSaveData());
    // 关闭页面时兜底刷写: 防止 500ms 防抖还没触发就关掉, 导致最后一次改动没落盘
    window.addEventListener('beforeunload',()=>{
      try{ navigator.sendBeacon('/__api/save-data', new Blob([this._fileContent()],{type:'application/javascript'})); }catch(e){}
    });
    console.log('文件实时同步: 已启用(经本地服务打开)');
  },

  _fileContent(){
    return '// 自动生成: 村户台账数据 (window.INITIAL_DATA)\n'
      + 'window.INITIAL_DATA = ' + JSON.stringify(Store.data, null, 1) + ';\n';
  },

  scheduleSaveData(){
    if(!this.enabled) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(()=>this.saveData(), 500);
  },

  async saveData(){
    if(!this.enabled) return false;
    try{
      const res = await fetch('/__api/save-data', {
        method:'POST',
        headers:{'Content-Type':'application/javascript; charset=utf-8'},
        body: this._fileContent()
      });
      if(!res.ok) console.warn('写入 ledger-data.js 失败:', res.status);
      return res.ok;
    }catch(e){ console.warn('写入 ledger-data.js 异常:', e); return false; }
  },

  // relPath 形如 "assets/imported/person/T1_H_002_01.jpg"; blob 为 File/Blob
  async saveAsset(relPath, blob){
    if(!this.enabled) return false;
    try{
      const res = await fetch('/__api/save-asset', {
        method:'POST',
        headers:{'X-Rel-Path': encodeURIComponent(relPath)},
        body: blob
      });
      if(!res.ok) console.warn('写入照片失败 '+relPath+':', res.status);
      return res.ok;
    }catch(e){ console.warn('写入照片异常 '+relPath+':', e); return false; }
  },

  async clearImported(){
    if(!this.enabled) return;
    try{ await fetch('/__api/clear-imported', {method:'POST'}); }catch(e){}
  },

  // 把 data/ledger-data.js 还原为首次写入前备份的原始演示数据(seed)
  async restoreSeed(){
    if(!this.enabled) return false;
    try{ const res=await fetch('/__api/restore-seed', {method:'POST'}); return res.ok ? (await res.text()) : false; }
    catch(e){ return false; }
  }
};
window.Sync = Sync;
