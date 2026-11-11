  constructor(props) {
    super(props);
    this.pageName = 'Viewer';
    this.goRef = { current: null };
    var ds = props.demoState || 'reading';
    var ep = this.startEp();
    if (ds === 'locked') { var lk = this.episodes().filter(function (e) { return e.fast; })[0]; if (lk) ep = lk.n; }
    var pos = this.read('toonwave.pos.' + this.series().id + '.' + ep, 0) || 0;
    this.state = Object.assign({}, this.state || {}, {
      ep: ep, listOpen: false, liked: false, draft: '', mine: [], dlg: false, busy: false, toast: '', searchOpen: false,
      setOpen: ds === 'settings', page: 0, pct: 0, resumeAt: pos > 0.05 && pos < 0.95 ? pos : 0, demoMode: ds === 'page-mode' ? 'page' : '',
      demoLocked: ds === 'locked', counting: ds === 'end', countdown: 5, showHidden: false
    });
  }
  prefs() {
    var s = this.read('toonwave.settings', {}) || {};
    var bg = this.get('toonwave.readerBg') || (s.theme === 'light' ? 'light' : 'dark');
    return { mode: this.state && this.state.demoMode ? this.state.demoMode : (s.mode === 'page' ? 'page' : 'scroll'), bg: bg, width: this.get('toonwave.readerWidth') || 'fit', autoNext: s.autoNext !== false, saveData: !!s.saveData };
  }
  savePref(k, v) { var s = this.read('toonwave.settings', {}) || {}; s[k] = v; this.put('toonwave.settings', JSON.stringify(s)); this.setState({ _sync: Date.now() }); }
  startEp() {
    var n = parseInt(this.get('toonwave.openEp') || '1', 10) || 1;
    var max = (parseInt(this.series().episodes, 10) || 48) + 3;
    return Math.min(Math.max(1, n), max);
  }
  componentDidMount() {
    this.sharedMount();
    var self = this;
    if (this.canRead(this.episodes()[this.state.ep - 1] || {})) this.logRead(this.state.ep);
    this._scroll = function () {
      var h = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      var pct = Math.min(1, (window.scrollY || 0) / h);
      if (Math.abs(pct - self.state.pct) < 0.01) return;
      self.setState({ pct: pct });
      var id = self.series().id;
      if (pct > 0.05 && pct < 0.95) self.put('toonwave.pos.' + id + '.' + self.state.ep, String(Math.round(pct * 100) / 100));
      if (pct >= 0.95) self.put('toonwave.pos.' + id + '.' + self.state.ep, null);
      if (pct >= 0.97) self.maybeAutoNext();
    };
    this._keys = function (e) {
      var t = e.target && e.target.tagName;
      if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var f = e.key === 'ArrowRight';
      if (self.prefs().mode === 'page') { if (f) self.pageNext(); else self.setState({ page: Math.max(0, self.state.page - 1) }); }
      else self.goEp(self.state.ep + (f ? 1 : -1));
    };
    window.addEventListener('scroll', this._scroll, { passive: true });
    document.addEventListener('keydown', this._keys);
    if (this.state.counting) this.tick();
  }
  componentWillUnmount() { this.sharedUnmount(); window.removeEventListener('scroll', this._scroll); document.removeEventListener('keydown', this._keys); this._dead = true; }
  maybeAutoNext() {
    var all = this.episodes(), nx = all[this.state.ep];
    if (!this.prefs().autoNext || !nx || !this.canRead(nx) || this.state.counting || this._autoDone === this.state.ep) return;
    this._autoDone = this.state.ep;
    this.setState({ counting: true, countdown: 5 }); this.tick();
  }
  tick() {
    var self = this;
    this.later(1000, function () {
      if (self._dead || !self.state.counting) return;
      if (self.state.countdown <= 1) { self.setState({ counting: false }); self.goEp(self.state.ep + 1); return; }
      self.setState({ countdown: self.state.countdown - 1 }); self.tick();
    });
  }
  pageNext() {
    var n = this.panels().length;
    if (this.state.page < n - 1) { this.setState({ page: this.state.page + 1 }); return; }
    this.goEp(this.state.ep + 1);
  }
  onSync(key) { if (key === 'toonwave.openEp' || key === 'toonwave.series') { var n = this.startEp(); this.setState({ ep: n, listOpen: false, liked: false }); this.logRead(n); } }
  logRead(n) {
    var s = this.series();
    if (n > this.lastRead(s.id)) this.put('toonwave.read.' + s.id, String(n));
  }
  canRead(e) { if (this.state && this.state.demoLocked && e.n === this.state.ep) return false; return !e.fast || this.unlocked(this.series().id).indexOf(e.n) >= 0; }
  goEp(n) {
    var e = this.episodes()[n - 1];
    if (!e) return;
    if (!this.canRead(e)) { this.setState({ dlg: true, dlgY: this.layerY(-180), listOpen: false }); return; }
    this.put('toonwave.openEp', String(n));
    this.logRead(n);
    var pos = this.read('toonwave.pos.' + this.series().id + '.' + n, 0) || 0;
    this.setState({ ep: n, listOpen: false, liked: false, page: 0, pct: 0, counting: false, demoLocked: false, resumeAt: pos > 0.05 && pos < 0.95 ? pos : 0 });
    try { window.scrollTo({ top: 0 }); } catch (er) {}
  }
  panels() {
    var p = [['ddeff94b48d22dc29b42285cab341132', 760], ['ad16d5cb0fefa16e2a03e65f485a404f', 520], ['f1dd75748294ba753968b07d2a958882', 600],
      ['b47988140ccfed188a8c193f98dbbfc0', 680], ['037692b42c7b6b6a195802d7dc920999', 440], ['10826c6c0de500187328e25735c19e6a', 720],
      ['95baea598c6b1d1aed8cd911791786a3', 520], ['75e17f7c30f31b1973b0823dafe8989b', 600], ['5ba5509f45d6edd0c1327aad164dfdf6', 560]];
    return p.map(function (x, i) { return { src: '/_blob/' + x[0], h: x[1], alt: 'Panel ' + (i + 1) }; });
  }

  renderVals() {
    var self = this;
    var st = this.state;
    var sv = this.sharedVals('');
    var s = this.series();
    var all = this.episodes();
    var ep = all[st.ep - 1] || all[0];
    var nextE = all[st.ep] || null;
    var price = this.price();
    var coins = this.coins();
    var subs = this.read('toonwave.subs', []) || [];
    var subbed = subs.indexOf(s.id) >= 0;
    var nextLocked = !!nextE && !this.canRead(nextE);
    var pf = this.prefs();
    var locked = !this.canRead(ep);
    var panels = this.panels();
    var pg = Math.min(st.page, panels.length - 1);
    var unl = this.unlocked(s.id);
    var fpLeft = all.filter(function (e) { return e.fast && unl.indexOf(e.n) < 0; });
    var free = parseInt(s.episodes, 10) || 48;
    var days = Math.max(0, (ep.n - free) * 7);
    var blocked = this.blocked();
    var segs = function (list, cur, fn) { return list.map(function (x) { var on = cur === x[0]; return { label: x[1], on: on, cls: on ? 'on' : '', pick: function () { fn(x[0]); } }; }); };
    var near = all.slice(Math.max(0, st.ep - 4), Math.min(all.length, st.ep + 5)).reverse().map(function (e) {
      var locked = !self.canRead(e);
      return Object.assign({}, e, { locked: locked, current: e.n === st.ep, cls: e.n === st.ep ? 'on' : '', open: function () { self.goEp(e.n); } });
    });
    var baseLikes = parseInt(String(ep.likes).replace(/[^0-9.]/g, ''), 10) || 0;
    var cms = [
      { name: 'Sokha P.', when: '2h', text: 'The rooftop panel is my new wallpaper.', likes: 231 },
      { name: 'Dara K.', when: '4h', text: 'Wait, was that the compass from episode 3?', likes: 188 },
      { name: 'Mai L.', when: '9h', text: 'Pacing in this one was perfect. See you next week.', likes: 64 }
    ];
    return Object.assign(sv, {
      goRef: this.goRef, goHref: this.href('Series'),
      seriesHref: this.href('Series'),
      s: s, ep: Object.assign({}, ep, { short: 'Episode ' + ep.n }),
      total: all.length,
      progress: (pf.mode === 'page' ? Math.round((pg + 1) / panels.length * 100) : Math.round(st.pct * 100)) + '%',
      themeCls: pf.bg === 'light' ? 'light' : '', widthCls: pf.width === 'narrow' ? 'narrow' : '',
      setOpen: st.setOpen, toggleSet: function () { self.setState({ setOpen: !st.setOpen, listOpen: false }); },
      modes: segs([['scroll', 'Scroll'], ['page', 'Page by page']], pf.mode, function (v) { self.setState({ demoMode: '', page: 0 }); self.savePref('mode', v); }),
      bgs: segs([['dark', 'Dark'], ['light', 'Light']], pf.bg, function (v) { self.put('toonwave.readerBg', v); self.setState({ _sync: Date.now() }); }),
      widths: segs([['fit', 'Full width'], ['narrow', 'Narrow']], pf.width, function (v) { self.put('toonwave.readerWidth', v); self.setState({ _sync: Date.now() }); }),
      autoNext: pf.autoNext, autoCls: pf.autoNext ? 'on' : '', toggleAuto: function () { self.savePref('autoNext', !pf.autoNext); },
      saver: pf.saveData, saverCls: pf.saveData ? 'on' : '', toggleSaver: function () { self.savePref('saveData', !pf.saveData); self.say(pf.saveData ? 'Full-quality images' : 'Data saver on: smaller images'); },
      isLocked: locked, isPage: !locked && pf.mode === 'page', isScroll: !locked && pf.mode !== 'page', showEnd: !locked && (pf.mode !== 'page' || pg === panels.length - 1),
      page: panels[pg], pageNo: pg + 1, pageTotal: panels.length, pageFirst: pg === 0,
      pagePrev: function () { self.setState({ page: Math.max(0, pg - 1) }); }, pageNext: function () { self.pageNext(); },
      pageNextLabel: pg === panels.length - 1 ? (nextE ? 'Next episode' : 'Done') : 'Next',
      showResume: !locked && pf.mode !== 'page' && st.resumeAt > 0, resumePct: Math.round(st.resumeAt * 100) + '%',
      resume: function () { try { window.scrollTo({ top: st.resumeAt * (document.documentElement.scrollHeight - window.innerHeight) }); } catch (e) {} self.setState({ resumeAt: 0 }); },
      dismissResume: function () { self.put('toonwave.pos.' + s.id + '.' + st.ep, null); self.setState({ resumeAt: 0 }); },
      lockPreview: panels[0].src, freeIn: days <= 0 ? 'today' : 'in ' + days + ' days',
      lkLogin: locked && !sv.loggedIn, lkCanPay: locked && sv.loggedIn && coins >= price, lkShort: locked && sv.loggedIn && coins < price, lkNeed: Math.max(0, price - coins),
      lkToAuth: function () { self.toAuth(); },
      lkToShop: function () { self.put('toonwave.shopReturn', JSON.stringify({ page: self.href('Viewer'), ep: ep.n, title: s.title, done: false, cost: price, unit: 'episode', count: 1 })); },
      unlockHere: function () {
        self.setState({ busy: true });
        self.later(700, function () {
          self.put('toonwave.unlocked.' + s.id, JSON.stringify(self.unlocked(s.id).concat([ep.n])));
          self.put('toonwave.coins', String(self.coins() - price));
          self.setState({ busy: false, demoLocked: false }); self.logRead(ep.n); self.say('Episode ' + ep.n + ' unlocked');
        });
      },
      canBundle: locked && fpLeft.length > 1, fpLeft: fpLeft.length, bundlePrice: fpLeft.length * price,
      toBundle: function () { self.put('toonwave.v2pending', JSON.stringify({ id: s.id, ep: ep.n, all: true })); },
      prevLabel: st.ep > 1 ? 'episode ' + (st.ep - 1) : 'the series',
      counting: st.counting && !nextLocked, countdown: st.countdown, cancelAuto: function () { self.setState({ counting: false }); self.say('Auto-next cancelled'); },
      toAllComments: function () { self.storeSeries(s); self.put('toonwave.commentsEp', String(st.ep)); },
      reportEp: function () { if (!sv.loggedIn) { self.say('Log in to report'); return; } self.openReport('episode', 'episode', ''); },
      listOpen: st.listOpen,
      toggleList: function () { self.setState({ listOpen: !st.listOpen }); },
      near: near,
      isFirst: st.ep <= 1, isLast: st.ep >= all.length,
      prev: function () { self.goEp(st.ep - 1); },
      next: function () { self.goEp(st.ep + 1); },
      panels: panels,
      liked: st.liked, likeCls: st.liked ? 'on' : '',
      likeCount: String(ep.likes).indexOf('K') > 0 ? ep.likes : String(baseLikes + (st.liked ? 1 : 0)),
      like: function () { self.setState({ liked: !st.liked }); if (!st.liked) self.say('Thanks for the like'); },
      subbed: subbed, subLabel: subbed ? 'Subscribed' : 'Subscribe',
      toggleSub: function () {
        var list = subs.filter(function (x) { return x !== s.id; });
        if (!subbed) list.unshift(s.id);
        self.put('toonwave.subs', JSON.stringify(list));
        self.setState({ _sync: Date.now() });
        self.say(subbed ? 'Unsubscribed' : 'You’ll get new-episode alerts');
      },
      share: function () { self.say('Link copied'); },
      hasNext: !!nextE, nextEp: nextE ? Object.assign({}, nextE, { short: 'Episode ' + nextE.n }) : { thumb: '', title: '', date: '', short: '' },
      nextLocked: nextLocked, price: price,
      nextCta: nextLocked ? 'Unlock' : 'Read next',
      scheduleLower: String(s.schedule || 'every week').toLowerCase(),
      commentTotal: '1.2K',
      draft: st.draft,
      onDraft: function (ev) { self.setState({ draft: ev.target.value.slice(0, 300) }); },
      commentPh: sv.loggedIn ? 'Add a comment…' : 'Log in to comment',
      post: function () {
        if (!sv.loggedIn) { self.say('Log in to comment'); return; }
        if (!st.draft.trim()) return;
        self.setState({ mine: [{ name: sv.userName, when: 'Just now', text: st.draft.trim(), likes: 0, mine: true }].concat(st.mine), draft: '' });
        self.say('Comment posted');
      },
      comments: st.mine.concat(cms).filter(function (c) { return blocked.indexOf(c.name) < 0; }).map(function (c) {
        return Object.assign({}, c, { ini: self.initials(c.name), notMine: !c.mine,
          report: function () { if (!sv.loggedIn) { self.say('Log in to report'); return; } self.openReport('comment', 'comment by ' + c.name, c.name); },
          block: function () { if (!sv.loggedIn) { self.say('Log in to block'); return; } self.openBlock(c.name); } });
      }),
      hasHidden: st.mine.concat(cms).some(function (c) { return blocked.indexOf(c.name) >= 0; }), hiddenLine: 'Comments from people you blocked are hidden.',
      dlgOn: st.dlg, dlgTop: st.dlgY || '120px',
      dlgLogin: st.dlg && !sv.loggedIn, dlgCanPay: st.dlg && sv.loggedIn && coins >= price, dlgShort: st.dlg && sv.loggedIn && coins < price,
      busy: st.busy,
      closeDlg: function () { self.setState({ dlg: false }); },
      toShop: function () { self.put('toonwave.shopReturn', JSON.stringify({ page: self.href('Viewer'), ep: nextE ? nextE.n : 0, title: s.title, done: false })); },
      unlock: function () {
        if (!nextE) return;
        self.setState({ busy: true });
        self.later(700, function () {
          self.put('toonwave.unlocked.' + s.id, JSON.stringify(self.unlocked(s.id).concat([nextE.n])));
          self.put('toonwave.coins', String(self.coins() - price));
          self.setState({ busy: false, dlg: false });
          self.say('Episode ' + nextE.n + ' unlocked');
          self.goEp(nextE.n);
        });
      }
    });
  }
