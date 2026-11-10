  constructor(props) {
    super(props);
    this.pageName = 'Series';
    this.goRef = { current: null };
    this.state = Object.assign({}, this.state || {}, {
      tab: props.demoReport && props.demoReport !== 'none' ? 'comments' : 'eps', sortNew: true, showHidden: false, shown: 12, dlg: null, dlgStep: 'ask', dlgMode: 'one', busy: false, jumpVal: '', jumpErr: '',
      draft: '', myComments: [], liked: {}, follow: false, toast: '', searchOpen: false, userMenu: false
    });
  }
  componentDidMount() {
    this.sharedMount(); this.resume();
    var self = this;
    // Phone: show the sticky "Continue" bar once the hero's button has scrolled away.
    this.onScroll = function () { var y = window.scrollY || 0; var on = y > 560; if (on !== self.state.stuck) self.setState({ stuck: on }); };
    window.addEventListener('scroll', this.onScroll, { passive: true });
  }
  componentWillUnmount() { this.sharedUnmount(); window.removeEventListener('scroll', this.onScroll); }
  onSync(key) { if (key === 'toonwave.series') this.setState({ tab: 'eps', shown: 12, dlg: null }); if (key === 'toonwave.coins' || key === 'toonwave.user') this.resume(); }
  // Coming back from Log in or the coin shop: reopen the episode they were trying to unlock.
  resume() {
    var p = this.read('toonwave.v2pending', null);
    var s = this.series();
    if (!p || p.id !== s.id) return;
    var e = this.episodes().filter(function (x) { return x.n === p.ep; })[0];
    var mode = p.all ? 'all' : 'one';
    var cost = p.all ? this.lockedFast().length * this.price() : this.price();
    if (e && this.userName() && this.coins() >= cost) { this.put('toonwave.v2pending', null); this.setState({ dlg: e, dlgStep: 'ask', dlgMode: mode }); }
  }
  lockedFast() {
    var un = this.unlocked(this.series().id);
    return this.episodes().filter(function (e) { return e.fast && un.indexOf(e.n) < 0; });
  }
  // Prototype "today" matches the episode data: the latest free episode came out on Nov 5, 2026.
  daysUntilFree(e) { var free = parseInt(this.series().episodes, 10) || 48; return Math.max(0, (e.n - free) * 7); }
  inDays(d) { return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' days'; }
  shortDate(e) { return e.date.replace(/, \d{4}$/, ''); }
  openEp(e) {
    var s = this.series();
    this.storeSeries(s);
    this.put('toonwave.openEp', String(e.n));
    this.go(this.goRef);
  }

  renderVals() {
    var self = this;
    var st = this.state;
    var sv = this.sharedVals('');
    var s = this.series();
    var nov = this.isNovel(s);
    var unit = nov ? 'Chapter' : 'Episode';
    var all = this.episodes();
    var unlocked = this.unlocked(s.id);
    var last = this.lastRead(s.id);
    var price = this.price();
    var coins = this.coins();
    var subs = this.read('toonwave.subs', []) || [];
    var subbed = subs.indexOf(s.id) >= 0;
    var free = parseInt(s.episodes, 10) || all.filter(function (e) { return !e.fast; }).length;
    var lockedFast = this.lockedFast();
    var fastAll = all.filter(function (e) { return e.fast; });
    var nextUp = last > 0 ? all.filter(function (e) { return e.n === Math.min(last + 1, free); })[0] : null;
    var openDlg = function (e, mode) { self.setState({ dlg: e, dlgStep: 'ask', dlgMode: mode || 'one', dlgY: self.layerY(-220) }); };
    var ordered = st.sortNew ? all.slice().reverse() : all.slice();
    var eps = [];
    var group = null;
    ordered.slice(0, st.shown).forEach(function (e) {
      var g = e.fast ? 'fp' : 'free';
      if (g !== group) {
        group = g;
        eps.push({ head: true, row: false, headCls: g === 'fp' ? 'fp' : '',
          headTitle: g === 'fp' ? '⚡ Fast Pass · read before everyone' : 'Free to read',
          headNote: g === 'fp' ? fastAll.length + ' ' + unit.toLowerCase() + 's · ' + price + ' coins each' : free + ' ' + unit.toLowerCase() + 's',
          n: 0, title: '', thumb: '', date: '', dateLine: '', likes: '', freeIn: '', priceLabel: '', aria: '', cls: '', locked: false, unlockedFp: false, isRead: false, isNext: false, isUp: false, open: function () {} });
      }
      var isUnl = unlocked.indexOf(e.n) >= 0;
      var locked = e.fast && !isUnl;
      var isNext = !!nextUp && nextUp.n === e.n && e.n > last;
      eps.push(Object.assign({}, e, {
        head: false, row: true, headCls: '', headTitle: '', headNote: '',
        locked: locked, unlockedFp: e.fast && isUnl, isRead: !e.fast && e.n <= last, isNext: isNext,
        cls: (locked ? 'locked' : '') + (!e.fast && e.n <= last ? ' read' : '') + (isNext ? ' flash' : ''),
        dateLine: locked ? 'Free ' + self.shortDate(e) : e.date,
        freeIn: 'Free ' + self.inDays(self.daysUntilFree(e)),
        priceLabel: price + ' coins',
        aria: e.title + (locked ? ', Fast Pass, ' + price + ' coins, free on ' + e.date : '') + (isNext ? ', up next' : ''),
        open: function () {
          if (locked) openDlg(e, 'one');
          else self.openEp(e);
        }
      }));
    });
    var dlg = st.dlg;
    var dlgAll = !!dlg && st.dlgMode === 'all' && lockedFast.length > 1;
    var dlgList = !dlg ? [] : dlgAll ? lockedFast : [dlg];
    var dlgCost = dlgList.length * price;
    var unitL = unit.toLowerCase();
    var dlgOpts = !dlg ? [] : [
      { key: 'one', label: 'Just ' + unitL + ' ' + dlg.n, note: 'Free ' + this.inDays(this.daysUntilFree(dlg)), cost: price },
      { key: 'all', label: 'All ' + lockedFast.length + ' Fast Pass ' + unitL + 's', note: unit + 's ' + (lockedFast.length ? lockedFast[0].n + '–' + lockedFast[lockedFast.length - 1].n : '') + ' · read to the newest page', cost: lockedFast.length * price }
    ].map(function (o) {
      var on = (o.key === 'all') === dlgAll;
      return Object.assign(o, { on: on, cls: on ? 'on' : '', pick: function () { self.setState({ dlgMode: o.key }); } });
    });
    var first = all[0];
    var next = last > 0 ? all.filter(function (e) { return e.n === Math.min(last + 1, parseInt(s.episodes, 10) || last + 1); })[0] || first : first;
    var genreSyn = {
      Fantasy: 'An apprentice cartographer inherits a compass that points to whatever its holder has lost. The city’s oldest guild wants it back.',
      Romance: 'Two neighbours who have never spoken start leaving each other notes. A slow, warm story about small courage.',
      Action: 'A courier who never misses a delivery takes one job too many. Fast, loud and full of heart.',
      Drama: 'A family bakery, three siblings and one last summer to save it.',
      Comedy: 'Everyday chaos with a tiny dragon behind the café counter.',
      'Slice of life': 'Quiet evenings, night markets and the people who make a city feel like home.',
      Superhero: 'A part-time hero with a full-time rent problem.',
      'Sci-fi': 'A delivery crew at the edge of the solar system finds a signal that shouldn’t exist.'
    };
    var cmBase = [
      { name: 'Sokha P.', when: '2h', text: 'That last page!! I did not see that coming. Waiting a whole week is going to hurt.', likes: 412, top: true },
      { name: 'Linh T.', when: '5h', text: 'The colors in this series keep getting better. The rain panels were beautiful.', likes: 168, top: false },
      { name: 'Vibol K.', when: '1d', text: 'Rereading from episode 1 and catching all the hints. The creator planned this from the start.', likes: 97, top: false }
    ];
    var blocked = this.blocked();
    var allCm = st.myComments.concat(cmBase);
    var hiddenN = allCm.filter(function (c) { return blocked.indexOf(c.name) >= 0; }).length;
    var comments = allCm.map(function (c, i) {
      var liked = !!st.liked[i], mine = !!c.mine;
      return Object.assign({}, c, { idx: i, ini: self.initials(c.name), liked: liked, likes: c.likes + (liked ? 1 : 0), notMine: !mine,
        like: function () { var l = Object.assign({}, st.liked); l[i] = !liked; self.setState({ liked: l }); },
        reply: function () { if (!sv.loggedIn) { self.say('Log in to reply'); return; } self.setState({ draft: '@' + c.name + ' ' }); },
        report: function () { if (!sv.loggedIn) { self.say('Log in to report'); return; } self.openReport('comment', 'comment by ' + c.name, c.name); },
        block: function () { if (!sv.loggedIn) { self.say('Log in to block'); return; } self.openBlock(c.name); } });
    }).filter(function (c) { return st.showHidden || blocked.indexOf(c.name) < 0; });
    var same = this.pool().filter(function (x) { return x.genre === s.genre && x.title !== s.title; }).slice(0, 4);

    return Object.assign(sv, {
      goRef: this.goRef, goHref: this.readerHref(s),
      epTotal: all.length,
      s: s, kindLabel: nov ? 'Web novel' : 'Comic', unitPlural: unit + 's', unitPluralLower: unit.toLowerCase() + 's',
      creatorInitials: this.initials(s.creator),
      synopsis: genreSyn[s.genre] || genreSyn.Fantasy,
      synopsis2: 'New ' + unit.toLowerCase() + 's ' + String(s.schedule || 'every week').toLowerCase() + '.',
      subCount: subbed ? '84.4K' : '84.3K',
      mainHref: this.readerHref(s),
      mainLabel: last > 0 ? 'Continue ' + unit.toLowerCase() + ' ' + next.n : 'Read ' + unit.toLowerCase() + ' 1',
      mainRead: function () { self.storeSeries(s); self.put('toonwave.openEp', String(next.n)); },
      subbed: subbed, subLabel: subbed ? '✓ Subscribed' : '+ Subscribe',
      toggleSub: function () {
        var list = subs.filter(function (x) { return x !== s.id; });
        if (!subbed) list.unshift(s.id);
        self.put('toonwave.subs', JSON.stringify(list));
        self.setState({ _sync: Date.now() });
        self.say(subbed ? 'Removed from your library' : 'Added to your library');
      },
      share: function () { self.say('Link copied'); },
      tabs: [['eps', unit + 's', all.length], ['about', 'About', 0], ['comments', 'Comments', 2400 + st.myComments.length]].map(function (t) {
        return { label: t[1], on: st.tab === t[0], cls: st.tab === t[0] ? 'on' : '', hasCount: t[2] > 0, count: t[2] >= 1000 ? (Math.round(t[2] / 100) / 10) + 'K' : t[2], pick: function () { self.setState({ tab: t[0] }); } };
      }),
      tabEps: st.tab === 'eps', tabAbout: st.tab === 'about', tabComments: st.tab === 'comments',
      fpCount: fastAll.length, price: price,
      fpLeft: lockedFast.length || fastAll.length,
      canBundle: lockedFast.length > 1, bundlePrice: lockedFast.length * price,
      openBundle: function () { if (lockedFast.length) openDlg(lockedFast[0], 'all'); },
      nextFreeLine: fastAll.length ? 'Next free: ' + unit + ' ' + fastAll[0].n + ' on ' + this.shortDate(fastAll[0]) + ' (' + this.inDays(this.daysUntilFree(fastAll[0])) + ').' : '',
      progLine: last > 0 ? 'You’ve read ' + Math.min(last, free) + ' of ' + free + ' free ' + unitL + 's' : free + ' free · ' + fastAll.length + ' Fast Pass',
      progRight: last > 0 ? Math.round(Math.min(last, free) / free * 100) + '%' : 'Start with ' + unitL + ' 1',
      progPct: last > 0 ? Math.round(Math.min(last, free) / free * 100) : 0,
      progW: (last > 0 ? Math.round(Math.min(last, free) / free * 100) : 0) + '%',
      stickyCls: st.stuck ? 'show' : '', stickyHidden: !st.stuck, stickyTab: st.stuck ? '0' : '-1',
      dlgFreeLine: !dlg ? '' : dlgAll ? 'All of them are free for everyone by ' + lockedFast[lockedFast.length - 1].date + ' (' + this.inDays(this.daysUntilFree(lockedFast[lockedFast.length - 1])) + ').' : 'Free for everyone on ' + dlg.date + ' (' + this.inDays(this.daysUntilFree(dlg)) + ').',
      mainShort: last > 0 ? 'Continue ' + (nov ? 'Ch. ' : 'Ep. ') + next.n : 'Read ' + (nov ? 'Ch. 1' : 'Ep. 1'),
      firstLabel: unit + ' 1', unitLower: unitL, unitShort: nov ? 'Ch.' : 'Ep.',
      jumpFirst: function () { self.openEp(all[0]); },
      jumpLatest: function () { self.openEp(all.filter(function (e) { return !e.fast; }).pop() || all[0]); },
      jumpVal: st.jumpVal, jumpErr: !!st.jumpErr, jumpErrMsg: st.jumpErr,
      onJump: function (ev) { self.setState({ jumpVal: ev.target.value.replace(/[^0-9]/g, '').slice(0, 4), jumpErr: '' }); },
      jumpGo: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        var n = parseInt(st.jumpVal, 10);
        var e = all.filter(function (x) { return x.n === n; })[0];
        if (!e) { self.setState({ jumpErr: 'Enter a number from 1 to ' + all.length + '.' }); return; }
        self.setState({ jumpVal: '' });
        if (e.fast && unlocked.indexOf(e.n) < 0) openDlg(e, 'one'); else self.openEp(e);
      },
      toShopPlain: function () { self.put('toonwave.shopReturn', JSON.stringify({ page: self.href('Series'), ep: 0, title: s.title, done: false })); },
      totalLine: all.length + ' ' + unit.toLowerCase() + 's · ' + String(s.schedule || '').replace('Every', 'new every'),
      sortLabel: st.sortNew ? 'Newest first' : 'Oldest first',
      toggleSort: function () { self.setState({ sortNew: !st.sortNew }); },
      eps: eps,
      hasMore: st.shown < all.length, moreCount: Math.min(12, all.length - st.shown),
      more: function () { self.setState({ shown: st.shown + 12 }); },
      details: [{ k: 'Genre', v: s.genre }, { k: 'Format', v: nov ? 'Web novel' : 'Vertical comic' }, { k: 'Schedule', v: s.schedule }, { k: 'Status', v: 'Ongoing' }, { k: 'Language', v: 'English, ខ្មែរ' }, { k: 'Age rating', v: 'All ages' }],
      tags: [{ t: s.genre.toLowerCase().replace(/ /g, '') }, { t: 'adventure' }, { t: 'found family' }, { t: 'phnompenh' }],
      draft: st.draft, draftCount: st.draft.length,
      commentPh: sv.loggedIn ? 'What did you think?' : 'Log in to join the conversation',
      onDraft: function (ev) { self.setState({ draft: ev.target.value.slice(0, 500) }); },
      postComment: function () {
        if (!sv.loggedIn) { self.say('Log in to comment'); return; }
        if (!st.draft.trim()) { self.say('Write something first'); return; }
        self.setState({ myComments: [{ name: sv.userName, when: 'Just now', text: st.draft.trim(), likes: 0, top: false, mine: true }].concat(st.myComments), draft: '', liked: {} });
        self.say('Comment posted');
      },
      comments: comments,
      hasHidden: hiddenN > 0, hiddenLine: hiddenN + ' comment' + (hiddenN > 1 ? 's' : '') + ' from people you blocked ' + (st.showHidden ? 'shown' : 'hidden') + '.',
      hiddenBtn: st.showHidden ? 'Hide' : 'Show', toggleHidden: function () { self.setState({ showHidden: !st.showHidden }); },
      commentTotal: '2.4K', toAllComments: function () { self.storeSeries(s); self.put('toonwave.commentsEp', null); },
      reportSeries: function () { if (!sv.loggedIn) { self.say('Log in to report'); return; } self.openReport('series', 'series', ''); },
      creatorCount: 3, followLabel: st.follow ? 'Following' : 'Follow creator',
      followCreator: function () { self.setState({ follow: !st.follow }); self.say(st.follow ? 'Unfollowed ' + s.creator : 'Following ' + s.creator); },
      similar: same.map(function (x) { return self.card(x); }),

      dlgOn: !!dlg, dlgTop: st.dlgY || '120px',
      dlg: dlg ? { thumb: dlg.thumb, title: unit + ' ' + dlg.n, date: dlgAll ? lockedFast[lockedFast.length - 1].date : dlg.date, inDays: this.inDays(this.daysUntilFree(dlgAll ? lockedFast[lockedFast.length - 1] : dlg)) } : { thumb: '', title: '', date: '', inDays: '' },
      dlgHead: !dlg ? '' : dlgAll ? 'Unlock ' + dlgList.length + ' Fast Pass ' + unitL + 's' : 'Unlock ' + unitL + ' ' + dlg.n,
      dlgChoice: !!dlg && lockedFast.length > 1, dlgOpts: dlgOpts,
      dlgCost: dlgCost, dlgAfter: coins - dlgCost, dlgNeed: Math.max(0, dlgCost - coins),
      dlgBtn: dlgAll ? 'Unlock ' + dlgList.length + ' ' + unitL + 's for ' + dlgCost + ' coins' : 'Unlock for ' + dlgCost + ' coins',
      dlgLogin: !!dlg && !sv.loggedIn,
      dlgCanPay: !!dlg && sv.loggedIn && coins >= dlgCost,
      dlgShort: !!dlg && sv.loggedIn && coins < dlgCost,
      busy: st.busy,
      closeDlg: function () { self.setState({ dlg: null, dlgMode: 'one' }); },
      dlgToAuth: function () { self.toAuth(); self.put('toonwave.v2pending', JSON.stringify({ id: s.id, ep: dlg.n, all: dlgAll })); },
      dlgToShop: function () {
        self.put('toonwave.v2pending', JSON.stringify({ id: s.id, ep: dlg.n, all: dlgAll }));
        self.put('toonwave.shopReturn', JSON.stringify({ page: self.href('Series'), ep: dlg.n, title: s.title, done: false, need: Math.max(0, dlgCost - self.coins()), cost: dlgCost, unit: unitL, count: dlgList.length }));
      },
      unlock: function () {
        self.setState({ busy: true });
        self.later(700, function () {
          var have = self.unlocked(s.id);
          var add = dlgList.map(function (x) { return x.n; }).filter(function (n) { return have.indexOf(n) < 0; });
          self.put('toonwave.unlocked.' + s.id, JSON.stringify(have.concat(add)));
          self.put('toonwave.coins', String(self.coins() - add.length * price));
          var e = dlgList[0];
          self.setState({ busy: false, dlg: null, dlgMode: 'one' });
          self.say(add.length > 1 ? add.length + ' ' + unitL + 's unlocked' : unit + ' ' + e.n + ' unlocked');
          self.later(500, function () { self.openEp(e); });
        });
      }
    });
  }
