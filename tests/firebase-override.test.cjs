// Run: node --test tests/firebase-override.test.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");

const source = readFileSync(join(__dirname, "../assets/js/firebase.js"), "utf8")
  .replace(/^import[\s\S]*?from "[^"]+";\n/gm, "");

function setup() {
  const node = { innerText: "loading", className: "animate-pulse text-transparent" };
  const config = { textContent: '{"config":{}}', getAttribute: () => null };
  let next, options, previous;
  const context = {
    document: { getElementById: id => id === "firebase-config" ? config : id === "likes_test" ? node : null, querySelectorAll: () => [] },
    initializeApp: () => ({}), getFirestore: () => ({}), getAuth: () => ({}),
    signInAnonymously: () => Promise.resolve(),
    doc: (_, collection, id) => ({ collection, id }),
    onSnapshot(ref, opts, callback) {
      options = typeof opts === "object" ? opts : {};
      next = typeof opts === "function" ? opts : callback;
    },
    localStorage: { getItem: () => null }, window: {}, console,
  };
  runInNewContext(source, context);
  context.updateDisplay("likes", "likes_test");
  return { node,
    emit(fromCache, value) {
      const signature = JSON.stringify(value);
      // 模拟 SDK：文档数据相同，仅元数据变化时需要显式订阅。
      const deliver = previous === undefined || previous !== signature || options.includeMetadataChanges;
      previous = signature;
      if (deliver) next({ metadata: { fromCache }, exists: () => value !== null, data: () => ({ likes: value }) });
    },
  };
}

test("offline missing document becomes zero when the server confirms it is still missing", () => {
  const s = setup();
  s.emit(true, null);
  assert.equal(s.node.innerText, "loading");
  assert.equal(s.node.className, "animate-pulse text-transparent");
  s.emit(false, null);
  assert.equal(String(s.node.innerText), "0");
  assert.equal(s.node.className, "");
});

test("cached and repeated metadata snapshots keep the count visible, followed by live updates", () => {
  const s = setup();
  s.emit(true, 1234);
  assert.equal(s.node.innerText, "1,234");
  assert.equal(s.node.className, "");
  s.emit(false, 1234);
  s.emit(true, 1234);
  assert.equal(s.node.innerText, "1,234");
  assert.equal(s.node.className, "");
  s.emit(false, 1235);
  assert.equal(s.node.innerText, "1,235");
  assert.equal(s.node.className, "");
});

test("offline missing snapshots preserve an already displayed cached count", () => {
  const s = setup();
  s.node.innerText = "7";
  s.emit(true, null);
  assert.equal(s.node.innerText, "7");
});
