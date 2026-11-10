  constructor(props) {
    super(props);
    this.pageName = 'Search';
    var mode = props.demoState || 'live';
    var q = mode === 'landing' ? '' : (mode === 'no-results' ? 'glas compas' : (this.get('toonwave.search') || props.demoQuery || ''));
    this.state = Object.assign({}, this.state || {}, {
      query: q, draft: q, tab: 'all', genre: 'all', day: 'all', sort: 'relevance', shown: 6,
      net: mode === 'loading' ? 'loading' : (mode === 'error' ? 'error' : 'ready'), moreBusy: false, follows: {},
      toast: '', searchOpen: false, userMenu: false
    });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); if (this._deb) clearTimeout(this._deb); }
  componentDidUpdate(pp) {
    if (pp.demoState !== this.props.demoState || pp.demoQuery !== this.props.demoQuery) {
      var m = this.props.demoState || 'live';
      var q = m === 'landing' ? '' : (m === 'no-results' ? 'glas compas' : (this.props.demoQuery || ''));
      this.setState({ query: q, draft: q, net: m === 'loading' ? 'loading' : (m === 'error' ? 'error' : 'ready'), shown: 6 });
    }
  }
  onSync(key) { if (key === 'toonwave.search') { var q = this.get('toonwave.search') || ''; if (q !== this.state.query) this.run(q, false); } }
  // Commit a query: show a short loading state like a real request would.
  run(q, save) {
    var self = this;
    var t = String(q || '').trim();
    if (save && t) this.toSearchPage(t);
    this.setState({ query: t, draft: q, shown: 6, net: t ? 'loading' : 'ready', tab: 'all' });
    if (t) this.later(450, function () { if (self.state.query === t) self.setState({ net: 'ready' }); });
  }
  recentList() { var v = this.read('toonwave.recent', null); return Array.isArray(v) ? v : ['letters to tuesday', 'Mina Sok', 'romance', 'dragon']; }
  segs(text, q) {
    var t = String(text), out = [], low = t.toLowerCase(), k = String(q || '').toLowerCase().trim();
    if (!k) return [{ t: t, m: false, n: true }];
    var i = 0, j;
    while ((j = low.indexOf(k, i)) >= 0) {
      if (j > i) out.push({ t: t.slice(i, j), m: false, n: true });
      out.push({ t: t.slice(j, j + k.length), m: true, n: false });
      i = j + k.length;
    }
    if (i < t.length) out.push({ t: t.slice(i), m: false, n: true });
    return out;
  }
  dist(a, b) {
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d.push([i]); }
    for (j = 1; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    return d[m][n];
  }
  score(s, k) {
    var t = s.title.toLowerCase();
    if (t.indexOf(k) === 0) return 4;
    if (t.indexOf(k) > 0) return 3;
    if (s.creator.toLowerCase().indexOf(k) >= 0) return 2;
    if (s.genre.toLowerCase().indexOf(k) >= 0) return 1;
    return 0;
  }

  renderVals() {
    var self = this;
    var st = this.state;
    var sv = this.sharedVals('');
    var pool = this.pool();
    var k = st.query.toLowerCase();
    var num = function (x) { var n = parseFloat(x) || 0; return /M/.test(x) ? n * 1e6 : (/K/.test(x) ? n * 1e3 : n); };
    var subs = this.read('toonwave.subs', []) || [];

    var matched = k ? pool.filter(function (s) { return self.score(s, k) > 0; }) : [];
    var filtered = matched.filter(function (s) {
      return (st.genre === 'all' || s.genre === st.genre) && (st.day === 'all' || s.day === st.day);
    });
    var byTab = function (list, tab) { return tab === 'comic' ? list.filter(function (s) { return !s.novel; }) : (tab === 'novel' ? list.filter(function (s) { return s.novel; }) : list); };
    var sorted = byTab(filtered, st.tab).slice().sort(function (a, b) {
      if (st.sort === 'popular') return num(b.likes) - num(a.likes);
      if (st.sort === 'az') return a.title.localeCompare(b.title);
      if (st.sort === 'episodes') return b.episodes - a.episodes;
      return self.score(b, k) - self.score(a, k) || num(b.likes) - num(a.likes);
    });
    var creatorNames = [];
    pool.forEach(function (s) { if (creatorNames.indexOf(s.creator) < 0) creatorNames.push(s.creator); });
    var creatorMatches = k ? creatorNames.filter(function (c) { return c.toLowerCase().indexOf(k) >= 0; }) : [];
    var creators = creatorMatches.map(function (c) {
      var mine = pool.filter(function (s) { return s.creator === c; });
      var on = !!st.follows[c];
      return {
        ini: self.initials(c), segs: self.segs(c, k), on: on, label: on ? 'Following' : 'Follow',
        meta: mine.length + ' series · ' + mine.slice(0, 2).map(function (s) { return s.title; }).join(', '),
        follow: function () { var f = Object.assign({}, st.follows); f[c] = !on; self.setState({ follows: f }); self.say(on ? 'Unfollowed ' + c : 'Following ' + c); }
      };
    });

    var tabCounts = { all: filtered.length + creators.length, comic: byTab(filtered, 'comic').length, novel: byTab(filtered, 'novel').length, creator: creators.length };
    var total = st.tab === 'creator' ? creators.length : sorted.length;
    var none = st.net === 'ready' && k && total === 0 && !(st.tab === 'all' && creators.length);
    var suggest = null;
    if (none) {
      var best = null, bd = 99;
      pool.forEach(function (s) { var d = self.dist(k, s.title.toLowerCase()); if (d < bd) { bd = d; best = s.title; } });
      if (best && bd <= Math.max(2, Math.floor(k.length / 3))) suggest = best;
    }
    var hasFilters = st.genre !== 'all' || st.day !== 'all';
    var genres = ['Drama', 'Fantasy', 'Comedy', 'Action', 'Slice of life', 'Romance', 'Superhero', 'Sci-fi'];
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var popular = pool.slice().sort(function (a, b) { return num(b.likes) - num(a.likes); }).slice(0, 6).map(function (s) { return self.card(s); });
    var unitWord = st.tab === 'novel' ? 'web novels' : (st.tab === 'comic' ? 'comics' : (st.tab === 'creator' ? 'creators' : 'results'));

    return Object.assign(sv, {
      draft: st.draft, hasDraft: st.draft.length > 0,
      onDraft: function (ev) {
        var v = ev.target.value;
        self.setState({ draft: v });
        if (self._deb) clearTimeout(self._deb);
        self._deb = setTimeout(function () { self.run(v, false); }, 300);
      },
      submit: function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); if (self._deb) clearTimeout(self._deb); self.run(st.draft, true); },
      clearDraft: function () { if (self._deb) clearTimeout(self._deb); self.run('', false); },

      isLanding: !k, isResults: !!k,
      hasRecent: this.recentList().length > 0,
      recent: this.recentList().map(function (t) {
        return { t: t, removeAria: 'Remove ' + t + ' from recent searches', go: function () { self.run(t, true); },
          remove: function () { self.put('toonwave.recent', JSON.stringify(self.recentList().filter(function (x) { return x !== t; }))); self.setState({ _sync: Date.now() }); } };
      }),
      clearRecent: function () { self.put('toonwave.recent', '[]'); self.setState({ _sync: Date.now() }); self.say('Recent searches cleared'); },
      trending: ['Glass Compass', 'romance', 'Mina Sok', 'tiny dragon', 'fantasy', 'Letters to Tuesday', 'sci-fi', 'Sunday Sword'].map(function (t, i) { return { no: i + 1, t: t, go: function () { self.run(t, true); } }; }),
      genreLinks: genres.map(function (g) { return { t: g, go: function () { self.run(g, true); } }; }),

      query: st.query,
      resultLine: (total === 1 ? '1 ' + unitWord.replace(/s$/, '') : total + ' ' + unitWord),
      tabs: [['all', 'All'], ['comic', 'Comics'], ['novel', 'Web novels'], ['creator', 'Creators']].map(function (t) {
        return { label: t[1], count: tabCounts[t[0]], on: st.tab === t[0], cls: st.tab === t[0] ? 'on' : '', pick: function () { self.setState({ tab: t[0], shown: 6 }); } };
      }),
      showFilters: st.tab !== 'creator',
      genre: st.genre, day: st.day, sort: st.sort,
      genreOpts: [{ v: 'all', t: 'All genres' }].concat(genres.map(function (g) { return { v: g, t: g }; })),
      dayOpts: [{ v: 'all', t: 'Any update day' }].concat(days.map(function (d) { return { v: d, t: 'Updates ' + self.dayLong(d) }; })),
      sortOpts: [{ v: 'relevance', t: 'Best match' }, { v: 'popular', t: 'Most popular' }, { v: 'episodes', t: 'Most episodes' }, { v: 'az', t: 'A to Z' }],
      onGenre: function (ev) { self.setState({ genre: ev.target.value, shown: 6 }); },
      onDay: function (ev) { self.setState({ day: ev.target.value, shown: 6 }); },
      onSort: function (ev) { self.setState({ sort: ev.target.value }); },
      hasFilters: hasFilters,
      resetFilters: function () { self.setState({ genre: 'all', day: 'all', shown: 6 }); },

      skel: [1, 2, 3, 4],
      isLoading: st.net === 'loading', isError: st.net === 'error',
      retry: function () { self.setState({ net: 'loading' }); self.later(450, function () { self.setState({ net: 'ready' }); }); },
      isNone: !!none,
      noneTitle: hasFilters ? 'No ' + unitWord + ' match these filters' : 'No ' + unitWord + ' for “' + st.query + '”',
      noneText: hasFilters ? 'Try removing a filter, or search for something else.' : 'Check the spelling, try a shorter word, or search by creator or genre.',
      hasSuggest: !!suggest, suggest: { t: suggest || '', go: function () { self.run(suggest, true); } },
      popular: popular,

      isAll: st.tab === 'all',
      showCreators: st.net === 'ready' && creators.length > 0 && (st.tab === 'all' || st.tab === 'creator'),
      creators: st.tab === 'all' ? creators.slice(0, 3) : creators,
      showSeries: st.net === 'ready' && st.tab !== 'creator' && sorted.length > 0,
      results: sorted.slice(0, st.shown).map(function (s) {
        var subbed = subs.indexOf(s.id) >= 0;
        return Object.assign(self.card(s), {
          segs: self.segs(s.title, k), hook: self.hook(s),
          unitCount: s.episodes + (s.novel ? ' chapters' : ' episodes'),
          subbed: subbed, subLabel: subbed ? '✓ Subscribed' : '+ Subscribe', subAria: (subbed ? 'Unsubscribe from ' : 'Subscribe to ') + s.title,
          toggleSub: function () {
            var list = subs.filter(function (x) { return x !== s.id; });
            if (!subbed) list.unshift(s.id);
            self.put('toonwave.subs', JSON.stringify(list));
            self.setState({ _sync: Date.now() });
            self.say(subbed ? 'Removed from your library' : 'Added to your library');
          }
        });
      }),
      hasMore: st.net === 'ready' && st.tab !== 'creator' && sorted.length > st.shown,
      shownCount: Math.min(st.shown, sorted.length), totalCount: sorted.length,
      moreBusy: st.moreBusy,
      more: function () { self.setState({ moreBusy: true }); self.later(450, function () { self.setState({ moreBusy: false, shown: st.shown + 6 }); }); }
    });
  }
