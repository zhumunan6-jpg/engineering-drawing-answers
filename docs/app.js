'use strict';

// Page loading and zoom follow the companion physics reader, simplified to pages.
const $ = id => document.getElementById(id);
const reader = $('reader'), stack = $('paper-stack');
const sizes = window.DRAWING_PAGES.sizes, total = sizes.length;
const MEDIA = 'engineering-answers-pages-v1';
const LAST = 'engineering-answers:last', SAVED = 'engineering-answers:bookmarks';
const bookmarks = new Set(JSON.parse(localStorage.getItem(SAVED) || '[]'));
const papers = [], offsets = [];
let currentPage = 1, zoom = 1, lastVisible = 1;
let warmTimer, saveTimer, noticeTimer, scrollTick = false;
let view = {page: 1, y: 0, x: 0, zoom: 1};
let savedOnly = false, downloading = false, stopDownload = false;

const imagePath = (folder, n) => `./${folder}/${String(n).padStart(3, '0')}.webp`;

function notify(text) {
  clearTimeout(noticeTimer);
  $('notice').textContent = text;
  $('notice').hidden = false;
  noticeTimer = setTimeout(() => { $('notice').hidden = true; }, 4500);
}

function measure() {
  stack.style.paddingBottom = `${Math.max(8, reader.clientHeight - papers[total - 1].offsetHeight)}px`;
  papers.forEach((paper, i) => { offsets[i] = paper.offsetTop; });
}

function pageAt(y) {
  let low = 0, high = total;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (offsets[mid] <= y) low = mid + 1;
    else high = mid;
  }
  return Math.max(1, low);
}

function position() {
  return {page: currentPage, y: (reader.scrollTop - offsets[currentPage - 1]) / papers[currentPage - 1].offsetHeight,
    x: reader.scrollLeft / stack.scrollWidth, zoom};
}

function place(pos) {
  reader.scrollTop = offsets[pos.page - 1] + pos.y * papers[pos.page - 1].offsetHeight;
  reader.scrollLeft = pos.x * stack.scrollWidth;
  view = position();
}

function save() {
  view = position();
  localStorage.setItem(LAST, JSON.stringify(view));
  history.replaceState(null, '', `#p=${currentPage}`);
}

function loadPage(n, priority = 'high') {
  if (n < 1 || n > total) return;
  const paper = papers[n - 1], img = paper.querySelector('img');
  const full = zoom > 1 || window.visualViewport.scale > 1;
  const path = imagePath(full ? 'pages' : 'pages-mobile', n);
  if (img.dataset.path === path) return;
  img.fetchPriority = priority;
  img.dataset.path = path;
  paper.querySelector('.load-error').hidden = true;
  paper.querySelector('.page-state').textContent = '加载中…';
  img.src = path;
}

function loadWindow(n) {
  clearTimeout(warmTimer);
  lastVisible = pageAt(reader.scrollTop + reader.clientHeight);
  for (let page = n; page <= lastVisible; page++) loadPage(page);
  for (const img of stack.querySelectorAll('img[data-path]')) {
    const page = Number(img.dataset.page);
    if (page < n - 1 || page > lastVisible + 1) {
      delete img.dataset.path;
      img.removeAttribute('src');
      papers[page - 1].querySelector('.page-state').textContent = '';
    }
  }
  warmTimer = setTimeout(() => loadPage(lastVisible + 1, 'low'), 300);
}

function updateBookmark() {
  const saved = bookmarks.has(currentPage);
  $('bookmark').setAttribute('aria-pressed', String(saved));
  $('bookmark').setAttribute('aria-label', saved ? '取消收藏当前页' : '收藏当前页');
}

function updatePage(n) {
  currentPage = n;
  $('page-label').innerHTML = `第 ${n} 页 <span>/ ${total}</span>`;
  $('prev-page').disabled = n === 1;
  $('next-page').disabled = n === total;
  updateBookmark();
  loadWindow(n);
}

function goPage(n, push = true) {
  if (!Number.isInteger(n) || n < 1 || n > total) {
    notify(`请输入 1～${total} 之间的页码。`);
    return;
  }
  if (push && n !== currentPage) history.pushState(null, '', `#p=${n}`);
  reader.scrollTop = offsets[n - 1];
  reader.scrollLeft = 0;
  updatePage(n);
  save();
}

function changeZoom(next) {
  const pos = position();
  zoom = Math.min(4, Math.max(1, next));
  stack.style.width = `${zoom * 100}%`;
  $('zoom-reset').textContent = zoom === 1 ? '适合宽度' : `${Math.round(zoom * 100)}% · 复原`;
  $('zoom-out').disabled = zoom === 1;
  $('zoom-in').disabled = zoom === 4;
  measure();
  place(pos);
  loadWindow(currentPage);
  save();
}

