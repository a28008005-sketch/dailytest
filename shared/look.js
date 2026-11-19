/* 웨일리 꾸민 모습을 게임 캔버스에 한 덩어리로 그린다.
   보카 옷장(voca)의 SVG와 같은 자리 계산(뷰박스 0,-28,210,218 / 고래 x36 y34 139×126)을 그대로 쓰므로
   머리띠·모자가 고래 머리에 딱 붙은 채 함께 움직인다. 아이템 자료는 shared/wear-data.js (자동 생성). */
window.WLOOK = (function () {
  'use strict';
  var me = document.currentScript && document.currentScript.src;
  var ROOT = me ? me.replace(/shared\/look\.js.*$/, '') : '../';
  var BY = {}; (window.WEAR_DATA || []).forEach(function (w) { BY[w.id] = w; });
  var IMGS = {};
  var API = 'https://hello-world.a28008005.workers.dev';
  function img(name) {
    if (!IMGS[name]) { var i = new Image(); i.src = ROOT + 'voca/wear/' + name + '.webp'; IMGS[name] = i; }
    return IMGS[name];
  }
  var ok = function (i) { return i && i.complete && i.naturalWidth > 0; };
  var FIN = typeof Path2D !== 'undefined' ? new Path2D('M150 70 C162 66 178 70 180 84 C182 98 172 110 160 116 L150 116 Z') : null;

  function rd(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function profile() { return rd('swv.profile'); }
  function code() { try { return localStorage.getItem('swv.code') || ''; } catch (e) { return ''; } }
  function myWear() { var p = profile(); var pr = p && p.studentId ? rd('swv.progress.' + p.studentId) : null; return (pr && pr.wear) || {}; }

  /* 뷰박스 좌표로 한 장 그리기 */
  function paint(c, wear) {
    var skin = BY[wear.skin] ? BY[wear.skin].img : 'whaley';
    var whale = img(skin), pending = 0;
    function part(id, slot) {
      var w = BY[id]; if (!w || w.slot !== slot) return;
      var im = img(w.img); if (!ok(im)) { pending++; return; }
      if (slot === 'hand') {
        var hh = w.ih || 84, ww = hh / w.ar;
        c.save(); c.translate(168, 104); c.rotate(12 * Math.PI / 180); c.translate(-168, -104);
        c.drawImage(im, 168 - ww / 2, 112 - hh, ww, hh); c.restore(); return;
      }
      var iw = w.iw || 90, ih = iw * w.ar, cx = w.cx || 105;
      var y = slot === 'head' ? (w.by || 56) - ih : (w.cy || 70) - ih / 2;
      if (w.rot) { c.save(); c.translate(cx, y + ih / 2); c.rotate(w.rot * Math.PI / 180); c.translate(-cx, -(y + ih / 2)); c.drawImage(im, cx - iw / 2, y, iw, ih); c.restore(); }
      else c.drawImage(im, cx - iw / 2, y, iw, ih);
    }
    part(wear.fx, 'fx'); part(wear.back, 'back');
    if (ok(whale)) { c.imageSmoothingEnabled = wear.skin !== 'skin_pixel'; c.drawImage(whale, 36, 34, 139, 126); c.imageSmoothingEnabled = true; } else pending++;
    part(wear.face, 'face'); part(wear.head, 'head'); part(wear.hand, 'hand');
    if (BY[wear.hand] && ok(whale) && FIN) { c.save(); c.clip(FIN); c.drawImage(whale, 36, 34, 139, 126); c.restore(); }
    return pending;
  }

  /* 꾸민 웨일리 그림(캔버스). 그림이 다 들어오면 저절로 다시 그린다.
     발밑 = 캔버스 높이의 FOOT 비율, 몸 가운데 x = 0.5 */
  var CACHE = {};
  function sprite(wear, px) {
    wear = wear || {}; px = Math.round(px || 160);
    var key = JSON.stringify(wear) + '@' + px;
    if (CACHE[key]) return CACHE[key];
    var cv = document.createElement('canvas'), s = px / 218 * 1.0;
    cv.width = Math.round(210 * s); cv.height = px;
    var draw = function () {
      var c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height);
      c.save(); c.scale(s, s); c.translate(0, 28); var left = paint(c, wear); c.restore();
      if (left && (draw.n = (draw.n || 0) + 1) < 40) setTimeout(draw, 150);
    };
    draw();
    CACHE[key] = cv; return cv;
  }

  async function post(path, body) {
    try { var r = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return await r.json(); } catch (e) { return null; }
  }
  return {
    sprite: sprite, myWear: myWear, profile: profile, code: code, post: post, ROOT: ROOT,
    FOOT: (160 + 28) / 218,               // 발밑 높이 비율
    HEAD: (34 + 28) / 218,
  };
})();
