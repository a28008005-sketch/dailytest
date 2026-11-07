/* 센텐스뱅크 · 파닉스 서바이벌 — 학습패드 보관함 (두 화면이 함께 씁니다)
 * - 화면(html·cards.js)은 인터넷에서 먼저 새로 받고, 안 되면 보관본을 씁니다. 그래야 고친 내용이 바로 반영됩니다.
 * - 카드 그림·음성·효과음은 한 번 받으면 기기에 보관해 두고 다음부터 바로 씁니다.
 */
var VERSION = 'survival-2026-11-07b';
var SHELL = ['./survival.html', './cards.js', './phonics.html', './phonics-cards.js', './phonics.webmanifest', './logo.png', './survival.webmanifest', './icons/icon-192.png',
  './sfx/card.mp3', './sfx/question.mp3', './sfx/answer.mp3', './sfx/tick.mp3', './sfx/go.mp3', './sfx/intro.mp3', './sfx/clear.mp3', './sfx/outro.mp3',
  './voice/say.mp3', './voice/welcome.mp3', './voice/ready.mp3', './voice/great.mp3'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(SHELL.map(function (u) { return c.add(u).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf('survival-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
function networkFirst(req) {
  var key = new URL(req.url); key.search = '';
  return fetch(req).then(function (res) {
    if (res && res.ok) { var cp = res.clone(); caches.open(VERSION).then(function (c) { c.put(key.href, cp); }); }
    return res;
  }).catch(function () { return caches.match(key.href); });
}
function cacheFirst(req) {
  return caches.match(req).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok && res.status === 200) { var cp = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, cp); }); }
      return res;
    });
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  var p = url.pathname;
  if (!/\/cards\//.test(p)) return;
  if (/\/(img|audio|sfx|voice|icons)\//.test(p)) { e.respondWith(cacheFirst(req)); return; }
  if (/\/(survival|phonics)\.html$|\/(phonics-)?cards\.js$/.test(p)) { e.respondWith(networkFirst(req)); return; }
});
