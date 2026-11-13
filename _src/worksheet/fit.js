// 하루치가 한 쪽에 들어가면 행 높이·글자 크기를 맞춰 한 쪽에 담고, 안 들어가면 다음 쪽으로 넘긴다.
(function () {
  const PT = 4 / 3, PAGE = (841.92 - 27 - 28) * PT;
  window.__fit = function () {
    const steps = [];
    for (let h = 48; h >= 34; h -= 2) steps.push([h, 16, 13.6]);
    for (const [h, e, k] of [[34, 15, 12.8], [32, 14.2, 12], [31, 13.5, 11.5]]) steps.push([h, e, k]);
    for (const s of document.querySelectorAll('.sheet')) {
      const list = s.querySelector('.list');
      const top = list.getBoundingClientRect().top - s.getBoundingClientRect().top;
      let ok = false;
      for (const [h, e, k] of steps) {
        list.style.setProperty('--h', h + 'pt'); list.style.setProperty('--en', e + 'pt'); list.style.setProperty('--ko', k + 'pt');
        if (top + list.getBoundingClientRect().height <= PAGE - 2) { ok = true; break; }
      }
      if (!ok) { list.style.setProperty('--h', '44pt'); list.style.setProperty('--en', '16pt'); list.style.setProperty('--ko', '13.6pt'); s.dataset.pages = '2'; }
    }
    return true;
  };
})();
