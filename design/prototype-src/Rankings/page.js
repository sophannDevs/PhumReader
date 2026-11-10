  constructor(props) {
    super(props);
    this.pageName = 'Rankings';
    this.state = Object.assign({}, this.state || {}, { tab: 'trending', format: 'all', genre: 'All genres', period: 'week', shown: 20, howOpen: false, toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  ranked() {
    var st = this.state, self = this;
    var list = this.pool().filter(function (s) {
      if (st.format === 'comic' && s.novel) return false;
      if (st.format === 'novel' && !s.novel) return false;
      if (st.genre !== 'All genres' && s.genre !== st.genre) return false;
      if (st.tab === 'new' && !s.isNew) return false;
      return true;
    });
    var score = function (s) { return self.metric(s).v; };
    return list.slice().sort(function (a, b) { return score(b) - score(a); });
  }
  // Demo numbers: reads in the period for Trending/New, all-time views for Popular, growth for Rising.
  metric(s) {
    var st = this.state, n = parseInt(s.id.slice(1), 10);
    var f = { day: 0.004, week: 0.03, month: 0.11 }[st.period] || 0.03;
    var reads = this.num(s.views) * f * (1 + ((n * 7) % 11) / 8) + ((n * 13) % 40) * 1000 * f * 30;
    if (st.tab === 'popular') return { v: this.num(s.views), main: s.views, mainLbl: 'all-time views' };
    if (st.tab === 'rising') { var g = 40 + ((n * 37) % 260); return { v: g * 1e6 + reads, main: '+' + g + '%', mainLbl: 'more readers' }; }
    return { v: reads, main: this.fmt(reads), mainLbl: { day: 'reads today', week: 'reads this week', month: 'reads this month' }[st.period] };
  }
  // Demo movement since the last update, stable per series and period.
  move(s, rank) {
    var n = parseInt(s.id.slice(1), 10), seed = { day: 3, week: 7, month: 11 }[this.state.period] || 7;
    if (this.state.tab === 'new' && n % 2 === 0) return ['NEW', 'new', 'New entry'];
    var d = ((n * seed * 5) % 9) - 4;
    if (rank <= 3 && d < 0) d = 0;
    if (s.isNew && n % 5 === 0) return ['NEW', 'new', 'New entry'];
    if (d > 0) return ['▲' + d, 'up', 'Up ' + d];
    if (d < 0) return ['▼' + (-d), 'down', 'Down ' + (-d)];
    return ['–', 'same', 'No change'];
  }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('rank');
    var subs = this.read('toonwave.subs', null); if (!Array.isArray(subs)) subs = ['S10', 'S19', 'S34', 'S7', 'S2', 'S27', 'S45', 'S14', 'S22', 'S40'];
    var all = this.ranked();
    var shown = all.slice(0, st.shown);
    var row = function (s, i) {
      var rank = i + 1, m = self.move(s, rank), subbed = subs.indexOf(s.id) >= 0;
      return Object.assign(self.card(s), {
        rank: rank, stat: self.metric(s).main, statLbl: self.metric(s).mainLbl, move: m[0], moveCls: m[1], moveAria: m[2], podCls: 'p' + rank,
        subbed: subbed, subCls: subbed ? 'btn-secondary' : 'btn-outline', subLabel: subbed ? '✓ Subscribed' : '+ Subscribe', subShort: subbed ? '✓ Added' : '+ Add',
        subAria: (subbed ? 'Unsubscribe from ' : 'Subscribe to ') + s.title,
        toggleSub: function () {
          if (!sv.loggedIn) { self.say('Log in to subscribe'); return; }
          var l = subs.filter(function (x) { return x !== s.id; }); if (!subbed) l.unshift(s.id);
          self.put('toonwave.subs', JSON.stringify(l)); self.setState({ _sync: Date.now() });
          self.say(subbed ? 'Removed from your library' : 'Added to your library');
        }
      });
    };
    var rows = shown.map(row);
    var topN = st.tab === 'rising' ? 0 : 3;
    var genres = ['All genres', 'Drama', 'Fantasy', 'Comedy', 'Action', 'Slice of life', 'Romance', 'Superhero', 'Sci-fi'];
    var periodLabel = { day: 'today', week: 'this week', month: 'this month' }[st.period];
    return Object.assign(sv, {
      updatedLine: st.tab === 'popular' ? 'All-time reads.' : 'Updated every hour · Last update 9:00 AM.',
      howOpen: st.howOpen, toggleHow: function () { self.setState({ howOpen: !st.howOpen }); },
      tabs: [['trending', 'Trending'], ['popular', 'Popular'], ['new', 'New'], ['rising', 'Rising']].map(function (t) {
        return { label: t[1], on: st.tab === t[0], cls: st.tab === t[0] ? 'on' : '', pick: function () { self.setState({ tab: t[0], shown: 20 }); } };
      }),
      formats: [['all', 'All'], ['comic', 'Comics'], ['novel', 'Web novels']].map(function (f) {
        return { label: f[1], on: st.format === f[0], cls: st.format === f[0] ? 'on' : '', pick: function () { self.setState({ format: f[0], shown: 20 }); } };
      }),
      genre: st.genre, genreOpts: genres.map(function (g) { return { v: g, label: g }; }),
      onGenre: function (ev) { self.setState({ genre: ev.target.value, shown: 20 }); },
      hasPeriod: st.tab !== 'popular',
      periods: [['day', 'Today'], ['week', 'This week'], ['month', 'This month']].map(function (p) {
        return { label: p[1], on: st.period === p[0], cls: st.period === p[0] ? 'on' : '', pick: function () { self.setState({ period: p[0] }); } };
      }),
      hasTop: topN > 0 && rows.length >= 3, top: topN && rows.length >= 3 ? rows.slice(0, 3) : [],
      hasRows: rows.length > (topN && rows.length >= 3 ? 3 : 0), rows: topN && rows.length >= 3 ? rows.slice(3) : rows, listStart: topN && rows.length >= 3 ? 4 : 1,
      isEmpty: !all.length, emptyWhat: st.format === 'novel' ? 'web novels' : st.format === 'comic' ? 'comics' : 'series',
      resetFilters: function () { self.setState({ genre: 'All genres', format: 'all', tab: 'trending' }); },
      hasMore: all.length > st.shown, shownCount: shown.length, totalCount: all.length,
      more: function () { self.setState({ shown: st.shown + 20 }); },
      periodLabel: periodLabel
    });
  }
