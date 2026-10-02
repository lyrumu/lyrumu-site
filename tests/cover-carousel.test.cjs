// Run: node --test tests/cover-carousel.test.cjs
const assert = require("node:assert/strict");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const { test } = require("node:test");
const { runInNewContext } = require("node:vm");

const source = readFileSync(`${__dirname}/../assets/js/cover-carousel.js`, "utf8");
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise(setImmediate);

function element() {
  const classes = new Set();
  const events = new Map();
  return {
    dataset: {}, style: { setProperty() {}, removeProperty() {} }, clientWidth: 100,
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, on) => on ? classes.add(name) : classes.delete(name),
    },
    setAttribute() {}, removeAttribute() {},
    querySelector: () => null, querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, width: 100 }),
    addEventListener: (name, fn) => events.set(name, fn),
    emit: (name, event = {}) => events.get(name)?.(event),
  };
}

function setup({ compact = false, reduced = false } = {}) {
  const root = element(), scene = element(), content = element(), deck = element();
  const camera = element(), field = element();
  const hero = deferred(), fonts = deferred();
  const imageDecodes = Array.from({ length: 7 }, deferred);
  const wrappers = Array.from({ length: 7 }, element);
  const images = wrappers.map((wrapper, i) => ({
    ...element(), src: "data:image/webp;base64,placeholder", currentSrc: "",
    dataset: { coverSrc: `/image/${i}.webp`, coverCandidates: `/image/${i}.webp 600w` },
    decode: () => imageDecodes[i].promise,
    closest: () => wrapper,
  }));
  const slides = Array.from({ length: 3 }, () => {
    const slide = element(), surface = element();
    slide.contains = (target) => target === surface;
    slide.querySelector = (selector) => selector === "h2" ? { textContent: "Docs" } : surface;
    return slide;
  });
  root.closest = (selector) => selector === ".cover-page" ? scene : content;
  root.querySelector = (selector) => selector === ".cover-carousel-deck" ? deck : null;
  root.querySelectorAll = (selector) => selector === "[data-cover-src]" ? images : slides;
  scene.querySelector = (selector) => selector === ".cover-music-camera" ? camera : field;
  field.querySelector = () => ({ decode: () => hero.promise });
  const frames = new Map(), timers = new Map();
  let id = 0;
  const window = {
    ...element(), innerWidth: 1280, innerHeight: 800,
    matchMedia: (query) => ({
      matches: query.includes("reduced-motion") ? reduced : compact,
      addEventListener() {},
    }),
    requestAnimationFrame: (fn) => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: (key) => frames.delete(key),
    setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id; },
    clearTimeout: (key) => timers.delete(key),
  };
  runInNewContext(source, {
    window, document: { querySelector: () => root, body: element(), documentElement: element(), fonts: { ready: fonts.promise } },
    getComputedStyle: () => ({ fontSize: "16", getPropertyValue: () => "81.6" }),
  });
  return {
    root, scene, hero, fonts, images, imageDecodes, wrappers, timers,
    frame() { const batch = [...frames.values()]; frames.clear(); batch.forEach((fn) => fn()); },
    wheel(deltaY, options = {}, outside = false) {
      let prevented = false;
      (outside ? window : scene).emit("wheel", {
        deltaY, ...options, preventDefault() { prevented = true; },
      });
      return prevented;
    },
    select(index) {
      const surface = slides[index].querySelector(".cover-carousel-card-surface");
      surface.emit("click", { currentTarget: surface, preventDefault() {} });
    },
    settle() { const batch = [...timers.values()]; timers.clear(); batch.forEach(({ fn }) => fn()); },
    async load(index, fail = false) {
      images[index].currentSrc = images[index].src;
      imageDecodes[index][fail ? "reject" : "resolve"]();
      await tick();
    },
  };
}

test("desktop waits for cover resources and two frames, then warms all images", async () => {
  const page = setup();
  page.frame(); page.frame();
  assert.ok(page.images.every((img) => !img.srcset));
  page.hero.resolve(); await tick();
  page.frame(); page.frame();
  assert.ok(page.images.every((img) => !img.srcset), "fonts still have priority");
  page.fonts.resolve(); await tick();
  page.frame();
  assert.ok(page.images.every((img) => !img.srcset));
  page.frame();
  assert.ok(page.images.every((img) => img.srcset && !img.src.startsWith("data:")));
  assert.ok(page.scene.classList.contains("is-images-warming"));
  await page.load(0);
  assert.ok(page.wrappers[0].classList.contains("is-loaded"));
});

test("early gesture never waits for images; reveal waits through reversal", async () => {
  const page = setup();
  page.wheel(100);
  assert.ok(page.root.classList.contains("is-orbit-open"));
  assert.ok(page.images.every((img) => img.srcset));
  await page.load(0);
  assert.ok(!page.wrappers[0].classList.contains("is-loaded"));
  page.wheel(-100);
  await page.load(1, true);
  assert.ok(!page.wrappers[0].classList.contains("is-loaded"));
  page.settle();
  assert.ok(page.wrappers[0].classList.contains("is-loaded"));
  assert.ok(!page.wrappers[1].classList.contains("is-loaded"), "failed image retains placeholder");
});

test("mobile and reduced motion load visible cards without waiting for the cover", async () => {
  for (const options of [{ compact: true }, { reduced: true }]) {
    const page = setup(options);
    assert.ok(page.images.every((img) => img.srcset));
    await page.load(0);
    assert.ok(page.wrappers[0].classList.contains("is-loaded"));
  }
});

test("switching side cards also defers image reveal until motion finishes", async () => {
  const page = setup();
  page.wheel(100); page.settle();
  page.select(1);
  assert.equal(page.root.dataset.activeIndex, "1");
  await page.load(2);
  assert.ok(!page.wrappers[2].classList.contains("is-loaded"));
  page.settle();
  assert.ok(page.wrappers[2].classList.contains("is-loaded"));
});

test("failed cover resources do not prevent background warmup", async () => {
  const page = setup();
  page.hero.reject(); page.fonts.reject(); await tick();
  page.frame(); page.frame();
  assert.ok(page.images.every((img) => img.srcset));
});

test("cover gestures leave overlays, browser zoom and compact scrolling alone", () => {
  const page = setup();
  assert.equal(page.wheel(100, {}, true), false);
  assert.equal(page.wheel(100, { ctrlKey: true }), false);
  assert.equal(page.wheel(100, { defaultPrevented: true }), false);
  assert.ok(!page.root.classList.contains("is-orbit-open"));
  assert.equal(page.wheel(100), true);
  assert.ok(page.root.classList.contains("is-orbit-open"));
  for (const options of [{ compact: true }, { reduced: true }]) {
    assert.equal(setup(options).wheel(100), false);
  }
});

test("Hugo preserves responsive srcset separators for deferred cover images", () => {
  const output = mkdtempSync(join(tmpdir(), "lyrumu-cover-test-"));
  try {
    execFileSync("hugo", [
      "--destination", output, "--themesDir", "themes", "--theme", "blowfish",
      "--config", "hugo.toml", "--cacheDir", join(output, "cache"), "--quiet",
    ], { cwd: join(__dirname, "..") });
    const html = readFileSync(join(output, "index.html"), "utf8");
    const deferred = [...html.matchAll(/data-cover-candidates="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(deferred.length, 7);
    assert.ok(deferred.every((srcset) => srcset.includes(" 600w") || srcset.includes(" 500w")));
    assert.ok(deferred.every((srcset) => !srcset.includes("%20")));
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
