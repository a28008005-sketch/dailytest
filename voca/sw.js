/* 웨일리 보카 — 오프라인 보관함
 *
 * 앱을 설치한 기기에서 인터넷이 약하거나 끊겨도 화면이 뜨도록
 * 앱 파일과 글꼴·라이브러리를 기기에 보관해 둔다.
 *
 * - 앱 본문(index.html)은 먼저 인터넷에서 새로 받아 보고, 안 되면 보관본을 쓴다.
 *   그래야 선생님이 앱을 고치면 다음에 열 때 바로 바뀐다.
 * - 글꼴·라이브러리·아이콘은 보관본을 먼저 쓴다. 바뀔 일이 거의 없기 때문이다.
 * - 학원 서버(로그인·진도 저장)는 절대 보관하지 않는다. 항상 실제 서버로 간다.
 */
var VERSION = 'whaley-2026-09-26b';
var SHELL = [
  './',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];
var LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js'
];
var STATIC_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (event) {
  event.waitUntil(caches.open(VERSION).then(function (cache) {
    // 하나가 실패해도 나머지는 보관되도록 따로따로 담는다.
    return Promise.all(SHELL.concat(LIBS).map(function (url) {
      return cache.add(url).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// 앱 본문은 './' 와 './index.html' 이 같은 파일이라 한 칸에 보관한다.
function pageKey(url) {
  return /\/(index\.html)?$/.test(url.pathname) ? new URL('./', self.registration.scope).href : url.origin + url.pathname;
}

function fromNetworkFirst(request) {
  var key = pageKey(new URL(request.url));
  return fetch(request).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(VERSION).then(function (c) { c.put(key, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(key).then(function (hit) {
      return hit || new Response('<h2 style="font-family:sans-serif;text-align:center;margin-top:40vh">인터넷에 연결한 뒤 다시 열어 주세요</h2>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    });
  });
}

function fromCacheFirst(request) {
  return caches.match(request).then(function (hit) {
    if (hit) return hit;
    return fetch(request).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(request, copy); });
      }
      return res;
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
    if (request.mode === 'navigate' || /\.html$|\/$/.test(url.pathname)) {
      event.respondWith(fromNetworkFirst(request));
      return;
    }
    event.respondWith(fromCacheFirst(request));
    return;
  }
  if (STATIC_HOSTS.indexOf(url.hostname) >= 0) {
    event.respondWith(fromCacheFirst(request));
  }
  // 그 밖(학원 서버 등)은 손대지 않고 그대로 보낸다.
});
