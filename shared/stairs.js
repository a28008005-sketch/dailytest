/* 웨일리 무한계단 — 파닉스 바다 계단과 520·860 무한계단이 함께 쓰는 계단 화면.
   형식은 레벨과 상관없이 같고, 파닉스는 slow:true 로 조금 느리게 움직인다.
   꾸미기: 배경 바꾸기 · 발자국 · 펫 · 계단 스킨 (선택은 이 기기에 저장)
   친구와 같이: 친구가 가장 높이 오른 기록(층마다 오른 시각)을 따라 친구 웨일리가 같은 계단을 함께 오른다.
   쓰는 법: const e = WSTAIRS.create({ slow, level }); 매 프레임 e.update(dt); e.draw(ctx, W, H);
           맞히면 e.step(), 틀리면 e.oops(), 끝나서 떨어질 땐 e.fall(). 버튼 줄은 WSTAIRS.toolbar(el, e). */
window.WSTAIRS = (function () {
  'use strict';
  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? me.replace(/shared\/stairs\.js.*$/, '') : '../';
  var BGS = [
    { k: 'sky', name: '하늘', src: 'arcade/img/bgSky.jpg', tint: ['#7cc8ff', '#dff3ff'] },
    { k: 'candy', name: '사탕 나라', src: 'shared/img/bg_candy.jpg', tint: ['#ffc6e6', '#fff0fa'] },
    { k: 'sea', name: '바닷속', src: 'arcade/img/bgSea.jpg', tint: ['#2a9ad8', '#a9e6ff'] },
    { k: 'aurora', name: '오로라 설산', src: 'shared/img/bg_aurora.jpg', tint: ['#1c2a6b', '#7fd6ff'] },
    { k: 'lava', name: '용암 화산', src: 'arcade/img/bgLava.jpg', tint: ['#5a1a10', '#ff9a5a'] },
    { k: 'space', name: '우주', src: 'shared/img/bg_space.jpg', tint: ['#0a0830', '#3a2a7a'] },
  ];
  var SKINS = [
    { k: 'rainbow', name: '무지개' }, { k: 'wood', name: '나무' }, { k: 'ice', name: '얼음' }, { k: 'cloud', name: '구름' },
    { k: 'gold', name: '황금' }, { k: 'candy', name: '사탕' }, { k: 'stone', name: '돌' }, { k: 'neon', name: '네온' },
  ];
  var TRAILS = [{ k: 'foot', name: '발자국' }, { k: 'rainbow', name: '무지개' }, { k: 'heart', name: '하트' }, { k: 'star', name: '별' }, { k: 'off', name: '끄기' }];
  var PETS = [{ k: '', name: '없음' }, { k: 'octo', name: '무니' }, { k: 'turtle', name: '토토' }, { k: 'clown', name: '코랄' }, { k: 'seal', name: '포포' }, { k: 'crab', name: '크랩이' }];
  var IM = {};
  function img(src) { if (!IM[src]) { var i = new Image(); i.src = ROOT + src; IM[src] = i; } return IM[src]; }
  var ok = function (i) { return i && i.complete && i.naturalWidth > 0; };
  var prefs = (function () { try { return Object.assign({ bg: 'sky', skin: 'rainbow', trail: 'foot', pet: '' }, JSON.parse(localStorage.getItem('wstairs:prefs')) || {}); } catch (e) { return { bg: 'sky', skin: 'rainbow', trail: 'foot', pet: '' }; } })();
  function savePrefs() { try { localStorage.setItem('wstairs:prefs', JSON.stringify(prefs)); } catch (e) {} }
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function heart(c, x, y, s) { c.beginPath(); c.moveTo(x, y + s * .35); c.bezierCurveTo(x - s, y - s * .35, x - s * .45, y - s, x, y - s * .45); c.bezierCurveTo(x + s * .45, y - s, x + s, y - s * .35, x, y + s * .35); c.fill(); }
  function star(c, x, y, R) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? R * .45 : R; c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); } c.closePath(); c.fill(); }
  // 미리 불러 두기
  BGS.forEach(function (b) { if (b.k === prefs.bg) img(b.src); });

  function create(opts) {
    opts = opts || {};
    var e = {
      slow: !!opts.slow, level: opts.level || '', stairs: [{ x: 0, y: 0 }], i: 0, from: { x: 0, y: 0 }, hop: 1, t: 0,
      camY: 0, camX: 0, mood: 'idle', moodT: 0, shake: 0, falling: false, fallY: 0, fallV: 0, parts: [],
      pet: { i: 0, hop: 1, from: { x: 0, y: 0 }, delay: 0 }, friend: null, startAt: 0, tl: [], look: null, wear: null,
    };
    function add() {
      var l = e.stairs[e.stairs.length - 1], n = e.stairs.length;
      var turn = n < 3 ? 1 : (Math.random() < .5 ? -1 : 1), nx = l.x + turn;
      if (Math.abs(nx) > 3) nx = l.x - turn;
      e.stairs.push({ x: nx, y: l.y - 1 });
    }
    function ensure(k) { while (e.stairs.length < k) add(); }
    ensure(48);
    e.setLook = function (wear) { e.wear = wear || {}; e.look = window.WLOOK ? WLOOK.sprite(e.wear, 220) : null; };
    e.setLook(opts.wear || (window.WLOOK ? WLOOK.myWear() : {}));
    e.burst = function (x, y, n, cols) { for (var k = 0; k < n; k++) { var a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 180; e.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: .7 + Math.random() * .4, c: cols[k % cols.length], r: 2 + Math.random() * 3 }); } };
    e.step = function () {
      if (!e.startAt) e.startAt = performance.now();
      var prev = e.stairs[e.i];
      if (prefs.trail !== 'off') prev.mark = { k: prefs.trail, t: e.t, side: e.stairs[e.i + 1].x > prev.x ? 1 : -1 };
      e.from = { x: prev.x, y: prev.y }; e.i++; e.hop = 0; e.mood = 'happy'; e.moodT = .6;
      e.tl.push(Math.round(performance.now() - e.startAt));
      ensure(e.i + 48);
      e.pet.delay = .12;
      if (e.i % 10 === 0) e.cheer = { t: 1.6, n: e.i };   // 10층마다 축하
      return e.i;
    };
    e.oops = function () { e.shake = .35; e.mood = 'sad'; e.moodT = .9; };
    e.fall = function () { e.falling = true; e.fallV = -260; e.mood = 'sad'; e.moodT = 9; };
    e.floor = function () { return e.i; };
    e.setFriend = function (f) {
      if (!f) { e.friend = null; return; }
      e.friend = { name: f.name, tl: f.tl || [], floors: f.floors || (f.tl || []).length, look: window.WLOOK ? WLOOK.sprite(f.wear || {}, 220) : null, i: 0, hop: 1, from: { x: 0, y: 0 }, t0: performance.now() };
    };
    e.update = function (dt) {
      e.t += dt;
      var hs = e.slow ? 3.4 : 6.5;
      e.hop = Math.min(1, e.hop + dt * hs);
      e.moodT -= dt; if (e.moodT <= 0) e.mood = 'idle';
      e.shake = Math.max(0, e.shake - dt);
      if (e.falling) { e.fallV += 900 * dt; e.fallY += e.fallV * dt; }
      var cur = e.stairs[e.i];
      e.camY = lerp(e.camY, cur.y, Math.min(1, dt * (e.slow ? 3.5 : 6)));
      e.camX = lerp(e.camX, cur.x, Math.min(1, dt * 3));
      // 펫: 한 박자 늦게 한 칸 아래를 따라온다
      var p = e.pet; p.delay -= dt;
      var want = Math.max(0, e.i - 1);
      if (p.i !== want && p.delay <= 0) { p.from = { x: e.stairs[p.i].x, y: e.stairs[p.i].y }; p.i = want; p.hop = 0; }
      p.hop = Math.min(1, p.hop + dt * hs * .9);
      // 친구: 기록한 시각마다 한 칸씩
      var f = e.friend;
      if (f) {
        var el = performance.now() - f.t0, n = 0; while (n < f.tl.length && f.tl[n] <= el) n++;
        if (n !== f.i) { ensure(n + 48); f.from = { x: e.stairs[f.i].x, y: e.stairs[f.i].y }; f.i = n; f.hop = 0; }
        f.hop = Math.min(1, f.hop + dt * 6);
      }
      e.parts = e.parts.filter(function (q) { q.vy += 520 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; return q.life > 0; });
    };

    function drawBg(c, W, H) {
      var b = BGS.find(function (x) { return x.k === prefs.bg; }) || BGS[0], im = img(b.src);
      var gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, b.tint[0]); gr.addColorStop(1, b.tint[1]); c.fillStyle = gr; c.fillRect(0, 0, W, H);
      if (ok(im)) {
        var sc = Math.max(W / im.naturalWidth, H / im.naturalHeight) * 1.12, iw = im.naturalWidth * sc, ih = im.naturalHeight * sc;
        var py = clamp(-e.camY * 2.2, 0, (ih - H)) - (ih - H) / 2;     // 높이 오를수록 배경이 아래로 천천히
        c.drawImage(im, (W - iw) / 2 - e.camX * 4, (H - ih) / 2 + py, iw, ih);
      }
      // 높이 오를수록 하늘이 조금씩 깊어진다
      var h = clamp(e.i / 120, 0, 1); if (h > 0) { c.fillStyle = 'rgba(20,10,60,' + h * .35 + ')'; c.fillRect(0, 0, W, H); }
    }
    function stairFace(c, k, x, y, w, h, idx) {
      var top = h * .42;
      c.fillStyle = 'rgba(0,0,0,.16)'; rr(c, x - w / 2, y + 5, w, h, 9); c.fill();
      var s = prefs.skin, g;
      if (s === 'rainbow') { var hue = (idx * 23) % 360; c.fillStyle = 'hsl(' + hue + ' 80% 60%)'; rr(c, x - w / 2, y, w, h, 9); c.fill(); c.fillStyle = 'hsl(' + hue + ' 90% 78%)'; rr(c, x - w / 2, y, w, top, 7); c.fill(); }
      else if (s === 'wood') { c.fillStyle = '#9a6233'; rr(c, x - w / 2, y, w, h, 7); c.fill(); c.fillStyle = '#c98a4c'; rr(c, x - w / 2, y, w, top, 6); c.fill(); c.strokeStyle = 'rgba(80,40,10,.45)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - w * .3, y + top + 3); c.lineTo(x - w * .3, y + h - 3); c.moveTo(x + w * .15, y + top + 3); c.lineTo(x + w * .15, y + h - 3); c.stroke(); }
      else if (s === 'ice') { g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#e8fbff'); g.addColorStop(1, '#7fd3f5'); c.fillStyle = g; rr(c, x - w / 2, y, w, h, 8); c.fill(); c.fillStyle = 'rgba(255,255,255,.85)'; rr(c, x - w * .38, y + 3, w * .3, 3, 2); c.fill(); }
      else if (s === 'cloud') { c.fillStyle = '#fff'; c.beginPath(); for (var j = 0; j < 4; j++) c.arc(x - w * .36 + j * w * .24, y + h * .45, h * .55, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(180,210,255,.5)'; c.fillRect(x - w * .45, y + h * .7, w * .9, h * .3); }
      else if (s === 'gold') { g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fff3b0'); g.addColorStop(.45, '#f3c24a'); g.addColorStop(1, '#a8711f'); c.fillStyle = g; rr(c, x - w / 2, y, w, h, 8); c.fill(); c.fillStyle = 'rgba(255,255,255,.8)'; star(c, x + w * .32, y + h * .35, 3.5); }
      else if (s === 'candy') { c.save(); rr(c, x - w / 2, y, w, h, h / 2); c.clip(); c.fillStyle = '#fff'; c.fillRect(x - w / 2, y, w, h); c.fillStyle = '#ff5f8f'; for (var q = -2; q < 8; q++) { c.beginPath(); c.moveTo(x - w / 2 + q * 12, y + h); c.lineTo(x - w / 2 + q * 12 + 6, y + h); c.lineTo(x - w / 2 + q * 12 + 6 + h, y); c.lineTo(x - w / 2 + q * 12 + h, y); c.fill(); } c.restore(); }
      else if (s === 'stone') { c.fillStyle = '#7d8590'; rr(c, x - w / 2, y, w, h, 5); c.fill(); c.fillStyle = '#a5adb8'; rr(c, x - w / 2, y, w, top, 4); c.fill(); c.fillStyle = 'rgba(40,46,56,.35)'; c.fillRect(x - w * .1, y + top, 2, h - top); }
      else if (s === 'neon') { var nh = (e.t * 60 + idx * 30) % 360; c.fillStyle = '#120c2a'; rr(c, x - w / 2, y, w, h, 8); c.fill(); c.shadowColor = 'hsl(' + nh + ' 100% 60%)'; c.shadowBlur = 12; c.strokeStyle = 'hsl(' + nh + ' 100% 65%)'; c.lineWidth = 2.5; rr(c, x - w / 2 + 1, y + 1, w - 2, h - 2, 8); c.stroke(); c.shadowBlur = 0; }
    }
    function drawMark(c, m, x, y, U) {
      var a = clamp(1 - (e.t - m.t) / 60, .35, 1); c.save(); c.globalAlpha = a;
      if (m.k === 'foot') { c.fillStyle = 'rgba(40,60,90,.55)'; [-1, 1].forEach(function (s) { c.beginPath(); c.ellipse(x + s * U * .12, y - 2, U * .07, U * .045, s * .3, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x + s * U * .12 + m.side * U * .05, y - 2 - U * .06, U * .025, 0, Math.PI * 2); c.fill(); }); }
      else if (m.k === 'rainbow') { var gr = c.createLinearGradient(x - U * .5, 0, x + U * .5, 0); ['#ff5f6d', '#ffc371', '#fff36b', '#6bff95', '#6bc6ff', '#b56bff'].forEach(function (col, i) { gr.addColorStop(i / 5, col); }); c.fillStyle = gr; rr(c, x - U * .48, y - 5, U * .96, 6, 3); c.fill(); }
      else if (m.k === 'heart') { c.fillStyle = '#ff5f8f'; heart(c, x, y - 8, U * .13); }
      else if (m.k === 'star') { c.fillStyle = '#ffd34d'; star(c, x, y - 8, U * .12); }
      c.restore();
    }
    function drawChar(c, sprite, x, y, h, flip, squash, alpha) {
      if (!sprite) return;
      var w = h * sprite.width / sprite.height;
      c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.translate(x, y);
      c.scale((1 + squash * .12) * (flip ? -1 : 1), 1 - squash * .12);
      c.drawImage(sprite, -w / 2, -h * (window.WLOOK ? WLOOK.FOOT : .86), w, h); c.restore();
    }
    e.draw = function (c, W, H) {
      drawBg(c, W, H);
      var U = clamp(Math.min(W / 6.4, H / 7.4), 40, 92), SW = U, SH = U * .74, sw = U * 1.05, sh = U * .36;
      var sx = e.shake > 0 ? Math.sin(e.t * 80) * 6 * e.shake : 0;
      c.save();
      c.translate(W / 2 - e.camX * SW * .55 + sx, H * .66 - e.camY * SH);
      var P = function (s) { return { x: s.x * SW, y: s.y * SH }; };
      var from = Math.max(0, e.i - 12), to = Math.min(e.stairs.length, e.i + 40);
      for (var k = from; k < to; k++) {
        var s = e.stairs[k], p = P(s);
        stairFace(c, prefs.skin, p.x, p.y, sw, sh, k);
        if (s.mark) drawMark(c, s.mark, p.x, p.y, U);
        if (k > 0 && k % 10 === 0) {            // 10층마다 깃발
          var big = k % 50 === 0; c.fillStyle = big ? '#ffd34d' : '#fff'; c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3;
          c.font = '900 ' + Math.round(U * (big ? .3 : .22)) + 'px Pretendard, sans-serif'; c.textAlign = 'center';
          c.strokeText(k + '층', p.x, p.y + sh * .78); c.fillText(k + '층', p.x, p.y + sh * .78);
          c.fillStyle = big ? '#ffb020' : '#ff5f6d'; c.fillRect(p.x + sw * .38, p.y - U * .7, 2.5, U * .7);
          c.beginPath(); c.moveTo(p.x + sw * .38 + 2.5, p.y - U * .7); c.lineTo(p.x + sw * .38 + U * .3, p.y - U * .6); c.lineTo(p.x + sw * .38 + 2.5, p.y - U * .5); c.fill();
        }
      }
      var H0 = U * 1.45;
      // 친구 (반투명, 같은 계단을 함께 오른다)
      var f = e.friend;
      if (f) {
        var fc = P(e.stairs[f.i]), ff = P(f.from), fe = ease(f.hop), fx = lerp(ff.x, fc.x, fe) + U * .28, fy = lerp(ff.y, fc.y, fe) - Math.sin(fe * Math.PI) * U * .45;
        drawChar(c, f.look, fx, fy, H0 * .92, (e.stairs[f.i + 1] || fc).x < e.stairs[f.i].x, f.hop < 1 ? .3 : Math.sin(e.t * 5 + 1) * .06, .62);
        c.font = '800 ' + Math.round(U * .2) + 'px Pretendard, sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)';
        var label = '👫 ' + f.name + ' ' + f.i + '층'; c.strokeText(label, fx, fy - H0 * .95); c.fillStyle = '#fff'; c.fillText(label, fx, fy - H0 * .95);
      }
      var fScreen = f ? H * .66 - e.camY * SH + (lerp(P(f.from).y, P(e.stairs[f.i]).y, ease(f.hop))) : 0;
      // 펫
      if (prefs.pet) {
        var pp = e.pet, pc = P(e.stairs[pp.i]), pf = P(pp.from), pe = ease(pp.hop);
        var px = lerp(pf.x, pc.x, pe) - U * .34, py = lerp(pf.y, pc.y, pe) - Math.sin(pe * Math.PI) * U * .35 - 2;
        var pim = img('arcade/img/' + prefs.pet + (e.mood === 'happy' ? '_happy' : '') + '.webp'); if (!ok(pim)) pim = img('arcade/img/' + prefs.pet + '.webp');
        if (ok(pim)) { var ph = U * .62, pw = ph * pim.naturalWidth / pim.naturalHeight; c.drawImage(pim, px - pw / 2, py - ph, pw, ph); }
      }
      // 웨일리
      var cur = P(e.stairs[e.i]), fr = P(e.from), he = ease(e.hop);
      var hx = lerp(fr.x, cur.x, he), hy = lerp(fr.y, cur.y, he) - Math.sin(he * Math.PI) * U * .5 + e.fallY;
      c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(cur.x, cur.y + 1, U * .38, U * .08, 0, 0, Math.PI * 2); c.fill();
      var nxt = e.stairs[e.i + 1] || e.stairs[e.i];
      c.save(); if (e.falling) { c.translate(hx, hy - H0 / 2); c.rotate(e.t * 6); c.translate(-hx, -(hy - H0 / 2)); }
      drawChar(c, e.look, hx, hy, H0, nxt.x < e.stairs[e.i].x, e.hop < 1 ? (e.hop < .5 ? -.4 : .3) : Math.sin(e.t * 5) * .07, 1);
      c.restore();
      if (e.mood === 'sad' && !e.falling) { c.font = Math.round(U * .3) + 'px sans-serif'; c.textAlign = 'center'; c.fillText('💦', hx + U * .35, hy - H0 * .85); }
      if (e.hop < .2 && prefs.trail !== 'off') e.burst(hx, hy, 3, prefs.trail === 'heart' ? ['#ff5f8f', '#ffc2d6'] : prefs.trail === 'star' ? ['#ffd34d', '#fff3b0'] : prefs.trail === 'rainbow' ? ['#ff5f6d', '#ffc371', '#6bff95', '#6bc6ff'] : ['#ffffff', '#bfe6ff']);
      e.parts.forEach(function (q) { c.globalAlpha = clamp(q.life * 1.6, 0, 1); c.fillStyle = q.c; c.beginPath(); c.arc(q.x, q.y, q.r, 0, Math.PI * 2); c.fill(); }); c.globalAlpha = 1;
      c.restore();
      if (e.cheer && e.cheer.t > 0) {
        e.cheer.t -= 1 / 60; var ca = Math.min(1, e.cheer.t * 1.5), cs = 1 + (1.6 - e.cheer.t) * .15;
        c.save(); c.globalAlpha = ca; c.translate(W / 2, H * .34); c.scale(cs, cs); c.textAlign = 'center';
        c.font = '900 ' + Math.round(Math.min(W, H) * .1) + 'px Pretendard, sans-serif'; c.lineWidth = 6; c.strokeStyle = 'rgba(80,30,0,.6)';
        var ct = '🎉 ' + e.cheer.n + '층 돌파!'; c.strokeText(ct, 0, 0); c.fillStyle = '#ffd34d'; c.fillText(ct, 0, 0); c.restore();
        if (Math.random() < .5) e.parts.push({ x: hx + (Math.random() - .5) * W * .6, y: hy - H * .4, vx: (Math.random() - .5) * 80, vy: 40, life: 1.2, c: ['#ff5f6d', '#ffd34d', '#6bc6ff', '#6bff95'][Math.floor(Math.random() * 4)], r: 3 });
      }
      // 친구가 화면 밖에 있으면 위·아래 끝에 몇 층인지 알려 준다
      if (f && (fScreen > H - 10 || fScreen < 70)) {
        var up = fScreen < 70, txt = (up ? '👆 ' : '👇 ') + f.name + ' ' + f.i + '층', by = up ? 78 : H - 26;
        c.font = '800 13px Pretendard, sans-serif'; var tw = c.measureText(txt).width + 22;
        c.fillStyle = 'rgba(10,40,80,.72)'; rr(c, W / 2 - tw / 2, by - 15, tw, 26, 13); c.fill();
        c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(txt, W / 2, by + 3);
      }
    };
    return e;
  }

  /* ───── 버튼 줄: 배경 · 발자국 · 펫 · 계단 · 친구와 같이 ───── */
  var CSS = '.wst-bar{position:absolute;right:8px;top:54px;display:flex;flex-direction:column;gap:6px;z-index:6}' +
    '.wst-bar button{width:46px;height:46px;border-radius:14px;border:2px solid rgba(255,255,255,.85);background:rgba(10,40,80,.55);color:#fff;font-size:20px;line-height:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 3px 8px rgba(0,0,0,.25);backdrop-filter:blur(4px);font-family:inherit}' +
    '.wst-bar button small{font-size:9px;font-weight:800;letter-spacing:-.03em}' +
    '.wst-bar button.on{background:linear-gradient(180deg,#ffb84d,#ff7a2f)}' +
    '.wst-pop{position:absolute;inset:0;z-index:30;background:rgba(5,20,40,.45);display:flex;align-items:flex-end;justify-content:center}' +
    '.wst-sheet{width:100%;max-width:560px;max-height:72%;overflow:auto;background:#fff;border-radius:22px 22px 0 0;padding:16px 14px calc(16px + env(safe-area-inset-bottom));color:#16324f;font-family:inherit}' +
    '.wst-sheet h3{margin:0 0 10px;font-size:18px;display:flex;justify-content:space-between;align-items:center}' +
    '.wst-sheet h3 button{border:0;background:#eef4fb;border-radius:10px;padding:6px 12px;font:inherit;font-size:14px;font-weight:800;color:#16324f}' +
    '.wst-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:8px}' +
    '.wst-opt{border:2px solid #dbe6f2;background:#f6f9fd;border-radius:14px;padding:6px 4px 8px;display:flex;flex-direction:column;align-items:center;gap:4px;font:inherit;font-size:13px;font-weight:800;color:#16324f}' +
    '.wst-opt.on{border-color:#ff8a2f;background:#fff4e8}' +
    '.wst-opt canvas,.wst-opt img{width:76px;height:60px;object-fit:contain;border-radius:10px}' +
    '.wst-opt small{font-size:11px;color:#5d7591;font-weight:700}' +
    '.wst-note{font-size:13px;color:#5d7591;margin:4px 0 10px;line-height:1.5}';
  function injectCss() { if (document.getElementById('wst-css')) return; var st = document.createElement('style'); st.id = 'wst-css'; st.textContent = CSS; document.head.appendChild(st); }

  function sheet(host, title, inner, onPick) {
    var pop = document.createElement('div'); pop.className = 'wst-pop';
    pop.innerHTML = '<div class="wst-sheet"><h3><span>' + title + '</span><button type="button">닫기</button></h3>' + inner + '</div>';
    host.appendChild(pop);
    var close = function () { pop.remove(); };
    pop.addEventListener('pointerdown', function (ev) { if (ev.target === pop) close(); });
    pop.querySelector('h3 button').onclick = close;
    pop.querySelectorAll('[data-v]').forEach(function (b) { b.onclick = function () { onPick(b.dataset.v); close(); }; });
    return pop;
  }
  function preview(kind, k) {
    var cv = document.createElement('canvas'); cv.width = 152; cv.height = 120; var c = cv.getContext('2d');
    var keep = prefs[kind]; prefs[kind] = k;
    var fake = create({}); fake.t = 1; for (var i = 0; i < 3; i++) { fake.step(); fake.hop = 1; }
    if (kind === 'trail') { fake.stairs.slice(0, 3).forEach(function (s) { if (k !== 'off') s.mark = { k: k, t: 1, side: 1 }; }); }
    fake.camY = fake.stairs[fake.i].y; fake.camX = fake.stairs[fake.i].x; fake.setLook(window.WLOOK ? WLOOK.myWear() : {});
    if (kind !== 'bg') { c.fillStyle = '#cfe8ff'; }
    fake.draw(c, 152, 120);
    prefs[kind] = keep;
    return cv;
  }
  function toolbar(host, e, opt) {
    injectCss(); opt = opt || {};
    var bar = document.createElement('div'); bar.className = 'wst-bar';
    bar.innerHTML = '<button data-b="bg">🖼<small>배경</small></button><button data-b="trail">👣<small>발자국</small></button><button data-b="pet">🐾<small>펫</small></button><button data-b="skin">🪜<small>계단</small></button>' +
      (opt.friend === false ? '' : '<button data-b="friend">👫<small>친구랑</small></button>');
    host.appendChild(bar);
    var pick = function (kind, list, title) {
      var html = '<div class="wst-grid">' + list.map(function (o) { return '<button type="button" class="wst-opt' + (prefs[kind] === o.k ? ' on' : '') + '" data-v="' + o.k + '"><span data-cv="' + o.k + '"></span>' + o.name + '</button>'; }).join('') + '</div>';
      var pop = sheet(host, title, html, function (v) { prefs[kind] = v; savePrefs(); if (kind === 'bg') BGS.forEach(function (b) { if (b.k === v) img(b.src); }); if (opt.onChange) opt.onChange(kind, v); refresh(); });
      list.forEach(function (o) {
        var slot = pop.querySelector('[data-cv="' + o.k + '"]');
        if (kind === 'pet') { var im = document.createElement('img'); im.src = o.k ? ROOT + 'arcade/img/' + o.k + '.webp' : ''; if (!o.k) { slot.textContent = '🚫'; slot.style.fontSize = '34px'; } else slot.appendChild(im); return; }
        if (kind === 'bg') { var b = BGS.find(function (x) { return x.k === o.k; }); var im2 = document.createElement('img'); im2.src = ROOT + b.src; im2.style.objectFit = 'cover'; slot.appendChild(im2); return; }
        slot.appendChild(preview(kind, o.k));
      });
    };
    async function friends() {
      var pop = sheet(host, '👫 친구와 같이 오르기', '<div class="wst-note">친구가 가장 높이 올랐던 기록을 따라 친구 웨일리가 옆에서 함께 올라가요. 친구보다 높이 올라가 볼까요?</div><div id="wst-fl" class="wst-grid"><div class="wst-note">친구 기록 불러오는 중…</div></div>', function () {});
      var code = window.WLOOK ? WLOOK.code() : '';
      var d = window.WLOOK ? await WLOOK.post('/api/stairs/list', { code: code, level: e.level }) : null;
      var box = pop.querySelector('#wst-fl'); if (!box) return;
      var list = (d && d.success ? d.friends : []).filter(function (x) { return x.tl && x.tl.length; });
      var ai = [{ id: 'ai1', name: '꼬마 문어 무니', floors: 25, ai: 3200 }, { id: 'ai2', name: '날쌘 물개 포포', floors: 45, ai: 2300 }, { id: 'ai3', name: '계단왕 크랩이', floors: 80, ai: 1700 }];
      ai.forEach(function (a) { a.tl = []; var t = 1500; for (var i = 0; i < a.floors; i++) { t += a.ai * (.7 + Math.random() * .6) * (e.slow ? 1.6 : 1); a.tl.push(Math.round(t)); } a.wear = { skin: ['', 'skin_pink', 'skin_gold'][ai.indexOf(a)] }; });
      var all = list.concat(ai);
      box.innerHTML = (e.friend ? '<button type="button" class="wst-opt" data-f="-1"><span style="font-size:34px">🚫</span>혼자 오르기</button>' : '') +
        all.map(function (x, i) { return '<button type="button" class="wst-opt" data-f="' + i + '"><span data-lk="' + i + '"></span>' + x.name + '<small>' + (x.ai ? 'AI 친구 · ' : '') + '최고 ' + x.floors + '층</small></button>'; }).join('') +
        (list.length ? '' : '<div class="wst-note" style="grid-column:1/-1">' + (d && d.success ? '아직 이 레벨에 친구 기록이 없어요. 내가 먼저 기록을 남겨 볼까요?' : '친구 기록을 불러오지 못했어요.') + ' AI 친구와 먼저 올라 봐요!</div>');
      all.forEach(function (x, i) { var s = box.querySelector('[data-lk="' + i + '"]'); if (s && window.WLOOK) { var sp = WLOOK.sprite(x.wear || {}, 120); s.appendChild(sp); sp.style.width = '64px'; sp.style.height = '64px'; } });
      box.querySelectorAll('[data-f]').forEach(function (b) { b.onclick = function () { var i = +b.dataset.f; e.setFriend(i < 0 ? null : all[i]); pop.remove(); refresh(); if (opt.onChange) opt.onChange('friend', i < 0 ? null : all[i]); }; });
    }
    var refresh = function () {
      bar.querySelector('[data-b="trail"]').classList.toggle('on', prefs.trail !== 'off');
      bar.querySelector('[data-b="pet"]').classList.toggle('on', !!prefs.pet);
      var fb = bar.querySelector('[data-b="friend"]'); if (fb) fb.classList.toggle('on', !!e.friend);
    };
    bar.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
      b.onclick = function (ev) {
        ev.stopPropagation(); if (opt.onOpen) opt.onOpen();
        var k = b.dataset.b;
        if (k === 'bg') pick('bg', BGS, '🖼 배경 바꾸기');
        if (k === 'trail') pick('trail', TRAILS, '👣 지나간 자리 남기기');
        if (k === 'pet') pick('pet', PETS, '🐾 같이 다닐 펫');
        if (k === 'skin') pick('skin', SKINS, '🪜 계단 스킨');
        if (k === 'friend') friends();
      };
    });
    refresh();
    return bar;
  }
  function saveRun(e) {
    if (!window.WLOOK || !e.tl.length) return;
    var code = WLOOK.code(); if (!code) return;
    WLOOK.post('/api/stairs/save', { code: code, level: e.level, floors: e.i, tl: e.tl, wear: e.wear || {} });
  }
  return { create: create, toolbar: toolbar, saveRun: saveRun, prefs: prefs, BGS: BGS };
})();
