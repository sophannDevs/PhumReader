  constructor(props) {
    super(props);
    this.pageName = 'Notifications';
    this.goRef = { current: null };
    this.state = Object.assign({}, this.state || {}, { tab: 'all', undoId: '', goHref: '', toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  userName() { var u = this.get('toonwave.user'); if (u === null || u === undefined) return this.get('toonwave.loggedOut') ? '' : 'Sokha Chan'; return u; }
  prefs() {
    var d = { update: [true, false], comment: [true, false], coins: [true, true], fastpass: [true, false], news: [false, false], quiet: true, from: 22, to: 7, digest: false };
    return Object.assign(d, this.read('toonwave.notifPrefs', {}) || {});
  }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var all = this.notifs(), read = this.notifRead();
    var setRead = function (r) { self.put('toonwave.notifRead', JSON.stringify(r)); self.setState({ _sync: Date.now() }); };
    var kinds = { updates: 'update', comments: 'comment', coins: 'coins' };
    var unreadAll = all.filter(function (n) { return read.indexOf(n.id) < 0; });
    var list = all.filter(function (n) {
      if (st.tab === 'unread') return read.indexOf(n.id) < 0;
      if (kinds[st.tab]) return n.kind === kinds[st.tab];
      return true;
    });
    var ic = { update: '▶', comment: '“', coins: 'C', system: 'i' };
    var item = function (n) {
      var unread = read.indexOf(n.id) < 0;
      return Object.assign({}, n, {
        unread: unread, cls: unread ? 'unread' : '', ic: ic[n.kind], icCls: n.kind,
        aria: (unread ? 'Unread. ' : '') + n.title + '. ' + n.time,
        readAria: unread ? 'Mark as read' : 'Mark as unread',
        toggleRead: function () { setRead(unread ? read.concat([n.id]) : read.filter(function (x) { return x !== n.id; })); },
        remove: function () {
          var g = self.read('toonwave.notifGone', []) || [];
          self.put('toonwave.notifGone', JSON.stringify(g.concat([n.id]))); self.setState({ undoId: n.id });
          if (self._undoT) clearTimeout(self._undoT);
          self._undoT = setTimeout(function () { self.setState({ undoId: '' }); }, 6000);
        },
        open: function () {
          if (unread) self.put('toonwave.notifRead', JSON.stringify(read.concat([n.id])));
          var s = n.series && self.byTitle(n.series);
          var to = n.kind === 'coins' ? self.href('Shop') : s ? self.href('Series') : self.href('Home');
          if (s) self.storeSeries(s);
          self.setState({ goHref: to }); self.later(0, function () { self.go(self.goRef); });
        }
      });
    };
    var groups = ['Today', 'This week', 'Earlier'].map(function (w) { return { label: w, items: list.filter(function (n) { return n.when === w; }).map(item) }; }).filter(function (g) { return g.items.length; });
    var p = this.prefs();
    var saveP = function (np) { self.put('toonwave.notifPrefs', JSON.stringify(np)); self.setState({ _saved: Date.now() }); };
    var rows = [['update', 'New episodes', 'From series you subscribe to'], ['fastpass', 'Fast Pass is free', 'When an episode you skipped becomes free'], ['comment', 'Replies and likes', 'On your comments'], ['coins', 'Coins and payments', 'Receipts and failed payments'], ['news', 'PhumiReader news', 'Events, new features and offers']];
    var hours = []; for (var h = 0; h < 24; h++) hours.push({ v: String(h), label: (h % 12 || 12) + ':00 ' + (h < 12 ? 'AM' : 'PM') });
    var counts = { all: all.length, unread: unreadAll.length };
    return Object.assign(sv, {
      goRef: this.goRef, goHref: st.goHref || sv.homeHref,
      headLine: unreadAll.length ? unreadAll.length + ' unread' : 'You’re all caught up',
      hasUnreadHere: unreadAll.length > 0,
      markAll: function () { setRead(all.map(function (n) { return n.id; }).concat(read)); self.say('All marked as read'); },
      tabs: [['all', 'All'], ['unread', 'Unread'], ['updates', 'New episodes'], ['comments', 'Comments'], ['coins', 'Coins']].map(function (t) {
        var c = counts[t[0]];
        return { label: t[1], on: st.tab === t[0], cls: st.tab === t[0] ? 'on' : '', hasCount: t[0] === 'unread' && c > 0, count: c, pick: function () { self.setState({ tab: t[0] }); } };
      }),
      groups: groups, isEmpty: !groups.length,
      emptyTitle: st.tab === 'unread' ? 'You’re all caught up' : 'No notifications yet',
      emptyBody: st.tab === 'unread' ? 'New alerts will show up here.' : 'Subscribe to series to get new-episode alerts here.',
      emptyCta: st.tab !== 'unread',
      hasUndo: !!st.undoId,
      undo: function () { var g = (self.read('toonwave.notifGone', []) || []).filter(function (x) { return x !== st.undoId; }); self.put('toonwave.notifGone', JSON.stringify(g)); self.setState({ undoId: '' }); },
      prefRows: rows.map(function (r) {
        var v = p[r[0]];
        return { id: 'np-' + r[0], label: r[1], desc: r[2], push: v[0], mail: v[1], pushCls: v[0] ? 'on' : '', mailCls: v[1] ? 'on' : '',
          pushAria: r[1] + ': push', mailAria: r[1] + ': email',
          togglePush: function () { var n = Object.assign({}, p); n[r[0]] = [!v[0], v[1]]; saveP(n); },
          toggleMail: function () { var n = Object.assign({}, p); n[r[0]] = [v[0], !v[1]]; saveP(n); } };
      }),
      quiet: p.quiet, quietCls: p.quiet ? 'on' : '', toggleQuiet: function () { saveP(Object.assign({}, p, { quiet: !p.quiet })); },
      qFrom: String(p.from), qTo: String(p.to), hours: hours,
      onFrom: function (ev) { saveP(Object.assign({}, p, { from: parseInt(ev.target.value, 10) })); },
      onTo: function (ev) { saveP(Object.assign({}, p, { to: parseInt(ev.target.value, 10) })); },
      digest: p.digest, digestCls: p.digest ? 'on' : '', toggleDigest: function () { saveP(Object.assign({}, p, { digest: !p.digest })); },
      savedNote: st._saved ? 'Saved' : 'Changes save automatically'
    });
  }
