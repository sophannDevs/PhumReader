  constructor(props) {
    super(props);
    this.pageName = 'Join';
    this.goRef = { current: null };
    this.state = Object.assign({}, this.state || {}, { readers: 200, eps: 4, faqOpen: 0, toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var pool = this.pool();
    var coins = st.readers * st.eps * 5;
    return Object.assign(sv, {
      goRef: this.goRef, startHref: sv.loggedIn ? this.href('CreateSeries') : this.href('Auth'),
      startLabel: sv.loggedIn ? 'Start creating' : 'Sign up and start creating',
      start: function () {
        if (!sv.loggedIn) { self.put('toonwave.returnTo', self.href('CreateSeries')); self.put('toonwave.authMode', 'signup'); }
        self.go(self.goRef);
      },
      covers: ['a', 'b', 'c', 'd', 'e'].map(function (k, i) { return { cover: pool[[3, 9, 15, 21, 30][i]].cover, cls: k }; }),
      steps: [['1', 'Create your series', 'Title, genre, summary and a 3:4 cover. Takes about 15 minutes.'], ['2', 'We review it', 'Within 1–2 days. If something needs fixing, we tell you exactly what.'], ['3', 'Publish on your schedule', 'Upload episodes and schedule them. Subscribers get an alert.'], ['4', 'Grow and earn', 'Reply to comments, watch your stats, and turn on Fast Pass.']].map(function (s) { return { n: s[0], t: s[1], d: s[2] }; }),
      readers: st.readers, eps: st.eps,
      onReaders: function (ev) { self.setState({ readers: parseInt(ev.target.value, 10) || 10 }); },
      onEps: function (ev) { self.setState({ eps: parseInt(ev.target.value, 10) || 1 }); },
      coinsOut: String(coins).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      tools: [['▦', 'Creator dashboard', 'Views, subscribers and coins earned, updated hourly.'], ['⏱', 'Scheduling', 'Upload ahead and release at the best time for your readers.'], ['ក', 'Khmer and English', 'Publish in one language or both as separate versions.'], ['“', 'Comments with pinned replies', 'Talk to readers and pin your notes to the top.'], ['C', 'Fast Pass earnings', 'Readers unlock your newest episodes early with coins.'], ['✓', 'Help from our team', 'Clear review feedback and creator support by email or Telegram.']].map(function (t) { return { ic: t[0], t: t[1], d: t[2] }; }),
      rules: ['Your original work, or work you have the rights to', 'An honest age rating (All ages, 13+, 16+ or 18+)', 'A clean 3:4 cover with no watermark', 'No phone numbers, links or ads in the title or summary', 'Comic images 690–1600 px wide; chapters of at least 300 words', 'A regular schedule, or a note to readers when you take a break'].map(function (t) { return { t: t }; }),
      faq: [['Do I need to be a professional?', 'No. Many creators start with a phone and a free drawing app. What matters is a story readers want to come back to.'], ['Can I publish in Khmer?', 'Yes. Publish in Khmer, English, or both as separate versions. Readers choose which language they see.'], ['Who owns my work?', 'You do. You give PhumiReader permission to show your series on the app, as set out in the creator agreement. You can hide your series at any time.'], ['How long does review take?', 'Usually 1–2 days for a new series. If we need changes, we list exactly what to fix and you can resubmit right away.'], ['When do I get paid?', 'Earnings come from Fast Pass coins. Payouts go to your bank account on [PAYOUT SCHEDULE] once you pass [MIN PAYOUT].']].map(function (f, i) { var on = st.faqOpen === i; return { q: f[0], a: f[1], open: on, cls: on ? 'on' : '', toggle: function () { self.setState({ faqOpen: on ? -1 : i }); } }; })
    });
  }
