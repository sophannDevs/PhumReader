  constructor(props) {
    super(props);
    this.pageName = 'Library';
    var v = props.demoView || 'signed-in';
    this.state = Object.assign({}, this.state || {}, {
      tab: 'subs', sort: 'updated', rsort: 'recent', newOnly: false, editing: false, sel: {},
      undo: null, guestNow: v === 'guest',
      net: v === 'loading' ? 'loading' : (v === 'error' ? 'error' : 'boot'),
      toast: '', searchOpen: false, userMenu: false
    });
  }
  componentDidMount() {
    this.sharedMount();
    var self = this;
    if (this.state.net === 'boot') this.later(500, function () { self.setState({ net: 'ready' }); });
  }
  componentDidUpdate(pp) {
    if (pp.demoView !== this.props.demoView) {
      var v = this.props.demoView || 'signed-in';
      this.setState({ guestNow: v === 'guest', net: v === 'loading' ? 'loading' : (v === 'error' ? 'error' : 'ready'), editing: false, sel: {} });
    }
  }
  componentWillUnmount() { this.sharedUnmount(); }
  // The canvas shows a signed-in reader by default; a real log in / log out always wins.
  userName() {
    var real = this.get('toonwave.user') || '';
    if (real) return real;
    return this.state && !this.state.guestNow ? 'Sokha Chan' : '';
  }
  isEmptyDemo() { return (this.props.demoView || '') === 'empty'; }
  subIds() {
    if (this.isEmptyDemo()) return [];
    var v = this.read('toonwave.subs', null);
    return Array.isArray(v) ? v : ['S10', 'S19', 'S34', 'S7', 'S2', 'S27', 'S45', 'S14', 'S22', 'S40'];
  }
  hidden() { var v = this.read('toonwave.v2histHidden', []); return Array.isArray(v) ? v : []; }
  byId(id) { return this.pool().filter(function (s) { return s.id === id; })[0]; }
  newCount(s) { return s.up ? (parseInt(s.id.slice(1), 10) % 3) + 1 : 0; }
  history() {
    if (this.isEmptyDemo()) return [];
    var self = this;
    var base = [['Crown of Ash', 23, 0.62, 'Today'], ['Tiny Dragon Café', 8, 0.3, 'Today'], ['Letters to Tuesday', 4, 0.85, 'Yesterday'], ['Sunday Sword', 41, 0.15, '2 days ago'], ['Glass Compass', 12, 1, '3 days ago'], ['Moonlit Market', 2, 0.4, 'Last week']];
    var list = base.map(function (h) { var s = self.byTitle(h[0]); return { s: s, ep: Math.max(h[1], self.lastRead(s.id)), pct: h[2], when: h[3] }; });
    this.pool().forEach(function (s) {
      var n = self.lastRead(s.id);
      if (n > 0 && !list.some(function (x) { return x.s.id === s.id; })) list.unshift({ s: s, ep: n, pct: 0.5, when: 'Recently' });
    });
    var hid = this.hidden();
    return list.filter(function (x) { return hid.indexOf(x.s.id) < 0; });
  }
  unlockedAll() {
    if (this.isEmptyDemo()) return [];
    var self = this, out = [];
    this.pool().forEach(function (s) { var u = self.unlocked(s.id); if (u.length) out.push({ s: s, eps: u.slice().sort(function (a, b) { return a - b; }) }); });
    if (!out.length) {
      var gc = this.byTitle('Glass Compass'), mc = this.byTitle('Midnight Courier');
      out = [{ s: gc, eps: [gc.episodes + 1] }, { s: mc, eps: [mc.episodes + 1, mc.episodes + 2] }];
    }
    return out;
  }
  freeOn(s, n) {
    var d = new Date(Date.UTC(2026, 10, 5) + (n - s.episodes) * 7 * 86400000);
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()] + ' ' + d.getUTCDate();
  }
  showUndo(text, restore) {
    var self = this;
    var token = Date.now();
    this.setState({ undo: { text: text, restore: restore, token: token }, editing: false, sel: {} });
    this.later(6000, function () { if (self.state.undo && self.state.undo.token === token) self.setState({ undo: null }); });
  }

  renderVals() {
    var self = this;
    var st = this.state;
    var sv = this.sharedVals('');
    var ready = st.net === 'ready';
    var dayIdx = { Thu: 0, Wed: 1, Tue: 2, Mon: 3, Sun: 4, Sat: 5, Fri: 6 };

    // ---- Subscribed ----
    var ids = this.subIds();
    var subs = ids.map(function (id) { return self.byId(id); }).filter(Boolean);
    var withNew = subs.filter(function (s) { return self.newCount(s) > 0; });
    var subView = (st.newOnly ? withNew : subs).slice();
    if (st.sort === 'az') subView.sort(function (a, b) { return a.title.localeCompare(b.title); });
    if (st.sort === 'updated') subView.sort(function (a, b) { return (self.newCount(b) > 0) - (self.newCount(a) > 0) || dayIdx[a.day] - dayIdx[b.day]; });
    var subsList = subView.map(function (s) {
      var idn = parseInt(s.id.slice(1), 10);
      var last = self.lastRead(s.id) || (idn % 3 !== 0 ? Math.max(1, s.episodes - (idn % 5) - (self.newCount(s))) : 0);
      var n = self.newCount(s);
      var on = !!st.sel[s.id];
      var next = last > 0 ? Math.min(last + 1, s.episodes) : 1;
      var unit = s.novel ? 'Ch.' : 'Ep.';
      return Object.assign(self.card(s), {
        hasNew: n > 0, newLabel: n + ' new',
        progressLine: last > 0 ? 'Read ' + unit + ' ' + last + ' of ' + s.episodes : 'Not started · ' + s.episodes + ' free',
        readLabel: last > 0 ? 'Continue ' + unit + ' ' + next : 'Start ' + unit + ' 1',
        readHref: self.readerHref(s), read: function () { self.storeSeries(s); self.put('toonwave.openEp', String(next)); },
        sel: on, selCls: on ? 'sel' : '', checkCls: on ? 'on' : '', selAria: (on ? 'Deselect ' : 'Select ') + s.title,
        tab: st.editing ? '-1' : '0',
        toggle: function () { var x = Object.assign({}, st.sel); if (on) delete x[s.id]; else x[s.id] = true; self.setState({ sel: x }); }
      });
    });

    // ---- Recently read ----
    var hist = this.history();
    var histView = hist.slice();
    if (st.rsort === 'az') histView.sort(function (a, b) { return a.s.title.localeCompare(b.s.title); });
    if (st.rsort === 'progress') histView.sort(function (a, b) { return a.pct - b.pct; });
    var recentList = histView.map(function (h) {
      var s = h.s, on = !!st.sel[s.id], pct = Math.round(h.pct * 100), done = pct >= 100;
      var unit = s.novel ? 'Chapter' : 'Episode';
      var nextEp = done ? h.ep + 1 : h.ep;
      return Object.assign(self.card(s), {
        epLine: unit + ' ' + h.ep + (done ? ' · finished' : ' · ' + pct + '% read'), when: h.when, pct: pct + '%', pctNum: pct,
        cta: done ? 'Next ' + unit.toLowerCase() : 'Continue',
        readHref: self.readerHref(s), read: function () { self.storeSeries(s); self.put('toonwave.openEp', String(nextEp)); },
        sel: on, selCls: on ? 'sel' : '', checkCls: on ? 'on' : '', selAria: (on ? 'Deselect ' : 'Select ') + s.title,
        toggle: function () { var x = Object.assign({}, st.sel); if (on) delete x[s.id]; else x[s.id] = true; self.setState({ sel: x }); }
      });
    });

    // ---- Unlocked ----
    var unl = this.unlockedAll();
    var unlockedList = unl.map(function (u) {
      var s = u.s, unit = s.novel ? 'Chapter' : 'Episode';
      var e = u.eps;
      return Object.assign(self.card(s), {
        epsLine: (e.length === 1 ? unit + ' ' + e[0] : unit + 's ' + e.join(', ')) + ' unlocked with Fast Pass',
        spentLine: (e.length * 5) + ' coins · free for everyone from ' + self.freeOn(s, e[e.length - 1]),
        cta: 'Read ' + (s.novel ? 'Ch. ' : 'Ep. ') + e[0],
        readHref: self.readerHref(s), read: function () { self.storeSeries(s); self.put('toonwave.openEp', String(e[0])); }
      });
    });

    var listForTab = st.tab === 'subs' ? subsList : (st.tab === 'recent' ? recentList : unlockedList);
    var selIds = Object.keys(st.sel);
    var tabItems = st.tab === 'subs' ? subsList : recentList;
    var allOn = tabItems.length > 0 && tabItems.every(function (x) { return st.sel[x.id]; });
    var empties = {
      subs: ['No subscriptions yet', 'Subscribe to a series to get new-episode alerts and find it here.'],
      recent: ['Nothing read yet', 'Episodes and chapters you open will show up here so you can pick up where you left off.'],
      unl: ['No unlocked episodes', 'When you unlock a Fast Pass episode with coins, it stays here for good.']
    };
    var emptyFilter = st.tab === 'subs' && st.newOnly && subs.length > 0 && withNew.length === 0;

    return Object.assign(sv, {
      logout: function () { self.put('toonwave.user', null); self.setState({ guestNow: true, userMenu: false }); self.say('You’re logged out'); },
      toSignup: function () { self.toAuth(); self.put('toonwave.authMode', 'signup'); },
      isGuest: !sv.loggedIn,
      headLine: subs.length + ' subscribed · ' + withNew.length + ' with new episodes · ' + unl.length + ' with unlocked episodes',
      tabs: [['subs', 'Subscribed', subs.length], ['recent', 'Recently read', hist.length], ['unl', 'Unlocked', unl.length]].map(function (t) {
        return { label: t[1], count: t[2], on: st.tab === t[0], cls: st.tab === t[0] ? 'on' : '', pick: function () { self.setState({ tab: t[0], editing: false, sel: {} }); } };
      }),
      tabSubs: st.tab === 'subs',
      canEdit: ready && st.tab !== 'unl' && listForTab.length > 0,
      editing: st.editing, notEditing: !st.editing, editCls: st.editing ? 'editing' : '',
      editLabel: st.editing ? 'Done' : 'Edit', editBtnCls: st.editing ? 'btn-primary' : 'btn-outline',
      toggleEdit: function () { self.setState({ editing: !st.editing, sel: {} }); },
      showToolbar: ready && listForTab.length + (emptyFilter ? 1 : 0) > 0 && st.tab !== 'unl',
      allOn: allOn, allCls: allOn ? 'on' : '',
      toggleAll: function () { var x = {}; if (!allOn) tabItems.forEach(function (i) { x[i.id] = true; }); self.setState({ sel: x }); },
      selLine: selIds.length ? selIds.length + ' selected' : 'Select series to remove',
      noneSel: selIds.length === 0,
      removeLabel: st.tab === 'subs' ? 'Unsubscribe' + (selIds.length ? ' (' + selIds.length + ')' : '') : 'Remove from history' + (selIds.length ? ' (' + selIds.length + ')' : ''),
      removeSel: function () {
        if (!selIds.length) return;
        if (st.tab === 'subs') {
          var before = ids.slice();
          self.put('toonwave.subs', JSON.stringify(ids.filter(function (id) { return !st.sel[id]; })));
          self.showUndo('Unsubscribed from ' + selIds.length + (selIds.length === 1 ? ' series' : ' series'), function () { self.put('toonwave.subs', JSON.stringify(before)); });
        } else {
          var prev = self.hidden();
          self.put('toonwave.v2histHidden', JSON.stringify(prev.concat(selIds)));
          self.showUndo('Removed ' + selIds.length + ' from history', function () { self.put('toonwave.v2histHidden', JSON.stringify(prev)); });
        }
      },
      hasUndo: !!st.undo, undoText: st.undo ? st.undo.text : '',
      undo: function () { if (st.undo) { st.undo.restore(); self.setState({ undo: null }); self.say('Restored'); } },
      newOnly: st.newOnly, newCls: st.newOnly ? 'on' : '', newCount: withNew.length,
      toggleNew: function () { self.setState({ newOnly: !st.newOnly }); },
      countLine: st.tab === 'subs' ? subView.length + ' series' : hist.length + ' series',
      sort: st.tab === 'subs' ? st.sort : st.rsort,
      sortOpts: st.tab === 'subs'
        ? [{ v: 'updated', t: 'Recently updated' }, { v: 'added', t: 'Recently added' }, { v: 'az', t: 'A to Z' }]
        : [{ v: 'recent', t: 'Last read' }, { v: 'progress', t: 'Least finished' }, { v: 'az', t: 'A to Z' }],
      onSort: function (ev) { if (st.tab === 'subs') self.setState({ sort: ev.target.value }); else self.setState({ rsort: ev.target.value }); },

      skel: [1, 2, 3, 4, 5, 6],
      isLoading: st.net === 'loading' || st.net === 'boot', isError: st.net === 'error',
      retry: function () { self.setState({ net: 'loading' }); self.later(500, function () { self.setState({ net: 'ready' }); }); },
      isEmpty: ready && listForTab.length === 0,
      emptyTitle: emptyFilter ? 'No new episodes right now' : empties[st.tab][0],
      emptyText: emptyFilter ? 'Your subscriptions are all caught up.' : empties[st.tab][1],
      emptyFilter: emptyFilter, emptyBrowse: !emptyFilter,
      showSubs: ready && st.tab === 'subs' && subsList.length > 0,
      showRecent: ready && st.tab === 'recent' && recentList.length > 0,
      showUnlocked: ready && st.tab === 'unl' && unlockedList.length > 0,
      subsList: subsList, recentList: recentList, unlockedList: unlockedList
    });
  }