function restore() {
  const last = JSON.parse(localStorage.getItem(LAST) || 'null');
  const requested = Number(new URLSearchParams(location.hash.slice(1)).get('p'));
  const n = requested || (last ? last.page : 1);
  const pos = last && last.page === n ? last : {page: n, y: 0, x: 0, zoom: 1};
  if (n < 1 || n > total || !Number.isInteger(n)) { goPage(1, false); return; }
  currentPage = n;
  changeZoom(pos.zoom);
  place(pos);
  updatePage(n);
  save();
}

function renderDirectory() {
  $('all-pages').setAttribute('aria-pressed', String(!savedOnly));
  $('saved-pages').setAttribute('aria-pressed', String(savedOnly));
  $('saved-pages').textContent = `我的收藏${bookmarks.size ? ` · ${bookmarks.size}` : ''}`;
  const fragment = document.createDocumentFragment();
  for (let n = 1; n <= total; n++) {
    if (savedOnly && !bookmarks.has(n)) continue;
    const button = document.createElement('button');
    button.className = `thumbnail${bookmarks.has(n) ? ' is-saved' : ''}`;
    button.setAttribute('aria-label', `打开第 ${n} 页`);
    if (n === currentPage) button.setAttribute('aria-current', 'page');
    const img = document.createElement('img');
    img.src = imagePath('thumbnails', n);
    img.alt = ''; img.loading = 'lazy'; img.width = 320; img.height = 226;
    const label = document.createElement('span'); label.textContent = `第 ${n} 页`;
    button.append(img, label);
    button.addEventListener('click', () => { $('directory').close(); goPage(n); });
    fragment.append(button);
  }
  $('thumbnail-grid').replaceChildren(fragment);
  const empty = savedOnly && bookmarks.size === 0;
  $('thumbnail-grid').hidden = empty;
  $('empty-bookmarks').hidden = !empty;
}

function jumpInput() {
  document.body.classList.remove('focus');
  $('focus-toggle').setAttribute('aria-pressed', 'false');
  $('focus-toggle').setAttribute('aria-label', '进入专注阅读');
  $('page-input').value = String(currentPage);
  $('page-input').focus();
  $('page-input').select();
}

async function refreshOffline() {
  const cache = await caches.open(MEDIA), keys = await cache.keys();
  const pages = new Set();
  for (const key of keys) {
    const match = new URL(key.url).pathname.match(/\/pages(?:-mobile)?\/(\d+)\.webp$/);
    if (match) pages.add(Number(match[1]));
  }
  $('download-progress').value = pages.size;
  $('offline-status').textContent = `已缓存 ${pages.size} / ${total} 页。保存全部可补齐高清图和目录。`;
}

async function downloadAll() {
  downloading = true; stopDownload = false;
  $('download-all').disabled = true; $('clear-cache').disabled = true;
  $('stop-download').hidden = false; $('stop-download').disabled = false;
  const cache = await caches.open(MEDIA);
  let done = 0;
  try {
    for (let n = 1; n <= total && !stopDownload; n++) {
      const paths = ['pages-mobile', 'pages', 'thumbnails'].map(folder => imagePath(folder, n));
      const missing = [];
      for (const path of paths) if (!await cache.match(path)) missing.push(path);
      await cache.addAll(missing);
      done = n;
      $('download-progress').value = done;
      $('offline-status').textContent = `正在保存 ${done} / ${total} 页…`;
    }
    $('offline-status').textContent = done === total ? `全部 ${total} 页已保存，包含高清图，可离线阅读。` : `已停止，完成 ${done} / ${total} 页。再次保存会接着补齐。`;
  } catch {
    $('offline-status').textContent = `保存在第 ${done + 1} 页中断。检查网络和可用空间后，再次保存即可继续。`;
  } finally {
    downloading = false;
    $('download-all').disabled = false; $('clear-cache').disabled = false;
    $('stop-download').hidden = true;
  }
}

for (let n = 1; n <= total; n++) {
  const [width, height] = sizes[n - 1];
  const paper = document.createElement('article');
  paper.className = 'paper'; paper.id = `page-${n}`;
  paper.setAttribute('aria-label', `PDF 第 ${n} 页`);
  const caption = document.createElement('div'); caption.className = 'page-caption';
  caption.innerHTML = `<span>PDF 第 ${n} 页</span><span class="page-state"></span>`;
  const frame = document.createElement('div'); frame.className = 'frame';
  frame.style.aspectRatio = `${width} / ${height}`;
  const img = document.createElement('img');
  img.alt = `工程制图答案，第 ${n} 页`;
  img.width = width; img.height = height; img.decoding = 'async'; img.dataset.page = n;
  const error = document.createElement('div'); error.className = 'load-error'; error.hidden = true;
  const text = document.createElement('span'); text.textContent = '本页未加载，请联网后重试。';
  const retry = document.createElement('button'); retry.textContent = '重新加载';
  retry.addEventListener('click', () => { delete img.dataset.path; loadPage(n); });
  error.append(text, retry);
  img.addEventListener('load', () => { caption.lastChild.textContent = ''; });
  img.addEventListener('error', () => {
    if (!img.dataset.path) return;
    caption.lastChild.textContent = '加载失败'; error.hidden = false;
  });
  frame.append(img, error); paper.append(caption, frame); stack.append(paper); papers.push(paper);
}

