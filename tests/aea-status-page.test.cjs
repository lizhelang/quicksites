const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(base, 'aea/status.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(script);

const actions = {
  needs_decision: { label: '需要你决定', color: 'amber', symbol: '?' },
  agent_ready: { label: 'Agent 可处理', color: 'blue', symbol: '→' },
  agent_active: { label: 'Agent 处理中', color: 'indigo', symbol: '↻' },
  waiting_dependency: { label: '等待依赖', color: 'gray', symbol: '⌛' },
  needs_acceptance: { label: '需要你验收', color: 'teal', symbol: '◇' },
  blocked: { label: '阻塞', color: 'red', symbol: '!' },
  done: { label: '完成', color: 'green', symbol: '✓' }
};
function record(id, overrides = {}) {
  return {
    id, title: '记录 ' + id, actionStates: ['agent_ready'], stage: 'ready',
    implementation: 'not_started', verificationLevel: 'none',
    owner: { type: 'unassigned', name: null }, depends: [], openQuestions: [],
    verificationEvidence: [], ...overrides
  };
}
function fixture() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 2,
    project: { name: 'AEA', repository: 'example/aea' },
    source: { branch: 'feat/aea-agent-bridge', commit: 'a'.repeat(40), committedAt: now, checkedAt: now, trackerRevision: 'TEST-02', remoteVerified: true },
    publication: { mode: 'full', generatedAt: now },
    taxonomy: {
      actions: structuredClone(actions),
      stages: { planning: '规划中', planned: '已规划', ready: '就绪', implementation: '实现', verification: '验证', acceptance: '验收', complete: '完成' },
      implementation: { not_started: '未开始', partial: '部分实现', implemented: '已有实现', not_applicable: '不适用' },
      verificationLevels: { none: '无', static: '静态', offline: '离线', local: '本地', end_to_end: '端到端', expert: '专家', production: '生产' }
    },
    process: {
      nodes: Array.from({ length: 10 }, (_, i) => record('S' + String(i + 1).padStart(2, '0'), {
        existing: 2, total: 4, actionStates: [Object.keys(actions)[i % 7]],
        implementation: 'partial', verificationEvidence: ['本轮端到端未验证']
      })),
      milestones: [record('M1', { taskIds: ['P0', 'P1'] })]
    },
    tasks: [
      record('P0', { requirements: ['QA-01'], actionStates: ['agent_active'], stage: 'verification', owner: { type: 'agent', name: 'Agent A' }, implementation: 'implemented', verificationLevel: 'local' }),
      record('P1', { requirements: ['IN-01'] }),
      record('P2-T', { requirements: ['TOOL-01'], actionStates: ['waiting_dependency'], depends: ['P0', 'P1'], implementation: 'implemented' }),
      record('P2-M', { requirements: ['MET-01'], actionStates: ['needs_decision', 'waiting_dependency'], depends: ['P0', 'P1'], openQuestions: ['Q-02'] }),
      record('P2-D', { requirements: ['OUT-06'], actionStates: ['needs_decision', 'waiting_dependency'], depends: ['P0'], openQuestions: ['Q-08'] })
    ]
  };
}
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.style = {}; this.dataset = {}; this.listeners = {}; this.ownText = ''; this.open = false; }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.ownText = ''; this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  scrollIntoView() { this.scrolled = true; }
  set innerHTML(_) { throw new Error('Unsafe HTML sink'); }
}
function descendants(node, predicate) {
  return (node.children || []).flatMap(child => [...(predicate(child) ? [child] : []), ...descendants(child, predicate)]);
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function harness(data = fixture()) {
  const elements = new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Element('div')]));
  const document = {
    getElementById(id) {
      if (elements.has(id)) return elements.get(id);
      for (const container of elements.values()) {
        const child = descendants(container, node => node.id === id)[0];
        if (child) return child;
      }
      return null;
    },
    createElement: tag => new Element(tag),
    createTextNode: text => { const node = new Element('#text'); node.textContent = text; return node; }
  };
  const env = { elements, document, calls: [], timers: new Map(), response: { ok: true, json: async () => structuredClone(data) } };
  let timerId = 0;
  const context = vm.createContext({
    document, window: { scrollY: 320, scrollTo(args) { this.lastScroll = args.top; } },
    location: { hash: '#P2-T' }, navigator: { clipboard: { writeText: async text => { env.copied = text; } } },
    AbortController, SyntaxError, console,
    setTimeout: (fn, ms) => { env.timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout: id => env.timers.delete(id),
    setInterval: (fn, ms) => { env.interval = { fn, ms }; },
    fetch: async (url, options) => {
      env.calls.push({ url, options });
      if (env.response instanceof Error) throw env.response;
      return typeof env.response === 'function' ? env.response(options) : env.response;
    }
  });
  env.context = context;
  env.run = code => vm.runInContext(code, context);
  env.run(script);
  env.refresh = () => env.run('refresh()');
  env.id = id => document.getElementById(id);
  env.setData = value => { env.response = { ok: true, json: async () => structuredClone(value) }; };
  return env;
}
let count = 0;
async function test(name, fn) { await fn(); count++; console.log('ok', count, '-', name); }
(async () => {
  await test('schema 2 renders ten nodes and separate symbol/text action badges', async () => {
    const h = harness(); await settle();
    assert.equal(h.id('flow').children.length, 10);
    assert.equal(h.id('tasks').children.length, 5);
    assert.equal(h.id('action-legend').children.length, 7);
    for (const [key, value] of Object.entries(actions)) {
      const badge = h.id('action-legend').children.find(node => node.dataset.action === key);
      assert.equal(badge.textContent, value.symbol + ' ' + value.label);
      assert(html.includes('.action-badge[data-action="' + key + '"]'));
    }
    assert.equal(h.id('commit').textContent, 'a'.repeat(40));
    for (const id of ['P2-M', 'P2-D']) {
      const badges = descendants(h.id(id), node => node.className === 'badge action-badge');
      assert.deepEqual(badges.map(node => node.dataset.action), ['needs_decision', 'waiting_dependency']);
    }
    assert.match(h.id('P2-T').textContent, /等待依赖：P0、P1/);
    assert(!descendants(h.id('P2-T'), node => node.dataset?.action === 'done').length, 'implemented must not imply done');
  });
  await test('details expose independent stage, implementation, evidence, owner, dependencies and questions', async () => {
    const h = harness(); await settle();
    const details = descendants(h.id('P2-M'), node => node.tag === 'details')[0];
    assert.equal(details.open, false);
    assert.match(details.textContent, /阶段.*实现程度.*验收等级.*负责人.*前置依赖.*未决问题.*验证依据/);
    assert.match(details.textContent, /尚未记录验证证据/);
    assert.equal(descendants(details, node => node.href === './#Q-02').length, 1);
    assert.match(h.id('P0').textContent, /Agent · Agent A/);
    assert.match(h.id('flow').textContent, /已有代码2\/4 项 · 不代表已验收/);
  });
  await test('first load and 60-second/manual polling bypass cache and unchanged snapshots retain DOM', async () => {
    const h = harness(); await settle();
    assert.equal(h.interval.ms, 60000);
    assert.equal(h.calls[0].url, './status.json');
    assert.equal(h.calls[0].options.cache, 'no-store');
    const previous = h.id('flow').children;
    await h.id('refresh').listeners.click();
    assert.equal(h.id('flow').children, previous);
    assert.match(h.id('notice').textContent, /未变化.*不代表/);
    await h.interval.fn(); assert.equal(h.calls.length, 3);
  });
  await test('hash, scroll and expanded details survive a new snapshot', async () => {
    const data = fixture(); const h = harness(data); await settle();
    assert.equal(h.id('P2-T').scrolled, true);
    const details = descendants(h.id('P2-M'), node => node.tag === 'details')[0];
    details.open = true; details.listeners.toggle();
    data.tasks[3].title = '新标题'; h.setData(data); await h.refresh();
    assert.equal(h.context.location.hash, '#P2-T');
    assert.equal(h.context.window.lastScroll, 320);
    assert.equal(descendants(h.id('P2-M'), node => node.tag === 'details')[0].open, true);
  });
  await test('overlapping refreshes issue one request and cannot overwrite newer data out of order', async () => {
    const h = harness(); await settle();
    let release;
    h.response = () => new Promise(resolve => { release = resolve; });
    const first = h.refresh(); const before = h.calls.length;
    await h.refresh(); await h.interval.fn();
    assert.equal(h.calls.length, before); assert.equal(h.id('refresh').disabled, true);
    const next = fixture(); next.source.commit = 'b'.repeat(40);
    release({ ok: true, json: async () => next }); await first;
    assert.equal(h.id('commit').textContent, 'b'.repeat(40)); assert.equal(h.id('refresh').disabled, false);
  });
  await test('schema 1 is explicitly rejected on first load without rendering old state', async () => {
    const legacy = fixture(); legacy.schemaVersion = 1; legacy.tasks[0].state = '旧复合标签';
    const h = harness(legacy); await settle();
    assert.match(h.id('notice').textContent, /schema 2.*旧 schema 1.*停用/);
    assert.equal(h.id('flow').children.length, 0); assert.equal(h.id('tasks').children.length, 0);
  });
  await test('schema 1 refresh preserves the last schema 2 snapshot with explicit failure', async () => {
    const h = harness(); await settle(); const previous = h.id('flow').children;
    const old = fixture(); old.schemaVersion = 1; h.setData(old); await h.refresh();
    assert.equal(h.id('flow').children, previous);
    assert.match(h.id('notice').textContent, /刷新失败，保留.*schema 1/);
  });
  await test('invalid independent fields and mixed old state are rejected before rendering', async () => {
    const h = harness(); await settle();
    const changes = [
      item => item.actionStates = ['unknown'], item => item.actionStates = [],
      item => item.actionStates = ['done', 'done'], item => item.stage = 'unknown',
      item => item.implementation = 'done', item => item.verificationLevel = 'verified',
      item => item.owner.type = 'robot', item => item.owner.name = 42,
      item => item.depends = 'P0', item => item.openQuestions = ['not-Q'],
      item => item.verificationEvidence = [null], item => item.state = '旧状态'
    ];
    for (const change of changes) {
      const bad = fixture(); change(bad.tasks[0]); h.context.bad = bad;
      assert.throws(() => h.run('validate(bad)'));
    }
    for (const [field, value] of [['branch','../bad'],['branch','main lock'],['branch','a..b'],['branch','a.lock'],['branch',''],['commit','abc123'],['remoteVerified',false]]) {
      const bad = fixture(); bad.source[field] = value; h.context.bad = bad; assert.throws(() => h.run('validate(bad)'));
    }
    const duplicate = fixture(); duplicate.process.nodes[0].id = 'P0'; h.context.bad = duplicate; assert.throws(() => h.run('validate(bad)'));
  });
  await test('offline, HTTP 404/500 and invalid JSON preserve successful data and retrieval time', async () => {
    const h = harness(); await settle(); const previous = h.id('flow').children; const time = h.id('retrieved').textContent;
    for (const response of [new Error('offline'), { ok:false,status:404 }, { ok:false,status:500 }, { ok:true,json:async()=>{throw new SyntaxError('bad JSON');} }]) {
      h.response = response; await h.refresh();
      assert.equal(h.id('flow').children, previous); assert.equal(h.id('retrieved').textContent, time);
      assert.equal(h.id('notice').dataset.tone, 'error'); assert.match(h.id('notice').textContent, /刷新失败，保留/);
      assert(!h.id('refresh').disabled);
    }
  });
  await test('15-second timeout aborts request, releases lock and allows retry', async () => {
    const h = harness(); await settle();
    h.response = options => new Promise((resolve,reject) => options.signal.addEventListener('abort', () => { const error = new Error('timeout'); error.name = 'AbortError'; reject(error); }));
    const waiting = h.refresh();
    const timer = [...h.timers.values()][0]; assert.equal(timer.ms, 15000); timer.fn(); await waiting;
    assert.match(h.id('notice').textContent, /15 秒/); assert(!h.id('refresh').disabled);
    h.setData(fixture()); await h.refresh(); assert.equal(h.id('notice').dataset.tone, 'normal');
  });
  await test('missing initial data remains explicitly unpublished', async () => {
    const h = harness(); await settle();
    const first = harness({ schemaVersion:2 }); await settle();
    assert.equal(first.id('tasks').children.length, 0);
    assert.match(first.id('notice').textContent, /暂无可用发布快照/);
    first.response = { ok:false,status:404 }; await first.refresh(); assert.match(first.id('notice').textContent, /尚未发布.*404/);
  });
  await test('stale source or snapshot and future clocks are warnings without latest claims', async () => {
    const h = harness(); await settle();
    for (const [part,key,value,pattern] of [['publication','generatedAt','2000-01-01T00:00:00Z',/旧快照/],['source','checkedAt','2000-01-01T00:00:00Z',/旧快照/],['publication','generatedAt','2100-01-01T00:00:00Z',/未来/]]) {
      const data = fixture(); data[part][key] = value; h.setData(data); await h.refresh();
      assert.equal(h.id('notice').dataset.tone,'warning'); assert.match(h.id('notice').textContent,pattern);
      assert(!h.id('notice').textContent.includes('已是最新'));
    }
  });
  await test('untrusted taxonomy, owner and evidence remain text; JSON colors never become CSS', async () => {
    const data = fixture(); const payload = '<img src=x onerror=alert(1)>';
    data.tasks[0].title = payload; data.tasks[0].owner.name = payload;
    data.tasks[0].verificationEvidence = [payload]; data.taxonomy.actions.agent_active.label = payload;
    data.taxonomy.actions.agent_active.color = 'url(https://invalid.example/x)';
    const h = harness(data); await settle();
    assert(h.id('P0').textContent.includes(payload));
    const badge = descendants(h.id('P0'), node => node.dataset?.action === 'agent_active')[0];
    assert.deepEqual(badge.style, {}); assert.match(badge.textContent, /<img/);
    assert(!/innerHTML|insertAdjacentHTML/.test(script));
    assert(!/\/Users\/|\/tmp\/|Bearer |github_pat_|ghp_/.test(html));
  });
  await test('clipboard success and failure both report honestly', async () => {
    const h = harness(); await settle(); await h.id('copy').listeners.click();
    assert.equal(h.copied, 'a'.repeat(40)); assert.match(h.id('copy-status').textContent,/已复制/);
    h.context.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
    await h.id('copy').listeners.click(); assert.match(h.id('copy-status').textContent,/手动复制/);
  });
  const current = JSON.parse(fs.readFileSync(path.join(base, 'aea/status.json'), 'utf8'));
  if (current.schemaVersion === 2) await test('current generated schema 2 snapshot renders', async () => {
    const h = harness(current); await settle(); assert.equal(h.id('flow').children.length,10); assert.notEqual(h.id('notice').dataset.tone,'error');
  });
  console.log(`PASS: ${count} tests; schema 2 action ownership, independent evidence, refresh/failure/race/cache/anchor behavior.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
