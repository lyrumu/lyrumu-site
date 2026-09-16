(function () {
  var button = document.querySelector('[data-article-copy]');
  var source = document.getElementById('article-markdown-source');
  if (!button || !source) return;

  var label = button.querySelector('span');
  var resetTimer;

  function fallbackCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    var copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy command failed');
  }

  function setState(state) {
    clearTimeout(resetTimer);
    button.classList.toggle('is-copied', state === 'copied');
    button.classList.toggle('is-error', state === 'error');
    label.textContent = button.getAttribute('data-' + state + '-label');
    resetTimer = setTimeout(function () {
      button.classList.remove('is-copied', 'is-error');
      label.textContent = button.getAttribute('data-copy-label');
    }, 2000);
  }

  button.addEventListener('click', async function () {
    var markdown = JSON.parse(source.textContent);
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(markdown);
    } catch (_) {
      try {
        fallbackCopy(markdown);
      } catch (_) {
        setState('error');
        return;
      }
    }
    setState('copied');
  });
})();
