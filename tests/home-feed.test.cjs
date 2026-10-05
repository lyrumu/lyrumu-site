// Run: node --test tests/home-feed.test.cjs
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const source = readFileSync(join(__dirname, "../assets/js/home-feed.js"), "utf8");

function setup(values) {
  const label = { textContent: "Recent" }, icon = { hidden: true }, status = {};
  const document = { activeElement: null };
  const moved = [];
  const cards = values.map(([views, likes], index) => ({
    index, hidden: index >= 6,
    link: { focus() { document.activeElement = this; } },
    contains(node) { return node === this.link; },
    views: { textContent: views }, likes: { textContent: likes },
    querySelector(selector) { return selector.includes("views_") ? this.views : this.likes; },
  }));
  let click, changed, deadline;
  const attrs = {};
  const button = {
    disabled: true,
    focus() { document.activeElement = this; },
    querySelector: selector => selector.includes("label") ? label : icon,
    setAttribute: (name, value) => { attrs[name] = value; },
    addEventListener: (_, fn) => { click = fn; },
  };
  const order = [...cards];
  const grid = {
    children: order,
    dataset: { limit: "6" }, querySelectorAll: () => cards,
    setAttribute: (name, value) => { attrs[name] = value; },
    insertBefore(card, next) {
      moved.push(card.index);
      if (card.contains(document.activeElement)) document.activeElement = null;
      order.splice(order.indexOf(card), 1);
      order.splice(next ? order.indexOf(next) : order.length, 0, card);
    },
  };
  const nodes = { "home-feed-toggle": button, "home-articles": grid, "home-feed-status": status };
  document.getElementById = id => nodes[id];
  runInNewContext(source, {
    document,
    MutationObserver: class { constructor(fn) { changed = fn; } observe() {} },
    setTimeout: fn => { deadline = fn; return 1; }, clearTimeout: () => { deadline = null; },
  });
  return { cards, label, status, button, attrs, document, moved,
    click: () => click(), changed: () => changed(), expire: () => deadline(),
    visible: () => order.filter(card => !card.hidden).map(card => card.index) };
}

test("Popular ranks all candidates by views + 10 likes, uses Recent order for ties, and switches back", () => {
  const s = setup([["5", "0"], ["10", "0"], ["0", "1"], ["0", "0"],
    ["20", "0"], ["30", "0"], ["0", "8"], ["1,000", "0"]]);
  assert.equal(s.button.disabled, false);
  assert.deepEqual(s.visible(), [0, 1, 2, 3, 4, 5]);
  s.click();
  assert.equal(s.label.textContent, "Popular");
  assert.equal(s.attrs["aria-pressed"], "true");
  assert.deepEqual(s.visible(), [7, 6, 5, 4, 1, 2]);
  s.cards[0].likes.textContent = "200"; s.changed();
  assert.deepEqual(s.visible(), [0, 7, 6, 5, 4, 1]);
  s.click();
  assert.equal(s.label.textContent, "Recent");
  assert.equal(s.attrs["aria-pressed"], "false");
  assert.deepEqual(s.visible(), [0, 1, 2, 3, 4, 5]);
});

test("Live rankings avoid unchanged moves, restore focus after a move, and redirect focus when an article leaves", () => {
  const s = setup(Array.from({ length: 8 }, (_, i) => [String(100 - i), "0"]));
  s.click();
  s.cards[0].link.focus();
  s.cards[7].views.textContent = "94"; s.changed();
  assert.deepEqual(s.moved, []);
  assert.equal(s.document.activeElement, s.cards[0].link);
  s.cards[1].link.focus();
  s.cards[1].likes.textContent = "20"; s.changed();
  assert.deepEqual(s.visible(), [1, 0, 2, 3, 4, 5]);
  assert.equal(s.document.activeElement, s.cards[1].link);
  s.cards[1].likes.textContent = "0";
  s.cards[1].views.textContent = "0"; s.changed();
  assert.ok(!s.visible().includes(1));
  assert.equal(s.document.activeElement, s.button);
});

test("Unknown counters keep Recent; loading can finish, cancel, or time out without a partial ranking", () => {
  const s = setup(Array.from({ length: 8 }, () => ["0", "0"]));
  s.cards[7].views.textContent = "loading";
  s.click();
  assert.equal(s.label.textContent, "Recent");
  assert.equal(s.attrs["aria-busy"], "true");
  assert.equal(s.status.hidden, false);
  assert.deepEqual(s.visible(), [0, 1, 2, 3, 4, 5]);
  s.cards[7].views.textContent = "1"; s.changed();
  assert.equal(s.label.textContent, "Popular");
  assert.deepEqual(s.visible(), [7, 0, 1, 2, 3, 4]);
  s.click();
  for (const invalid of ["loading", "NaN", "-1", "12,34", "9007199254740992"]) {
    s.cards[7].views.textContent = invalid;
    s.click(); s.expire();
    assert.equal(s.label.textContent, "Recent");
    assert.equal(s.attrs["aria-busy"], "false");
    assert.match(s.status.textContent, /unavailable/);
    assert.deepEqual(s.visible(), [0, 1, 2, 3, 4, 5]);
  }
  s.click(); s.click();
  s.cards[7].views.textContent = "100"; s.changed();
  assert.equal(s.label.textContent, "Recent");
  assert.deepEqual(s.visible(), [0, 1, 2, 3, 4, 5]);
});
