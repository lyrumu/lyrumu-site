// Run: node --test tests/header-menu.test.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const source = readFileSync(join(__dirname, "../assets/js/header-menu.js"), "utf8");

function setup(desktop = false) {
  const events = {}, classes = new Set(desktop ? ["site-menu-group--desktop"] : []);
  const panel = {}, trigger = { addEventListener() {}, focus() {} };
  const links = ["/about/", "/friends/", "/life/"].map(href => ({ href }));
  const group = {
    open: true, dataset: {},
    classList: { contains: name => classes.has(name), remove: name => classes.delete(name) },
    querySelector: selector => selector === "summary" ? trigger : panel,
    contains: node => node === trigger || links.includes(node),
    matches: () => false,
    addEventListener: (name, fn) => { events[name] = fn; },
  };
  let outsideClick;
  runInNewContext(source, {
    document: { activeElement: null, querySelectorAll: () => [group],
      addEventListener: (_, fn) => { outsideClick = fn; } },
    window: { matchMedia: () => ({ matches: false }) },
    clearTimeout() {}, cancelAnimationFrame() {},
    setTimeout: fn => { fn(); },
    getComputedStyle: () => ({ getPropertyValue: () => "240" }),
  });
  return { group, panel, links, events, outsideClick };
}

test("touch blur keeps each About child available for its native click", () => {
  for (const desktop of [false, true]) {
    for (let i = 0; i < 3; i++) {
      const s = setup(desktop);
      s.events.focusout({ relatedTarget: null });
      assert.equal(s.group.open, true, s.links[i].href);
      assert.notEqual(s.panel.inert, true);
      s.events.focusout({ relatedTarget: s.links[i] });
      s.outsideClick({ target: s.links[i] });
      assert.equal(s.group.open, true, s.links[i].href);
    }
  }
});

test("focus outside, outside clicks and Escape still close both menu variants", () => {
  for (const desktop of [false, true]) {
    for (const action of [
      s => s.events.focusout({ relatedTarget: {} }),
      s => s.outsideClick({ target: {} }),
      s => s.events.keydown({ key: "Escape", preventDefault() {}, stopPropagation() {} }),
    ]) {
      const s = setup(desktop);
      action(s);
      assert.equal(s.group.open, false);
    }
  }
});
