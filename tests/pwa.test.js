import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function worker() {
  const handlers = {};
  const saved = new Map([['another-app',new Map()],['krono-app:https://test.example/krono/:old',new Map()]]);
  const core = ['index.html','assets/app.js'];
  const context = {
    URL, Set,
    self:{registration:{scope:'https://test.example/krono/'},location:{origin:'https://test.example'},clients:{claim:async()=>{}},addEventListener:(type,fn)=>handlers[type]=fn},
    caches:{keys:async()=>[...saved.keys()],delete:async key=>saved.delete(key),open:async key=>{
      if (!saved.has(key)) saved.set(key,new Map());
      const cache=saved.get(key);
      return {addAll:async urls=>urls.forEach(url=>cache.set(url,'cached:'+url)),match:async request=>cache.get(typeof request==='string'?request:request.url)};
    }},
    fetch:async()=>{throw new Error('offline')}
  };
  const source = readFileSync(new URL('../build/sw-template.js',import.meta.url),'utf8').replace('__CORE_FILES__',JSON.stringify(core)).replace('__VERSION__','test-version');
  vm.runInNewContext(source,context);
  return {handlers,saved};
}
test('App shell and bundled assets open without network after initial cache',async()=>{
  const {handlers}=worker();let task;handlers.install({waitUntil:p=>task=p});await task;
  for(const [url,mode,want] of [['https://test.example/krono/','navigate','index.html'],['https://test.example/krono/assets/app.js','cors','assets/app.js']]) {
    let response;handlers.fetch({request:{method:'GET',url,mode},respondWith:p=>response=p});
    assert.equal(await response,'cached:https://test.example/krono/'+want);
  }
});
test('Service worker leaves API and external requests alone, preserves other apps caches',async()=>{
  const {handlers,saved}=worker();let task;handlers.install({waitUntil:p=>task=p});await task;
  for(const request of [{method:'POST',url:'https://test.example/krono/',mode:'cors'},{method:'GET',url:'https://api.example/rates',mode:'cors'},{method:'GET',url:'https://test.example/api/private',mode:'cors'}]) {
    let intercepted=false;handlers.fetch({request,respondWith:()=>intercepted=true});assert.equal(intercepted,false);
  }
  handlers.activate({waitUntil:p=>task=p});await task;
  assert.equal(saved.has('another-app'),true);assert.equal(saved.has('krono-app:https://test.example/krono/:old'),false);
});
