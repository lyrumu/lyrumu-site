// Run: node --test tests/cover-scroll.test.cjs
const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const source = readFileSync(join(__dirname, "../assets/js/cover-scroll.js"), "utf8");

function setup({ compact = false, reduced = false, coarse = false } = {}) {
  const classes = new Set(), properties = new Map(), recentProperties = new Map(), events = new Map(), frames = new Map();
  let top = 0, id = 0, observe;
  const media = {
    compact: { matches: compact, addEventListener: (_, fn) => { media.compact.change = fn; } },
    reduced: { matches: reduced, addEventListener: (_, fn) => { media.reduced.change = fn; } },
    coarse: { matches: coarse, addEventListener: (_, fn) => { media.coarse.change = fn; } },
  };
  const pointerEvents = new Map();
  const interaction = {
    addEventListener: (name, fn) => pointerEvents.set(name, fn),
    getBoundingClientRect: () => ({ left: 600, top: 100, width: 600, height: 600 }),
  };
  const scene = {
    classList: {
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
    },
    style: { setProperty: (name, value) => properties.set(name, value) },
    getBoundingClientRect: () => ({ top, height: 800 }),
    querySelector: () => interaction,
  };
  const recent = {
    style: { setProperty: (name, value) => recentProperties.set(name, value) },
    getBoundingClientRect: () => ({ top: 800 + top }),
  };
  const window = {
    innerWidth: 1280, innerHeight: 800, scrollY: 0,
    IntersectionObserver: true,
    matchMedia: (q) => q.includes("reduced-motion") ? media.reduced : q.includes("max-width") ? media.compact : media.coarse,
    requestAnimationFrame: (fn) => { frames.set(++id, fn); return id; },
    addEventListener: (name, fn, options) => events.set(name, { fn, options }),
  };
  const document = { hidden: false, querySelector: () => scene, getElementById: () => recent,
    addEventListener: (name, fn) => events.set(name, { fn }) };
  runInNewContext(source, {
    document, window,
    IntersectionObserver: class {
      constructor(fn) { observe = fn; }
      observe() {}
    },
  });
  const flush = () => {
    for (const [key, fn] of [...frames]) { frames.delete(key); fn(); }
  };
  return {
    classes, properties, recentProperties, events, frames, media, window, document, flush,
    scroll(y) { top = -y; window.scrollY = y; events.get("scroll").fn(); flush(); },
    visible(on) { observe([{ isIntersecting: on }]); flush(); },
    pointer(x, y, pointerType = "mouse") { pointerEvents.get("pointermove")({ clientX: x, clientY: y, pointerType }); flush(); },
    leave() { pointerEvents.get("pointerleave")(); flush(); },
  };
}

test("parallax reverses exactly, stays small, and respects native input and motion preferences", () => {
  const s = setup();
  assert.ok(s.classes.has("is-orbit-looping"));
  for (const y of [0, 80, 300, 400, 440, 520, 800, 10000, 800, 520, 440, 400, 300, 80, 0, -100]) {
    s.scroll(y);
    assert.equal(Number(s.properties.get("--cover-scroll-progress")), Math.min(1, Math.max(0, y) / 800));
    const recentProgress = Number(s.recentProperties.get("--cover-recent-progress"));
    assert.equal(recentProgress, Math.min(1, Math.max(0, (800 - y) / 800)));
    assert.ok(Math.abs(parseFloat(s.properties.get("--cover-camera-y")) - Math.min(48, Math.max(0, y) * 0.06)) < 1e-9);
  }
  assert.equal(s.properties.has("--cover-camera-scale"), false);
  assert.equal(s.events.get("scroll").options.passive, true);
  for (const event of ["wheel", "touchmove", "keydown"]) assert.equal(s.events.has(event), false);
  for (let i = 0; i < 20; i++) s.events.get("scroll").fn();
  assert.equal(s.frames.size, 1);
  s.flush();
  s.visible(false);
  assert.equal(s.classes.has("is-orbit-looping"), false);
  s.visible(true);
  assert.ok(s.classes.has("is-orbit-looping"));
  for (const options of [{ compact: true }, { reduced: true }]) {
    const staticScene = setup(options);
    staticScene.scroll(400);
    assert.equal(staticScene.classes.has("is-scroll-enhanced"), false);
    assert.equal(staticScene.classes.has("is-scrolling-up"), false);
    assert.equal(staticScene.classes.has("is-orbit-looping"), false);
    assert.equal(staticScene.properties.get("--cover-camera-y"), "0px");
    assert.equal(staticScene.properties.get("--cover-scroll-progress"), "0");
    assert.equal(staticScene.recentProperties.get("--cover-recent-progress"), "0");
  }
  s.scroll(400);
  s.media.reduced.matches = true;
  s.media.reduced.change();
  s.flush();
  assert.equal(s.classes.has("is-scroll-enhanced"), false);
  assert.equal(s.properties.get("--cover-camera-y"), "0px");
  assert.equal(s.recentProperties.get("--cover-recent-progress"), "0");
});

