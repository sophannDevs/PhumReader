  constructor(props) {
    super(props);
    this.pageName = 'Help';
    var ds = props.demoState || 'browse';
    var em = '';
    try { em = this.get('toonwave.user') ? 'reader@phumireader.app' : ''; } catch (e) {}
    this.state = Object.assign({}, this.state || {}, {
      q: ds === 'search' ? 'refund' : '', topic: 'all', open: ds === 'search' ? 0 : -1, votes: {},
      c: { topic: ds === 'contact-sent' ? 'payment' : '', email: ds === 'contact-sent' ? 'reader@phumireader.app' : em, order: '', msg: '', files: 0 }, tried: false, busy: false,
      sent: ds === 'contact-sent', ticket: 'T-58213', toast: '', searchOpen: false, userMenu: false
    });
    var pf = null; try { pf = this.read('toonwave.helpPrefill', null); } catch (e) {}
    if (pf && ds !== 'contact-sent') { this.state.c = Object.assign({}, this.state.c, { topic: pf.topic || '', order: pf.order || '', msg: pf.msg || '' }); this.put('toonwave.helpPrefill', null); }
  }
  componentDidMount() { this.sharedMount(); if (this.get('toonwave.helpContact')) { this.put('toonwave.helpContact', null); try { var el = document.getElementById('ct-topic'); if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); } } catch (e) {} } }
  componentWillUnmount() { this.sharedUnmount(); }
  articles() {
    var shop = this.href('Shop'), set = this.href('Settings'), lg = this.href('Legal'), up = this.href('Upload'), er = this.href('Earnings');
    return [
      ['coins', 'What is Fast Pass?', 'Fast Pass lets you read the newest episodes before they’re free. Each Fast Pass episode costs 5 coins. Every episode becomes free for everyone 7 days after it comes out.', '', ''],
      ['coins', 'How do I buy coins?', 'Go to Coins, pick a pack, and pay with KHQR, ABA Pay or a card. Your first purchase gives you double coins. Coins arrive in a few seconds.', shop, 'Go to Coins'],
      ['coins', 'Do coins expire?', 'No. Coins you buy never expire. Bonus coins from events may have an end date, which we show when you get them.', '', ''],
      ['coins', 'I paid but didn’t get my coins', 'Most payments confirm within seconds. If it’s been more than 10 minutes, send us a message with your order number (it starts with TW-). We’ll check with the bank and add your coins or refund you.', '', ''],
      ['coins', 'Can I get a refund?', 'Coins you haven’t spent can be refunded within the refund period. Coins already spent on episodes can’t be refunded. If you were charged twice or a payment failed, we refund it in full.', lg, 'Read the coins and refunds policy', 'refund'],
      ['account', 'I forgot my password', 'On the Log in page, tap “Forgot password?”, enter your email, and we’ll send you a 6-digit code to set a new password.', this.href('Auth'), 'Go to Log in'],
      ['account', 'How do I change my name or language?', 'Open Settings. Your display name is under Account, and the app language (English or ខ្មែរ) is under Language and region.', set, 'Open Settings'],
      ['account', 'How do I delete my account?', 'Open Settings → Account actions → Delete account. This deletes your library, comments and unused coins, and can’t be undone.', set, 'Open Settings'],
      ['reading', 'Images load slowly or look blurry', 'Check your connection, then set Image quality to Automatic in Settings → Reading. On mobile data, “Data saver” loads smaller images.', set, 'Open reading settings'],
      ['reading', 'How do I get alerts for new episodes?', 'Subscribe to a series. You’ll get a notification when a new episode comes out. Choose push or email in Notifications → Alert settings.', this.href('Notifications'), 'Alert settings'],
      ['creators', 'How do I publish my comic or novel?', 'Open Creator studio → New series, add the details, summary and cover, then submit it for review. We check new series within 1–2 days. Then upload your first episode.', this.href('CreateSeries'), 'Create a series'],
      ['creators', 'What image size should episodes be?', 'Use JPG or PNG, 690–1600 px wide, up to 20 MB per image. Upload them in reading order; you can reorder before publishing.', up, 'Upload an episode'],
      ['creators', 'How do creators get paid?', 'You earn when readers spend coins on your Fast Pass episodes. Add a payout method in Earnings. Payout amounts and dates follow the creator agreement.', er, 'Go to Earnings'],
      ['safety', 'How do I report a comment or series?', 'Tap “Report” next to a comment, or “Report it” on a series’ About tab. Choose a reason and send. We review reports within 24 hours. Reports are anonymous.', lg, 'Read the community guidelines', 'community'],
      ['safety', 'How do I block someone?', 'Tap “Block” next to their comment or on their profile. You won’t see their comments and they can’t reply to you. Unblock them any time in Settings → Privacy and safety.', set, 'Blocked accounts'],
      ['tech', 'The app shows “You’re offline”', 'Turn airplane mode off, then turn Wi-Fi or mobile data off and on again. The page reconnects by itself when you’re back online.', '', ''],
      ['tech', 'Something isn’t working', 'Try refreshing the page or updating your browser. If it still doesn’t work, send us a message with a screenshot and what you were trying to do.', '', '']
    ];
  }
  renderVals() {
    var self = this, st = this.state, c = st.c;
    var sv = this.sharedVals('');
    var topics = [['account', 'Account and log in', '@'], ['coins', 'Coins and payments', 'C'], ['reading', 'Reading', '▶'], ['creators', 'For creators', '✎'], ['safety', 'Safety and reports', '!'], ['tech', 'Technical problems', '⚙']];
    var tname = {}; topics.forEach(function (t) { tname[t[0]] = t[1]; });
    var arts = this.articles();
    var q = st.q.trim().toLowerCase();
    var words = q.split(/\s+/).filter(Boolean);
    var list = arts.map(function (a, i) { return { a: a, i: i }; }).filter(function (x) {
      if (st.topic !== 'all' && x.a[0] !== st.topic) return false;
      var hay = (x.a[1] + ' ' + x.a[2]).toLowerCase();
      return words.every(function (w) { return hay.indexOf(w) >= 0 || hay.indexOf(w.replace(/s$/, '')) >= 0; });
    });
    var set = function (k, v) { var n = Object.assign({}, st.c); n[k] = v; self.setState({ c: n }); };
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim());
    var orderOk = !c.order.trim() || /^TW-\d{8}$/i.test(c.order.trim());
    var msgOk = c.msg.trim().length >= 20;
    var t = st.tried;
    return Object.assign(sv, {
      q: st.q, hasQ: !!st.q, onQ: function (ev) { self.setState({ q: ev.target.value, open: -1 }); }, clearQ: function () { self.setState({ q: '' }); },
      noSubmit: function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); },
      popular: ['Fast Pass', 'Refund', 'Forgot password', 'Report'].map(function (p) { return { t: p, go: function () { self.setState({ q: p, topic: 'all', open: 0 }); } }; }),
      topics: topics.map(function (x) { var on = st.topic === x[0]; return { label: x[1], ic: x[2], n: arts.filter(function (a) { return a[0] === x[0]; }).length, on: on, cls: on ? 'on' : '', pick: function () { self.setState({ topic: on ? 'all' : x[0], open: -1 }); } }; }),
      faqTitle: st.topic !== 'all' ? tname[st.topic] : q ? 'Search results' : 'Common questions',
      filtered: st.topic !== 'all' || !!q, showAll: function () { self.setState({ topic: 'all', q: '' }); },
      resultLine: q ? list.length + ' article' + (list.length === 1 ? '' : 's') + ' for “' + st.q.trim() + '”' : list.length + ' articles',
      hasFaq: list.length > 0, noFaq: !list.length,
      faq: list.map(function (x, k) {
        var a = x.a, open = st.open === k, v = st.votes[x.i];
        return { q: a[1], a: a[2], topic: tname[a[0]], open: open, cls: open ? 'on' : '', hasLink: !!a[3], href: a[3], linkLabel: a[4],
          linkGo: function () { if (a[5]) self.put('toonwave.legalDoc', a[5]); },
          toggle: function () { self.setState({ open: open ? -1 : k }); },
          saidYes: v === 'y', saidNo: v === 'n', thanks: v === 'y' ? 'Thanks!' : v === 'n' ? 'Sorry. Send us a message below.' : '',
          yes: function () { var n = Object.assign({}, st.votes); n[x.i] = 'y'; self.setState({ votes: n }); },
          no: function () { var n = Object.assign({}, st.votes); n[x.i] = 'n'; self.setState({ votes: n }); } };
      }),
      c: c, notSent: !st.sent, sent: st.sent, ticket: st.ticket, busy: st.busy,
      onTopic: function (ev) { set('topic', ev.target.value); }, onEmail: function (ev) { set('email', ev.target.value); },
      onOrder: function (ev) { set('order', ev.target.value.toUpperCase().slice(0, 11)); }, onMsg: function (ev) { set('msg', ev.target.value.slice(0, 1000)); },
      isPayment: c.topic === 'payment', msgCount: c.msg.length,
      e: {
        topicBad: t && !c.topic, topicCls: t && !c.topic ? 'bad' : '',
        emailBad: t && !emailOk, emailCls: t && !emailOk ? 'bad' : '',
        orderCls: t && !orderOk ? 'bad' : '', orderHintCls: t && !orderOk ? 'err' : 'hint', orderHint: t && !orderOk ? 'Order numbers look like TW-12345678.' : 'Optional. Find it in Coins → Purchase history.',
        msgCls: t && !msgOk ? 'bad' : '', msgHintCls: t && !msgOk ? 'err' : 'hint', msgHint: t && !msgOk ? 'Write at least 20 characters.' : 'Include what you tapped and any error message.'
      },
      attachLabel: c.files ? c.files + ' screenshot added' : 'Add a screenshot',
      attach: function () { set('files', c.files + 1); self.say('Screenshot added (prototype)'); },
      send: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (!c.topic || !emailOk || !orderOk || !msgOk) { self.setState({ tried: true }); return; }
        self.setState({ busy: true });
        self.later(900, function () { self.setState({ busy: false, sent: true, ticket: 'T-' + (58213 + Math.floor(Math.random() * 900)) }); });
      },
      again: function () { self.setState({ sent: false, tried: false, c: Object.assign({}, c, { topic: '', order: '', msg: '', files: 0 }) }); }
    });
  }
