// Run: node --test tests/custom-cursor.test.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const source = readFileSync(join(__dirname, "../assets/js/custom-cursor.js"), "utf8");
const baseTemplate = readFileSync(join(__dirname, "../layouts/_default/baseof.html"), "utf8");
const cursorPartial = readFileSync(join(__dirname, "../layouts/partials/custom-cursor.html"), "utf8");

class Element {
  constructor(tag, classes = [], parent = null) {
    this.tag = tag;
    this.classes = new Set(classes);
    this.parent = parent;
    this.classListCalls = { add: 0, remove: 0 };
    this.classList = {
      add: (...names) => { this.classListCalls.add++; names.forEach(name => this.classes.add(name)); },
      remove: (...names) => { this.classListCalls.remove++; names.forEach(name => this.classes.delete(name)); },
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

test("cursor stays owned inside the page and resets only after a real exit", () => {
  const events = {}, windowEvents = {}, storage = new Map();
  const root = new Element("html"), cursor = new Element("div"), ringWrapper = { style: {} };
  let frameRequests = 0;
  const positionStorageKey = "lyrumu.customCursorPosition.v2";
  storage.set(positionStorageKey, JSON.stringify({ x: 480, y: 32, savedAt: Date.now() }));
  cursor.querySelector = () => ringWrapper;
  const documentState = { documentElement: root, hidden: false, querySelector: () => cursor,
    scrollingElement: { scrollHeight: 800, clientHeight: 800, scrollWidth: 1200, clientWidth: 1200 },
    elementFromPoint: () => new Element("a"),
    addEventListener: (name, fn) => { events[name] = fn; } };
  runInNewContext(source, {
    Element,
    requestAnimationFrame: () => ++frameRequests,
    cancelAnimationFrame() {},
    window: {
      matchMedia: () => ({ matches: false }),
      addEventListener: (name, fn) => { windowEvents[name] = fn; },
      innerWidth: 1200,
      innerHeight: 800,
      sessionStorage: {
        getItem: key => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
        removeItem: key => storage.delete(key),
      },
    },
    document: documentState,
  });
  assert.equal(root.classes.has("custom-cursor-active"), true);
  assert.equal(cursor.classes.has("is-ready"), true);
  assert.equal(ringWrapper.style.transform, "translate3d(480.00px, 32.00px, 0)");
  assert.equal(storage.has(positionStorageKey), false);
  events.DOMContentLoaded();
  assert.equal(root.classes.has("custom-cursor-hover"), true);
  const rootAddCalls = root.classListCalls.add;
  const cursorAddCalls = cursor.classListCalls.add;
  const cursorRemoveCalls = cursor.classListCalls.remove;
  events.pointermove({ pointerType: "mouse", clientX: 481, clientY: 32 });
  assert.equal(root.classListCalls.add, rootAddCalls);
  assert.equal(cursor.classListCalls.add, cursorAddCalls);
  assert.equal(cursor.classListCalls.remove, cursorRemoveCalls);
  events.pointerdown({ pointerType: "mouse", clientX: 481, clientY: 32 });
  assert.equal(root.classes.has("custom-cursor-click"), true);
  windowEvents.blur();
  assert.equal(root.classes.has("custom-cursor-active"), true);
  assert.equal(cursor.classes.has("is-hidden"), true);
  assert.equal(root.classes.has("custom-cursor-click"), false);
  documentState.hidden = true;
  events.visibilitychange();
  assert.equal(root.classes.has("custom-cursor-active"), true);
  assert.equal(cursor.classes.has("is-hidden"), true);
  documentState.hidden = false;
  const requestsBeforeResume = frameRequests;
  events.visibilitychange();
  assert.equal(frameRequests, requestsBeforeResume);
  assert.equal(cursor.classes.has("is-hidden"), true);
  events.pointermove({ pointerType: "mouse", clientX: 900, clientY: 80 });
  assert.equal(cursor.classes.has("is-hidden"), false);
  assert.equal(ringWrapper.style.transform, "translate3d(900.00px, 80.00px, 0)");
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
  root.classes.add("custom-cursor-active");
  events.pointerout({ relatedTarget: null });
  assert.equal(root.classes.has("custom-cursor-hover"), true);
  assert.equal(root.classes.has("custom-cursor-active"), true);
  assert.equal(cursor.classes.has("is-hidden"), false);
  events.mouseleave({ clientX: 480, clientY: 32 });
  assert.equal(root.classes.has("custom-cursor-active"), true);
  assert.equal(cursor.classes.has("is-hidden"), false);
  windowEvents.pagehide();
  const saved = JSON.parse(storage.get(positionStorageKey));
  assert.equal(saved.x, 900);
  assert.equal(saved.y, 80);
  assert.equal(Number.isFinite(saved.savedAt), true);
  windowEvents.pageshow();
  assert.equal(root.classes.has("custom-cursor-active"), true);
  assert.equal(cursor.classes.has("is-hidden"), false);
  windowEvents.pagehide();
  documentState.hidden = true;
  windowEvents.pageshow();
  assert.equal(root.classes.has("custom-cursor-active"), false);
  documentState.hidden = false;
  events.visibilitychange();
  assert.equal(root.classes.has("custom-cursor-active"), true);
  events.mouseleave({ clientX: -1, clientY: 32 });
  assert.equal(root.classes.has("custom-cursor-active"), false);
  assert.equal(cursor.classes.has("is-hidden"), true);
  windowEvents.pagehide();
  assert.equal(storage.has(positionStorageKey), false);
  windowEvents.pageshow();
  assert.equal(root.classes.has("custom-cursor-active"), false);
  assert.equal(cursor.classes.has("is-hidden"), true);
});

test("cursor partial runs before visible body content", () => {
  const cursorIndex = baseTemplate.indexOf('partial "custom-cursor.html"');
  const contentIndex = baseTemplate.indexOf('id="the-top"');
  assert.notEqual(cursorIndex, -1);
  assert.ok(cursorIndex < contentIndex);
  assert.match(cursorPartial, /<script>\{\{ \$js\.Content \| safeJS \}\}<\/script>/);
});
