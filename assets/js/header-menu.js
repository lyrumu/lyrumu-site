/* details 保留原生触屏行为；桌面以 CSS 动画呈现，离开后延迟收起。 */
(function () {
  "use strict";
  const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const groups = [...document.querySelectorAll(".site-menu-group")];
  const closeMenus = new Map();

  groups.forEach(function (group) {
    const trigger = group.querySelector("summary");
    const panel = group.querySelector(".site-menu-group__panel");
    const desktop = group.classList.contains("site-menu-group--desktop");
    let leaveTimer, finishTimer, frame;
    let returningFocus = false;
    if (desktop) group.dataset.enhanced = "true";

    function cancelPending() {
      clearTimeout(leaveTimer);
      clearTimeout(finishTimer);
      cancelAnimationFrame(frame);
    }
    function open() {
      cancelPending();
      group.open = true;
      panel.inert = false;
      // 先让关闭样式被计算，再在下一帧过渡到展开样式。
      panel.getBoundingClientRect();
      frame = requestAnimationFrame(function () { group.classList.add("is-expanded"); });
    }
    function close() {
      cancelPending();
      if (!desktop || reducedMotion.matches) {
        group.classList.remove("is-expanded");
        group.open = false;
        return;
      }
      group.classList.remove("is-expanded");
      panel.inert = true;
      const duration = parseFloat(getComputedStyle(group).getPropertyValue("--menu-duration")) || 210;
      finishTimer = setTimeout(function () { group.open = false; }, duration);
    }
    closeMenus.set(group, close);

    if (desktop) {
      trigger.addEventListener("click", function (event) {
        event.preventDefault();
        if (group.classList.contains("is-expanded")) close();
        else open();
      });
      group.addEventListener("pointerenter", function (event) {
        if (hover.matches && event.pointerType === "mouse") open();
      });
      group.addEventListener("pointerleave", function () {
        if (!group.contains(document.activeElement)) leaveTimer = setTimeout(close, 150);
      });
      group.addEventListener("focusin", function () {
        if (!returningFocus) open();
      });
    }
    group.addEventListener("focusout", function (event) {
      // 触屏可能先失焦到空目标，再派发链接 click；此时不能提前隐藏子项。
      if (event.relatedTarget && !group.contains(event.relatedTarget) && !(desktop && group.matches(":hover"))) close();
    });
    group.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && group.open) {
        event.preventDefault();
        event.stopPropagation();
        close();
        returningFocus = true;
        trigger.focus();
        returningFocus = false;
      }
    });
    // 页面恢复焦点或脚本加载前已 Tab 到触发器时，也展开其子导航。
    if (desktop && group.contains(document.activeElement)) open();
  });
  document.addEventListener("click", function (event) {
    closeMenus.forEach(function (close, group) {
      if (!group.contains(event.target)) close();
    });
  });
})();
