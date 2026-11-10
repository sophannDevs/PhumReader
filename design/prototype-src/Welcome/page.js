  constructor(props) {
    super(props);
    this.pageName = 'Welcome';
    this.goRef = { current: null };
    var step = props.demoStep || 'language';
    var demo = step !== 'language';
    this.state = Object.assign({}, this.state || {}, { step: step, lang: this.lang(), stories: ['km', 'en'], picked: demo ? ['Fantasy', 'Romance', 'Slice of life'] : [], format: 'all', tried: false, denied: false, alerts: false, subs: {}, toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  userName() { var u = this.get('toonwave.user'); return u || 'Sokha Chan'; }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var order = ['language', 'genres', 'alerts', 'done'], ix = order.indexOf(st.step);
    var pool = this.pool();
    var genres = ['Drama', 'Fantasy', 'Comedy', 'Action', 'Slice of life', 'Romance', 'Superhero', 'Sci-fi'];
    var go = function (s) { self.setState({ step: s, tried: false }); try { window.scrollTo(0, 0); } catch (e) {} };
    var next = this.get('toonwave.welcomeNext') || this.href('Home');
    var picks = pool.filter(function (s) { return st.picked.indexOf(s.genre) >= 0 && (st.format === 'all' || (st.format === 'novel') === !!s.novel); })
      .sort(function (a, b) { return self.num(b.views) - self.num(a.views); }).slice(0, 4);
    if (!picks.length) picks = pool.slice().sort(function (a, b) { return self.num(b.views) - self.num(a.views); }).slice(0, 4);
    var subN = Object.keys(st.subs).filter(function (k) { return st.subs[k]; }).length;
    var save = function () {
      self.put('toonwave.prefs', JSON.stringify(st.picked));
      var cur = self.read('toonwave.subs', null); if (!Array.isArray(cur)) cur = [];
      var add = Object.keys(st.subs).filter(function (k) { return st.subs[k] && cur.indexOf(k) < 0; });
      self.put('toonwave.subs', JSON.stringify(add.concat(cur)));
      var set = self.read('toonwave.settings', {}) || {}; set.langs = st.stories; self.put('toonwave.settings', JSON.stringify(set));
      self.put('toonwave.welcomed', '1'); self.put('toonwave.welcomeNext', null);
    };
    var setLang = function (l) { self.put('toonwave.lang', l); self.setState({ lang: l, _langPicked: true }); self.applyLang(); };
    return Object.assign(sv, {
      goRef: this.goRef, nextHref: next,
      firstName: (sv.userName || 'there').split(' ')[0],
      notDone: st.step !== 'done', stepNo: Math.min(ix + 1, 3),
      dots: [0, 1, 2].map(function (i) { return { cls: i <= ix ? 'on' : '' }; }),
      isLang: st.step === 'language', isGenres: st.step === 'genres', isAlerts: st.step === 'alerts', isDone: st.step === 'done',
      isKm: st.lang === 'km', isEn: st.lang === 'en', kmCls: st.lang === 'km' ? 'on' : '', enCls: st.lang === 'en' ? 'on' : '',
      pickKm: function () { setLang('km'); }, pickEn: function () { setLang('en'); },
      storyLangs: [['km', 'ខ្មែរ'], ['en', 'English']].map(function (c) { var on = st.stories.indexOf(c[0]) >= 0; return { label: c[1], on: on, cls: on ? 'on' : '', tick: on ? '✓ ' : '', toggle: function () { var l = on ? st.stories.filter(function (x) { return x !== c[0]; }) : st.stories.concat([c[0]]); if (!l.length) { self.say('Keep at least one language'); return; } self.setState({ stories: l }); } }; }),
      genres: genres.map(function (g, gi) { var on = st.picked.indexOf(g) >= 0; var c = pool[gi * 6 + (gi % 6)]; return { label: g, cover: c.cover, on: on, cls: on ? 'on' : '', toggle: function () { self.setState({ picked: on ? st.picked.filter(function (x) { return x !== g; }) : st.picked.concat([g]), tried: false }); } }; }),
      formats: [['all', 'Both'], ['comic', 'Comics'], ['novel', 'Web novels']].map(function (f) { var on = st.format === f[0]; return { label: f[1], on: on, cls: on ? 'on' : '', pick: function () { self.setState({ format: f[0] }); } }; }),
      genreErr: st.tried && !st.picked.length,
      denied: st.denied,
      allow: function () {
        // Prototype: the browser asks; here we simulate "allowed".
        var ok = true;
        try { if (typeof Notification !== 'undefined' && Notification.permission === 'denied') ok = false; } catch (e) {}
        if (!ok) { self.setState({ denied: true }); return; }
        self.put('toonwave.pushOn', '1'); self.setState({ alerts: true }); self.say('Alerts are on'); go('done');
      },
      notNow: function () { self.setState({ alerts: false }); go('done'); },
      canBack: ix > 0 && st.step !== 'done', back: function () { go(order[ix - 1]); },
      showNext: st.step === 'language' || st.step === 'genres',
      next: function () {
        if (st.step === 'genres' && !st.picked.length) { self.setState({ tried: true }); return; }
        go(order[ix + 1]);
      },
      doneLine: (st.picked.length ? 'Your Home page now starts with ' + st.picked.slice(0, 3).join(', ') + (st.picked.length > 3 ? ' and more' : '') + '. ' : '') + (st.alerts ? 'Alerts are on.' : 'You can turn on alerts later from the bell.'),
      picks: picks.map(function (s) { var on = !!st.subs[s.id]; return { title: s.title, cover: s.cover, meta: s.genre + ' · ' + s.likes + ' likes', subbed: on, subCls: on ? 'btn-secondary' : 'btn-outline', subLabel: on ? '✓ Added' : '+ Add', subAria: (on ? 'Remove ' : 'Add ') + s.title + ' to your library', toggleSub: function () { var n = Object.assign({}, st.subs); n[s.id] = !on; self.setState({ subs: n }); } }; }),
      finishLabel: subN ? 'Start reading · ' + subN + ' in your library' : 'Start reading',
      finish: function () { save(); self.go(self.goRef); },
      skipAll: function () { self.put('toonwave.welcomed', '1'); self.put('toonwave.welcomeNext', null); self.go(self.goRef); }
    });
  }
