  constructor(props) {
    super(props);
    this.pageName = 'Shop';
    this.goRef = { current: null };
    this.retRef = { current: null };
    this.state = Object.assign({}, this.state || {}, {
      pack: 3, method: 'khqr', step: 'review', deadline: 0, now: Date.now(), last: null, fail: '', faqOpen: 0,
      toast: '', searchOpen: false, userMenu: false, backIn: 0, autoPicked: false
    });
    try { this.pickForNeed(true); } catch (e) {}
  }
  componentDidMount() {
    this.sharedMount();
    var self = this;
    this.pickForNeed();
    this.tick = setInterval(function () {
      var st = self.state;
      if (st.step === 'success' && st.backIn > 0) {
        if (st.backIn === 1) { self.setState({ backIn: 0 }); self.go(self.retRef); } else self.setState({ backIn: st.backIn - 1 });
        return;
      }
      if (st.step !== 'pay') return;
      if (Date.now() >= st.deadline) self.finish('failed', 'expired');
      else self.setState({ now: Date.now() });
    }, 1000);
  }
  componentWillUnmount() { this.sharedUnmount(); if (this.tick) clearInterval(this.tick); }
  packs() {
    return [
      { coins: 10, bonus: 0, tag: '' }, { coins: 30, bonus: 3, tag: '' }, { coins: 60, bonus: 8, tag: '' },
      { coins: 120, bonus: 20, tag: 'Popular' }, { coins: 300, bonus: 60, tag: 'Best value' }
    ];
  }
  packTotal(i, first) { var p = this.packs()[i]; return p.coins + p.bonus + (first ? p.coins : 0); }
  // Prototype: with no real hand-off stored, "from-episode" shows the flow from a locked episode.
  ret() {
    var r = this.read('toonwave.shopReturn', null);
    if (r && r.page) return r;
    if ((this.props.demoFrom || 'from-episode') === 'from-episode' && !this.state.demoDone) return { page: this.href('Series'), ep: 66, title: 'Glass Compass', done: false, cost: this.price(), unit: 'episode', count: 1, demo: true };
    return null;
  }
  need() { var r = this.ret(); return r && r.page && !r.done ? Math.max(0, (r.cost || this.price()) - this.coins()) : 0; }
  // Coming from a locked episode: preselect the smallest pack that covers what they need.
  pickForNeed(init) {
    var need = this.need();
    if (!need) return;
    var first = this.isFirst();
    for (var i = 0; i < this.packs().length; i++) if (this.packTotal(i, first) >= need) {
      if (init) { this.state.pack = i; this.state.autoPicked = true; } else this.setState({ pack: i, autoPicked: true });
      return;
    }
  }
  purchases() { var v = this.read('toonwave.purchases', []); return Array.isArray(v) ? v : []; }
  isFirst() { return !this.purchases().some(function (p) { return p.status === 'Paid'; }); }
  methodLabel(k) { return { khqr: 'KHQR', aba: 'ABA Pay', card: 'Credit or debit card' }[k] || k; }
  order() {
    var p = this.packs()[this.state.pack];
    var first = this.isFirst() ? p.coins : 0;
    return { packLabel: p.coins + ' coin pack', base: p.coins, bonus: p.bonus, first: first, hasBonus: p.bonus > 0, hasFirst: first > 0, total: p.coins + p.bonus + first, after: this.coins() + p.coins + p.bonus + first };
  }
  fmtDate(t) { var d = new Date(t); var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; return m[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
  finish(result, reason) {
    var st = this.state;
    var o = this.order();
    var rec = { id: 'TW-' + String(Date.now()).slice(-8), at: Date.now(), pack: o.packLabel, coins: o.total, method: st.method, status: result === 'success' ? 'Paid' : (reason === 'cancel' ? 'Cancelled' : 'Failed') };
    this.put('toonwave.purchases', JSON.stringify([rec].concat(this.purchases()).slice(0, 30)));
    if (result === 'success') {
      this.put('toonwave.coins', String(this.coins() + o.total));
      var ret = this.ret();
      if (ret && ret.page && !ret.demo) this.put('toonwave.shopReturn', JSON.stringify(Object.assign({}, ret, { done: true })));
      if (ret && ret.demo) {
        var gc = this.byTitle(ret.title);
        if (gc) { this.storeSeries(gc); this.put('toonwave.v2pending', JSON.stringify({ id: gc.id, ep: ret.ep, all: false })); }
        this.setState({ demoDone: true, demoRet: ret });
      }
      this.setState({ step: 'success', deadline: 0, backIn: ret && ret.page && ret.ep ? 5 : 0, last: Object.assign({}, o, { id: rec.id, methodLabel: this.methodLabel(st.method) }) });
      this.say('+' + o.total + ' coins added');
    } else if (reason === 'cancel') {
      this.setState({ step: 'review', deadline: 0 });
    } else {
      this.setState({ step: 'failed', fail: reason || 'declined', deadline: 0 });
    }
  }
  qr() {
    var n = 21, out = [];
    var finder = function (x, y) {
      var c = [[0, 0], [14, 0], [0, 14]];
      for (var i = 0; i < 3; i++) {
        var dx = x - c[i][0], dy = y - c[i][1];
        if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7) {
          var edge = dx === 0 || dy === 0 || dx === 6 || dy === 6;
          var core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          return edge || core ? 1 : 0;
        }
        if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) return 0;
      }
      return -1;
    };
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var f = finder(x, y);
      var on = f >= 0 ? f === 1 : ((x * 7 + y * 13 + x * y) % 5) < 2;
      out.push({ c: on ? 'b' : '' });
    }
    return out;
  }

  renderVals() {
    var self = this;
    var st = this.state;
    var sv = this.sharedVals('');
    var o = this.order();
    var first = this.isFirst();
    var ret = this.ret() || st.demoRet || null;
    var hasRet = !!(ret && ret.page);
    var retLabel = '';
    if (hasRet) {
      var nov = /Novel/.test(ret.page);
      retLabel = ret.count > 1 ? ret.count + ' ' + (ret.unit || 'episode') + 's' + (ret.title ? ' of ' + ret.title : '') : ret.ep ? (nov ? 'chapter ' : 'episode ') + ret.ep + (ret.title ? ' of ' + ret.title : '') : (ret.title || 'where you were');
    }
    var left = Math.max(0, Math.ceil((st.deadline - st.now) / 1000));
    var hist = this.purchases();
    if (!hist.length) hist = [{ id: 'TW-48213377', at: Date.UTC(2026, 9, 28), pack: '30 coin pack', coins: 33, method: 'khqr', status: 'Paid' }, { id: 'TW-48190012', at: Date.UTC(2026, 9, 12), pack: '10 coin pack', coins: 10, method: 'card', status: 'Failed' }];
    var faqQ = [
      ['What can I use coins for?', 'Coins unlock Fast Pass episodes and chapters before they become free. Unlocked episodes stay in your library.'],
      ['Do coins expire?', 'No. Purchased coins never expire. Bonus coins from events may have an end date, shown when you get them.'],
      ['Which payment methods work?', 'KHQR works with any Bakong-member bank app. You can also pay with ABA Pay or a credit or debit card.'],
      ['I paid but didn’t get coins', 'Most payments confirm in seconds. If it takes longer than 10 minutes, contact Help with your order number.']
    ];
    var ic = { khqr: 'KHQR', aba: 'ABA', card: 'CARD' };
    var price = this.price();
    var coins = this.coins();
    var need = this.need();
    var unitL = hasRet && ret.unit ? ret.unit : (hasRet && /Novel/.test(ret.page) ? 'chapter' : 'episode');
    var stepIx = st.step === 'review' ? 1 : st.step === 'success' ? 3 : 2;
    var eq = function (n) { var k = Math.floor(n / price); return '≈ ' + k + ' Fast Pass ' + (k === 1 ? 'episode' : 'episodes'); };
    return Object.assign(sv, {
      goRef: this.goRef,
      retRef: this.retRef,
      hasReturn: hasRet, retLabel: retLabel,
      balEq: eq(coins),
      hasNeed: need > 0, needLine: need > 0 ? 'You need ' + need + ' more ' + (need === 1 ? 'coin' : 'coins') + ' to unlock ' + retLabel + '.' : '',
      needSub: st.autoPicked ? 'We picked the smallest pack that covers it. After paying we’ll take you straight back.' : 'After paying we’ll take you straight back.',
      retTitle: need > 0 ? 'Almost there' : 'Get coins for ' + retLabel,
      steps: [['1', 'Choose a pack'], ['2', 'Pay'], ['3', 'Done']].map(function (x, i) {
        var n = i + 1;
        var state = n < stepIx ? 'done' : n === stepIx ? 'cur' : '';
        return { n: x[0], label: x[1], cls: state, isDone: state === 'done', notDone: state !== 'done', cur: state === 'cur' ? 'step' : 'false', sepCls: n < stepIx ? 'done' : '', last: n === 3, notLast: n !== 3 };
      }),
      stepSr: 'Step ' + stepIx + ' of 3',
      backIn: st.backIn, autoBack: st.step === 'success' && st.backIn > 0,
      stayHere: function () { self.setState({ backIn: 0 }); }, retHref: hasRet ? ret.page : this.href('Home'),
      firstOffer: first,
      locked: st.step !== 'review' && st.step !== 'success' && st.step !== 'failed',
      packs: this.packs().map(function (p, i) {
        var bonus = p.bonus ? '+' + p.bonus + ' bonus (' + Math.round(p.bonus / p.coins * 100) + '%)' : 'No bonus';
        var total = self.packTotal(i, first);
        var covers = need > 0 && total >= need;
        var tag = covers && (i === 0 || self.packTotal(i - 1, first) < need) ? 'Covers it' : p.tag;
        return { coins: p.coins, tag: tag, hasTag: !!tag, eq: (first ? 'You get ' + total + ' · ' : '') + '≈ ' + Math.floor(total / price) + ' ' + unitL + 's', totalLine: first || p.bonus ? 'You get ' + total : '', hasTotal: !!(first || p.bonus), tagCls: tag === p.tag ? (p.tag === 'Popular' ? 'badge-new' : 'badge-default') : 'badge-warn', bonusLabel: bonus, bonusCls: p.bonus ? 'ink' : 'muted', on: st.pack === i, cls: st.pack === i ? 'on' : '', pick: function () { self.setState({ pack: i, step: 'review' }); } };
      }),
      methods: [
        ['khqr', 'KHQR', 'Scan with any Bakong-member bank app', true], ['aba', 'ABA Pay', 'Confirm in the ABA Mobile app', false], ['card', 'Credit or debit card', 'Visa, Mastercard, UnionPay, JCB', false]
      ].map(function (m) { return { label: m[1], desc: m[2], rec: m[3], ic: ic[m[0]], on: st.method === m[0], cls: st.method === m[0] ? 'on' : '', pick: function () { self.setState({ method: m[0], step: 'review' }); } }; }),
      o: o, methodLabel: this.methodLabel(st.method),
      stReview: st.step === 'review', stPay: st.step === 'pay', stProcessing: st.step === 'processing', stSuccess: st.step === 'success', stFailed: st.step === 'failed',
      toPay: function () {
        if (!sv.loggedIn) { self.toAuth(); self.go(self.goRef); return; }
        self.setState({ step: 'pay', deadline: Date.now() + 600000, now: Date.now() });
      },
      payTitle: st.method === 'khqr' ? 'Scan to pay' : (st.method === 'aba' ? 'Confirm in ABA Mobile' : 'Card details'),
      payHint: o.total + ' coins · ' + this.methodLabel(st.method),
      countdown: Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2),
      isQr: st.method === 'khqr', isAba: st.method === 'aba', isCard: st.method === 'card',
      qrCells: this.qr(),
      paidLabel: st.method === 'card' ? 'Pay now' : 'I’ve paid (simulate)',
      simulatePaid: function () { self.setState({ step: 'processing' }); self.later(1500, function () { self.finish('success'); }); },
      simulateFail: function () { self.setState({ step: 'processing' }); self.later(1200, function () { self.finish('failed', 'declined'); }); },
      cancelPay: function () { self.finish('failed', 'cancel'); self.say('Payment cancelled'); },
      last: st.last || { total: 0, id: '', methodLabel: '' },
      failTitle: st.fail === 'expired' ? 'The code expired' : 'Payment didn’t go through',
      failBody: st.fail === 'expired' ? 'KHQR codes are valid for 10 minutes. Make a new one to try again.' : 'Your bank declined the payment. No coins were charged.',
      again: function () { self.setState({ step: 'review', fail: '' }); },
      receiptHref: this.href('Receipt'), history: hist.slice(0, 6).map(function (h) { return { open: function () { self.put('toonwave.receipt', h.id || ''); }, date: self.fmtDate(h.at), pack: h.pack, method: self.methodLabel(h.method), coins: h.coins, status: h.status, cls: h.status === 'Paid' ? 'badge-brand' : (h.status === 'Failed' ? 'badge-up' : 'badge-secondary') }; }),
      noHistory: false,
      faq: faqQ.map(function (f, i) { return { q: f[0], a: f[1], open: st.faqOpen === i, cls: st.faqOpen === i ? 'on' : '', toggle: function () { self.setState({ faqOpen: st.faqOpen === i ? -1 : i }); } }; })
    });
  }
