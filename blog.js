/* ============================================================
   blog.js — the engine. You should not need to edit this file.

   What it does
   1. Loads site.js (your settings + post list) and styles.css.
   2. On a post page: turns the markdown inside
      <script type="text/markdown"> … </script> into the article,
      and fills in <title>, description, canonical, Open Graph
      and schema.org from the matching line in site.js.
   3. On the home page: fills the post list, newest first.

   A post page is any file that contains a text/markdown script.
   The home page is any file that contains an element with id="posts".
   ============================================================ */
(function () {
  'use strict';

  var ME = document.currentScript;
  var IS_LIB = !!(ME && ME.hasAttribute('data-lib'));
  var ROOT = ME ? ME.src.replace(/blog\.js(\?.*)?$/, '') : './';
  var IS_FILE = location.protocol === 'file:';

  // Load settings and styles synchronously so the page renders styled.
  if (!IS_LIB) {
    document.write(
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<link rel="stylesheet" href="' + ROOT + 'styles.css">' +
      '<script src="' + ROOT + 'site.js"><\/script>'
    );
  }

  /* ---------------- helpers ---------------- */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function formatDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    if (!m) return iso || '';
    return MONTHS[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1];
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function slugify(s) {
    return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/['\u2019]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 80).replace(/-+$/, '') || 'post';
  }

  function wordCount(md) {
    var text = String(md).replace(/```[\s\S]*?```/g, ' ');
    var m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu);
    return m ? m.length : 0;
  }

  function leading(line) {
    return /^ */.exec(line)[0].length;
  }

  /* ---------------- markdown ---------------- */

  var RE = {
    blank:   /^\s*$/,
    fence:   /^ {0,3}(```+|~~~+)([^`]*)$/,
    heading: /^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/,
    hr:      /^ {0,3}([-*_])(\s*\1){2,}\s*$/,
    quote:   /^ {0,3}>\s?/,
    ul:      /^( *)([-*+]) +(.*)$/,
    ol:      /^( *)(\d{1,9}[.)]) +(.*)$/,
    fndef:   /^ {0,3}\[\^([^\]\s]+)\]:\s?(.*)$/,
    html:    /^ {0,3}(<(\/?)(address|article|aside|audio|blockquote|canvas|center|details|dialog|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|iframe|img|main|nav|ol|p|picture|pre|script|section|style|summary|svg|table|ul|video)\b|<!--)/i,
    image:   /^!\[([^\]]*)\]\(\s*((?:[^\s()]|\([^\s()]*\))+)(?:\s+"([^"]*)")?\s*\)$/
  };

  function startsBlock(line) {
    return RE.fence.test(line) || RE.heading.test(line) || RE.hr.test(line) ||
      RE.quote.test(line) || RE.ul.test(line) || RE.ol.test(line) ||
      RE.fndef.test(line) || RE.html.test(line);
  }

  // render(markdown, { root, shift }) -> { html, footnotes }
  //   root:  prefix for links/images written as "assets/…" or "posts/…"
  //   shift: how many levels to push headings down (1 = "#" becomes <h2>)
  function render(src, opts) {
    opts = opts || {};
    var root = opts.root || '';
    var shift = opts.shift == null ? 1 : opts.shift;
    var footnotes = {};
    var refs = [];

    function url(href) {
      if (/^(assets\/|posts\/|index\.html)/.test(href)) return root + href;
      return href;
    }

    function figure(alt, src, caption) {
      return '<figure><img src="' + esc(url(src)) + '" alt="' + esc(alt) + '">' +
        (caption ? '<figcaption>' + inline(caption) + '</figcaption>' : '') +
        '</figure>';
    }

    // Lines indented at least `min` spaces, plus blank lines that are
    // followed by such a line. Returns { lines, next }.
    function collectIndented(lines, i, min, strip) {
      var out = [], n = lines.length;
      while (i < n) {
        var l = lines[i];
        if (RE.blank.test(l)) {
          var j = i;
          while (j < n && RE.blank.test(lines[j])) j++;
          if (j < n && leading(lines[j]) >= min) { out.push(''); i++; continue; }
          break;
        }
        if (leading(l) >= min) { out.push(l.slice(Math.min(leading(l), strip))); i++; continue; }
        break;
      }
      return { lines: out, next: i };
    }

    function parseList(lines, i) {
      var n = lines.length;
      var first = RE.ul.exec(lines[i]) || RE.ol.exec(lines[i]);
      var ordered = /\d/.test(first[2]);
      var re = ordered ? RE.ol : RE.ul;
      var indent = first[1].length;
      var start = ordered ? parseInt(first[2], 10) : 1;
      var items = [], tight = true;

      while (i < n) {
        var m = re.exec(lines[i]);
        if (!m || m[1].length !== indent) break;
        var offset = m[0].length - m[3].length;
        var body = [m[3]];
        i++;
        var sawBlank = false;
        while (i < n) {
          var l = lines[i];
          if (RE.blank.test(l)) {
            var j = i;
            while (j < n && RE.blank.test(lines[j])) j++;
            if (j < n && leading(lines[j]) >= indent + 2) {
              body.push(''); sawBlank = true; tight = false; i++; continue;
            }
            break;
          }
          if (leading(l) >= indent + 2) { body.push(l.slice(Math.min(leading(l), offset))); i++; continue; }
          if (!sawBlank && !re.exec(l) && !startsBlock(l)) { body.push(l); i++; continue; }
          break;
        }
        items.push(body);

        // Blank lines between items make the list loose but do not end it.
        var k = i;
        while (k < n && RE.blank.test(lines[k])) k++;
        if (k < n && k > i) {
          var nm = re.exec(lines[k]);
          if (nm && nm[1].length === indent) { tight = false; i = k; continue; }
        }
        if (k > i) break;
      }

      var html = items.map(function (body) {
        var inner = blocks(body);
        if (tight) inner = inner.replace(/^<p>([\s\S]*?)<\/p>/, '$1');
        return '<li>' + inner + '</li>';
      }).join('\n');

      var tag = ordered ? 'ol' : 'ul';
      var attr = (ordered && start !== 1) ? ' start="' + start + '"' : '';
      return { html: '<' + tag + attr + '>\n' + html + '\n</' + tag + '>', next: i };
    }

    function blocks(lines) {
      var out = [], i = 0, n = lines.length, m;
      while (i < n) {
        var line = lines[i];
        if (RE.blank.test(line)) { i++; continue; }

        // ``` fenced code
        if ((m = RE.fence.exec(line))) {
          var fence = m[1], lang = m[2].trim().split(/\s+/)[0], buf = [];
          var close = new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}\\s*$');
          i++;
          while (i < n && !close.test(lines[i])) { buf.push(lines[i]); i++; }
          i++;
          out.push('<pre><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' +
            esc(buf.join('\n')) + '</code></pre>');
          continue;
        }

        // # heading
        if ((m = RE.heading.exec(line))) {
          var lvl = Math.min(6, m[1].length + shift);
          out.push('<h' + lvl + ' id="' + slugify(m[2]) + '">' + inline(m[2]) + '</h' + lvl + '>');
          i++; continue;
        }

        // --- rule
        if (RE.hr.test(line)) { out.push('<hr>'); i++; continue; }

        // > quote
        if (RE.quote.test(line)) {
          var q = [];
          while (i < n && (RE.quote.test(lines[i]) ||
                 (q.length && !RE.blank.test(lines[i]) && !startsBlock(lines[i])))) {
            q.push(lines[i].replace(RE.quote, '')); i++;
          }
          out.push('<blockquote>\n' + blocks(q) + '\n</blockquote>');
          continue;
        }

        // [^id]: footnote text
        if ((m = RE.fndef.exec(line))) {
          var c = collectIndented(lines, i + 1, 2, 4);
          footnotes[m[1]] = [m[2]].concat(c.lines).join('\n');
          i = c.next; continue;
        }

        // - list / 1. list
        if (RE.ul.test(line) || RE.ol.test(line)) {
          var r = parseList(lines, i);
          out.push(r.html); i = r.next; continue;
        }

        // raw HTML block, passed through untouched
        if (RE.html.test(line)) {
          var h = [];
          while (i < n && !RE.blank.test(lines[i])) { h.push(lines[i]); i++; }
          out.push(h.join('\n'));
          continue;
        }

        // paragraph
        var p = [];
        while (i < n && !RE.blank.test(lines[i]) && (p.length === 0 || !startsBlock(lines[i]))) {
          p.push(lines[i]); i++;
        }
        var text = p.join('\n').trim();
        var im = RE.image.exec(text);
        if (im) { out.push(figure(im[1], im[2], im[3])); continue; }
        out.push('<p>' + inline(text) + '</p>');
      }
      return out.join('\n');
    }

    function inline(s) {
      var store = [];
      s = inlineRaw(s, store);
      while (/\u0000\d+\u0000/.test(s)) {
        s = s.replace(/\u0000(\d+)\u0000/g, function (_, k) { return store[+k]; });
      }
      return s;
    }

    function inlineRaw(s, store) {
      function keep(html) { store.push(html); return '\u0000' + (store.length - 1) + '\u0000'; }

      // `code`
      s = s.replace(/(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g, function (_, t, code) {
        return keep('<code>' + esc(code.replace(/\n/g, ' ').trim()) + '</code>');
      });
      // \escapes
      s = s.replace(/\\([\\`*_{}\[\]()#+\-.!>~|])/g, function (_, ch) { return keep(esc(ch)); });
      // <https://auto.link>
      s = s.replace(/<(https?:\/\/[^\s<>]+)>/g, function (_, href) {
        return keep('<a href="' + esc(href) + '">' + esc(href) + '</a>');
      });
      // inline HTML tags pass through untouched
      s = s.replace(/<\/?[a-zA-Z][^<>]*>/g, function (tag) { return keep(tag); });
      // ![alt](src "caption")
      s = s.replace(/!\[([^\]]*)\]\(\s*((?:[^\s()]|\([^\s()]*\))+)(?:\s+"([^"]*)")?\s*\)/g,
        function (_, alt, src, title) {
          return keep('<img src="' + esc(url(src)) + '" alt="' + esc(alt) + '"' +
            (title ? ' title="' + esc(title) + '"' : '') + '>');
        });
      // [^id] footnote reference
      s = s.replace(/\[\^([^\]\s]+)\]/g, function (_, id) {
        var k = refs.indexOf(id);
        if (k < 0) { refs.push(id); k = refs.length - 1; }
        return keep('<sup class="fn-ref" id="fnref-' + esc(id) + '"><a href="#fn-' + esc(id) +
          '" aria-label="Footnote ' + (k + 1) + '">' + (k + 1) + '</a></sup>');
      });
      // [text](url "title")
      s = s.replace(/\[([^\]]+)\]\(\s*((?:[^\s()]|\([^\s()]*\))+)(?:\s+"([^"]*)")?\s*\)/g,
        function (_, text, href, title) {
          return keep('<a href="' + esc(url(href)) + '"' + (title ? ' title="' + esc(title) + '"' : '') +
            '>' + inlineRaw(text, store) + '</a>');
        });
      // **strong** __strong__ *em* _em_ ~~del~~
      s = s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>');
      s = s.replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>');
      s = s.replace(/\*(?=\S)([^*\n]*?\S)\*/g, '<em>$1</em>');
      s = s.replace(/(^|[^\w])_(?=\S)([^_\n]*?\S)_(?!\w)/g, '$1<em>$2</em>');
      s = s.replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
      // two trailing spaces, or a backslash, before a newline = line break
      s = s.replace(/(?: {2,}|\\)\n/g, '<br>\n');
      return s;
    }

    var lines = String(src).replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');

    // Strip the indentation every non-blank line shares, so the markdown
    // may be indented inside its <script> tag without changing meaning.
    var common = Infinity;
    lines.forEach(function (l) { if (!RE.blank.test(l)) common = Math.min(common, leading(l)); });
    if (common > 0 && common < Infinity) lines = lines.map(function (l) { return l.slice(common); });

    var html = blocks(lines);

    var fn = '';
    if (refs.length) {
      fn = '<section class="footnotes" aria-label="Footnotes"><ol>\n' + refs.map(function (id) {
        var body = footnotes[id] == null ? '' : blocks(footnotes[id].split('\n'));
        var back = ' <a class="fn-back" href="#fnref-' + esc(id) + '" aria-label="Back to text">\u21A9</a>';
        if (/<\/p>\s*$/.test(body)) body = body.replace(/<\/p>\s*$/, back + '</p>');
        else body += back;
        return '<li id="fn-' + esc(id) + '">' + body + '</li>';
      }).join('\n') + '\n</ol></section>';
    }

    return { html: html, footnotes: fn };
  }

  /* ---------------- pages ---------------- */

  function site() { return window.SITE || {}; }
  function posts() { return Array.isArray(window.POSTS) ? window.POSTS : []; }

  // Listed posts: those with a file and a date that is not in the future.
  function listed() {
    var t = today();
    return posts().filter(function (p) {
      return p && p.file && (!p.date || String(p.date) <= t);
    }).sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  }

  function upsert(selector, tag, attrs) {
    var el = document.head.querySelector(selector);
    if (!el) { el = document.createElement(tag); document.head.appendChild(el); }
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }
  function meta(name, content) { if (content) upsert('meta[name="' + name + '"]', 'meta', { name: name, content: content }); }
  function og(prop, content) { if (content) upsert('meta[property="' + prop + '"]', 'meta', { property: prop, content: content }); }
  function jsonld(obj) {
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  function siteUrl() { return String(site().url || '').replace(/\/+$/, ''); }
  function homeHref() { return IS_FILE ? ROOT + 'index.html' : ROOT; }
  function postHref(p) { return ROOT + 'posts/' + encodeURIComponent(p.file) + '.html'; }
  function postUrl(p) { return siteUrl() + '/posts/' + encodeURIComponent(p.file); }
  function imageUrl(name) {
    if (!name) return '';
    if (/^(https?:)?\/\//.test(name) || name.indexOf('/') >= 0) return name;
    return 'assets/' + name;
  }
  function absolute(rel) {
    if (!rel) return '';
    if (/^(https?:)?\/\//.test(rel)) return rel;
    return siteUrl() + '/' + rel.replace(/^\.?\//, '');
  }

  function headerHtml(isHome) {
    var S = site();
    return '<header class="site-header"><div class="wrap">' +
      '<a class="brand" href="' + esc(homeHref()) + '">' + esc(S.name || 'Blog') + '</a>' +
      (isHome ? '' : '<nav class="nav"><a href="' + esc(homeHref()) + '">Home</a></nav>') +
      '</div></header>';
  }

  function footerHtml() {
    var S = site();
    return S.footer ? '<footer class="site-footer" id="about"><p>' + S.footer + '</p></footer>' : '';
  }

  function analytics() {
    var S = site();
    if (!S.analytics || IS_FILE || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', JSON.stringify({ token: S.analytics }));
    document.body.appendChild(s);
  }

  function renderHome(list) {
    var S = site();
    document.documentElement.lang = document.documentElement.lang || S.lang || 'en';
    document.title = S.name || 'Blog';
    meta('description', S.description);
    meta('author', S.author);
    meta('keywords', S.keywords);
    meta('robots', 'index,follow,max-snippet:-1,max-image-preview:large');
    if (siteUrl()) {
      upsert('link[rel="canonical"]', 'link', { rel: 'canonical', href: siteUrl() + '/' });
      og('og:url', siteUrl() + '/');
    }
    og('og:type', 'website');
    og('og:site_name', S.name);
    og('og:title', S.name);
    og('og:description', S.description);
    meta('twitter:card', 'summary');
    jsonld({
      '@context': 'https://schema.org', '@type': 'Blog',
      name: S.name, url: siteUrl() + '/', description: S.description,
      inLanguage: S.lang || 'en',
      publisher: { '@type': 'Organization', name: S.author || S.name, url: siteUrl() + '/' }
    });

    var items = listed();
    list.innerHTML = items.length ? items.map(function (p) {
      return '<li><time datetime="' + esc(p.date || '') + '">' + esc(formatDate(p.date)) + '</time>' +
        '<a href="' + esc(postHref(p)) + '">' + esc(p.title || p.file) + '</a></li>';
    }).join('\n') : '<li class="empty">Nothing here yet.</li>';

    document.body.insertAdjacentHTML('afterbegin', headerHtml(true));
    var main = document.querySelector('main') || document.body;
    main.insertAdjacentHTML('beforeend', footerHtml());
    analytics();
  }

  function renderPost(mdEl) {
    var S = site();
    var src = mdEl.textContent.replace(/^\s*\n/, '').replace(/\s+$/, '');
    var file = decodeURIComponent((location.pathname.split('/').pop() || '')).replace(/\.html?$/i, '');
    var all = listed();
    var post = null, idx = -1;
    posts().forEach(function (p) { if (p && p.file === file) post = p; });
    all.forEach(function (p, i) { if (p === post) idx = i; });

    // Title: site.js line, else the file's <title>, else a leading "# Heading".
    var title = post && post.title;
    if (!title) {
      var t = document.querySelector('title');
      if (t && t.textContent.trim()) title = t.textContent.replace(/\s+[\u2014\u2013-]\s+[^\u2014\u2013-]*$/, '').trim();
    }
    var h1 = /^ {0,3}#\s+(.+)\n?/.exec(src);
    if (h1 && (!title || h1[1].trim().toLowerCase() === String(title).trim().toLowerCase())) {
      title = title || h1[1].trim();
      src = src.slice(h1[0].length);
    }
    title = title || 'Untitled';

    var summary = (post && post.summary) || S.description || '';
    var image = post && imageUrl(post.image);
    var date = post && post.date;
    var updated = (post && post.updated) || date;

    document.documentElement.lang = document.documentElement.lang || S.lang || 'en';
    document.title = title + (S.name ? ' \u2014 ' + S.name : '');
    meta('description', summary);
    meta('author', S.author);
    meta('keywords', S.keywords);
    meta('robots', post ? 'index,follow,max-snippet:-1,max-image-preview:large' : 'noindex');
    og('og:type', 'article');
    og('og:site_name', S.name);
    og('og:title', title);
    og('og:description', summary);
    meta('twitter:card', image ? 'summary_large_image' : 'summary');
    if (post && siteUrl()) {
      upsert('link[rel="canonical"]', 'link', { rel: 'canonical', href: postUrl(post) });
      og('og:url', postUrl(post));
      if (image) og('og:image', absolute(image));
      jsonld({
        '@context': 'https://schema.org', '@type': 'BlogPosting',
        headline: title, description: summary,
        datePublished: date, dateModified: updated,
        image: image ? absolute(image) : undefined,
        author: { '@type': 'Person', name: S.author || S.name },
        publisher: { '@type': 'Organization', name: S.author || S.name, url: siteUrl() + '/' },
        mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl(post) }
      });
    }

    var out = render(src, { root: ROOT, shift: 1 });

    var metaLine = post
      ? '<time datetime="' + esc(date || '') + '">' + esc(formatDate(date)) + '</time>' +
        (post.updated ? ' <span aria-hidden="true">\u00B7</span> updated ' + esc(formatDate(post.updated)) : '')
      : 'Draft';

    var nav = '';
    if (idx >= 0) {
      var newer = all[idx - 1], older = all[idx + 1];
      if (newer || older) {
        nav = '<nav class="post-nav" aria-label="Other posts">' +
          (newer ? '<a class="newer" rel="next" href="' + esc(postHref(newer)) + '">\u2190 ' + esc(newer.title) + '</a>' : '') +
          (older ? '<a class="older" rel="prev" href="' + esc(postHref(older)) + '">' + esc(older.title) + ' \u2192</a>' : '') +
          '</nav>';
      }
    }

    document.body.innerHTML =
      headerHtml(false) +
      '<main class="wrap"><article class="post">' +
      '<header class="post-head"><h1>' + esc(title) + '</h1>' +
      '<p class="post-meta">' + metaLine + '</p></header>' +
      '<div class="prose">' +
      (image ? '<img class="banner-img" src="' + esc(/^(https?:)?\/\//.test(image) ? image : ROOT + image) + '" alt="">' : '') +
      out.html + out.footnotes +
      '</div>' + nav + '</article>' + footerHtml() + '</main>';
    analytics();
  }

  window.Blog = {
    render: render, formatDate: formatDate, slugify: slugify, today: today,
    wordCount: wordCount, esc: esc, imageUrl: imageUrl, root: ROOT
  };

  if (IS_LIB) return;

  document.addEventListener('DOMContentLoaded', function () {
    var md = document.querySelector('script[type="text/markdown"]');
    var list = document.getElementById('posts');
    if (md) renderPost(md);
    else if (list) renderHome(list);
  });
})();
