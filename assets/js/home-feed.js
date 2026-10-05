/* 首页 Recent / Popular：复用 Firebase 已更新的计数，不另建读写链路。 */
(() => {
  const button = document.getElementById("home-feed-toggle");
  const grid = document.getElementById("home-articles");
  if (!button || !grid) return;
  const label = button.querySelector("[data-feed-label]");
  const status = document.getElementById("home-feed-status");
  const recent = Array.from(grid.querySelectorAll("[data-home-article]"));
  const limit = Number(grid.dataset.limit);
  const counters = recent.map(card => ({
    views: card.querySelector("span[id^='views_']"),
    likes: card.querySelector("span[id^='likes_']"),
  }));
  let popular = false, timer;

  function count(node) {
    const text = node?.textContent.trim() || "";
    if (!/^(\d+|\d{1,3}(,\d{3})+)$/.test(text)) return null;
    const value = Number(text.replaceAll(",", ""));
    return Number.isSafeInteger(value) ? value : null;
  }

  function message(text) {
    status.textContent = text;
    status.hidden = !text;
  }

  function show(cards, mode) {
    const visible = cards.slice(0, limit);
    const focused = document.activeElement;
    const focusedCard = recent.find(card => card.contains(focused));
    recent.forEach(card => { card.hidden = !visible.includes(card); });
    visible.forEach((card, index) => {
      if (grid.children[index] !== card) grid.insertBefore(card, grid.children[index] || null);
    });
    if (focusedCard) {
      const target = visible.includes(focusedCard) ? focused : button;
      if (document.activeElement !== target) target.focus({ preventScroll: true });
    }
    label.textContent = mode;
    button.setAttribute("aria-pressed", String(mode === "Popular"));
    button.setAttribute("aria-label", `Show ${mode === "Recent" ? "Popular" : "Recent"} articles`);
    grid.setAttribute("aria-busy", "false");
  }

  function update() {
    if (!popular) return;
    const scores = counters.map(({ views, likes }) => {
      const v = count(views), l = count(likes);
      return v === null || l === null ? null : v + l * 10;
    });
    if (scores.includes(null)) return;
    clearTimeout(timer);
    const ranked = recent.map((card, index) => ({ card, index, score: scores[index] }))
      .sort((a, b) => b.score - a.score || a.index - b.index);
    show(ranked.map(item => item.card), "Popular");
    message("");
  }

  const observer = new MutationObserver(update);
  counters.forEach(pair => Object.values(pair).forEach(node => {
    if (node) observer.observe(node, { childList: true, characterData: true, subtree: true });
  }));
  button.disabled = false;
  button.querySelector("[data-feed-icon]").hidden = false;
  button.addEventListener("click", () => {
    popular = !popular;
    clearTimeout(timer);
    if (!popular) {
      show(recent, "Recent");
      message("");
      return;
    }
    grid.setAttribute("aria-busy", "true");
    button.setAttribute("aria-label", "Cancel loading Popular articles");
    message("Loading Popular…");
    timer = setTimeout(() => {
      popular = false;
      show(recent, "Recent");
      message("Popular is unavailable. Showing Recent; click to retry.");
    }, 15000);
    update();
  });
})();
