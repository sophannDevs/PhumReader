  // ===== shared V2 helpers (same in every V2 page) =====
  isPhone() { return this.props.device === 'phone'; }
  href(page) { return 'V2' + page + (this.isPhone() ? 'Mobile' : '') + '.dc.html'; }
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  put(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  read(k, fb) { try { var v = JSON.parse(this.get(k) || 'null'); return v == null ? fb : v; } catch (e) { return fb; } }
  coins() { var c = parseInt(this.get('toonwave.coins'), 10); return isNaN(c) ? 3 : c; }
  userName() { return this.get('toonwave.user') || ''; }
  initials(name) {
    var p = String(name || '?').replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/);
    return ((p.length > 1 ? p[0].charAt(0) + p[1].charAt(0) : (p[0] || '?').slice(0, 2)) || '?').toUpperCase();
  }
  novelTitles() { return ['Letters to Tuesday', 'The Last Archivist', 'Ink Witch', 'Paper Moon Hotel', 'The Florist Next Door', 'Moonlit Market', 'Low Orbit Lullaby']; }
  isNovel(s) { return this.novelTitles().indexOf(s && s.title) >= 0; }
  pool() {
    if (this._pool) return this._pool;
    var covers = [
      '/_blob/20601080669acf8ae431d1e3c087947f', '/_blob/8d0c4f9541b9e07d4fd8fb7e0e3bd7d4', '/_blob/07d70e33d965c6d11510ca21795511fa',
      '/_blob/0cc640ea5d2b409a648a84407d70038d', '/_blob/9f239e90f56bf43d48b0fb36dc43e267', '/_blob/7dcec365f36962edfa3d05d3e6b99776',
      '/_blob/c540925cb77336b65a63e034f004446f', '/_blob/cb6dd94cecacc7b9256f91e571265ef2', '/_blob/a8053d9fd88144475af925645c37e2e6',
      '/_blob/d2e211c44b547d83e3a5fb39e2fcedf8', '/_blob/daf506aa7e219d8c36bc936757ea07e9', '/_blob/02eac6b05156d01f88c4919f72b5bbfc',
      '/_blob/e1cf054261ebd7fae9de06616b47d11d', '/_blob/f782290c29217ebdc507087a03aaeca2', '/_blob/bb71948155f283442b50e899c88d07d8',
      '/_blob/de51168d1dc0da7fa1222b3ed42364b9', '/_blob/74e7814c5198560e4eb5df11fc97409e', '/_blob/d16ae40a8dfc690b3ad137840128bb6c',
      '/_blob/89cdb45609d42c1b2f87eb9af148a7f9', '/_blob/4130b324173b6805d1b480c075065d3f', '/_blob/d09cf84c4b69e7c909de0c7ddcbd4403',
      '/_blob/4420116177e800d3ec12f59b2f82c097', '/_blob/66abc5c11673ef012ee49977d01e3057', '/_blob/1a506b0c94faff6c11b440b3f6a88a9a'
    ];
    var genres = ['Drama', 'Fantasy', 'Comedy', 'Action', 'Slice of life', 'Romance', 'Superhero', 'Sci-fi'];
    var titles = [
      ['The Last Archivist', 'Paper Tigers', 'Riverstone Academy', 'Second Chance Bakery', 'The Orchard Pact', 'Heartline'],
      ['Crown of Ash', 'Ink Witch', 'The Quiet Kingdom', 'Glass Compass', "The Cartographer's Daughter", 'Honey Lantern'],
      ['Lunch Break Heroes', 'Tiny Dragon Café', 'Mecha Mornings', 'Little Thunder', 'Ember & Co.', 'Rooftop Astronomy'],
      ['Midnight Courier', 'Salt & Thunder', 'Sunday Sword', 'Iron Lullaby', 'Wolves of Wren Street', 'Static Bloom'],
      ['Moonlit Market', 'Garden of Static', 'Blue Hour Bus Stop', "Grandma's Satellite", 'Pocket Seasons', 'Lantern Alley'],
      ['Silk & Steel', 'Paper Moon Hotel', 'Neon Monsoon', 'Letters to Tuesday', 'The Florist Next Door', 'Summer Index'],
      ['Hollow Signal', 'Ghost of Floor 9', 'Captain Nobody', 'The Ninth Shift', 'Volt & Vale', 'Saturday Vigilante'],
      ['Starfall Delivery', 'Low Orbit Lullaby', 'The Drift Protocol', 'Signal Lost', 'Tin Horizon', 'Kepler Street']
    ];
    var creators = ['Mina Sok', 'J. Harlow', 'Dara Vann', 'Studio Kite', 'Sovan Rith', 'Lena Ortiz', 'Pich & Co.', 'Nao Fujita', 'Chan Sreyleak', 'Owen Blake', 'Kiri Lab', 'Mei Tanaka'];
    var likes = ['3.6M', '2.9M', '2.1M', '1.8M', '1.4M', '982K', '871K', '640K', '512K', '398K', '287K', '164K'];
    var views = ['48M', '31M', '23M', '19M', '14M', '9.8M', '7.2M', '5.1M', '3.9M', '2.4M', '1.6M', '980K'];
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var nov = this.novelTitles();
    var list = [];
    for (var g = 0; g < genres.length; g++) {
      for (var t = 0; t < 6; t++) {
        var i = g * 6 + t;
        list.push({
          id: 'S' + (i + 1), title: titles[g][t], genre: genres[g],
          cover: covers[(i * 7) % covers.length], creator: creators[(i * 5) % creators.length],
          likes: likes[(i * 3) % likes.length], views: views[(i * 5 + g) % views.length],
          episodes: 12 + ((i * 37) % 140), schedule: 'Every ' + days[(i * 3) % 7], day: days[(i * 3) % 7],
          up: (i % 4) === 1, isNew: (i % 3) === 0, novel: nov.indexOf(titles[g][t]) >= 0
        });
      }
    }
    this._pool = list;
    return list;
  }
  byTitle(t) { return this.pool().filter(function (x) { return x.title === t; })[0]; }
  storeSeries(s) {
    this.put('toonwave.series', JSON.stringify({ id: s.id, title: s.title, genre: s.genre, creator: s.creator, cover: s.cover, likes: s.likes, views: s.views, episodes: s.episodes, schedule: s.schedule }));
  }
  readerHref(s) { return this.isNovel(s) ? this.href('Novel') : this.href('Viewer'); }
  // Builds the view data for a series card; clicking stores the series for the Series page.
  card(s) {
    var self = this;
    return Object.assign({}, s, {
      href: this.href('Series'),
      open: function () { self.storeSeries(s); },
      meta: s.creator + ' · ' + s.genre,
      kindLabel: s.novel ? 'Novel' : '',
      isNovelCard: !!s.novel
    });
  }
  sharedMount() {
    var self = this;
    this._down = function (e) { self.lastY = e.clientY; };
    this._store = function (e) {
      if (!e || !e.key || e.key.indexOf('toonwave.') !== 0) return;
      self.setState({ _sync: Date.now() });
      if (self.onSync) self.onSync(e.key);
      if (e.key === 'toonwave.lang') self.applyLang();
    };
    this._key = function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); self.setState({ searchOpen: true, searchQ: '' }); }
      if (e.key === 'Escape') self.setState({ searchOpen: false, userMenu: false, menuOpen: false });
    };
    try {
      document.addEventListener('pointerdown', this._down, true);
      window.addEventListener('storage', this._store);
      document.addEventListener('keydown', this._key);
      this.langWatch();
    } catch (e) {}
  }
  sharedUnmount() {
    try {
      document.removeEventListener('pointerdown', this._down, true);
      window.removeEventListener('storage', this._store);
      document.removeEventListener('keydown', this._key);
      if (this._langObs) this._langObs.disconnect();
    } catch (e) {}
    (this._timers || []).forEach(function (t) { clearTimeout(t); });
  }
  later(ms, fn) { this._timers = this._timers || []; this._timers.push(setTimeout(fn, ms)); }
  say(msg) {
    var self = this;
    if (this._toastT) clearTimeout(this._toastT);
    this.setState({ toast: msg, toastY: this.layerY(-40) });
    this._toastT = setTimeout(function () { self.setState({ toast: '' }); }, 2600);
  }
  // Places dialogs near where the reader clicked, so they show up in view on a tall artboard.
  layerY(offset) { var y = (this.lastY || 220) + (offset || 0); return Math.max(16, y) + 'px'; }
  go(ref) { var a = ref && ref.current; try { if (a && a.click) a.click(); } catch (e) {} }
  toAuth() { this.put('toonwave.returnTo', this.href(this.pageName)); }
  sharedVals(active) {
    var self = this;
    var st = this.state;
    var user = this.userName();
    var q = (st.searchQ || '').trim().toLowerCase();
    var pool = this.pool();
    var hits = (q ? pool.filter(function (x) { return x.title.toLowerCase().indexOf(q) >= 0 || x.creator.toLowerCase().indexOf(q) >= 0 || x.genre.toLowerCase().indexOf(q) >= 0; }) : pool.slice(0, 6)).slice(0, 8);
    var nav = [['Home', 'home'], ['Rankings', 'rank'], ['Genres', 'genres'], ['Web novels', 'novels']];
    return Object.assign(this.rpVals(), {
      phone: this.isPhone(), desktop: !this.isPhone(),
      homeHref: this.href('Home'), shopHref: this.href('Shop'), authHref: this.href('Auth'),
      libraryHref: this.href('Library'), searchPageHref: this.href('Search'),
      searchRef: this.searchRef(),
      settingsHref: this.href('Settings'), notifHref: this.href('Notifications'),
      creatorHref: this.href('Creator'), rankHref: this.href('Rankings'), genresHref: this.href('Genres'),
      earnHref: this.href('Earnings'), uploadHref: this.href('Upload'), createHref: this.href('CreateSeries'), profileHref: this.href('Profile'),
      unread: this.unreadCount(), hasUnread: this.unreadCount() > 0 && !!user,
      bellLabel: 'Notifications' + (this.unreadCount() ? ', ' + this.unreadCount() + ' unread' : ''),
      navItems: nav.map(function (n) {
        var h = { home: self.href('Home'), rank: self.href('Rankings'), genres: self.href('Genres'), novels: self.href('Genres') }[n[1]];
        return { label: n[0], href: h, cls: n[1] === active ? 'on' : '', cur: n[1] === active ? 'page' : 'false',
          go: function () { self.put('toonwave.genreFormat', n[1] === 'novels' ? 'novel' : (n[1] === 'genres' ? 'all' : (self.get('toonwave.genreFormat') || 'all'))); } };
      }),
      coinCount: this.coins(),
      loggedIn: !!user, loggedOut: !user, userName: user || 'Guest', userInitials: this.initials(user),
      userMenu: !!st.userMenu,
      toggleUserMenu: function () { self.setState({ userMenu: !st.userMenu }); },
      toAuth: function () { self.toAuth(); },
      logout: function () { self.put('toonwave.user', null); self.setState({ userMenu: false }); self.say('You’re logged out'); },
      searchOpen: !!st.searchOpen, searchTop: this.layerY(-60),
      openSearch: function () { self.setState({ searchOpen: true, searchQ: '', userMenu: false }); },
      closeSearch: function () { self.setState({ searchOpen: false }); },
      searchQ: st.searchQ || '',
      onSearchQ: function (ev) { self.setState({ searchQ: ev.target.value }); },
      searchKey: function (ev) { if (ev && ev.key === 'Enter' && (st.searchQ || '').trim()) { if (ev.preventDefault) ev.preventDefault(); self.toSearchPage(st.searchQ); self.go(self.searchRef()); } },
      seeAll: function () { self.toSearchPage(st.searchQ); },
      hasQuery: q.length > 0, seeAllLabel: 'See all results for “' + (st.searchQ || '').trim() + '”',
      searchHead: q ? (hits.length ? 'Series' : '') : 'Popular now',
      searchHits: hits.map(function (s) { var c = self.card(s); c.pick = function () { self.storeSeries(s); self.setState({ searchOpen: false }); }; return c; }),
      searchEmpty: q.length > 0 && hits.length === 0,
      helpHref: this.href('Help'), joinHref: this.href('Join'), commentsHref: this.href('Comments'), legalHref: this.href('Legal'), manageHref: this.href('Manage'),
      rpLegal: function () { self.put('toonwave.legalDoc', 'community'); },
      langOther: this.lang() === 'km' ? 'EN' : 'ខ្មែរ', langOtherCode: this.lang() === 'km' ? 'en' : 'km', langAria: this.lang() === 'km' ? 'Switch to English' : 'ប្តូរទៅភាសាខ្មែរ',
      toggleLang: function () { var n = self.lang() === 'km' ? 'en' : 'km'; self.put('toonwave.lang', n); self.setState({ _langPicked: true, _sync: Date.now() }); self.applyLang(); },
      lgTerms: function () { self.put('toonwave.legalDoc', 'terms'); }, lgPrivacy: function () { self.put('toonwave.legalDoc', 'privacy'); },
      lgRefund: function () { self.put('toonwave.legalDoc', 'refund'); }, lgCreator: function () { self.put('toonwave.legalDoc', 'creator'); },
      hpContact: function () { self.put('toonwave.helpContact', '1'); },
      toast: st.toast || '', toastOn: !!st.toast, toastTop: st.toastY || '120px',
      year: '2026',
      mn: {
        home: this.pageName === 'Home' ? 'on' : '', search: this.pageName === 'Search' ? 'on' : '', library: this.pageName === 'Library' ? 'on' : '', coins: this.pageName === 'Shop' ? 'on' : '', me: this.pageName === 'Auth' ? 'on' : '',
        meLabel: user ? 'Me' : 'Log in', meHref: user ? (this.isPhone() ? 'SettingsMobile.dc.html' : 'Settings.dc.html') : this.href('Auth')
      }
    });
  }
  // ---- Khmer: the dictionary (i18n/*.tsv) is built in; text is swapped in the page after each render ----
  lang() { if (this.props && this.props.demoLang === 'km' && !(this.state && this.state._langPicked)) return 'km'; return this.get('toonwave.lang') === 'km' ? 'km' : 'en'; }
  kmDict() { return /*KMDICT*/{}; }
  kmTr(s) {
    var d = this._kmD || (this._kmD = this.kmDict());
    var t = String(s).trim(); if (!t || !/[A-Za-z]/.test(t)) return null;
    if (d[t]) return s.replace(t, d[t]);
    var M = { Jan: 'មករា', Feb: 'កុម្ភៈ', Mar: 'មីនា', Apr: 'មេសា', May: 'ឧសភា', Jun: 'មិថុនា', Jul: 'កក្កដា', Aug: 'សីហា', Sep: 'កញ្ញា', Oct: 'តុលា', Nov: 'វិច្ឆិកា', Dec: 'ធ្នូ' };
    var D = { Mon: 'ច័ន្ទ', Tue: 'អង្គារ', Wed: 'ពុធ', Thu: 'ព្រហស្បតិ៍', Fri: 'សុក្រ', Sat: 'សៅរ៍', Sun: 'អាទិត្យ' };
    var P = [
      [/^(\d[\d,.]*[KM]?) coins?$/, '$1 កាក់'], [/^(\d+) episodes?$/, '$1 ភាគ'], [/^(\d+) chapters?$/, '$1 ជំពូក'], [/^(\d+) series$/, '$1 រឿង'], [/^(\d+) articles?$/, '$1 អត្ថបទ'],
      [/^Episode (\d+)$/, 'ភាគ $1'], [/^Chapter (\d+)$/, 'ជំពូក $1'], [/^Ep\. (\d+)$/, 'ភាគ $1'], [/^Episode (\d+): (.+)$/, 'ភាគ $1៖ $2'], [/^Chapter (\d+): (.+)$/, 'ជំពូក $1៖ $2'],
      [/^Read episode (\d+)$/, 'អានភាគ $1'], [/^Continue episode (\d+)$/, 'បន្តអានភាគ $1'], [/^Read Ep\. (\d+)$/, 'អានភាគ $1'], [/^Continue Ep\. (\d+)$/, 'បន្តភាគ $1'], [/^Read chapter (\d+)$/, 'អានជំពូក $1'], [/^Read Ch\. (\d+)$/, 'អានជំពូក $1'],
      [/^Free in (\d+) days$/, 'ឥតគិតថ្លៃក្នុង $1 ថ្ងៃទៀត'], [/^(\d+) unread$/, 'មិនទាន់អាន $1'], [/^Showing (\d+) of (\d+)$/, 'បង្ហាញ $1 ក្នុងចំណោម $2'],
      [/^(\d+) results?$/, 'លទ្ធផល $1'], [/^Show (\d+) more$/, 'បង្ហាញ $1 ទៀត'], [/^Unlock for (\d+) coins$/, 'ដោះសោដោយ $1 កាក់'], [/^(\d+) free$/, 'ឥតគិតថ្លៃ $1'],
      [/^(\d+) Fast Pass$/, 'Fast Pass $1'], [/^(\d+) reports?$/, 'របាយការណ៍ $1'], [/^Updates (\w+)$/, null], [/^You get (\d+)$/, 'ទទួលបាន $1'], [/^≈ (\d+) episodes$/, '≈ $1 ភាគ'],
      [/^(\d+)h ago$/, '$1 ម៉ោងមុន'], [/^(\d+) min read$/, 'អាន $1 នាទី'], [/^Balance after: (\d+) coins$/, 'សមតុល្យក្រោយ៖ $1 កាក់'], [/^Get coins · you need (\d+) more$/, 'ទិញកាក់ · ត្រូវការ $1 ទៀត']
    ];
    for (var i = 0; i < P.length; i++) { if (P[i][1] && P[i][0].test(t)) return s.replace(t, t.replace(P[i][0], P[i][1])); }
    var m = t.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})$/);
    if (m) return s.replace(t, 'ថ្ងៃ' + D[m[1]] + ' ' + m[3] + ' ' + M[m[2]]);
    m = t.match(/^Released (.+)$/); if (m) { var r1 = this.kmTr(m[1]); return s.replace(t, 'ចេញផ្សាយ ' + (r1 || m[1])); }
    m = t.match(/^free for everyone (.+)$/); if (m) { var r2 = this.kmTr(m[1]); return s.replace(t, 'ឥតគិតថ្លៃសម្រាប់គ្រប់គ្នា ' + (r2 || m[1])); }
    m = t.match(/^End of (Episode|Chapter|chapter) (\d+)$/); if (m) return s.replace(t, 'ចប់' + (m[1] === 'Episode' ? 'ភាគ ' : 'ជំពូក ') + m[2]);
    m = t.match(/^(\d+) series in (.+)$/); if (m) return s.replace(t, m[1] + ' រឿងក្នុង' + (d[m[2]] || m[2]));
    m = t.match(/^\+(\d+) bonus \((\d+)%\)$/); if (m) return s.replace(t, '+' + m[1] + ' កាក់ថែម (' + m[2] + '%)');
    m = t.match(/^(\d+) coin pack$/); if (m) return s.replace(t, 'កញ្ចប់ ' + m[1] + ' កាក់');
    m = t.match(/^≈ (\d+) Fast Pass episodes?$/); if (m) return s.replace(t, '≈ ' + m[1] + ' ភាគ Fast Pass');
    m = t.match(/^Schedule for (.+)$/); if (m) { var r3 = this.kmTr(m[1]); return s.replace(t, 'កំណត់ពេលសម្រាប់ ' + (r3 || m[1])); }
    m = t.match(/^Goes live (.+)$/); if (m) { var r4 = this.kmTr(m[1]); return s.replace(t, 'ចេញផ្សាយ ' + (r4 || m[1])); }
    m = t.match(/^(\d+):(\d+) (AM|PM)$/); if (m) return s.replace(t, m[1] + ':' + m[2] + ' ' + (m[3] === 'AM' ? 'ព្រឹក' : 'ល្ងាច'));
    m = t.match(/^(\S+) likes$/); if (m) return s.replace(t, m[1] + ' ចូលចិត្ត');
    m = t.match(/^(\d+)% read$/); if (m) return s.replace(t, 'អានបាន ' + m[1] + '%');
    m = t.match(/^Unlock all (\d+)$/); if (m) return s.replace(t, 'ដោះសោទាំង ' + m[1]);
    m = t.match(/^new every (Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/); if (m) return s.replace(t, 'ថ្មីរៀងរាល់ថ្ងៃ' + D[m[1]]);
    m = t.match(/^(\d+) series update on (\w+) \(today\)\.$/); if (m) return s.replace(t, 'មាន ' + m[1] + ' រឿងបង្ហោះនៅ' + (d[m[2]] || m[2]) + ' (ថ្ងៃនេះ)។');
    m = t.match(/^(\d+) episodes free to read$/); if (m) return s.replace(t, 'អានឥតគិតថ្លៃ ' + m[1] + ' ភាគ');
    m = t.match(/^(\d+) more with Fast Pass$/); if (m) return s.replace(t, 'និង ' + m[1] + ' ភាគទៀតជាមួយ Fast Pass');
    m = t.match(/^Next free: (Episode|Chapter) (\d+) on (\w{3}) (\d+) \((in (\d+) days|today|tomorrow)\)\.$/);
    if (m) return s.replace(t, 'ឥតគិតថ្លៃបន្ទាប់៖ ' + (m[1] === 'Episode' ? 'ភាគ ' : 'ជំពូក ') + m[2] + ' នៅ ' + m[4] + ' ' + M[m[3]] + (m[6] ? ' (ក្នុង ' + m[6] + ' ថ្ងៃទៀត)។' : '។'));
    m = t.match(/^Every (Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/); if (m) return s.replace(t, 'រៀងរាល់ថ្ងៃ' + D[m[1]]);
    m = t.match(/^Updates (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/); if (m) return s.replace(t, 'បង្ហោះ' + d[m[1]]);
    m = t.match(/^(Free )?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})(, (\d{4}))?$/);
    if (m) return s.replace(t, (m[1] ? 'ឥតគិតថ្លៃ ' : '') + m[3] + ' ' + M[m[2]] + (m[5] ? ' ' + m[5] : ''));
    if (t.indexOf(' · ') > 0) { var self = this, ch = false; var out = t.split(' · ').map(function (p) { var k = self.kmTr(p); if (k && k !== p) { ch = true; return k; } return p; }); if (ch) return s.replace(t, out.join(' · ')); }
    return null;
  }
  // Swaps English text for Khmer (and back) in the rendered page. React re-renders put English back; the observer re-translates.
  applyLang() {
    if (typeof document === 'undefined' || !document.querySelector) return;
    var root = document.querySelector('.v2'); if (!root) return;
    var km = this.lang() === 'km', self = this;
    try { root.classList.toggle('km', km); document.documentElement.lang = km ? 'km' : 'en'; } catch (e) {}
    var skip = function (el) {
      if (!el || !el.closest) return false;
      if (el.closest('code,[data-no-tr],script,style')) return true;
      var k = el.closest('[lang="km"]');
      return !!k && k !== document.documentElement && root.contains(k) && k !== root;
    };
    var w = document.createTreeWalker(root, 4), n;
    while ((n = w.nextNode())) {
      if (skip(n.parentElement)) continue;
      if (km) { if (n.__km !== n.nodeValue) { var k = self.kmTr(n.nodeValue); if (k && k !== n.nodeValue) { n.__en = n.nodeValue; n.__km = k; n.nodeValue = k; } } }
      else if (n.__en && n.nodeValue === n.__km) { n.nodeValue = n.__en; n.__km = null; }
    }
    ['placeholder', 'aria-label', 'title'].forEach(function (a) {
      root.querySelectorAll('[' + a + ']').forEach(function (el) {
        if (skip(el)) return;
        var v = el.getAttribute(a), key = 'data-en-' + a;
        if (km) { if (el.getAttribute('data-km-' + a) === v) return; var k = self.kmTr(v); if (k && k !== v) { el.setAttribute(key, v); el.setAttribute('data-km-' + a, k); el.setAttribute(a, k); } }
        else if (el.getAttribute(key) && el.getAttribute('data-km-' + a) === v) { el.setAttribute(a, el.getAttribute(key)); el.removeAttribute('data-km-' + a); }
      });
    });
  }
  langWatch() {
    var self = this;
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.querySelector) return;
    var root = document.querySelector('.v2'); if (!root) return;
    this._langObs = new MutationObserver(function () { if (self.lang() !== 'km' || self._langQ) return; self._langQ = true; setTimeout(function () { self._langQ = false; self.applyLang(); }, 0); });
    this._langObs.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
    this.applyLang();
  }
  // ---- Report and block (dialog lives in layers.html, so every page can open it) ----
  blocked() { var b = this.read('toonwave.blocked', []); return Array.isArray(b) ? b : []; }
  isBlocked(name) { return this.blocked().indexOf(name) >= 0; }
  openReport(kind, target, who) { this.setState({ rp: { step: 'reason', kind: kind, target: target, who: who || '', reason: '', details: '', tried: false, alsoBlock: false }, rpY: this.layerY(-220) }); }
  openBlock(who) { this.setState({ rp: { step: 'block', kind: 'user', target: who, who: who }, rpY: this.layerY(-160) }); }
  // Prototype boards can open the dialog straight away with props.demoReport.
  rpState() {
    var st = this.state || {};
    if (st.rp !== undefined) return st.rp;
    var d = (this.props && this.props.demoReport) || 'none';
    if (d === 'report') return { step: 'reason', kind: 'comment', target: 'comment by Vibol K.', who: 'Vibol K.', reason: 'spoiler', details: '', tried: false, alsoBlock: false };
    if (d === 'report-sent') return { step: 'sent', kind: 'comment', target: 'comment by Vibol K.', who: 'Vibol K.', reason: 'spoiler', caseId: 'R-20481', alsoBlock: false };
    if (d === 'block') return { step: 'block', kind: 'user', target: 'Vibol K.', who: 'Vibol K.' };
    return null;
  }
  rpReasons(kind) {
    var common = [['spam', 'Spam or scam', 'Ads, fake links, repeated posts'], ['harass', 'Harassment or bullying', 'Insults or attacks on a person'], ['hate', 'Hate speech', 'Attacks on a group of people'], ['sexual', 'Sexual content', 'Nudity or sexual content that isn’t allowed'], ['violence', 'Violence or threats', 'Threats, or content that encourages harm']];
    if (kind === 'comment') return common.concat([['spoiler', 'Spoilers without warning', 'Reveals later episodes'], ['other', 'Something else', 'Tell us what’s wrong']]);
    if (kind === 'user') return [['spam', 'Spam or fake account', 'Bots, scams or fake profiles'], ['impersonate', 'Pretending to be someone', 'Uses another creator’s name or work'], ['harass', 'Harassment or bullying', 'Targets me or someone else'], ['other', 'Something else', 'Tell us what’s wrong']];
    return [['copyright', 'Stolen or copied work', 'This is someone else’s comic or story']].concat(common).concat([['rating', 'Wrong age rating', 'Should be 16+ or 18+'], ['other', 'Something else', 'Tell us what’s wrong']]);
  }
  rpVals() {
    var self = this, rp = this.rpState();
    if (!rp) return { rpOn: false, rpReason: false, rpSent: false, rpBlock: false, rp: { target: '', who: '', caseId: '' }, rpOpts: [], rpNeedsDetails: false, rpDetailsBad: false, rpDetailsBadCls: '', rpErr: false, rpErrMsg: '', rpDetailsLabel: '', rpDetailsPh: '', rpCanBlock: false, rpBlockCls: '', rpTitle: '', rpTop: '120px', rpDetails: '', rpCount: 0 };
    var set = function (o) { self.setState({ rp: Object.assign({}, rp, o) }); };
    var needs = rp.reason === 'other' || rp.reason === 'copyright' || rp.reason === 'impersonate';
    var detailsBad = needs && (rp.details || '').trim().length < 10;
    var close = function () { self.setState({ rp: null }); };
    return {
      rpOn: true, rpReason: rp.step === 'reason', rpSent: rp.step === 'sent', rpBlock: rp.step === 'block', rp: rp, rpTop: (this.state && this.state.rpY) || '120px',
      rpTitle: { comment: 'Report comment', series: 'Report series', episode: 'Report episode', user: 'Report account' }[rp.kind] || 'Report',
      rpOpts: rp.step === 'reason' ? this.rpReasons(rp.kind).map(function (r) { return { label: r[1], desc: r[2], on: rp.reason === r[0], cls: rp.reason === r[0] ? 'on' : '', pick: function () { set({ reason: r[0] }); } }; }) : [],
      rpNeedsDetails: needs, rpDetails: rp.details || '', rpCount: (rp.details || '').length,
      rpDetailsLabel: rp.reason === 'copyright' ? 'Link to the original work and who made it' : rp.reason === 'impersonate' ? 'Who are they pretending to be?' : 'What’s wrong?',
      rpDetailsPh: rp.reason === 'copyright' ? 'e.g. https://… original by @artist' : 'A short description helps us review faster',
      rpDetailsBad: !!rp.tried && detailsBad, rpDetailsBadCls: rp.tried && detailsBad ? 'bad' : '',
      rpErr: !!rp.tried && (!rp.reason || detailsBad), rpErrMsg: !rp.reason ? 'Choose a reason.' : 'Add a few more details (at least 10 characters).',
      rpOnDetails: function (ev) { set({ details: ev.target.value.slice(0, 500) }); },
      rpSubmit: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (!rp.reason || detailsBad) { set({ tried: true }); return; }
        var list = self.read('toonwave.reports', []) || [];
        var id = 'R-' + (20480 + list.length + 1);
        list.unshift({ id: id, kind: rp.kind, target: rp.target, reason: rp.reason, at: Date.now(), status: 'In review' });
        self.put('toonwave.reports', JSON.stringify(list.slice(0, 20)));
        set({ step: 'sent', caseId: id });
      },
      rpCanBlock: !!rp.who && !this.isBlocked(rp.who), rpBlockCls: rp.alsoBlock ? 'on' : '',
      rpToggleBlock: function () { set({ alsoBlock: !rp.alsoBlock }); },
      rpDone: function () {
        if (rp.alsoBlock && rp.who) { self.put('toonwave.blocked', JSON.stringify(self.blocked().concat([rp.who]))); self.say(rp.who + ' is blocked'); }
        close();
      },
      rpConfirmBlock: function () {
        if (!self.isBlocked(rp.who)) self.put('toonwave.blocked', JSON.stringify(self.blocked().concat([rp.who])));
        close(); self.say(rp.who + ' is blocked');
      },
      rpClose: close
    };
  }
  // ---- shared by Rankings / Genres / Notifications / Creator pages ----
  num(v) { var m = String(v).match(/([\d.]+)\s*([KM]?)/); if (!m) return 0; return parseFloat(m[1]) * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1); }
  fmt(n) { return n >= 1e6 ? (Math.round(n / 1e5) / 10) + 'M' : n >= 1e3 ? (Math.round(n / 100) / 10) + 'K' : String(Math.round(n)); }
  notifs() {
    var base = [
      { id: 'n1', kind: 'update', when: 'Today', time: '9:12 AM', title: 'Glass Compass · Episode 65 is out', body: 'New episode from Owen Blake. 1 more is waiting in Fast Pass.', series: 'Glass Compass' },
      { id: 'n2', kind: 'comment', when: 'Today', time: '8:40 AM', title: 'Linh T. replied to your comment', body: '“Same! The rain panels were beautiful.”', series: 'Glass Compass' },
      { id: 'n3', kind: 'coins', when: 'Today', time: '7:05 AM', title: 'Payment received · +33 coins', body: 'Order TW-48213377 paid with KHQR. Your balance was updated.', series: '' },
      { id: 'n4', kind: 'update', when: 'This week', time: 'Mon', title: 'Midnight Courier · Episode 41 is out', body: 'Your subscribed series has a new episode.', series: 'Midnight Courier' },
      { id: 'n5', kind: 'update', when: 'This week', time: 'Sun', title: 'Letters to Tuesday · Chapter 88', body: 'A new chapter is ready to read.', series: 'Letters to Tuesday' },
      { id: 'n6', kind: 'system', when: 'This week', time: 'Sat', title: 'Fast Pass episode is now free', body: 'Glass Compass Episode 64 is free for everyone.', series: 'Glass Compass' },
      { id: 'n7', kind: 'comment', when: 'Earlier', time: 'Oct 28', title: '12 people liked your comment', body: 'On Midnight Courier · Episode 39', series: 'Midnight Courier' },
      { id: 'n8', kind: 'system', when: 'Earlier', time: 'Oct 20', title: 'Welcome to PhumiReader', body: 'Subscribe to series to get new-episode alerts here.', series: '' }
    ];
    var gone = this.read('toonwave.notifGone', []) || [];
    return base.filter(function (n) { return gone.indexOf(n.id) < 0; });
  }
  notifRead() { var r = this.read('toonwave.notifRead', null); return Array.isArray(r) ? r : ['n4', 'n5', 'n6', 'n7', 'n8']; }
  unreadCount() { var r = this.notifRead(); return this.notifs().filter(function (n) { return r.indexOf(n.id) < 0; }).length; }
  // The signed-in creator's own series (prototype data, kept in localStorage).
  myWorks() {
    var c = this.pool().map(function (x) { return x.cover; });
    var d = [
      { id: 'C1', title: 'River Lantern', format: 'comic', genre: 'Fantasy', status: 'published', eps: 24, day: 'Sat', cover: c[3], views: '182K', subs: '12.4K', likes: '24K', summary: 'A ferry girl on the Mekong carries a lantern that shows the way home to lost spirits.' },
      { id: 'C2', title: 'Night Market Detectives', format: 'comic', genre: 'Comedy', status: 'review', eps: 3, day: 'Wed', cover: c[9], views: '0', subs: '0', likes: '0', summary: 'Two noodle-stall cousins solve tiny mysteries at the Russian Market.' },
      { id: 'C3', title: 'Monsoon Letters', format: 'novel', genre: 'Romance', status: 'draft', eps: 0, day: 'Sun', cover: c[15], views: '0', subs: '0', likes: '0', summary: '' }
    ];
    var s = this.read('toonwave.myWorks', null);
    return Array.isArray(s) ? s : d;
  }
  creatorNav(active) {
    var self = this;
    return [['Creator', 'Dashboard', 'grid'], ['CreateSeries', 'New series', 'plus'], ['Upload', 'Upload episode', 'external'], ['Earnings', 'Earnings', 'coins'], ['Profile', 'Public profile', 'user']].map(function (x) {
      return { href: self.href(x[0]), label: x[1], cls: x[0] === active ? 'on' : '', cur: x[0] === active ? 'page' : 'false' };
    });
  }
  searchRef() { this._searchRef = this._searchRef || { current: null }; return this._searchRef; }
  // Saves the query (and recent searches) for the Search page, which reads them on open.
  toSearchPage(q) {
    var t = String(q || '').trim();
    if (!t) return;
    this.put('toonwave.search', t);
    var list = this.read('toonwave.recent', []);
    if (!Array.isArray(list)) list = [];
    list = [t].concat(list.filter(function (x) { return String(x).toLowerCase() !== t.toLowerCase(); })).slice(0, 8);
    this.put('toonwave.recent', JSON.stringify(list));
    this.setState({ searchOpen: false });
  }
  dayLong(d) { return { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' }[d] || d; }
  // A one-line hook per series so covers that look alike can still be told apart.
  hook(s) {
    var h = {
      'Glass Compass': 'A compass that points to whatever you have lost.', 'Ink Witch': 'She can rewrite one page of anyone’s life. Once.',
      'The Quiet Kingdom': 'A kingdom where nobody may speak above a whisper.', 'Crown of Ash': 'The heir burned the crown. The crown wants her back.',
      'Tiny Dragon Café': 'A tiny dragon runs the café. Badly.', 'Lunch Break Heroes': 'Office heroes who only save the day at lunch.',
      'Mecha Mornings': 'A giant robot that only works before 9 a.m.', 'Midnight Courier': 'A courier who never misses a delivery takes one job too many.',
      'Sunday Sword': 'Swords on Sunday, school on Monday.', 'Wolves of Wren Street': 'Wolves run the streets of Wren. Not for long.',
      'Second Chance Bakery': 'Three siblings, one bakery and a summer to save it.', 'Moonlit Market': 'Night-market stalls, and the stories behind them.',
      'Blue Hour Bus Stop': 'Strangers who meet at the same bus stop every evening.', "Grandma's Satellite": 'Grandma built a satellite. Now it is talking back.',
      'Pocket Seasons': 'Four seasons in one small apartment.', 'Letters to Tuesday': 'Letters on a café counter, every Tuesday.',
      'The Florist Next Door': 'The florist next door keeps sending the wrong flowers.', 'Paper Moon Hotel': 'A hotel where every guest is hiding something.',
      'The Last Archivist': 'The last keeper of a library the city forgot.', 'Low Orbit Lullaby': 'A night-shift astronaut sings to a sleeping planet.',
      'Starfall Delivery': 'A delivery crew finds a signal that should not exist.', 'Kepler Street': 'One street, 400 years from now.',
      'Captain Nobody': 'Captain Nobody would like some credit, please.', 'The Ninth Shift': 'The ninth shift is the one nobody talks about.',
      'Saturday Vigilante': 'A part-time hero with a full-time rent problem.', 'Ghost of Floor 9': 'The office ghost just wants a promotion.'
    };
    return h[s.title] || ('An ongoing ' + s.genre.toLowerCase() + ' story, new every ' + this.dayLong(s.day) + '.');
  }
  // ----- series + episodes (Series, Viewer, Novel) -----
  series() {
    var s = this.read('toonwave.series', null);
    if (s && s.id && s.title) return Object.assign({}, this.byTitle(s.title) || {}, s);
    return this.byTitle('Glass Compass');
  }
  price() { return 5; }
  unlocked(id) { var v = this.read('toonwave.unlocked.' + id, []); return Array.isArray(v) ? v : []; }
  lastRead(id) { var v = this.read('toonwave.read.' + id, 0); if (Array.isArray(v)) return Math.max.apply(null, [0].concat(v)); return parseInt(v, 10) || 0; }
  episodes() {
    var s = this.series();
    var free = parseInt(s.episodes, 10) || 48;
    var nov = this.isNovel(s);
    var key = s.id + ':' + free + ':' + nov;
    if (this._epsKey === key) return this._eps;
    var names = ['The Third Letter', 'Flour and Ink', 'The Blue Bicycle', 'A Reply on the Counter', 'Rain on the Riverside', 'The Tailor’s Alibi', 'Closing Time', 'What the Pigeons Saw', 'A Name in Pencil', 'The Empty Envelope', 'Tuesday Again', 'Lights Off'];
    var covers = this.pool().map(function (x) { return x.cover; });
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var base = Date.UTC(2026, 10, 5);
    var list = [];
    for (var n = 1; n <= free + 3; n++) {
      var d = new Date(base + (n - free) * 7 * 86400000);
      var likes = Math.max(900, 52000 - (free - n) * 90 + ((n * 733) % 4000) - (n > free ? 30000 : 0));
      list.push({
        n: n, title: nov ? 'Chapter ' + n + ': ' + names[n % names.length] : (n >= 80 ? '(S2) Episode ' + n : 'Episode ' + n),
        date: months[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(),
        likes: likes >= 1000 ? (Math.round(likes / 100) / 10) + 'K' : String(likes),
        thumb: covers[(n * 5) % covers.length], fast: n > free, isUp: n === free
      });
    }
    this._eps = list; this._epsKey = key;
    return list;
  }
