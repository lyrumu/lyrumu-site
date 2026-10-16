(function () {
  const inputs = document.querySelectorAll('input[name="works-category"]');
  if (!inputs.length) return;

  function restoreCategory() {
    const category = location.hash === "#demo" ? "demo" : "project";
    inputs.forEach(function (input) {
      input.checked = input.value === category;
    });
  }

  inputs.forEach(function (input) {
    input.addEventListener("change", function () {
      if (input.checked) history.replaceState(history.state, "", "#" + input.value);
    });
  });
  window.addEventListener("hashchange", restoreCategory);
  window.addEventListener("pageshow", restoreCategory);
  restoreCategory();
})();
