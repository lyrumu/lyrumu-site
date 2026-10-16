// Run: node --test tests/works-filter.test.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const source = readFileSync(join(__dirname, "../assets/js/works-filter.js"), "utf8");

function setup(hash = "", values = ["project", "demo"]) {
  const listeners = {};
  const inputs = values.map(value => ({ value, checked: value === "project",
    addEventListener(_, fn) { this.change = fn; } }));
  const location = { hash };
  const state = { previous: "preserved" };
  const history = { state, calls: [], replaceState(saved, title, hash) {
    assert.equal(saved, state);
    this.calls.push(hash);
    location.hash = hash;
  } };
  runInNewContext(source, {
    document: { querySelectorAll: () => inputs }, location, history,
    window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
  });
  return { inputs, location, history, listeners,
    selected: () => inputs.filter(input => input.checked).map(input => input.value),
    choose(value) {
      inputs.forEach(input => { input.checked = input.value === value; });
      inputs.find(input => input.value === value).change();
    },
  };
}

test("direct visits default to Project; Demo links restore Demo without writing history", () => {
  for (const hash of ["", "#project", "#invalid"]) assert.deepEqual(setup(hash).selected(), ["project"]);
  const s = setup("#demo");
  assert.deepEqual(s.selected(), ["demo"]);
  assert.deepEqual(s.history.calls, []);
});

test("changing category updates the current URL and keeps existing history state", () => {
  const s = setup();
  s.choose("demo");
  s.choose("project");
  assert.deepEqual(s.history.calls, ["#demo", "#project"]);
  assert.deepEqual(s.selected(), ["project"]);
  s.inputs[1].change();
  assert.equal(s.history.calls.length, 2);
});

test("hash navigation and restored history pages select the matching category", () => {
  const s = setup();
  s.location.hash = "#demo";
  s.listeners.hashchange();
  assert.deepEqual(s.selected(), ["demo"]);
  s.inputs.forEach(input => { input.checked = false; });
  s.listeners.pageshow();
  assert.deepEqual(s.selected(), ["demo"]);
  s.location.hash = "";
  s.listeners.pageshow();
  assert.deepEqual(s.selected(), ["project"]);
});

test("pages without Works radios do not register handlers", () => {
  assert.deepEqual(setup("", []).listeners, {});
});
