  constructor(props) {
    super(props);
    this.pageName = 'Admin';
    this.state = Object.assign({}, this.state || {}, { tab: props.demoTab || 'overview', srSel: 0, checks: {}, asking: false, changes: {}, srNote: '', askErr: false, rqFilter: 'all', rqSel: 0, act: '', actErr: false, undo: null, toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  componentDidUpdate(pp) { if (pp.demoTab !== this.props.demoTab) this.setState({ tab: this.props.demoTab || 'overview' }); }
  done(k) { var d = this.read('toonwave.admin.' + k, []); return Array.isArray(d) ? d : []; }
  markDone(k, id) { this.put('toonwave.admin.' + k, JSON.stringify(this.done(k).concat([id]))); }
  seriesQueue() {
    var c = this.pool().map(function (x) { return x.cover; });
    var base = [
      { id: 'C2', title: 'Night Market Detectives', creator: 'Sokha Chan', format: 'Comic', genre: 'Comedy', age: 'All ages', lang: 'ខ្មែរ', eps: '3 episodes', when: 'Nov 9, 4:12 PM', hours: 27, cover: c[9], summary: 'Two noodle-stall cousins solve tiny mysteries at the Russian Market. Follow us on Telegram @nightmarket_kh for extras!', flags: ['Summary may contain a social handle (“@nightmarket_kh”)', 'Cover may have a watermark (bottom-right corner)'] },
      { id: 'Q2', title: 'Steel Monsoon', creator: 'Phirun S.', format: 'Comic', genre: 'Action', age: '13+', lang: 'English', eps: '4 episodes', when: 'Nov 9, 9:30 PM', hours: 22, cover: c[13], summary: 'A street racer in Phnom Penh builds a motorbike that can outrun the rain, and the gang that wants it.', flags: ['Title is similar to an existing series: “Neon Monsoon”'] },
      { id: 'Q3', title: 'Moonlight Tuk-Tuk', creator: 'Rina T.', format: 'Web novel', genre: 'Romance', age: 'All ages', lang: 'ខ្មែរ', eps: '5 chapters', when: 'Nov 10, 8:05 AM', hours: 6, cover: c[20], summary: 'Every night at 11, the same passenger asks to be driven nowhere in particular. Tonight, the driver asks why.', flags: [] }
    ];
    var mine = this.myWorks().filter(function (w) { return w.status === 'review' && w.id !== 'C2'; }).map(function (w) {
      return { id: w.id, title: w.title, creator: 'Sokha Chan', format: w.format === 'novel' ? 'Web novel' : 'Comic', genre: w.genre, age: 'All ages', lang: 'ខ្មែរ', eps: w.eps + ' episodes', when: 'Just now', hours: 0, cover: w.cover, summary: w.summary || '', flags: [] };
    });
    var d = this.done('series');
    return base.concat(mine).filter(function (q) { return d.indexOf(q.id) < 0; });
  }
  reportQueue() {
    var base = [
      { id: 'R-20470', kind: 'comment', reason: 'violence', target: 'Comment by night_owl_22', who: 'night_owl_22', where: 'Midnight Courier · Episode 41', text: 'If the creator kills off Vee I will find where you live.', count: 4, hours: 2, details: '', history: '1 earlier warning (Oct 3) for harassment.' },
      { id: 'R-20466', kind: 'series', reason: 'copyright', target: 'Series “Glass Kompass”', who: 'artlover99', where: 'Series page', text: 'A series using the same art and story as Glass Compass, with a changed name.', count: 7, hours: 9, details: 'This is Owen Blake’s Glass Compass re-uploaded. Original: phumireader.app/series/glass-compass', history: 'New account (3 days old). No other series.' },
      { id: 'R-20461', kind: 'comment', reason: 'spam', target: 'Comment by free_coins_kh', who: 'free_coins_kh', where: 'Crown of Ash · Episode 12', text: 'FREE 1000 COINS!!! click t.me/freecoinskh', count: 12, hours: 15, details: '', history: '38 comments in 1 hour, all with the same link.' },
      { id: 'R-20455', kind: 'comment', reason: 'spoiler', target: 'Comment by Mai L.', who: 'Mai L.', where: 'Letters to Tuesday · Chapter 88', text: 'Can’t believe the letters were from her brother all along.', count: 2, hours: 20, details: '', history: 'No earlier reports.' }
    ];
    var mine = (this.read('toonwave.reports', []) || []).filter(function (r) { return r.status === 'In review'; }).map(function (r) {
      return { id: r.id, kind: r.kind, reason: r.reason, target: r.target.charAt(0).toUpperCase() + r.target.slice(1), who: (r.target.match(/by (.+)$/) || [0, 'the account'])[1], where: 'Reported from the reader app', text: '(Content as reported)', count: 1, hours: 0, details: '', history: 'No earlier reports.', mine: true };
    });
    var d = this.done('reports');
    return mine.concat(base).filter(function (q) { return d.indexOf(q.id) < 0; });
  }
  pri(r) { return /violence|sexual/.test(r) ? 'urgent' : /harass|hate|copyright|impersonate/.test(r) ? 'high' : 'normal'; }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var sq = this.seriesQueue(), rq0 = this.reportQueue();
    var rank = { urgent: 0, high: 1, normal: 2 };
    rq0.sort(function (a, b) { return rank[self.pri(a.reason)] - rank[self.pri(b.reason)] || a.hours - b.hours; });
    var rq = rq0.filter(function (r) { return st.rqFilter === 'all' || self.pri(r.reason) === st.rqFilter; });
    var refunds0 = [
      { id: 'F1', order: 'TW-48213377', user: 'Sokha P.', pack: '120 coins + bonus', method: 'KHQR', when: 'Nov 9', reason: '“I bought the wrong pack by mistake.”', elig: 'Unused · eligible', eligCls: 'badge-brand', label: 'Refund' },
      { id: 'F2', order: 'TW-48207731', user: 'Vibol K.', pack: '60 coins', method: 'ABA Pay', when: 'Nov 8', reason: 'Charged twice for the same order.', elig: 'Double charge', eligCls: 'badge-brand', label: 'Refund duplicate' },
      { id: 'F3', order: 'TW-48190020', user: 'Linh T.', pack: '300 coins', method: 'Card', when: 'Oct 21', reason: '“I don’t read anymore.”', elig: '210 coins spent · 90 unused', eligCls: 'badge-warn', label: 'Refund 90 unused' }
    ];
    var refunds = refunds0.filter(function (r) { return self.done('refunds').indexOf(r.id) < 0; });
    var sel = sq[Math.min(st.srSel, sq.length - 1)];
    var rsel = rq[Math.min(st.rqSel, rq.length - 1)];
    var reasonLbl = { spam: 'Spam or scam', harass: 'Harassment or bullying', hate: 'Hate speech', sexual: 'Sexual content', violence: 'Violence or threats', spoiler: 'Spoilers without warning', copyright: 'Stolen or copied work', impersonate: 'Pretending to be someone', rating: 'Wrong age rating', other: 'Something else' };
    var priLbl = { urgent: 'Urgent', high: 'High', normal: 'Normal' };
    var age = function (h) { return h <= 0 ? 'just now' : h < 24 ? h + 'h ago' : Math.floor(h / 24) + 'd ' + (h % 24) + 'h ago'; };
    var withUndo = function (k, id, text, extra) { self.markDone(k, id); self.setState(Object.assign({ undo: { k: k, id: id, text: text, extra: extra || null } }, {})); if (self._ut) clearTimeout(self._ut); self._ut = setTimeout(function () { self.setState({ undo: null }); }, 6000); };
    var checks = ['Original work (no signs of copying)', 'Age rating matches the content', 'Cover is clean (no watermark, readable)', 'Summary has no contact details or ads'];
    var allChecked = sel ? checks.every(function (c, i) { return st.checks[sel.id + i]; }) : false;
    var setWork = function (id, status) { var w = self.myWorks(); if (w.some(function (x) { return x.id === id; })) self.put('toonwave.myWorks', JSON.stringify(w.map(function (x) { return x.id === id ? Object.assign({}, x, { status: status }) : x; }))); };
    var changeOpts = ['Remove contact details or links from the summary', 'Replace the cover (watermark or unreadable)', 'Change the title (too close to an existing series)', 'Choose a higher age rating', 'Fix image size or quality in an episode'];
    var acts = [['remove', 'Remove content', 'Hide it for everyone'], ['warn', 'Remove and warn', 'Strike 1 of 3 on the account'], ['suspend', 'Remove and suspend 7 days', 'Can’t comment or upload'], ['dismiss', 'No violation', 'Keep it up and close the report']];
    var setRep = function (id, status) { var l = self.read('toonwave.reports', []) || []; if (l.some(function (r) { return r.id === id; })) self.put('toonwave.reports', JSON.stringify(l.map(function (r) { return r.id === id ? Object.assign({}, r, { status: status }) : r; }))); };
    var stuckDone = this.done('stuck');
    var urgentN = rq0.filter(function (r) { return self.pri(r.reason) === 'urgent'; }).length;
    var go = function (t) { self.setState({ tab: t }); try { window.scrollTo(0, 0); } catch (e) {} };
    return Object.assign(sv, {
      nav: [['overview', 'Overview', 0, ''], ['series', 'Series review', sq.length, 'badge-secondary'], ['reports', 'Reports', rq0.length, urgentN ? 'badge-up' : 'badge-secondary'], ['payments', 'Payments and refunds', refunds.length, 'badge-secondary']].map(function (n) {
        var on = st.tab === n[0]; return { label: n[1], count: n[2], hasCount: n[2] > 0, badgeCls: n[3], cls: on ? 'on' : '', cur: on ? 'page' : 'false', pick: function () { go(n[0]); } };
      }),
      tOverview: st.tab === 'overview', tSeries: st.tab === 'series', tReports: st.tab === 'reports', tPayments: st.tab === 'payments',
      kpis: [['Series to review', String(sq.length), sq.length ? 'Oldest waiting ' + age(Math.max.apply(null, sq.map(function (q) { return q.hours; }))) : 'All done', 'muted', 'series'], ['Open reports', String(rq0.length), urgentN + ' urgent', urgentN ? 'down-t' : 'muted', 'reports'], ['Refund requests', String(refunds.length), 'Target: 2 business days', 'muted', 'payments'], ['Paid, no coins', String(2 - stuckDone.length), 'Fix today', stuckDone.length < 2 ? 'down-t' : 'muted', 'payments']].map(function (k) { return { label: k[0], v: k[1], d: k[2], dCls: k[3], go: function () { go(k[4]); } }; }),
      oldest: sq.slice().sort(function (a, b) { return b.hours - a.hours; }).slice(0, 2).map(function (q) { return { t: q.title, d: 'Series review · ' + q.creator, age: age(q.hours), cls: q.hours > 24 ? 'badge-up' : 'badge-secondary' }; }).concat(rq0.slice(0, 2).map(function (r) { return { t: reasonLbl[r.reason], d: 'Report · ' + r.target, age: age(r.hours), cls: self.pri(r.reason) === 'urgent' ? 'badge-up' : 'badge-secondary' }; })),
      log: [['Approved “Paper Moon Hotel” season 2', 'Dara M. · 9:40 AM'], ['Removed a spam comment, warned free_coins_kh', 'Sophea R. · 9:12 AM'], ['Refunded TW-48199914 (double charge)', 'Dara M. · 8:55 AM'], ['Requested changes on “Iron Lullaby” cover', 'Sophea R. · Yesterday']].map(function (l) { return { t: l[0], d: l[1] }; }),
      // Series review
      srLine: sq.length ? sq.length + ' waiting · oldest first is best · approve only when every check is ticked' : 'Nothing waiting',
      srHas: sq.length > 0, srEmpty: !sq.length,
      srQueue: sq.map(function (q, i) { var on = sel && q.id === sel.id; return { title: q.title, creator: q.creator, cover: q.cover, age: age(q.hours), hasFlags: q.flags.length > 0, flagCount: q.flags.length, plural: q.flags.length > 1 ? 's' : '', cls: on ? 'on' : '', cur: on ? 'true' : 'false', pick: function () { self.setState({ srSel: i, asking: false, askErr: false }); } }; }),
      sr: sel ? Object.assign({}, sel, { hasFlags: sel.flags.length > 0, flagCount: sel.flags.length, plural: sel.flags.length > 1 ? 's' : '', flags: sel.flags.map(function (f) { return { t: f }; }) }) : { title: '', cover: '', flags: [], hasFlags: false },
      srChecks: sel ? checks.map(function (c, i) { var on = !!st.checks[sel.id + i]; return { t: c, on: on, cls: on ? 'on' : '', toggle: function () { var n = Object.assign({}, st.checks); n[sel.id + i] = !on; self.setState({ checks: n }); } }; }) : [],
      cantApprove: !allChecked, approveHint: allChecked ? 'Approving publishes the series and notifies the creator.' : 'Tick every check to approve, or request changes.',
      approve: function () { if (!allChecked) return; setWork(sel.id, 'published'); withUndo('series', sel.id, '“' + sel.title + '” approved', { work: sel.id, prev: 'review' }); self.say('Approved. The creator was notified.'); },
      srAsking: st.asking, srNotAsking: !st.asking, askChanges: function () { var pre = {}; if (sel.flags.some(function (f) { return /handle|link/.test(f); })) pre[0] = true; if (sel.flags.some(function (f) { return /watermark/.test(f); })) pre[1] = true; if (sel.flags.some(function (f) { return /similar/.test(f); })) pre[2] = true; self.setState({ asking: true, changes: pre, srNote: '' }); },
      cancelAsk: function () { self.setState({ asking: false }); },
      changeOpts: changeOpts.map(function (t, i) { var on = !!st.changes[i]; return { t: t, on: on, cls: on ? 'on' : '', toggle: function () { var n = Object.assign({}, st.changes); n[i] = !on; self.setState({ changes: n, askErr: false }); } }; }),
      srNote: st.srNote, onSrNote: function (ev) { self.setState({ srNote: ev.target.value.slice(0, 300) }); }, srAskErr: st.askErr,
      sendChanges: function () { if (!Object.keys(st.changes).some(function (k) { return st.changes[k]; })) { self.setState({ askErr: true }); return; } setWork(sel.id, 'changes'); var rn = self.read('toonwave.reviewNotes', {}) || {}; rn[sel.id] = { items: changeOpts.filter(function (t, i) { return st.changes[i]; }), note: st.srNote.trim() }; self.put('toonwave.reviewNotes', JSON.stringify(rn)); withUndo('series', sel.id, 'Changes requested on “' + sel.title + '”', { work: sel.id, prev: 'review' }); self.setState({ asking: false }); self.say('Sent to the creator'); },
      rejectSr: function () { withUndo('series', sel.id, '“' + sel.title + '” rejected', { work: sel.id, prev: 'review' }); setWork(sel.id, 'draft'); self.say('Rejected. The creator was told why.'); },
      // Reports
      rpLine: rq0.length + ' open · urgent first · target 24 hours',
      rpFilters: [['all', 'All'], ['urgent', 'Urgent'], ['high', 'High'], ['normal', 'Normal']].map(function (f) { var on = st.rqFilter === f[0]; return { label: f[1], count: f[0] === 'all' ? rq0.length : rq0.filter(function (r) { return self.pri(r.reason) === f[0]; }).length, on: on, cls: on ? 'on' : '', pick: function () { self.setState({ rqFilter: f[0], rqSel: 0, act: '' }); } }; }),
      rqHas: rq.length > 0, rqEmpty: !rq.length,
      rq: rq.map(function (r, i) { var on = rsel && r.id === rsel.id, p = self.pri(r.reason); return { reasonLabel: reasonLbl[r.reason] || 'Report', target: r.target, count: r.count + ' report' + (r.count > 1 ? 's' : ''), age: age(r.hours), fromYou: r.mine ? ' · from your test account' : '', priCls: p, priLabel: priLbl[p] + ' priority', cls: on ? 'on' : '', cur: on ? 'true' : 'false', pick: function () { self.setState({ rqSel: i, act: '', actErr: false }); } }; }),
      rd: rsel ? { id: rsel.id, reasonLabel: reasonLbl[rsel.reason] || 'Report', priLabel: priLbl[self.pri(rsel.reason)], priBadge: self.pri(rsel.reason) === 'urgent' ? 'badge-up' : self.pri(rsel.reason) === 'high' ? 'badge-warn' : 'badge-secondary', kindLabel: { comment: 'Comment', series: 'Series', episode: 'Episode', user: 'Account' }[rsel.kind] || 'Content', count: rsel.count + ' report' + (rsel.count > 1 ? 's' : ''), where: rsel.where, text: rsel.text, hasDetails: !!rsel.details, details: rsel.details, who: rsel.who, history: rsel.history } : { id: '', hasDetails: false },
      rdActs: acts.map(function (a) { var on = st.act === a[0]; return { label: a[1], desc: a[2], on: on, cls: on ? 'on' : '', pick: function () { self.setState({ act: a[0], actErr: false }); } }; }),
      rdErr: st.actErr,
      resolve: function () {
        if (!st.act) { self.setState({ actErr: true }); return; }
        var status = st.act === 'dismiss' ? 'No violation found' : 'Removed';
        setRep(rsel.id, status); withUndo('reports', rsel.id, rsel.id + ': ' + (st.act === 'dismiss' ? 'closed, no violation' : 'content removed'), { rep: rsel.id });
        self.setState({ act: '', rqSel: 0 }); self.say('Done. The reporter was told the outcome.');
      },
      // Payments
      rfEmpty: !refunds.length,
      refunds: refunds.map(function (r) { return Object.assign({}, r, { approveLabel: r.label, approve: function () { withUndo('refunds', r.id, r.order + ' refunded'); self.say('Refund sent to ' + r.method); }, decline: function () { withUndo('refunds', r.id, r.order + ' declined'); self.say('Declined. The reader was told why.'); } }); }),
      stuck: [['S1', 'TW-48215502', 'Dara K.', '30 coins + bonus', 'KHQR', 'Today 7:58 AM'], ['S2', 'TW-48215488', 'Chenda P.', '10 coins', 'ABA Pay', 'Today 7:41 AM']].map(function (x) { var d = stuckDone.indexOf(x[0]) >= 0; return { order: x[1], user: x[2], pack: x[3], method: x[4], when: x[5], done: d, label: d ? '✓ Coins added' : 'Add coins', btnCls: d ? 'btn-secondary' : 'btn-primary', fix: function () { self.markDone('stuck', x[0]); self.setState({ _sync: Date.now() }); self.say('Coins added and the reader was notified'); } }; }),
      hasUndo: !!st.undo, undoText: st.undo ? st.undo.text : '',
      undo: function () {
        var u = st.undo; if (!u) return;
        self.put('toonwave.admin.' + u.k, JSON.stringify(self.done(u.k).filter(function (x) { return x !== u.id; })));
        if (u.extra && u.extra.work) setWork(u.extra.work, u.extra.prev);
        if (u.extra && u.extra.rep) setRep(u.extra.rep, 'In review');
        self.setState({ undo: null }); self.say('Undone');
      }
    });
  }
