  constructor(props) {
    super(props);
    this.pageName = 'Genres';
    var g = null, f = null;
    try { g = this.get('toonwave.genre'); f = this.get('toonwave.genreFormat'); } catch (e) {}
    this.state = Object.assign({}, this.state || {}, { genre: g || 'All', format: f === 'novel' || f === 'comic' ? f : 'all', status: 'any', day: 'any', sort: 'popular', shown: 18, toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  isDone(s) { return parseInt(s.id.slice(1), 10) % 5 === 0; }
  info() {
    return {
      Drama: ['Family secrets, second chances and stories that stay with you.', '#fef3c7', '#92400e'],
      Fantasy: ['Magic, quests and worlds with their own rules.', '#ede9fe', '#5b21b6'],
      Comedy: ['Quick laughs, chaotic friends and very small dragons.', '#fee2e2', '#991b1b'],
      Action: ['Chases, fights and heroes who never miss a delivery.', '#ffedd5', '#9a3412'],
      'Slice of life': ['Quiet, warm stories about everyday people.', '#e0f2fe', '#075985'],
      Romance: ['Slow burns, sweet notes and big feelings.', '#fce7f3', '#9d174d'],
      Superhero: ['Capes, secret identities and rent that’s still due.', '#dbeafe', '#1e40af'],
      'Sci-fi': ['Signals from space, strange tech and the near future.', '#dcfce7', '#166534']
    };
  }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals(st.format === 'novel' ? 'novels' : 'genres');
    var pool = this.pool();
    var match = function (s, ignoreGenre) {
      if (!ignoreGenre && st.genre !== 'All' && s.genre !== st.genre) return false;
      if (st.format === 'comic' && s.novel) return false;
      if (st.format === 'novel' && !s.novel) return false;
      if (st.status === 'completed' && !self.isDone(s)) return false;
      if (st.status === 'ongoing' && self.isDone(s)) return false;
      if (st.day !== 'any' && s.day !== st.day) return false;
      return true;
    };
    var list = pool.filter(function (s) { return match(s); });
    var cmp = {
      popular: function (a, b) { return self.num(b.views) - self.num(a.views); },
      liked: function (a, b) { return self.num(b.likes) - self.num(a.likes); },
      updated: function (a, b) { return (b.up ? 1 : 0) - (a.up ? 1 : 0) || parseInt(b.id.slice(1), 10) - parseInt(a.id.slice(1), 10); },
      az: function (a, b) { return a.title.localeCompare(b.title); }
    }[st.sort];
    list.sort(cmp);
    var genres = ['All', 'Drama', 'Fantasy', 'Comedy', 'Action', 'Slice of life', 'Romance', 'Superhero', 'Sci-fi'];
    var info = this.info()[st.genre];
    var filterCount = (st.format !== 'all' ? 1 : 0) + (st.status !== 'any' ? 1 : 0) + (st.day !== 'any' ? 1 : 0);
    var setG = function (g) { self.put('toonwave.genre', g); self.setState({ genre: g, shown: 18 }); };
    var days = [['any', 'Any day'], ['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'], ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday']];
    var shown = list.slice(0, st.shown);
    var gPool = pool.filter(function (s) { return s.genre === st.genre; });
    return Object.assign(sv, {
      pageTitle: st.format === 'novel' ? 'Web novels' : 'Genres',
      pageLead: st.format === 'novel' ? 'Stories to read in text, chapter by chapter.' : 'Find your next series by genre, format and update day.',
      genreChips: genres.map(function (g) {
        var c = pool.filter(function (s) { return (g === 'All' || s.genre === g) && match(s, true); }).length;
        return { label: g === 'All' ? 'All genres' : g, count: c, on: st.genre === g, cls: st.genre === g ? 'on' : '', pick: function () { setG(g); } };
      }),
      hasBanner: !!info,
      banner: info ? { name: st.genre, desc: info[0], bg: info[1], ink: info[2], count: gPool.length, covers: gPool.slice(0, 3).map(function (s) { return { cover: s.cover }; }) } : { name: '', desc: '', bg: '', ink: '', count: 0, covers: [] },
      formats: [['all', 'All'], ['comic', 'Comics'], ['novel', 'Web novels']].map(function (f) {
        return { label: f[1], on: st.format === f[0], cls: st.format === f[0] ? 'on' : '', pick: function () { self.put('toonwave.genreFormat', f[0]); self.setState({ format: f[0], shown: 18 }); } };
      }),
      status: st.status, onStatus: function (ev) { self.setState({ status: ev.target.value, shown: 18 }); },
      day: st.day, dayOpts: days.map(function (d) { return { v: d[0], label: d[1] }; }), onDay: function (ev) { self.setState({ day: ev.target.value, shown: 18 }); },
      sort: st.sort, onSort: function (ev) { self.setState({ sort: ev.target.value }); },
      countLine: list.length + ' ' + (list.length === 1 ? 'series' : 'series') + (st.genre !== 'All' ? ' in ' + st.genre : ''),
      hasFilters: filterCount > 0, filterCount: filterCount,
      clearFilters: function () { self.put('toonwave.genreFormat', 'all'); self.setState({ format: 'all', status: 'any', day: 'any', shown: 18 }); },
      hasResults: list.length > 0, isEmpty: !list.length,
      results: shown.map(function (s) { return Object.assign(self.card(s), { done: self.isDone(s), sub: (self.isDone(s) ? 'Completed' : s.schedule) + ' · ♥ ' + s.likes }); }),
      hasMore: list.length > st.shown, shownCount: shown.length, totalCount: list.length,
      more: function () { self.setState({ shown: st.shown + 18 }); }
    });
  }
