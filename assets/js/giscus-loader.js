/*
  giscus-loader.js — 评论区按需加载
  --------------------------------------------------------------------------
  原 inline 脚本从 layouts/partials/extend-footer.html 外置到这里（2026-07-25），
  加载范围由 extend-footer.html 根据 Hugo 页面类型决定；本脚本负责
  Giscus 配置与深浅主题切换，作为外部指纹文件跨页缓存。
*/
(function () {
  function getGiscusTheme() {
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  }

  function updateGiscusTheme() {
    const giscus = document.querySelector("iframe.giscus-frame");
    if (giscus) {
      giscus.contentWindow.postMessage(
        { giscus: { setConfig: { theme: getGiscusTheme() } } },
        "https://giscus.app"
      );
    }
  }

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.attributeName === "class") {
        updateGiscusTheme();
      }
    });
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  const script = document.createElement("script");
  script.src = "https://giscus.app/client.js";
  script.setAttribute("data-repo", "lyrumu/lyrumu-site");
  script.setAttribute("data-repo-id", "R_kgDOSCENwg");
  script.setAttribute("data-category", "Announcements");
  script.setAttribute("data-category-id", "DIC_kwDOSCENws4DAnhH");
  script.setAttribute("data-mapping", "pathname");
  script.setAttribute("data-strict", "0");
  script.setAttribute("data-reactions-enabled", "1");
  script.setAttribute("data-emit-metadata", "0");
  script.setAttribute("data-input-position", "top");
  script.setAttribute("data-theme", getGiscusTheme());
  script.setAttribute("data-lang", "zh-CN");
  script.setAttribute("data-loading", "lazy");
  script.crossOrigin = "anonymous";
  script.async = true;
  document.body.appendChild(script);
})();
