  constructor(props) {
    super(props);
    this.pageName = 'Profile';
    this.state = Object.assign({}, this.state || {}, { tab: 'series', editing: false, ed: null, toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  userName() { var u = this.get('toonwave.user'); return u || 'Sokha Chan'; }
  prof() { return Object.assign({ name: 'Sokha Chan', place: 'Phnom Penh', bio: 'I draw quiet stories about rivers, markets and the people in between. New River Lantern episodes every Saturday.' }, this.read('toonwave.profile', {}) || {}); }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var owner = (this.props.demoView || 'reader') === 'owner';
    var p = this.prof();
    var follows = this.read('toonwave.follows', []) || [];
    var following = follows.indexOf('sokha') >= 0;
    var works = this.myWorks().filter(function (w) { return w.status !== 'draft'; });
    var ed = st.ed || p;
    var setEd = function (k, v) { var n = Object.assign({}, ed); n[k] = v; self.setState({ ed: n }); };
    return Object.assign(sv, {
      cnav: this.creatorNav('Profile'), isOwner: owner, isReader: !owner,
      name: p.name, handle: p.name.toLowerCase().replace(/[^a-z]+/g, ''), place: p.place, bio: p.bio, initials: this.initials(p.name),
      stats: [['Followers', following ? '12,415' : '12,414'], ['Series', String(works.length)], ['Likes', '24.1K'], ['Episodes', String(works.reduce(function (a, w) { return a + w.eps; }, 0))]].map(function (x) { return { k: x[0], v: x[1] }; }),
      following: following, followCls: following ? 'btn-secondary' : 'btn-primary', followLabel: following ? '✓ Following' : '+ Follow',
      follow: function () {
        if (!sv.loggedIn) { self.say('Log in to follow creators'); return; }
        self.put('toonwave.follows', JSON.stringify(following ? follows.filter(function (x) { return x !== 'sokha'; }) : follows.concat(['sokha'])));
        self.setState({ _sync: Date.now() }); self.say(following ? 'Unfollowed ' + p.name : 'You’ll get alerts from ' + p.name);
      },
      share: function () { self.say('Profile link copied'); },
      blockLabel: this.isBlocked(p.name) ? 'Unblock' : 'Block',
      reportUser: function () { if (!sv.loggedIn) { self.say('Log in to report'); return; } self.openReport('user', 'account', p.name); },
      blockUser: function () {
        if (!sv.loggedIn) { self.say('Log in to block'); return; }
        if (self.isBlocked(p.name)) { self.put('toonwave.blocked', JSON.stringify(self.blocked().filter(function (x) { return x !== p.name; }))); self.setState({ _sync: Date.now() }); self.say(p.name + ' is unblocked'); return; }
        self.openBlock(p.name);
      },
      editing: owner && st.editing, editLabel: st.editing ? 'Close editor' : 'Edit profile',
      toggleEdit: function () { self.setState({ editing: !st.editing, ed: null }); },
      ed: ed, bioCount: (ed.bio || '').length,
      onEdName: function (ev) { setEd('name', ev.target.value.slice(0, 30)); }, onEdPlace: function (ev) { setEd('place', ev.target.value.slice(0, 30)); }, onEdBio: function (ev) { setEd('bio', ev.target.value.slice(0, 200)); },
      saveEdit: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if ((ed.name || '').trim().length < 2) { self.say('Enter a display name'); return; }
        self.put('toonwave.profile', JSON.stringify(ed)); self.setState({ editing: false, ed: null }); self.say('Profile saved');
      },
      tabs: [['series', 'Series'], ['updates', 'Updates'], ['about', 'About']].map(function (t) { return { label: t[1], on: st.tab === t[0], cls: st.tab === t[0] ? 'on' : '', pick: function () { self.setState({ tab: t[0] }); } }; }),
      tabSeries: st.tab === 'series', tabUpdates: st.tab === 'updates', tabAbout: st.tab === 'about',
      seriesHref: this.href('Series'),
      series: works.map(function (w) {
        var live = w.status === 'published', unitL = w.format === 'novel' ? 'chapter' : 'episode';
        return Object.assign({}, w, { live: live, soon: !live, unitL: unitL, formatLabel: w.format === 'novel' ? 'Web novel' : 'Comic',
          meta: live ? w.eps + ' ' + unitL + 's · Every ' + self.dayLong(w.day) + ' · ' + w.subs + ' subscribers' : 'First ' + unitL + 's coming soon',
          open: function () { self.storeSeries({ id: w.id, title: w.title, genre: w.genre, creator: p.name, cover: w.cover, likes: w.likes, views: w.views, episodes: w.eps, schedule: 'Every ' + self.dayLong(w.day) }); } });
      }),
      posts: [['2 days ago', 'Behind the panels: Episode 24', 'The ferry scene took 3 weeks. Here are my first sketches and the colour tests that didn’t make it.', '1.2K', 86], ['Nov 1', 'New series coming soon', 'Night Market Detectives is in review! Two cousins, one noodle stall, lots of tiny mysteries.', '2.4K', 210], ['Oct 18', 'Thank you for 10,000 subscribers', 'I started River Lantern on my phone during lunch breaks. Thank you for reading every Saturday.', '3.1K', 342]].map(function (x) { return { when: x[0], t: x[1], b: x[2], likes: x[3], comments: x[4] }; }),
      about: [['Location', p.place], ['Languages', 'ខ្មែរ, English'], ['Creating since', 'March 2024'], ['Schedule', 'River Lantern every Saturday, 6:00 PM'], ['Contact', 'Through PhumiReader messages only']].map(function (x) { return { k: x[0], v: x[1] }; })
    });
  }
