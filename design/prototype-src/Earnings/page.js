  constructor(props) {
    super(props);
    this.pageName = 'Earnings';
    this.state = Object.assign({}, this.state || {}, { period: '6m', asTable: false, methodOpen: false, method: 'aba', toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  userName() { var u = this.get('toonwave.user'); return u || 'Sokha Chan'; }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var saved = this.get('toonwave.payoutSet');
    var hasMethod = saved ? saved === '1' : (this.props.demoState || 'payout-set') === 'payout-set';
    var months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'], longM = ['June', 'July', 'August', 'September', 'October', 'November'];
    var coins = [1240, 1610, 1980, 2450, 2830, 3420];
    var n = st.period === '30d' ? 1 : st.period === '3m' ? 3 : 6;
    var ms = months.slice(-n), cs = coins.slice(-n), ls = longM.slice(-n);
    var max = Math.max.apply(null, cs), total = cs.reduce(function (a, b) { return a + b; }, 0);
    var fmt = function (x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
    var works = this.myWorks();
    var c1 = works[0] || { title: 'River Lantern', cover: '' };
    return Object.assign(sv, {
      cnav: this.creatorNav('Earnings'),
      periods: [['30d', 'Last 30 days'], ['3m', '3 months'], ['6m', '6 months']].map(function (p) { return { label: p[1], on: st.period === p[0], cls: st.period === p[0] ? 'on' : '', pick: function () { self.setState({ period: p[0] }); } }; }),
      stats: [['Coins earned', fmt(total), n === 1 ? '▲ 21% vs October' : 'Across ' + n + ' months', n === 1 ? 'up-t' : 'muted'], ['Fast Pass unlocks', fmt(Math.round(total / 5)), '5 coins each', 'muted'], ['Estimated earnings', '[USD AMOUNT]', 'At [REVENUE SHARE]% of coin value', 'muted'], ['Readers who paid', fmt(Math.round(total / 5 / 2.6)), '≈ 2.6 unlocks each', 'muted']].map(function (x) { return { label: x[0], v: x[1], d: x[2], dCls: x[3], vCls: /^\[/.test(x[1]) ? 'ph' : '' }; }),
      barN: n, asTable: st.asTable, asChart: !st.asTable, tableLabel: st.asTable ? 'Show chart' : 'Show as table',
      toggleTable: function () { self.setState({ asTable: !st.asTable }); },
      bars: cs.map(function (v, i) { return { v: fmt(v), u: fmt(Math.round(v / 5)), m: ms[i], mLong: ls[i] + ' 2026', h: Math.round(v / max * 100 * 0.82) + '%', cls: i === cs.length - 1 ? 'cur' : '' }; }),
      chartAria: 'Coins earned by month: ' + cs.map(function (v, i) { return ms[i] + ' ' + v; }).join(', ') + '.',
      bySeries: [[c1.title, c1.cover, Math.round(total * 0.94), 'Fast Pass on · 3 episodes ahead'], ['Night Market Detectives', (works[1] || c1).cover, 0, 'Starts earning after approval and Fast Pass'], ['Tips and other', '', Math.round(total * 0.06), 'Reader tips on River Lantern']].filter(function (x) { return x[1]; }).map(function (x) {
        return { title: x[0], cover: x[1], coins: fmt(x[2]), pct: Math.round(x[2] / total * 100) + '%', meta: x[3] };
      }),
      availCoins: fmt(coins[5]),
      hasMethod: hasMethod, noMethod: !hasMethod,
      history: [['Nov 1, 2026', 2830, 'Paid', 'badge-brand'], ['Oct 1, 2026', 2450, 'Paid', 'badge-brand'], ['Sep 1, 2026', 1980, 'Paid', 'badge-brand']].map(function (h) { return { date: h[0], coins: fmt(h[1]), status: hasMethod ? h[2] : 'On hold', cls: hasMethod ? h[3] : 'badge-warn' }; }),
      methodOpen: st.methodOpen, dlgTop: st.dlgY || '140px',
      openMethod: function () { self.setState({ methodOpen: true, dlgY: self.layerY(-120) }); },
      closeMethod: function () { self.setState({ methodOpen: false }); },
      methods: [['aba', 'ABA Bank', 'Paid to your ABA account in USD or KHR'], ['bank', 'Other Cambodian bank', 'Paid by bank transfer']].map(function (m) { return { label: m[1], desc: m[2], on: st.method === m[0], cls: st.method === m[0] ? 'on' : '', pick: function () { self.setState({ method: m[0] }); } }; }),
      saveMethod: function () { self.put('toonwave.payoutSet', '1'); self.setState({ methodOpen: false }); self.say('Payout method saved'); }
    });
  }