$('jump-form').addEventListener('submit', event => {
  event.preventDefault();
  const match = $('page-input').value.normalize('NFKC').trim().match(/^(?:第\s*)?(\d+)\s*页?$/);
  if (!match) { notify('输入页码即可，例如 12 或第12页。'); return; }
  $('page-input').blur();
  goPage(Number(match[1]));
});
$('prev-page').addEventListener('click', () => goPage(currentPage - 1));
$('next-page').addEventListener('click', () => goPage(currentPage + 1));
$('page-label').addEventListener('click', jumpInput);
$('zoom-in').addEventListener('click', () => changeZoom(zoom + .25));
$('zoom-out').addEventListener('click', () => changeZoom(zoom - .25));
$('zoom-reset').addEventListener('click', () => changeZoom(1));
reader.addEventListener('dblclick', event => {
  if (event.target.tagName === 'IMG') { event.preventDefault(); changeZoom(zoom === 1 ? 2 : 1); }
});
reader.addEventListener('scroll', () => {
  if (scrollTick) return;
  scrollTick = true;
  requestAnimationFrame(() => {
    scrollTick = false;
    const n = pageAt(reader.scrollTop + 18);
    if (n !== currentPage) updatePage(n);
    else if (pageAt(reader.scrollTop + reader.clientHeight) !== lastVisible) loadWindow(n);
    view = position();
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 180);
  });
}, {passive: true});
$('bookmark').addEventListener('click', () => {
  if (bookmarks.has(currentPage)) bookmarks.delete(currentPage);
  else bookmarks.add(currentPage);
  localStorage.setItem(SAVED, JSON.stringify([...bookmarks].sort((a, b) => a - b)));
  updateBookmark();
  notify(bookmarks.has(currentPage) ? `已收藏第 ${currentPage} 页。` : `已取消收藏第 ${currentPage} 页。`);
});
$('focus-toggle').addEventListener('click', () => {
  const focused = document.body.classList.toggle('focus');
  $('focus-toggle').setAttribute('aria-pressed', String(focused));
  $('focus-toggle').setAttribute('aria-label', focused ? '退出专注阅读' : '进入专注阅读');
});
$('show-directory').addEventListener('click', () => {
  renderDirectory(); $('directory').showModal();
  const active = $('thumbnail-grid').querySelector('[aria-current="page"]');
  if (active) active.scrollIntoView({block: 'center'});
});
$('all-pages').addEventListener('click', () => { savedOnly = false; renderDirectory(); });
$('saved-pages').addEventListener('click', () => { savedOnly = true; renderDirectory(); });
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $(button.dataset.close).close());
$('show-help').addEventListener('click', () => { $('menu').open = false; $('help-dialog').showModal(); });
$('show-offline').addEventListener('click', () => {
  $('menu').open = false; $('offline-dialog').showModal();
  if (!downloading) refreshOffline();
});
$('download-all').addEventListener('click', downloadAll);
$('stop-download').addEventListener('click', () => {
  stopDownload = true; $('stop-download').disabled = true;
  $('offline-status').textContent = '正在停止，已完成的页面会保留。';
});
$('clear-cache').addEventListener('click', async () => { await caches.delete(MEDIA); await refreshOffline(); });
$('share-page').addEventListener('click', async () => {
  $('menu').open = false;
  const link = new URL(location.href); link.hash = `p=${currentPage}`;
  try {
    if (navigator.share) await navigator.share({title: `工程制图答案 · 第 ${currentPage} 页`, url: link.href});
    else { await navigator.clipboard.writeText(link.href); notify('当前页链接已复制。'); }
  } catch (error) { if (error.name !== 'AbortError') notify(`当前页链接：${link.href}`); }
});
window.addEventListener('popstate', () => goPage(Number(new URLSearchParams(location.hash.slice(1)).get('p')) || 1, false));
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
function networkStatus() { $('network-state').textContent = navigator.onLine ? '' : '· 离线'; }
window.addEventListener('online', networkStatus); window.addEventListener('offline', networkStatus);
window.visualViewport.addEventListener('resize', () => loadWindow(currentPage));
new ResizeObserver(() => { const pos = view; measure(); place(pos); loadWindow(currentPage); }).observe(reader);
$('offline-size').textContent = `全套约 ${(window.DRAWING_PAGES.bytes / 1024 / 1024).toFixed(1)} MB，含手机图、高清图和缩略图。`;
measure(); restore(); networkStatus();
navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'}).catch(() => notify('离线功能未就绪，请联网后刷新。'));
