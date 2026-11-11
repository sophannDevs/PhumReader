  constructor(props) {
    super(props);
    this.pageName = 'Home';
    this.goRef = { current: null };
    var mode = props.demoState || 'live';
    this.state = Object.assign({}, this.state || {}, {
      feat: 0, day: 'Thu', type: 'all', rankTab: 'comics', genre: 'Fantasy',
      draftPrefs: [], editing: false, dayAllOn: false,
      // Simulated network: first load, then 'ready' (or the state picked in the canvas props).
      net: mode === 'live' ? 'loading' : mode, dayBusy: false,
      toast: '', searchOpen: false, userMenu: false
    });
  }
  componentDidMount() {
    this.sharedMount();
    if (this.state.net === 'loading' && (this.props.demoState || 'live') === 'live') {
      var self = this;
      this.later(650, function () { self.setState({ net: 'ready' }); });
    }
  }
  componentDidUpdate(pp) {
    if (pp.demoState !== this.props.demoState) {
      var m = this.props.demoState || 'live';
      this.setState({ net: m === 'live' ? 'ready' : m });
    }
  }
  componentWillUnmount() { this.sharedUnmount(); }
  subs() { var v = this.read('toonwave.subs', []); return Array.isArray(v) ? v : []; }
  prefs() { var v = this.read('toonwave.prefs', null); return Array.isArray(v) ? v : null; }
  readVals(s, ep) {
    var self = this;
    return { readHref: this.readerHref(s), read: function () { self.storeSeries(s); self.put('toonwave.openEp', String(ep || 1)); } };
  }
  pickDay(d) {
    var self = this;
    this.setState({ day: d, dayBusy: true, dayAllOn: false });
    this.later(350, function () { self.setState({ dayBusy: false }); });
  }

  renderVals() {
    var self = this;
    var st = this.state;
    var pool = this.pool();
    var sv = this.sharedVals('home');
    var subs = this.subs();
    var net = st.net;

    // ---- Spotlight ----
    var featDefs = [
      { t: 'Glass Compass', tag: 'Season 2 is here', blurb: 'A cartographer’s apprentice finds a compass that points to whatever its holder has lost — and someone wants it back.' },
      { t: 'Midnight Courier', tag: 'New episode today', blurb: 'Phnom Penh after dark, one delivery at a time. Some packages were never meant to arrive.' },
      { t: 'Letters to Tuesday', tag: 'Editor’s pick · Web novel', blurb: 'Every Tuesday a letter appears on the café counter. Every Tuesday, Sreyna writes back.' }
    ];
    var feats = featDefs.map(function (h, i) {
      var s = self.byTitle(h.t);
      var subbed = subs.indexOf(s.id) >= 0;
      return Object.assign(self.card(s), self.readVals(s, 1), {
        tag: h.tag, blurb: h.blurb, subbed: subbed,
        kindLabel2: s.novel ? 'Web novel' : 'Comic',
        readLabel: s.novel ? 'Start reading · Ch. 1' : 'Start reading · Ep. 1',
        freeLine: s.episodes + (s.novel ? ' chapters' : ' episodes') + ' free to read · 3 more with Fast Pass',
        subLabel: subbed ? '✓ Subscribed' : '+ Subscribe',
        on: st.feat === i, cls: st.feat === i ? 'on' : '',
        meta: s.genre + ' · ' + s.likes + ' likes',
        pick: function () { self.setState({ feat: i }); },
        toggleSub: function () {
          var list = self.subs().filter(function (x) { return x !== s.id; });
          if (!subbed) list.unshift(s.id);
          self.put('toonwave.subs', JSON.stringify(list));
          self.setState({ _sync: Date.now() });
          self.say(subbed ? 'Removed from your library' : 'Subscribed. You’ll get new-episode alerts');
        }
      });
    });

    // ---- Continue reading ----
    var hist = [['Crown of Ash', 23, 0.62], ['Tiny Dragon Café', 8, 0.3], ['Letters to Tuesday', 4, 0.85], ['Sunday Sword', 41, 0.15]];
    var continueList = hist.map(function (h) {
      var s = self.byTitle(h[0]);
      var pct = Math.round(h[2] * 100);
      return Object.assign(self.card(s), self.readVals(s, h[1]), {
        epLabel: (s.novel ? 'Chapter ' : 'Episode ') + h[1] + ' · ' + pct + '% read', pct: pct + '%', pctNum: pct
      });
    });

    // ---- For you ----
    var prefs = this.prefs();
    var showPicker = prefs === null || st.editing;
    var draft = st.editing || prefs === null ? st.draftPrefs : prefs;
    var genres = ['Drama', 'Fantasy', 'Comedy', 'Action', 'Slice of life', 'Romance', 'Superhero', 'Sci-fi'];
    var recSrc = prefs && prefs.length ? pool.filter(function (s) { return prefs.indexOf(s.genre) >= 0; }) : pool.slice();
    var num = function (x) { var n = parseFloat(x) || 0; return /M/.test(x) ? n * 1e6 : (/K/.test(x) ? n * 1e3 : n); };
    recSrc = recSrc.slice().sort(function (a, b) { return num(b.likes) - num(a.likes); });
    var recList = recSrc.slice(0, 6).map(function (s) { return Object.assign(self.card(s), { hook: self.hook(s) }); });
    var why = prefs && prefs.length ? 'Because you like ' + (prefs.length > 2 ? prefs.slice(0, 2).join(', ') + ' and ' + (prefs.length - 2) + ' more' : prefs.join(' and ')) : 'Popular with readers in Cambodia this week';

    // ---- Daily ----
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    var matchType = function (s) { return st.type === 'all' || (st.type === 'novel' ? s.novel : !s.novel); };
    var dayAll = pool.filter(function (s) { return s.day === st.day && matchType(s); });
    var dayList = dayAll.map(function (s) {
      var today = st.day === 'Thu';
      return Object.assign(self.card(s), {
        upd: today && s.up ? 'New today' : (s.novel ? 'Ch. ' : 'Ep. ') + s.episodes,
        updCls: today && s.up ? 'upd-new' : ''
      });
    });
    var typeName = st.type === 'novel' ? 'web novels' : (st.type === 'comic' ? 'comics' : 'series');

    // ---- Rankings ----
    var rankBase = pool.filter(function (s) { return st.rankTab === 'novels' ? s.novel : !s.novel; });
    var order = rankBase.slice().sort(function (a, b) { return ((parseInt(b.id.slice(1), 10) * 13) % 41) - ((parseInt(a.id.slice(1), 10) * 13) % 41); });
    var moves = ['▲ 2', '—', '▲ 5', '▼ 1', 'NEW', '▲ 1', '▼ 3', '—'];
    var rankList = order.slice(0, 8).map(function (s, i) {
      var m = moves[i % moves.length];
      return Object.assign(self.card(s), {
        no: i + 1, topCls: i < 3 ? 'top' : '', move: m,
        moveCls: m.charAt(0) === '▲' || m === 'NEW' ? 'upm' : (m.charAt(0) === '▼' ? 'down' : ''),
        moveAria: m === 'NEW' ? 'New entry' : (m === '—' ? 'No change' : (m.charAt(0) === '▲' ? 'Up ' : 'Down ') + m.slice(2)),
        meta: s.creator + ' · ' + s.views + ' views'
      });
    });
    var genreAll = pool.filter(function (s) { return s.genre === st.genre; });

    var ready = net === 'ready' || net === 'empty';
    return Object.assign(sv, {
      goRef: this.goRef, goHref: this.href('Series'),
      feat: feats[st.feat], feats: feats,
      continueSub: sv.loggedIn ? 'Pick up where you left off.' : 'Saved on this device. Log in to keep it on all your devices.',
      continueList: continueList,

      noPrefs: showPicker, hasPrefs: !showPicker,
      prefChips: genres.map(function (g) {
        var on = draft.indexOf(g) >= 0;
        return { label: g, on: on, cls: on ? 'on' : '', pick: function () { var d = draft.filter(function (x) { return x !== g; }); if (!on) d.push(g); self.setState({ draftPrefs: d, editing: prefs !== null ? true : st.editing }); } };
      }),
      prefNone: draft.length === 0,
      saveLabel: draft.length ? 'Show my picks (' + draft.length + ')' : 'Pick at least one genre',
      savePrefs: function () { if (!draft.length) return; self.put('toonwave.prefs', JSON.stringify(draft)); self.setState({ editing: false }); self.say('Home page updated for ' + draft.length + (draft.length === 1 ? ' genre' : ' genres')); },
      skipPrefs: function () { self.put('toonwave.prefs', JSON.stringify([])); self.setState({ editing: false }); },
      editPrefs: function () { self.setState({ editing: true, draftPrefs: (prefs || []).slice() }); },
      recTitle: prefs && prefs.length ? 'Recommended for you' : 'Popular right now',
      recWhy: why, recList: recList,

      dayLine: dayAll.length + ' ' + typeName + ' update on ' + this.dayLong(st.day) + (st.day === 'Thu' ? ' (today)' : '') + '.',
      typeTabs: [['all', 'All'], ['comic', 'Comics'], ['novel', 'Web novels']].map(function (t) { return { label: t[1], on: st.type === t[0], cls: st.type === t[0] ? 'on' : '', pick: function () { self.setState({ type: t[0], dayAllOn: false }); } }; }),
      dayTabs: days.map(function (d) {
        var n = pool.filter(function (s) { return s.day === d && matchType(s); }).length;
        return { label: d === 'Thu' ? 'Today' : d, count: n + (n === 1 ? ' series' : ' series'), on: st.day === d, cls: (st.day === d ? 'on' : '') + (d === 'Thu' ? ' today' : ''), pick: function () { self.pickDay(d); } };
      }),
      skel6: [1, 2, 3, 4, 5, 6],
      dayLoading: net === 'loading' || (ready && st.dayBusy),
      dayError: net === 'error',
      dayEmpty: ready && !st.dayBusy && (net === 'empty' || dayList.length === 0),
      dayReady: ready && !st.dayBusy && net !== 'empty' && dayList.length > 0,
      emptyTitle: net === 'empty' ? 'No updates yet' : 'No ' + typeName + ' on ' + this.dayLong(st.day),
      emptyText: net === 'empty' ? 'New episodes will appear here as soon as creators publish them.' : 'Try another day, or show all series for this day.',
      showAllTypes: function () { self.setState({ type: 'all', net: net === 'empty' ? 'ready' : net }); },
      retry: function () { self.setState({ net: 'loading' }); self.later(650, function () { self.setState({ net: 'ready' }); }); },
      dayList: st.dayAllOn ? dayList : dayList.slice(0, 6),
      dayMore: ready && !st.dayBusy && dayList.length > 6 && !st.dayAllOn,
      dayMoreLabel: 'Show all ' + dayList.length + ' ' + typeName,
      showDayAll: function () { self.setState({ dayAllOn: true }); },

      rankTabs: [['comics', 'Comics'], ['novels', 'Web novels']].map(function (t) { return { label: t[1], on: st.rankTab === t[0], cls: st.rankTab === t[0] ? 'on' : '', pick: function () { self.setState({ rankTab: t[0] }); } }; }),
      rankList: rankList,
      listLoading: net === 'loading', listError: net === 'error', listReady: ready,
      genre: st.genre, genreCount: genreAll.length,
      genreChips: genres.map(function (g) { var n = pool.filter(function (s) { return s.genre === g; }).length; return { label: g, n: n, on: st.genre === g, cls: st.genre === g ? 'on' : '', pick: function () { self.setState({ genre: g }); } }; }),
      genreList: genreAll.slice(0, 6).map(function (s) { return self.card(s); }),
      surprise: function () {
        var s = genreAll[Math.floor(Math.random() * genreAll.length)];
        self.storeSeries(s);
        self.say('Opening ' + s.title);
        self.later(350, function () { self.go(self.goRef); });
      },
      novels: pool.filter(function (s) { return s.novel; }).slice(0, 6).map(function (s) { return Object.assign(self.card(s), { hook: self.hook(s) }); }),
      ctaArt: ['Ink Witch', 'Sunday Sword', 'Pocket Seasons'].map(function (t) { return self.byTitle(t); })
    });
  }
