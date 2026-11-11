  constructor(props) {
    super(props);
    this.pageName = 'Creator';
    this.state = Object.assign({}, this.state || {}, { filter: 'all', open: -1, drafts: {}, replies: {}, liked: {}, toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  userName() { var u = this.get('toonwave.user'); return u || 'Sokha Chan'; }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var isNew = (this.props.demoState || 'active') === 'new-creator';
    var works = isNew ? [] : this.myWorks();
    var first = (sv.userName || 'there').split(' ')[0];
    var lbl = { published: ['Published', 'badge-brand'], review: ['In review', 'badge-warn'], changes: ['Changes requested', 'badge-up'], draft: ['Draft', 'badge-secondary'] };
    var shown = works.filter(function (w) { return st.filter === 'all' || (st.filter === 'live' ? w.status === 'published' : w.status !== 'published'); });
    var views = [5.1, 4.8, 6.2, 5.9, 5.4, 7.8, 13.6, 6.0, 5.6, 6.4, 6.1, 5.8, 8.2, 14.1];
    var max = Math.max.apply(null, views);
    var days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    var cm = [
      { name: 'Dara K.', where: 'River Lantern · Ep. 24', text: 'The lantern scene at the ferry made me cry. When does Ep. 25 come out?' },
      { name: 'Linh T.', where: 'River Lantern · Ep. 24', text: 'Love the colours in the river panels!' },
      { name: 'Vibol S.', where: 'River Lantern · Ep. 23', text: 'Is the old ferryman going to come back?' }
    ];
    return Object.assign(sv, {
      cnav: this.creatorNav('Creator'),
      hello: isNew ? 'Welcome to Creator studio, ' + first : 'Good morning, ' + first,
      subLine: isNew ? 'Share your comics and web novels with readers in Cambodia and beyond.' : 'River Lantern Ep. 25 goes live Saturday at 6:00 PM.',
      isNew: isNew, hasWorks: works.length > 0,
      startSteps: [['1', 'Create a series', 'Title, genre, summary and cover'], ['2', 'Upload episode 1', 'Images for comics, text for web novels'], ['3', 'Submit for review', 'We check new series within 1–2 days']].map(function (x, i) { return { n: x[0], t: x[1], d: x[2], cls: '' }; }),
      stats: [['Views', '182.4K', '▲ 12%', 'up-t', sv.creatorHref], ['New subscribers', '1,284', '▲ 8%', 'up-t', sv.creatorHref], ['Likes', '24.1K', '▼ 3%', 'down-t', sv.creatorHref], ['Coins earned', '3,420', '▲ 21% · See earnings', 'up-t', sv.earnHref]].map(function (x) { return { label: x[0], v: x[1], delta: x[2], dCls: x[3], href: x[4] }; }),
      bars: views.map(function (v, i) { return { h: Math.round(v / max * 100) + '%', d: days[i % 7].slice(0, 2), tip: days[i % 7] + ': ' + v + 'K views', cls: i === views.length - 1 ? 'today' : '' }; }),
      chartAria: 'Daily views for the last 14 days, between 4.8K and 14.1K. Peaks on Saturdays when new episodes come out.',
      filters: [['all', 'All', works.length], ['live', 'Published', works.filter(function (w) { return w.status === 'published'; }).length], ['wip', 'Drafts and review', works.filter(function (w) { return w.status !== 'published'; }).length]].map(function (f) {
        return { label: f[1], count: f[2], on: st.filter === f[0], cls: st.filter === f[0] ? 'on' : '', pick: function () { self.setState({ filter: f[0] }); } };
      }),
      works: shown.map(function (w) {
        var pub = w.status === 'published', unit = w.format === 'novel' ? 'chapters' : 'episodes';
        return Object.assign({}, w, {
          statusLabel: lbl[w.status][0], statusCls: lbl[w.status][1], formatLabel: w.format === 'novel' ? 'Web novel' : 'Comic',
          meta: pub ? w.eps + ' ' + unit + ' · ' + w.views + ' views · ' + w.subs + ' subscribers' : w.status === 'changes' ? 'The review team asked for changes. Open Manage to see what to fix.' : w.status === 'review' ? w.eps + ' ' + unit + ' ready · Review usually takes 1–2 days' : 'Missing: summary, cover and chapter 1',
          next: pub ? 'Next: Ep. ' + (w.eps + 1) + ' scheduled · Sat, Nov 14 · 6:00 PM' : w.status === 'changes' ? 'Fix and resubmit to keep your place in the queue' : w.status === 'review' ? 'We’ll notify you when it’s approved' : 'Finish setup to submit for review',
          nextCls: pub ? 'up-t' : 'muted',
          uploadLabel: w.status === 'changes' ? 'Fix and resubmit' : w.status === 'draft' ? 'Continue setup' : (w.format === 'novel' ? 'Add chapter' : 'Upload episode'),
          primaryHref: w.status === 'changes' ? sv.manageHref : w.status === 'draft' ? sv.createHref : sv.uploadHref,
          upload: function () { self.put('toonwave.uploadFor', w.id); self.put('toonwave.editSeries', w.id); },
          edit: function () { self.put('toonwave.editSeries', w.id); }
        });
      }),
      todos: [['→', 'go', 'Ep. 25 is scheduled', 'Saturday 6:00 PM · 3 Fast Pass episodes ready'], ['6', 'go', 'Reply to new comments', 'Readers who get replies come back more often'], ['…', 'wait', 'Night Market Detectives is in review', 'Submitted Nov 9 · usually 1–2 days'], ['!', '', 'Monsoon Letters needs a cover', 'Add a 3:4 cover to submit it']].map(function (t) { return { ic: t[0], cls: t[1], t: t[2], d: t[3] }; }),
      commentCount: cm.length,
      comments: cm.map(function (c, i) {
        var replied = st.replies[i], liked = !!st.liked[i];
        return Object.assign({}, c, {
          ini: self.initials(c.name), inId: 'rp-' + i, open: st.open === i && !replied, canReply: !replied && st.open !== i,
          replied: !!replied, reply: replied || '', draft: st.drafts[i] || '', liked: liked, likeLabel: liked ? '♥ Liked' : '♡ Like',
          toggle: function () { self.setState({ open: st.open === i ? -1 : i }); },
          onDraft: function (ev) { var d = Object.assign({}, st.drafts); d[i] = ev.target.value.slice(0, 300); self.setState({ drafts: d }); },
          send: function (ev) {
            if (ev && ev.preventDefault) ev.preventDefault();
            var t = (st.drafts[i] || '').trim(); if (!t) { self.say('Write a reply first'); return; }
            var r = Object.assign({}, st.replies); r[i] = t; self.setState({ replies: r, open: -1 }); self.say('Reply posted');
          },
          like: function () { var l = Object.assign({}, st.liked); l[i] = !liked; self.setState({ liked: l }); }
        });
      })
    });
  }