test("scroll intent reverses at the same position, survives pauses and ignores subpixel jitter", () => {
  const s = setup();
  s.scroll(400);
  assert.equal(s.classes.has("is-scrolling-up"), false);
  s.scroll(399.6); s.scroll(399.2);
  assert.equal(s.classes.has("is-scrolling-up"), false);
  s.scroll(398.9);
  assert.equal(s.classes.has("is-scrolling-up"), true);
  s.pointer(1200, 100);
  s.events.get("scroll").fn(); s.flush();
  assert.equal(s.classes.has("is-scrolling-up"), true);
  s.scroll(400);
  assert.equal(s.classes.has("is-scrolling-up"), false);
  s.scroll(200);
  assert.equal(s.classes.has("is-scrolling-up"), true);
  s.scroll(0);
  assert.equal(s.classes.has("is-scrolling-up"), false);
  s.scroll(400); s.scroll(300);
  s.media.reduced.matches = true; s.media.reduced.change(); s.flush();
  assert.equal(s.classes.has("is-scrolling-up"), false);
});

test("pointer depth is bounded and resets on leave, blur, visibility and motion changes", () => {
  const s = setup();
  s.pointer(1200, 100);
  assert.equal(s.properties.get("--cover-pointer-x"), "12px");
  assert.equal(s.properties.get("--cover-pointer-y"), "-12px");
  s.leave();
  assert.equal(s.properties.get("--cover-pointer-x"), "0px");
  for (const event of ["blur", "resize", "pageshow"]) {
    s.pointer(600, 700);
    s.events.get(event).fn(); s.flush();
    assert.equal(s.properties.get("--cover-pointer-y"), "0px");
  }
  s.pointer(1200, 100); s.visible(false);
  assert.equal(s.properties.get("--cover-pointer-x"), "0px");
  s.visible(true); s.pointer(1200, 100);
  s.document.hidden = true; s.events.get("visibilitychange").fn(); s.flush();
  assert.equal(s.classes.has("is-orbit-looping"), false);
  assert.equal(s.properties.get("--cover-pointer-x"), "0px");
  for (const options of [{ compact: true }, { reduced: true }, { coarse: true }]) {
    const staticScene = setup(options); staticScene.pointer(1200, 100);
    assert.equal(staticScene.properties.get("--cover-pointer-x"), "0px");
  }
  const touch = setup(); touch.pointer(1200, 100, "touch");
  assert.equal(touch.properties.get("--cover-pointer-x"), "0px");
  touch.pointer(1200, 100); touch.media.coarse.matches = true; touch.media.coarse.change(); touch.flush();
  assert.equal(touch.properties.get("--cover-pointer-x"), "0px");
});

test("Hugo outputs native recent cards and a static cover without carousel or home pagination", () => {
  const build = mkdtempSync(join(tmpdir(), "lyrumu-cover-scroll-"));
  try {
    execFileSync("hugo", ["--minify", "--themesDir", "themes", "--theme", "blowfish",
      "--config", "hugo.toml", "--destination", join(build, "public"), "--cacheDir", join(build, "cache")],
    { cwd: join(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] });
    const html = readFileSync(join(build, "public/index.html"), "utf8");
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    const candidates = [...html.matchAll(/<div data-home-article( hidden)?>([\s\S]*?)<h2 class=cover-card__title>([\s\S]*?)<\/h2>/g)];
    assert.ok(candidates.length > 6);
    assert.equal(candidates.filter(card => !card[1]).length, 6);
    assert.ok(candidates.slice(0, 6).every(card => !card[1]));
    assert.ok(candidates.slice(6).every(card => card[1]));
    const dates = candidates.map(card => Date.parse(card[2].match(/<time datetime=([^ >]+)/)[1]));
    assert.ok(dates.every((date, i) => i === 0 || date <= dates[i - 1]));
    assert.match(html, /id=home-feed-toggle/);
    assert.match(html, /\/js\/home-feed.min\./);
    assert.match(html, /home-recent-grid/);
    assert.match(html, /href=#home-recent/);
    assert.match(html, /cover-music-field__disc/);
    assert.equal((html.match(/class="cover-music-field__traveller /g) || []).length, 2);
    assert.match(html, /data-cover-interaction/);
    assert.doesNotMatch(html, /cover-music-field__light/);
    assert.doesNotMatch(html, /cover-carousel|Homepage sections|has-cover-carousel-js/);
    const css = readFileSync(join(__dirname, "../assets/css/_16_cover-scroll.css"), "utf8");
    assert.doesNotMatch(css, /position:\s*sticky|175svh|-55svh|cover-camera-scale|cover-text-opacity/);
    assert.doesNotMatch(css, /cover-disc-turn|cover-orbit-turn|cover-light-pass/);
    const { existsSync } = require("node:fs");
    assert.equal(existsSync(join(build, "public/page/2/index.html")), false);
  } finally { rmSync(build, { recursive: true, force: true }); }
});
