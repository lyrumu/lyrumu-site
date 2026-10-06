/* Native scrolling and bounded pointer depth; CSS owns the ambient music motion. */
(function () {
  "use strict";
  const scene = document.querySelector("[data-cover-scroll]");
  if (!scene) return;
  const interaction = scene.querySelector("[data-cover-interaction]");
  const recent = document.getElementById("home-recent");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const compactLayout = window.matchMedia("(max-width: 720px), (max-width: 980px) and (max-height: 500px) and (pointer: coarse)");
  const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)");
  let frame = 0;
  let visible = true;
  let point = null;
  let lastScrollY = Math.max(0, window.scrollY);
  let goingUp = false;

  function render() {
    frame = 0;
    const animated = !reduceMotion.matches && !compactLayout.matches;
    const scrollY = Math.max(0, window.scrollY);
    // 累积满 1px 才判定方向，忽略触控板小数抖动；停止滚动时保留意图。
    if (Math.abs(scrollY - lastScrollY) >= 1) {
      goingUp = scrollY < lastScrollY;
      lastScrollY = scrollY;
    }
    scene.classList.toggle("is-scroll-enhanced", animated);
    scene.classList.toggle("is-scrolling-up", animated && goingUp && scrollY > 0);
    const rect = scene.getBoundingClientRect();
    const progress = animated ? Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height))) : 0;
    scene.style.setProperty("--cover-scroll-progress", `${progress}`);
    if (recent) {
      // 只在向上回封面时使用；向下进入 Recent 时整块始终清晰。
      const recentProgress = animated ? Math.min(1, Math.max(0,
        recent.getBoundingClientRect().top / Math.max(1, window.innerHeight))) : 0;
      recent.style.setProperty("--cover-recent-progress", `${recentProgress}`);
    }
    // 最多 48px 位差；位置只由滚动决定，向上滚动沿同一路径返回。
    scene.style.setProperty("--cover-camera-y", `${Math.min(48, window.innerHeight * 0.06) * progress}px`);
    const running = animated && visible && !document.hidden;
    scene.classList.toggle("is-orbit-looping", running);
    if (!running || coarsePointer.matches) point = null;
    let x = 0, y = 0;
    if (point) {
      const area = interaction.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (point.x - area.left) / Math.max(1, area.width) * 2 - 1)) * 12;
      y = Math.max(-1, Math.min(1, (point.y - area.top) / Math.max(1, area.height) * 2 - 1)) * 12;
    }
    scene.style.setProperty("--cover-pointer-x", `${x}px`);
    scene.style.setProperty("--cover-pointer-y", `${y}px`);
  }

  function schedule() {
    if (!frame) frame = window.requestAnimationFrame(render);
  }
  function resetPointer() {
    point = null;
    schedule();
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", resetPointer, { passive: true });
  window.addEventListener("pageshow", resetPointer);
  window.addEventListener("blur", resetPointer);
  document.addEventListener("visibilitychange", resetPointer);
  compactLayout.addEventListener("change", resetPointer);
  reduceMotion.addEventListener("change", resetPointer);
  coarsePointer.addEventListener("change", resetPointer);
  interaction.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    point = { x: event.clientX, y: event.clientY };
    schedule();
  }, { passive: true });
  interaction.addEventListener("pointerleave", resetPointer);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }).observe(scene);
  }
  render();
})();
