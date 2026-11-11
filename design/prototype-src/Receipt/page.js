  constructor(props) {
    super(props);
    this.pageName = 'Receipt';
    this.state = Object.assign({}, this.state || {}, { toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  order() {
    var want = this.get('toonwave.receipt');
    var list = this.read('toonwave.purchases', []) || [];
    var p = list.filter(function (x) { return x.id === want; })[0];
    var ds = (this.props.demoStatus || 'paid');
    if (!p && want === 'TW-48190012') return { id: want, at: Date.UTC(2026, 9, 12, 2, 40), pack: '10 coin pack', coins: 10, method: 'card', status: 'Failed', base: 10, bonus: 0, first: 0, spent: 0 };
    if (!p) p = { id: 'TW-48213377', at: Date.UTC(2026, 9, 28, 7, 5), pack: '30 coin pack', coins: 33, method: 'khqr', status: ds === 'failed' ? 'Failed' : ds === 'refunded' ? 'Refunded' : 'Paid', base: 30, bonus: 3, first: 0, spent: 15 };
    return p;
  }
  renderVals() {
    var self = this;
    var sv = this.sharedVals('');
    var o = this.order();
    var st = o.status;
    var mth = { khqr: 'KHQR', aba: 'ABA Pay', card: 'Credit or debit card' }[o.method] || o.method;
    var d = new Date(o.at), mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var hh = d.getUTCHours() + 7; var when = mo[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear() + ' · ' + ((hh % 12) || 12) + ':' + ('0' + d.getUTCMinutes()).slice(-2) + ' ' + (hh % 24 < 12 ? 'AM' : 'PM');
    var base = o.base || parseInt(o.pack, 10) || o.coins, bonus = o.bonus != null ? o.bonus : Math.max(0, o.coins - base), first = o.first || 0;
    var spent = o.spent != null ? o.spent : 0, unused = Math.max(0, o.coins - spent);
    var paid = st === 'Paid', failed = st === 'Failed', refunded = st === 'Refunded';
    var rows = [['Order number', o.id, '', true], ['Date', when + ' (ICT)', ''], ['Pack', o.pack, ''], ['Coins', base + ' coins', '']];
    if (bonus) rows.push(['Pack bonus', '+' + bonus + ' coins', '']);
    if (first) rows.push(['First-purchase bonus', '+' + first + ' coins', '']);
    rows = rows.concat([['Paid with', mth, ''], ['Provider reference', '[PROVIDER TRANSACTION ID]', ''], ['Total', failed ? 'Not charged' : '[PRICE USD] · [PRICE KHR]', 'total']]);
    var prefill = function (msg) { self.put('toonwave.helpPrefill', JSON.stringify({ topic: 'payment', order: o.id, msg: msg || '' })); self.put('toonwave.helpContact', '1'); };
    return Object.assign(sv, {
      o: o,
      statusLabel: st, statusCls: paid ? 'badge-brand' : failed ? 'badge-up' : 'badge-secondary',
      statusIc: paid ? '✓' : failed ? '✕' : '↩', statusIcCls: paid ? '' : failed ? 'bad' : 'neutral',
      headline: paid ? '+' + o.coins + ' coins' : failed ? 'Payment didn’t go through' : 'Refunded',
      subline: paid ? 'Added to your balance right after payment. ' + (spent ? spent + ' of these coins are spent; ' + unused + ' are unused.' : 'None are spent yet.') : failed ? 'No money was taken and no coins were added. You can try again with the same or another method.' : 'The money went back to your ' + mth + ' account. The ' + o.coins + ' coins were removed from your balance.',
      rows: rows.map(function (r) { return { k: r[0], v: r[1], cls: r[2], copy: !!r[3] }; }),
      copyId: function () { try { navigator.clipboard.writeText(o.id); } catch (e) {} self.say('Order number copied'); },
      timeline: (paid ? [['Order created', when, ''], ['Payment confirmed by ' + mth, 'A few seconds later', ''], ['+' + o.coins + ' coins added', 'Balance updated', '']] : failed ? [['Order created', when, ''], ['Bank declined the payment', 'No money was taken', 'bad'], ['No coins added', '', 'wait']] : [['Paid', when, ''], ['Refund requested', 'Oct 29', ''], ['Refunded to ' + mth, 'Oct 30 · coins removed', '']]).map(function (t) { return { t: t[0], d: t[1], cls: t[2] }; }),
      isPaid: paid, isFailed: failed,
      download: function () { self.say('Receipt PDF downloads here (prototype)'); },
      getHelp: function () { prefill(''); },
      canRefund: paid && unused > 0, refundNote: paid,
      refundLine: unused > 0 ? 'You can ask for a refund of the ' + unused + ' unused coins within [REFUND WINDOW] days.' : 'All coins from this order are spent, so it can’t be refunded.',
      askRefund: function () { prefill('I’d like a refund of the ' + unused + ' unused coins from this order.'); }
    });
  }
