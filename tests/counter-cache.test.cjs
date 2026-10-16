// Run: node --test tests/counter-cache.test.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const source = readFileSync(join(__dirname, "../assets/js/counter-cache.js"), "utf8");
const KEY = "counter-cache:v2";

function node(id, text) { return { id, textContent: text, style: {} }; }

function setup(nodes, cached) {
  const store = {};
  if (cached) store[KEY] = JSON.stringify(cached);
  const observers = [], timers = [];
  const window = {};
  const document = { readyState: "complete", querySelectorAll: () => nodes, addEventListener: () => {} };
  const localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  runInNewContext(source, {
    window, document, localStorage,
    MutationObserver: class { constructor(fn) { this.fn = fn; } observe() { observers.push(this); } },
    setTimeout: fn => { timers.push(fn); return timers.length; },
  });
  return { window, store, observers,
    expire: () => { timers.splice(0).forEach(fn => fn()); },
    saved: () => JSON.parse(store[KEY]) };
}

test("shows the cached count after the grace period when the counter never loads", () => {
  const n = node("views_notes/a.md", "loading");
  const s = setup([n], { "views_notes/a.md": 1234 });
  assert.equal(n.textContent, "loading");
  s.expire();
  assert.equal(n.textContent, "1,234");
  assert.equal(n.style.color, "inherit");
  assert.equal(n.style.background, "none");
  assert.equal(n.style.animation, "none");
  assert.equal(n.style.maxHeight, "none");
});

test("keeps live values, does not reveal them, and caches them", () => {
  const n = node("views_x", "42");
  const s = setup([n]);
  s.expire();
  assert.equal(n.textContent, "42");
  assert.equal(n.style.color, undefined);
  assert.deepEqual(s.saved(), { "views_x": 42 });
});

test("a live value arriving after a reveal updates the display and the cache", () => {
  const n = node("likes_x", "loading");
  const s = setup([n], { "likes_x": 7 });
  s.expire();
  assert.equal(n.textContent, "7");
  n.textContent = "8"; // firebase 之后写入实时值
  s.observers.forEach(o => o.fn());
  assert.equal(s.saved()["likes_x"], 8);
});

test("no cache and no live value leaves the placeholder untouched", () => {
  const n = node("views_home", "···");
  const s = setup([n]);
  s.expire();
  assert.equal(n.textContent, "···");
  assert.equal(s.store[KEY], undefined);
});

test("caps the cache and drops the oldest entries", () => {
  const cached = {};
  for (let i = 0; i < 1000; i++) cached["views_" + i] = i;
  const n = node("views_new", "5");
  const s = setup([n], cached);
  const saved = s.saved();
  assert.equal(Object.keys(saved).length, 1000);
  assert.equal(saved["views_new"], 5);
  assert.ok(!("views_0" in saved));
});

test("exposes the shared cache for the Popular ranking", () => {
  const n = node("views_x", "9");
  const s = setup([n]);
  assert.equal(s.window.CounterCache.get(n), 9);
});
