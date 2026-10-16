/* 计数缓存（2026-10-13）
   ---------------------------------------------------------------
   - 实时计数 15 秒内到达就用实时值；否则显示上次缓存的数字，避免一直 loading。
   - 直连（gstatic 被墙）时 firebase.js 的 module 不会执行，本脚本不依赖它。
   - 与首页 Popular 共用同一份缓存：window.CounterCache.get(node)。
   - 缓存揭示使用内联样式；Firebase 实时值到达并清除加载类后仍正常显示。
   --------------------------------------------------------------- */
(function () {
  var KEY = "counter-cache:v2";
  var MAX = 1000;
  var GRACE = 15000;
  var SELECTOR = "[id^='views_'], [id^='likes_']";

  var cache = (function () {
    try {
      var parsed = JSON.parse(localStorage.getItem(KEY));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) { return {}; }
  })();

  function persist() {
    try {
      var keys = Object.keys(cache);
      // 超出上限时丢弃最早写入的条目（对象键按插入顺序）。
      for (var i = 0; i < keys.length - MAX; i++) delete cache[keys[i]];
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {}
  }

  // 读出节点上的实时数字；占位文案（loading / ···）返回 null。
  function number(node) {
    var text = (node && node.textContent.trim()) || "";
    if (!/^(\d+|\d{1,3}(,\d{3})+)$/.test(text)) return null;
    var value = Number(text.replace(/,/g, ""));
    return Number.isSafeInteger(value) ? value : null;
  }

  function format(value) {
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function get(node) {
    var value = node && cache[node.id];
    return Number.isSafeInteger(value) ? value : null;
  }

  function store(node) {
    var value = number(node);
    if (value === null || !node.id || cache[node.id] === value) return;
    cache[node.id] = value;
    persist();
  }

  function reveal(node) {
    var value = get(node);
    if (value === null || number(node) !== null) return;
    node.textContent = format(value);
    node.style.color = "inherit";
    node.style.background = "none";
    node.style.animation = "none";
    node.style.maxHeight = "none";
    node.style.borderRadius = "0";
  }

  function init() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll(SELECTOR));
    nodes.forEach(function (node) {
      if (!node.id) return;
      store(node);
      // 实时值写入缓存；揭示缓存后 firebase 再写实时值时也会更新缓存。
      new MutationObserver(function () { store(node); })
        .observe(node, { childList: true, characterData: true, subtree: true });
    });
    setTimeout(function () { nodes.forEach(reveal); }, GRACE);
  }

  window.CounterCache = { get: get, key: KEY };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
