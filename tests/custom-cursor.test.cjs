// Run: node --test tests/custom-cursor.test.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const source = readFileSync(join(__dirname, "../assets/js/custom-cursor.js"), "utf8");

class Element {
  constructor(tag, classes = [], parent = null) {
    this.tag = tag;
    this.classes = new Set(classes);
    this.parent = parent;
    this.classList = {
      add: (...names) => names.forEach(name => this.classes.add(name)),
      remove: (...names) => names.forEach(name => this.classes.delete(name)),
      contains: name => this.classes.has(name),
      toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name),
    };
  }
  closest(selectors) {
    for (let node = this; node; node = node.parent) {
      if (selectors.split(",").some(selector => {
        const value = selector.trim();
        return value.startsWith(".") ? node.classes.has(value.slice(1)) : node.tag === value;
      })) return node;
    }
    return null;
  }
}

test("cursor hover stays continuous on vertical menu paths and resets outside", () => {
  const events = {}, root = new Element("html"), cursor = new Element("div");
  cursor.querySelector = () => ({ style: {} });
  runInNewContext(source, {
    Element,
    window: { matchMedia: () => ({ matches: false }), addEventListener() {} },
    document: { documentElement: root, hidden: false, querySelector: () => cursor,
      addEventListener: (name, fn) => { events[name] = fn; } },
  });
  const group = new Element("details", ["site-menu-group--desktop"]);
  const summary = new Element("summary", [], group);
  const title = new Element("span", [], summary);
  const panel = new Element("div", ["site-menu-group__panel"], group);
  const items = new Element("ul", ["site-menu-group__items"], panel);
  const link = new Element("a", [], items);
  const linkTitle = new Element("span", [], link);
  const path = [title, summary, panel, items, link, linkTitle, link, items, panel, summary, title];
  for (let round = 0; round < 3; round++) {
    for (const target of path) {
      events.pointerout({ relatedTarget: target });
      assert.equal(root.classes.has("custom-cursor-hover"), true, `out to ${target.tag}`);
      events.pointerover({ target });
      assert.equal(root.classes.has("custom-cursor-hover"), true, `over ${target.tag}`);
    }
  }
  events.pointerout({ relatedTarget: new Element("div") });
  assert.equal(root.classes.has("custom-cursor-hover"), false);
  events.pointerover({ target: new Element("a") });
  assert.equal(root.classes.has("custom-cursor-hover"), true);
  events.pointerout({ relatedTarget: null });
  assert.equal(root.classes.has("custom-cursor-hover"), false);
  assert.equal(cursor.classes.has("is-hidden"), true);
});
