const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const base = require('node:path').resolve(__dirname, '..');
const html = fs.readFileSync(base + '/aea/status.html','utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);
const live = JSON.parse(fs.readFileSync(base + '/aea/status.json','utf8'));
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.dataset = {}; this.listeners = {}; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name,value) { this[name] = value; }
  addEventListener(name,fn) { this.listeners[name] = fn; }
  scrollIntoView() { this.scrolled = true; }
  set innerHTML(_) { throw new Error('Unsafe HTML sink'); }
}
const elements = new Map();
const document = {
  getElementById(id) {
    for (const container of elements.values()) {
      const find = nodes => { for(const node of nodes) { if(node.id === id) return node; const child = find(node.children || []); if(child) return child; } };
      const child = find(container.children); if(child) return child;
    }
    if(!elements.has(id)) elements.set(id,new Element('div'));
    return elements.get(id);
  },
  createElement: tag => new Element(tag), createTextNode: text => ({textContent:text})
};
let response = {ok:true,json:async()=>structuredClone(live)};
let options, calls = 0, interval;
const context = vm.createContext({document, window:{scrollY:320,scrollTo(args){this.lastScroll=args.top;}},location:{hash:'#P2-T'},navigator:{clipboard:{writeText:async text => {context.copied=text;}}},AbortController,SyntaxError,setTimeout,clearTimeout,setInterval:(fn,ms)=>{interval=ms;},console,fetch:async(url,opts)=>{assert.equal(url,'./status.json');options=opts;calls++; if(response instanceof Error) throw response; return response;}});
const run = code => vm.runInContext(code,context);
(async()=>{
  run(script);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(interval,60000); assert.equal(options.cache,'no-store');
  assert.equal(elements.get('flow').children.length,10);
  assert.equal(elements.get('commit').textContent,live.source.commit);
  assert.equal(elements.get('tasks').children.length,live.tasks.length);
  assert.equal(document.getElementById('P2-T').scrolled,true);
  assert.match(elements.get('notice').textContent,/发布快照/);
  const previousFlow=elements.get('flow').children;
  await run('refresh()');
  assert.equal(elements.get('flow').children,previousFlow);
  assert.match(elements.get('notice').textContent,/未变化|旧快照/);
  const retrieved = elements.get('retrieved').textContent;
  response = new Error('offline'); await run('refresh()');
  assert.match(elements.get('notice').textContent,/刷新失败，保留/);
  assert.equal(elements.get('notice').dataset.tone,'error');
  assert.equal(elements.get('flow').children,previousFlow);
  assert.equal(elements.get('retrieved').textContent,retrieved);
  response={ok:false,status:404}; await run('refresh()');
  assert.match(elements.get('notice').textContent,/尚未发布.*404/);
  run('current = null'); await run('refresh()');
  assert.match(elements.get('notice').textContent,/暂无可用发布快照/);
  const hostile=structuredClone(live); hostile.tasks[0].title='<img src=x onerror=alert(1)>';
  response={ok:true,json:async()=>hostile}; await run('refresh()');
  assert.equal(elements.get('tasks').children[0].children[1].textContent,hostile.tasks[0].title);
  const old=structuredClone(live); old.publication.generatedAt='2000-01-01T00:00:00Z';
  context.fixture=old; assert.equal(run('snapshotMessage(fixture,false,false)[1]'),'warning');
  assert.match(run('snapshotMessage(fixture,false,false)[0]'),/旧快照/);
  const future=structuredClone(live);future.publication.generatedAt='2100-01-01T00:00:00Z';context.fixture=future;
  assert.match(run('snapshotMessage(fixture,false,false)[0]'),/未来/);
  for(const branch of ['', '../bad','main lock','a..b','a@{x}','a//b','-bad','a.lock','a/.foo','@']) {
    const bad=structuredClone(live);bad.source.branch=branch;context.fixture=bad;assert.throws(()=>run('validate(fixture)'),/分支/);
  }
  const bad=structuredClone(live);bad.source.commit='abc123';context.fixture=bad;assert.throws(()=>run('validate(fixture)'),/40/);
  bad.source.commit=live.source.commit;bad.source.remoteVerified=false;assert.throws(()=>run('validate(fixture)'),/远端/);
  response={ok:true,json:async()=>structuredClone(live)}; await run('refresh()');
  assert.equal(context.window.lastScroll,320); assert.equal(context.location.hash,'#P2-T');
  await elements.get('copy').listeners.click(); assert.equal(context.copied,live.source.commit);
  const noChanges=elements.get('flow').children; response={ok:true,json:async()=>{throw new SyntaxError('bad json')}};await run('refresh()');
  assert.equal(elements.get('flow').children,noChanges);assert.match(elements.get('notice').textContent,/不是有效 JSON/);
  response=new Error('Abort');response.name='AbortError';await run('refresh()');assert.match(elements.get('notice').textContent,/15 秒/);
  assert(!/innerHTML|insertAdjacentHTML/.test(script));
  assert(!/\/Users\/|\/tmp\/|Bearer |github_pat_|ghp_/.test(html));
  console.log('PASS: JS syntax; live snapshot render; 10 nodes; no-store/60s polling; anchors and scroll preservation; unchanged snapshot; offline/404/invalid JSON/timeout preserve data; missing data; stale/future time; branch/SHA/remote validation; safe text; clipboard; no local paths/tokens. Fetch calls:',calls);
})().catch(error=>{console.error(error);process.exitCode=1});
