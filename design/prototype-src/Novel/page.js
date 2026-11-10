  constructor(props) {
    super(props);
    this.pageName = 'Novel';
    this.goRef = { current: null };
    var set = this.read('toonwave.v2.novel', null) || {};
    // First visit: start from the choices in Settings → Reading.
    var g = this.read('toonwave.settings', null) || {};
    var gSize = { s: 16, m: 18, l: 20, xl: 22 }[g.size];
    var ch = this.startCh();
    if ((props.demoState || '') === 'locked') { var lk = this.episodes().filter(function (e) { return e.fast; })[0]; if (lk) ch = lk.n; }
    var pos = this.read('toonwave.pos.' + this.series().id + '.' + ch, 0) || 0;
    this.state = Object.assign({}, this.state || {}, {
      demoLocked: (props.demoState || '') === 'locked', pct: 0, resumeAt: pos > 0.05 && pos < 0.95 ? pos : 0,
      ch: ch, tocOpen: false, setOpen: false, liked: false, marked: false, dlg: false, busy: false,
      size: set.size || gSize || 18, theme: set.theme || (g.theme === 'dark' ? 'dark' : 'light'), font: set.font || 'sans', wide: set.wide !== false, toast: '', searchOpen: false
    });
  }
  // The reader only shows web novels; a comic in storage falls back to a sample novel.
  series() {
    var s = this.read('toonwave.series', null);
    if (s && s.title && this.isNovel(s)) return Object.assign({}, this.byTitle(s.title) || {}, s);
    return this.byTitle('Letters to Tuesday');
  }
  startCh() {
    var n = parseInt(this.get('toonwave.openEp') || '1', 10) || 1;
    var max = (parseInt(this.series().episodes, 10) || 12) + 3;
    return Math.min(Math.max(1, n), max);
  }
  componentDidMount() {
    this.sharedMount();
    var self = this;
    if (!this.state.demoLocked) this.logRead(this.state.ch);
    this._scroll = function () {
      var h = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var pct = Math.min(1, (window.scrollY || 0) / h);
      if (Math.abs(pct - self.state.pct) < 0.01) return;
      self.setState({ pct: pct });
      var k = 'toonwave.pos.' + self.series().id + '.' + self.state.ch;
      self.put(k, pct > 0.05 && pct < 0.95 ? String(Math.round(pct * 100) / 100) : null);
    };
    this._keys = function (e) {
      var t = e.target && e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      if (e.key === 'ArrowRight') self.goCh(self.state.ch + 1);
      if (e.key === 'ArrowLeft') self.goCh(self.state.ch - 1);
    };
    window.addEventListener('scroll', this._scroll, { passive: true });
    document.addEventListener('keydown', this._keys);
  }
  componentWillUnmount() { this.sharedUnmount(); window.removeEventListener('scroll', this._scroll); document.removeEventListener('keydown', this._keys); }
  componentDidUpdate(pp, ps) {
    var st = this.state;
    if (ps && (ps.size !== st.size || ps.theme !== st.theme || ps.font !== st.font || ps.wide !== st.wide)) this.put('toonwave.v2.novel', JSON.stringify({ size: st.size, theme: st.theme, font: st.font, wide: st.wide }));
  }
  onSync(key) { if (key === 'toonwave.openEp' || key === 'toonwave.series') this.setState({ ch: this.startCh(), tocOpen: false }); }
  logRead(n) { var s = this.series(); if (n > this.lastRead(s.id)) this.put('toonwave.read.' + s.id, String(n)); }
  canRead(e) { if (this.state && this.state.demoLocked && e.n === this.state.ch) return false; return !e.fast || this.unlocked(this.series().id).indexOf(e.n) >= 0; }
  goCh(n) {
    var e = this.episodes()[n - 1];
    if (!e) return;
    if (!this.canRead(e)) { this.setState({ dlg: true, dlgN: n, dlgY: this.layerY(-180), tocOpen: false }); return; }
    this.put('toonwave.openEp', String(n));
    this.logRead(n);
    var pos = this.read('toonwave.pos.' + this.series().id + '.' + n, 0) || 0;
    this.setState({ ch: n, tocOpen: false, liked: false, marked: false, demoLocked: false, pct: 0, resumeAt: pos > 0.05 && pos < 0.95 ? pos : 0 });
    try { window.scrollTo({ top: 0 }); } catch (er) {}
  }
  text() {
    return [
      ['p', 'The letter was there again, tucked under the sugar jar, the way it always was on Tuesdays.'],
      ['p', 'Sreyna saw it before she had even turned on the lights. Pale blue paper, folded twice, her name written in the careful, slightly leaning hand she had started to recognise from across the room. Outside, the street was still waking up — a tuk-tuk idling at the corner, a woman setting out plastic stools for the noodle stall, the river a grey line behind the buildings.'],
      ['p', 'She made herself start the coffee first. Fill the kettle. Grind the beans. Wipe the counter that did not need wiping. Only when the first cup was poured did she slide the letter out and unfold it.'],
      ['q', '“You asked what I’m afraid of. I think it’s this: that one Tuesday I’ll come in and the jar will be empty, and I’ll never know why.”'],
      ['p', 'She read it twice. Then a third time, more slowly, as if the words might change if she let them sit.'],
      ['s', ''],
      ['p', 'By eight o’clock the café was full. Students with their laptops, two monks sheltering from the heat, the old man who ordered iced tea and never drank more than half. Sreyna moved between the tables with the letter folded in her apron pocket, a small, steady weight.'],
      ['p', 'Dara, who ran the bakery next door and had opinions about everything, leaned over the counter. “You’re smiling at the milk frother.”'],
      ['p', '“I’m not.”'],
      ['p', '“You are. Is it the letter person?”'],
      ['p', 'She did not answer, which was an answer. Dara laughed and went back to her croissants, and Sreyna caught herself looking at every customer who came through the door — the man in the grey shirt, the girl with the camera, the delivery rider who always said thank you twice — wondering, for the first time, which of them was paying attention.'],
      ['s', ''],
      ['p', 'That night she wrote back on the last sheet of her good paper. She wrote about the river, and about her grandmother, and about how being afraid of an empty jar meant you had already decided the jar was worth something.'],
      ['p', 'Then, at the bottom, smaller, before she could talk herself out of it:'],
      ['q', '“Next Tuesday, stay for a coffee. I’ll know it’s you.”']
    ].map(function (b) { return { isP: b[0] === 'p', isQ: b[0] === 'q', isS: b[0] === 's', text: b[1] }; });
  }

  renderVals() {
    var self = this;
    var st = this.state;
    var sv = this.sharedVals('');
    var s = this.series();
    var all = this.episodes();
    var ch = all[st.ch - 1] || all[0];
    var price = this.price();
    var coins = this.coins();
    var dn = st.dlgN || st.ch + 1;
    var dE = all[dn - 1];
    var sizes = [14, 16, 18, 20, 22, 24];
    var si = sizes.indexOf(st.size); if (si < 0) si = 2;
    var near = all.slice(Math.max(0, st.ch - 4), Math.min(all.length, st.ch + 5)).map(function (e) {
      return Object.assign({}, e, { locked: !self.canRead(e), cls: e.n === st.ch ? 'on' : '', open: function () { self.goCh(e.n); } });
    });
    return Object.assign(sv, {
      goRef: this.goRef, seriesHref: this.href('Series'),
      s: s, total: all.length,
      ch: Object.assign({}, ch, { kicker: 'Chapter ' + ch.n, title: ch.title.replace(/^Chapter \d+: /, '') }),
      creatorInitials: this.initials(s.creator),
      readTime: '6 min read',
      progress: Math.round(st.pct * 100) + '%',
      isLocked: !this.canRead(ch), isOpen: this.canRead(ch),
      teaser: this.text().filter(function (b) { return b.isP; }).slice(0, 2),
      freeIn: (function () { var d = Math.max(0, (ch.n - (parseInt(s.episodes, 10) || 12)) * 7); return d ? 'in ' + d + ' days' : 'today'; })(),
      lkLogin: !this.canRead(ch) && !sv.loggedIn, lkCanPay: !this.canRead(ch) && sv.loggedIn && coins >= price, lkShort: !this.canRead(ch) && sv.loggedIn && coins < price, lkNeed: Math.max(0, price - coins),
      lkToShop: function () { self.put('toonwave.shopReturn', JSON.stringify({ page: self.href('Novel'), ep: ch.n, title: s.title, done: false, cost: price, unit: 'chapter', count: 1 })); },
      unlockHere: function () {
        self.setState({ busy: true });
        self.later(700, function () {
          self.put('toonwave.unlocked.' + s.id, JSON.stringify(self.unlocked(s.id).concat([ch.n])));
          self.put('toonwave.coins', String(self.coins() - price));
          self.setState({ busy: false, demoLocked: false }); self.logRead(ch.n); self.say('Chapter ' + ch.n + ' unlocked');
        });
      },
      showResume: this.canRead(ch) && st.resumeAt > 0, resumePct: Math.round(st.resumeAt * 100) + '%',
      resume: function () { try { window.scrollTo({ top: st.resumeAt * (document.documentElement.scrollHeight - window.innerHeight) }); } catch (e) {} self.setState({ resumeAt: 0 }); },
      dismissResume: function () { self.put('toonwave.pos.' + s.id + '.' + st.ch, null); self.setState({ resumeAt: 0 }); },
      reportCh: function () { if (!sv.loggedIn) { self.say('Log in to report'); return; } self.openReport('episode', 'chapter', ''); },
      themeCls: st.theme === 'light' ? '' : st.theme,
      fontCls: st.font === 'serif' ? 'serif' : '',
      sizePx: st.size + 'px', lh: st.wide ? '1.85' : '1.6',
      sizeLabel: st.size + ' px', sizePct: Math.round((si + 1) / sizes.length * 100) + '%',
      minSize: si <= 0, maxSize: si >= sizes.length - 1,
      smaller: function () { self.setState({ size: sizes[Math.max(0, si - 1)] }); },
      bigger: function () { self.setState({ size: sizes[Math.min(sizes.length - 1, si + 1)] }); },
      themes: [['light', 'Light'], ['sepia', 'Sepia'], ['dark', 'Dark']].map(function (t) { return { label: t[1], on: st.theme === t[0], cls: st.theme === t[0] ? 'on' : '', pick: function () { self.setState({ theme: t[0] }); } }; }),
      fonts: [['sans', 'Sans'], ['serif', 'Serif']].map(function (t) { return { label: t[1], on: st.font === t[0], cls: st.font === t[0] ? 'on' : '', pick: function () { self.setState({ font: t[0] }); } }; }),
      wide: st.wide, wideCls: st.wide ? 'on' : '',
      toggleWide: function () { self.setState({ wide: !st.wide }); },
      tocOpen: st.tocOpen, setOpen: st.setOpen,
      toggleToc: function () { self.setState({ tocOpen: !st.tocOpen, setOpen: false }); },
      toggleSet: function () { self.setState({ setOpen: !st.setOpen, tocOpen: false }); },
      near: near, price: price,
      blocks: this.text(),
      liked: st.liked, likeCls: st.liked ? 'on' : '', likeLabel: st.liked ? 'Liked' : 'Like',
      like: function () { self.setState({ liked: !st.liked }); },
      markLabel: st.marked ? 'Bookmarked' : 'Bookmark',
      bookmark: function () { self.setState({ marked: !st.marked }); self.say(st.marked ? 'Bookmark removed' : 'Bookmarked chapter ' + ch.n); },
      share: function () { self.say('Link copied'); },
      isFirst: st.ch <= 1, isLast: st.ch >= all.length,
      nextLabel: all[st.ch] && !this.canRead(all[st.ch]) ? 'Next · ' + price + ' coins' : 'Next chapter',
      prev: function () { self.goCh(st.ch - 1); },
      next: function () { self.goCh(st.ch + 1); },
      dlgOn: st.dlg, dlgTop: st.dlgY || '120px', nextN: dn, nextDate: dE ? dE.date : '',
      dlgLogin: st.dlg && !sv.loggedIn, dlgCanPay: st.dlg && sv.loggedIn && coins >= price, dlgShort: st.dlg && sv.loggedIn && coins < price,
      busy: st.busy,
      closeDlg: function () { self.setState({ dlg: false }); },
      toShop: function () { self.put('toonwave.shopReturn', JSON.stringify({ page: self.href('Novel'), ep: dn, title: s.title, done: false })); },
      unlock: function () {
        self.setState({ busy: true });
        self.later(700, function () {
          self.put('toonwave.unlocked.' + s.id, JSON.stringify(self.unlocked(s.id).concat([dn])));
          self.put('toonwave.coins', String(self.coins() - price));
          self.setState({ busy: false, dlg: false });
          self.say('Chapter ' + dn + ' unlocked');
          self.goCh(dn);
        });
      }
    });
  }
