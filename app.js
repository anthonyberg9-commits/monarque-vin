/* Carte des vins — moteur de recherche interne
   Données : window.CARTE (data.js) */
(function () {
  'use strict';

  var DATA = (window.CARTE || { meta: {}, vins: [] });
  var VINS = DATA.vins || [];

  /* ---------- utilitaires ---------- */
  function fold(s) {                       // sans accents, longueur préservée
    return (s || '').toLowerCase().replace(/[À-ɏ]/g, function (c) {
      var d = c.normalize('NFD');
      return d[0] || c;
    });
  }
  function slug(s) { return fold(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function prix(n) { return n == null ? '' : (Math.round(n) + ' $'); }

  /* ---------- synonymes / abréviations de la carte ---------- */
  var SYN = {
    chardonnay: ['chardo'], chardo: ['chardonnay'],
    grenache: ['gren', 'garnacha', 'garnacho'], mourvedre: ['mourv', 'monastrell'],
    cabernet: ['cab'], sauvignon: ['sauv'], franc: ['frc'],
    marsanne: ['mars'], roussanne: ['rouss'], sangiovese: ['sangio'],
    meunier: ['pinot meunier'], gruner: ['gruner veltliner', 'veltliner'],
    poulsard: ['pouls'], macabeu: ['maccabeu', 'macabeo', 'maccabeo'],
    petnat: ['petillant', 'ancestrale'], 'pet nat': ['petillant'],
    bulles: ['champagne', 'cremant', 'mousseux', 'petillant', 'prosecco', 'cava',
             'franciacorta', 'spumante', 'lambrusco'],
    effervescent: ['champagne', 'cremant', 'mousseux', 'petillant'],
    nature: ['nature', 'sans so2', 'zero'], bio: ['bio', 'biodynamie'],
    biodynamie: ['bio'], fut: ['fut', 'foudre', 'barrique'], amphore: ['anfora', 'amphore'],
    quebec: ['quebec', 'dunham', 'brigham', 'farnham', 'armand'],
    usa: ['californie', 'oregon', 'etats unis', 'napa', 'sonoma', 'willamette'],
    local: ['quebec', 'ontario', 'canada'],
    macere: ['maceration', 'macere', 'orange'],
    'demi sec': ['demi sec', 'moelleux', 'sucre'],
    sucre: ['moelleux', 'demi sec'],
    aperitif: ['vermouth', 'pineau', 'manzanilla', 'xeres', 'sherry'],
    verre: [], abordable: [], cher: []
  };

  /* ---------- index ---------- */
  VINS.forEach(function (v) {
    v._prod = slug(v.producteur);
    v._nom = slug([v.cuvee, v.appellation, v.label].join(' '));
    v._cep = slug([v.cepages, v.notes].join(' '));
    v._lieu = slug([v.region, v.pays, v.origine].join(' '));
    v._meta = slug([v.agence, v.code].join(' '));
    var f = v.fiche;
    v._fiche = f ? slug([f.nez, f.bouche, f.finale, (f.accords || []).join(' ')].join(' ')) : '';
    v._all = [v._prod, v._nom, v._cep, v._lieu, v._meta, v._fiche, slug(v.format),
              slug(v.couleur), v.au_verre ? 'au verre' : ''].join(' ');
    v._words = v._all.split(' ');
    v._prixTri = v.prix_bouteille != null ? v.prix_bouteille : (v.prix_verre || 0) * 4.2;
  });

  /* ---------- analyse de la requête ---------- */
  function parseQuery(raw) {
    var s = ' ' + slug(raw) + ' ';
    var f = { min: null, max: null, verre: false, magnum: false, couleurs: [], tokens: [] };
    var m;

    if ((m = s.match(/ entre (\d{2,4})\s*(?:\$|dollars)?\s*(?:et|a|-)\s*(\d{2,4})/))) {
      f.min = +m[1]; f.max = +m[2]; s = s.replace(m[0], ' ');
    }
    if ((m = s.match(/ (?:moins de|sous|max|maximum|jusqu a|jusqu|budget|en dessous de)\s*(\d{2,4})/))) {
      f.max = +m[1]; s = s.replace(m[0], ' ');
    }
    if ((m = s.match(/ (?:plus de|au dessus de|min|minimum|au dela de)\s*(\d{2,4})/))) {
      f.min = +m[1]; s = s.replace(m[0], ' ');
    }
    if ((m = s.match(/ (\d{2,4})\s*(?:a|-)\s*(\d{2,4}) /))) {
      f.min = +m[1]; f.max = +m[2]; s = s.replace(m[0], ' ');
    }
    if (f.max == null && f.min == null && (m = s.match(/ (?:a|autour de|vers|environ)?\s*(\d{2,4})\s*\$/))) {
      var p = +m[1]; f.min = Math.round(p * 0.8); f.max = Math.round(p * 1.2);
      s = s.replace(m[0], ' ');
    }
    if (/ (au verre|verre|verres) /.test(s)) { f.verre = true; s = s.replace(/ (au verre|verre|verres) /g, ' '); }
    if (/ magnum /.test(s)) { f.magnum = true; s = s.replace(/ magnum /g, ' '); }

    [['rouge', 'rouge'], ['rouges', 'rouge'], ['blanc', 'blanc'], ['blancs', 'blanc'],
     ['rose', 'rosé'], ['roses', 'rosé'], ['orange', 'orange'], ['oranges', 'orange'],
     ['bulle', 'bulles'], ['bulles', 'bulles'], ['aperitif', 'apéritif']
    ].forEach(function (pair) {
      var re = new RegExp(' ' + pair[0] + ' ');
      if (re.test(s) && f.couleurs.indexOf(pair[1]) < 0) {
        // « orange » et « rosé » restent aussi des mots-clés utiles
        f.couleurs.push(pair[1]); s = s.replace(re, ' ');
      }
    });

    f.tokens = s.split(' ').filter(function (t) {
      return t && t.length > 1 && ['de', 'du', 'la', 'le', 'les', 'un', 'une', 'des', 'et',
        'avec', 'pour', 'en', 'au', 'aux', 'qui', 'qc'].indexOf(t) < 0;
    });
    return f;
  }

  function variants(tok) {
    var out = [tok];
    if (SYN[tok]) out = out.concat(SYN[tok]);
    return out;
  }

  function fieldScore(v, tok) {
    var vars = variants(tok), best = 0;
    for (var i = 0; i < vars.length; i++) {
      var t = vars[i];
      if (!t) continue;
      if (v._prod.indexOf(t) === 0 || (' ' + v._prod).indexOf(' ' + t) >= 0) best = Math.max(best, 12);
      else if ((' ' + v._nom).indexOf(' ' + t) >= 0) best = Math.max(best, 8);
      else if ((' ' + v._cep).indexOf(' ' + t) >= 0) best = Math.max(best, 7);
      else if ((' ' + v._lieu).indexOf(' ' + t) >= 0) best = Math.max(best, 6);
      else if ((' ' + v._meta).indexOf(' ' + t) >= 0) best = Math.max(best, 5);
      else if ((' ' + v._fiche).indexOf(' ' + t) >= 0) best = Math.max(best, 4);
      else if (v._all.indexOf(t) >= 0) best = Math.max(best, 3);
    }
    return best;
  }

  function search(f) {
    var out = [];
    for (var i = 0; i < VINS.length; i++) {
      var v = VINS[i];
      if (f.verre && !v.au_verre) continue;
      if (f.magnum && !/magnum/i.test(v.format)) continue;
      if (f.couleurs.length && f.couleurs.indexOf(v.couleur) < 0) continue;
      if (state.couleur && v.couleur !== state.couleur) continue;
      if (state.verre && !v.au_verre) continue;
      if (state.pays && v.pays !== state.pays) continue;
      if (state.region && v.region !== state.region) continue;
      var p = f.verre || state.verre ? (v.prix_verre != null ? v.prix_verre : v.prix_bouteille)
                                     : (v.prix_bouteille != null ? v.prix_bouteille : v.prix_verre);
      if (f.min != null && !(p >= f.min)) continue;
      if (f.max != null && !(p <= f.max)) continue;

      var sc = 0, ok = true;
      for (var j = 0; j < f.tokens.length; j++) {
        var s = fieldScore(v, f.tokens[j]);
        if (!s) { ok = false; break; }
        sc += s;
      }
      if (!ok) continue;
      out.push({ v: v, s: sc });
    }
    return out;
  }

  /* ---------- état ---------- */
  var state = { q: '', couleur: '', verre: false, pays: '', region: '', tri: 'carte', limit: 60 };

  var COULEURS = [
    { k: '', l: 'Tous' },
    { k: '__verre', l: 'Au verre' },
    { k: 'bulles', l: 'Bulles' },
    { k: 'blanc', l: 'Blanc' },
    { k: 'orange', l: 'Orange' },
    { k: 'rosé', l: 'Rosé' },
    { k: 'rouge', l: 'Rouge' },
    { k: 'apéritif', l: 'Apéritif' }
  ];

  var el = {
    q: document.getElementById('q'),
    clear: document.getElementById('clear'),
    chips: document.getElementById('chips'),
    pays: document.getElementById('pays'),
    region: document.getElementById('region'),
    tri: document.getElementById('tri'),
    res: document.getElementById('results'),
    more: document.getElementById('more'),
    count: document.getElementById('count'),
    foot: document.getElementById('foot'),
    theme: document.getElementById('theme')
  };

  /* ---------- jour / soir ---------- */
  var root = document.documentElement;
  function prefLight() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  }
  function effectif() {
    return root.getAttribute('data-theme') || (prefLight() ? 'light' : 'dark');
  }
  function majIcone() { el.theme.textContent = effectif() === 'dark' ? '☾' : '☀'; }
  try {
    var choisi = localStorage.getItem('carte-theme');
    if (choisi === 'light' || choisi === 'dark') root.setAttribute('data-theme', choisi);
  } catch (e) {}
  majIcone();
  el.theme.onclick = function () {
    var suivant = effectif() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', suivant);
    try { localStorage.setItem('carte-theme', suivant); } catch (e) {}
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', suivant === 'dark' ? '#171210' : '#f6f1e8');
    majIcone();
  };

  /* ---------- filtres ---------- */
  function buildChips() {
    el.chips.innerHTML = '';
    COULEURS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.textContent = c.l;
      b.dataset.k = c.k;
      b.onclick = function () {
        if (c.k === '__verre') { state.verre = !state.verre; }
        else { state.couleur = (state.couleur === c.k ? '' : c.k); state.verre = c.k ? state.verre : false; }
        state.limit = 60; syncChips(); fillRegions(); render();
      };
      el.chips.appendChild(b);
    });
    syncChips();
  }
  function syncChips() {
    [].forEach.call(el.chips.children, function (b) {
      var k = b.dataset.k;
      var on = k === '__verre' ? state.verre : (k === '' ? (!state.couleur && !state.verre) : state.couleur === k);
      b.classList.toggle('on', !!on);
      b.classList.toggle('verre', k === '__verre');
    });
  }

  function fillSelect(sel, items, label, val) {
    sel.innerHTML = '';
    var o = document.createElement('option'); o.value = ''; o.textContent = label;
    sel.appendChild(o);
    items.forEach(function (it) {
      var x = document.createElement('option'); x.value = it; x.textContent = it;
      sel.appendChild(x);
    });
    sel.value = items.indexOf(val) >= 0 ? val : '';
    sel.classList.toggle('on', !!sel.value);
  }

  function pool() {
    return VINS.filter(function (v) {
      return (!state.couleur || v.couleur === state.couleur) && (!state.verre || v.au_verre);
    });
  }
  function fillPays() {
    var set = {};
    pool().forEach(function (v) { if (v.pays) set[v.pays] = (set[v.pays] || 0) + 1; });
    var l = Object.keys(set).sort(function (a, b) { return set[b] - set[a] || a.localeCompare(b, 'fr'); });
    fillSelect(el.pays, l, 'Tous les pays', state.pays);
  }
  function fillRegions() {
    fillPays();
    var set = {};
    pool().forEach(function (v) {
      if (state.pays && v.pays !== state.pays) return;
      if (v.region) set[v.region] = 1;
    });
    var l = Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
    fillSelect(el.region, l, 'Toutes les régions', state.region);
  }

  /* ---------- rendu ---------- */
  var LAST_TOKENS = [];

  function highlight(text) {
    if (!text) return '';
    if (!LAST_TOKENS.length) return esc(text);
    var f = fold(text), marks = [];
    LAST_TOKENS.forEach(function (tok) {
      variants(tok).forEach(function (t) {
        if (!t || t.length < 2) return;
        var i = f.indexOf(t);
        while (i >= 0) {
          if (i === 0 || /[^a-z0-9]/.test(f[i - 1])) marks.push([i, i + t.length]);
          i = f.indexOf(t, i + 1);
        }
      });
    });
    if (!marks.length) return esc(text);
    marks.sort(function (a, b) { return a[0] - b[0]; });
    var out = '', pos = 0;
    marks.forEach(function (m) {
      if (m[0] < pos) return;
      out += esc(text.slice(pos, m[0])) + '<mark>' + esc(text.slice(m[0], m[1])) + '</mark>';
      pos = m[1];
    });
    return out + esc(text.slice(pos));
  }

  function card(v) {
    var d = document.createElement('div');
    d.className = 'card ' + v.couleur;

    var titre = '<span class="prod">' + highlight(v.producteur) + '</span>';
    if (v.cuvee) titre += ' <span class="cuvee">' + highlight(v.cuvee) + '</span>';

    var px = '';
    if (v.prix_verre != null) px += '<span class="pv">' + prix(v.prix_verre) + ' / verre</span>';
    if (v.prix_bouteille != null) px = '<span class="pb">' + prix(v.prix_bouteille) + '</span>' + px;
    else px = px.replace('class="pv"', 'class="pb"');

    var l2 = [];
    if (v.appellation) l2.push(highlight(v.appellation));
    if (v.millesime) l2.push('<span class="mill">' + v.millesime + '</span>');

    var tags = [];
    if (v.au_verre) tags.push('<span class="tag verre">au verre</span>');
    if (v.format) tags.push('<span class="tag mag">' + esc(v.format) + '</span>');
    var segs = (v.region || '').split(' · ').filter(Boolean);
    function add(s) {
      if (!s) return;
      var f = fold(s).replace(/[. ]/g, '');
      for (var i = 0; i < segs.length; i++) {
        var g = fold(segs[i]).replace(/[. ]/g, '');
        if (g === f || g.indexOf(f) === 0 || f.indexOf(g) === 0) return;
      }
      segs.push(s);
    }
    add(v.pays);
    (v.origine || '').split(' · ').forEach(add);
    var lieu = segs.join(' · ');

    var l3 = [];
    if (lieu) l3.push('<span>' + highlight(lieu) + '</span>');
    if (v.cepages) l3.push('<span>' + highlight(v.cepages) + '</span>');

    var f = v.fiche, fiche = '';
    if (f) {
      var service = [f.service, f.carafe && !/^non/i.test(f.carafe) ? f.carafe : '', f.boire]
        .filter(Boolean).join(' · ');
      fiche =
        '<div class="deg">' +
          (f.nez ? '<div class="line"><b>Nez</b>' + highlight(f.nez) + '</div>' : '') +
          (f.bouche ? '<div class="line"><b>Bouche</b>' + highlight(f.bouche) + '</div>' : '') +
          (f.finale ? '<div class="line"><b>Finale</b>' + highlight(f.finale) + '</div>' : '') +
          ((f.accords || []).length
            ? '<div class="line accords"><b>Accords</b>' +
              f.accords.map(function (a) { return '<span class="acc">' + highlight(a) + '</span>'; }).join('') +
              '</div>' : '') +
          (service ? '<div class="line service">' + esc(service) + '</div>' : '') +
        '</div>';
    }

    d.innerHTML =
      '<div class="row1">' + titre + '<span class="prices">' + px + '</span></div>' +
      (l2.length ? '<div class="row2">' + l2.join(' · ') + '</div>' : '') +
      '<div class="row3">' + tags.join('') + l3.join('<span style="opacity:.4">•</span>') + '</div>' +
      '<div class="detail">' + fiche +
        (v.notes ? '<div class="line"><b>Vinif.</b>' + highlight(v.notes) + '</div>' : '') +
        (v.agence ? '<div class="line"><b>Agence</b>' + esc(v.agence) + '</div>' : '') +
        (v.code ? '<div class="line"><b>Code SAQ</b>' + esc(v.code) + '</div>' : '') +
        '<div class="line"><b>Carte</b>' + esc(v.label) + '</div>' +
      '</div>';

    d.onclick = function () { d.classList.toggle('open'); };
    return d;
  }

  function trier(list) {
    var t = state.tri;
    if (t === 'prix-') list.sort(function (a, b) { return a.v._prixTri - b.v._prixTri; });
    else if (t === 'prix+') list.sort(function (a, b) { return b.v._prixTri - a.v._prixTri; });
    else if (t === 'prod') list.sort(function (a, b) { return a.v.producteur.localeCompare(b.v.producteur, 'fr'); });
    else if (t === 'mill-' || t === 'mill+') {
      list.sort(function (a, b) {
        var x = +a.v.millesime || 9999, y = +b.v.millesime || 9999;
        return t === 'mill-' ? x - y : y - x;
      });
    } else if (LAST_TOKENS.length) {
      list.sort(function (a, b) { return b.s - a.s || a.v.id - b.v.id; });
    } else {
      list.sort(function (a, b) { return a.v.id - b.v.id; });
    }
    return list;
  }

  var ORDRE = ['bulles', 'blanc', 'orange', 'rosé', 'rouge', 'apéritif'];

  function render() {
    var f = parseQuery(state.q);
    LAST_TOKENS = f.tokens;
    var list = trier(search(f));

    el.count.textContent = list.length + (list.length > 1 ? ' vins' : ' vin');
    el.res.innerHTML = '';

    if (!list.length) {
      el.more.hidden = true;
      el.res.innerHTML =
        '<div class="empty"><div class="big">🍷</div>' +
        '<p>Aucun résultat.</p>' +
        '<p>Essaie un cépage, un producteur, une région ou un prix.</p>' +
        '<div class="hints">' +
        ['chenin', 'nebbiolo', 'bourgogne sous 150', 'bulles au verre', 'nature',
         'québec', 'magnum', 'rouge entre 60 et 90', 'huîtres', 'ris de veau',
         'champignons', 'truffe', 'agneau']
          .map(function (h) { return '<span class="hint">' + h + '</span>'; }).join('') +
        '</div></div>';
      [].forEach.call(el.res.querySelectorAll('.hint'), function (h) {
        h.onclick = function () { el.q.value = h.textContent; onInput(); };
      });
      return;
    }

    var shown = list.slice(0, state.limit);
    var grouped = !LAST_TOKENS.length && state.tri === 'carte' && !state.couleur;

    if (grouped) {
      var by = {};
      shown.forEach(function (r) { (by[r.v.couleur] = by[r.v.couleur] || []).push(r); });
      ORDRE.forEach(function (c) {
        if (!by[c]) return;
        var h = document.createElement('div');
        h.className = 'group';
        h.textContent = c === 'bulles' ? 'Bulles' : c.charAt(0).toUpperCase() + c.slice(1);
        el.res.appendChild(h);
        by[c].forEach(function (r) { el.res.appendChild(card(r.v)); });
      });
    } else {
      shown.forEach(function (r) { el.res.appendChild(card(r.v)); });
    }

    el.more.hidden = list.length <= state.limit;
    el.more.textContent = 'Afficher plus (' + (list.length - state.limit) + ')';
    el.foot.textContent = DATA.meta.total + ' vins · ' + DATA.meta.au_verre + ' au verre'
      + (DATA.meta.fiches ? ' · ' + DATA.meta.fiches + ' fiches de dégustation' : '');
  }

  /* ---------- événements ---------- */
  var timer;
  function onInput() {
    state.q = el.q.value;
    state.limit = 60;
    el.clear.classList.toggle('on', !!state.q);
    clearTimeout(timer);
    timer = setTimeout(render, 90);
  }
  el.q.addEventListener('input', onInput);
  el.q.addEventListener('search', onInput);
  el.clear.onclick = function () { el.q.value = ''; onInput(); el.q.focus(); };
  el.pays.onchange = function () { state.pays = el.pays.value; state.region = ''; state.limit = 60; fillRegions(); render(); };
  el.region.onchange = function () { state.region = el.region.value; state.limit = 60; el.region.classList.toggle('on', !!state.region); render(); };
  el.tri.onchange = function () { state.tri = el.tri.value; state.limit = 60; render(); };
  el.more.onclick = function () { state.limit += 80; render(); };

  window.addEventListener('scroll', function () {
    if (el.more.hidden) return;
    if (window.innerHeight + window.scrollY > document.body.offsetHeight - 400) {
      state.limit += 80; render();
    }
  }, { passive: true });

  buildChips();
  fillRegions();
  render();

  if ('serviceWorker' in navigator && !window.NO_SW) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
