/* 照片存储: IndexedDB 持久化真实照片 + idb: 引用解析
   - 台账数据(localStorage)里只存轻量字符串引用 "idb:<key>"，避免撑爆 localStorage
   - 真实图片二进制存 IndexedDB；启动时 rehydrate() 生成对象URL供 <img> 使用
   - file:// 下 Chrome/Edge 可正常使用 IndexedDB；若不可用则降级为会话内对象URL(刷新即失效) */
const Photos = {
  DB:'vhl-photos', STORE:'imgs', VER:1,
  _db:null, urls:Object.create(null), available:true,

  _open(){
    if(this._db) return Promise.resolve(this._db);
    return new Promise((resolve,reject)=>{
      let req;
      try{ req=indexedDB.open(this.DB,this.VER); }
      catch(e){ this.available=false; return reject(e); }
      req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(this.STORE)) db.createObjectStore(this.STORE); };
      req.onsuccess=()=>{ this._db=req.result; resolve(this._db); };
      req.onerror=()=>{ this.available=false; reject(req.error||new Error('IndexedDB 打开失败')); };
    });
  },
  _tx(mode){ return this._open().then(db=>db.transaction(this.STORE,mode).objectStore(this.STORE)); },

  // key 不含 "idb:" 前缀; 返回引用字符串
  ref(key){ return 'idb:'+key; },

  put(key,blob){
    return this._tx('readwrite').then(st=>new Promise((res,rej)=>{
      const r=st.put(blob,key); r.onsuccess=()=>res(this.ref(key)); r.onerror=()=>rej(r.error);
    }));
  },
  get(key){
    return this._tx('readonly').then(st=>new Promise((res,rej)=>{
      const r=st.get(key); r.onsuccess=()=>res(r.result||null); r.onerror=()=>rej(r.error);
    }));
  },
  keys(){
    return this._tx('readonly').then(st=>new Promise((res,rej)=>{
      const r=st.getAllKeys(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error);
    }));
  },
  clear(){
    // 释放旧对象URL
    Object.values(this.urls).forEach(u=>{ try{URL.revokeObjectURL(u);}catch(e){} });
    this.urls=Object.create(null);
    return this._tx('readwrite').then(st=>new Promise((res,rej)=>{
      const r=st.clear(); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error);
    })).catch(()=>{});
  },

  // 启动时调用: 把 IndexedDB 内全部图片转为对象URL，填充 this.urls['idb:key']
  async rehydrate(){
    try{
      const ks=await this.keys();
      for(const k of ks){
        const blob=await this.get(k);
        if(blob){ this.urls[this.ref(k)]=URL.createObjectURL(blob); }
      }
      return ks.length;
    }catch(e){ this.available=false; console.warn('照片存储不可用(将以无图模式运行):',e&&e.message); return 0; }
  },

  // 批量写入 {key:blob}，写完刷新对应对象URL；返回成功数
  async putMany(map){
    let n=0;
    for(const key of Object.keys(map)){
      try{
        await this.put(key,map[key]);
        const ref=this.ref(key);
        if(this.urls[ref]){ try{URL.revokeObjectURL(this.urls[ref]);}catch(e){} }
        this.urls[ref]=URL.createObjectURL(map[key]);
        n++;
      }catch(e){ /* 单张失败不阻断 */ }
    }
    return n;
  },

  count(){ return Object.keys(this.urls).length; }
};
window.Photos=Photos;
