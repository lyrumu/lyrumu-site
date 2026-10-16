/* blur-image.js — 通用 LQIP blur-up 加载
   ---------------------------------------------------------------
   - 给 html 加 js-blurup class
   - 监听 .blur-img（排除 data-cover-src）和 .cover-card__bg-img 的 load/error
   - 加载完成：给 img 和 .blur-img-wrapper 加 .is-loaded
   - 加载失败：给 img 加 .is-broken
   - 暴露 window.BlurImage.markLoaded(img) 供动态切换封面时调用
   --------------------------------------------------------------- */
(function () {
  document.documentElement.classList.add("js-blurup");

  function markLoaded(img) {
    var cur = img.currentSrc || img.src || "";
    if (cur.indexOf("data:image") === 0) {
      // 有 srcset 时交给浏览器选图；没有时用 data-full-src 替换 LQIP。
      if (!img.getAttribute("srcset")) {
        var full = img.getAttribute("data-full-src");
        if (full && img.src !== full) img.src = full;
      }
      return;
    }
    img.classList.add("is-loaded");
    var wrapper = img.closest(".blur-img-wrapper");
    if (wrapper) wrapper.classList.add("is-loaded");
    // DOCS 封面卡使用独立的背景容器。
    var bg = img.closest(".cover-card__bg");
    if (bg) bg.classList.add("is-loaded");
  }

  function markBroken(img) {
    img.classList.add("is-broken");
    var wrapper = img.closest(".blur-img-wrapper");
    if (wrapper) wrapper.classList.add("is-broken");
  }

  function init() {
    // 带 data-cover-src 的图片不在这里接管，其余图片统一绑定加载反馈。
    document.querySelectorAll(".blur-img:not([data-cover-src]), .cover-card__bg-img").forEach(function (img) {
      img.addEventListener("error", function () {
        markBroken(img);
        // DOCS 卡片兼容：显示图标降级
        var card = img.closest(".article-link--cover-card");
        if (card) {
          var fb = card.querySelector(".cover-card__icon-fallback");
          if (fb) fb.removeAttribute("hidden");
        }
      });

      img.addEventListener("load", function () {
        // 只有带 LQIP 的图才走 blur-up 收尾
        if (!img.dataset.lqip) return;
        markLoaded(img);
      });

      if (img.complete && img.dataset.lqip) markLoaded(img);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.BlurImage = { markLoaded: markLoaded };
})();
