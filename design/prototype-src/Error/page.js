  constructor(props) {
    super(props);
    this.pageName = 'Error';
    this.goRef = { current: null };
    this.state = Object.assign({}, this.state || {}, {
      lang: 'en', busy: false, tries: 0, status: '', online: false, notifyOn: false, q: '', goneRemoved: false, goHref: '',
      toast: '', searchOpen: false, userMenu: false
    });
    try { if (this.get('toonwave.lang') === 'km') this.state.lang = 'km'; } catch (e) {}
  }
  componentDidMount() {
    this.sharedMount();
    var self = this;
    this.setState({ lang: this.get('toonwave.lang') === 'km' ? 'km' : 'en', goHref: this.href('Home') });
    // A real offline page listens for the connection coming back.
    this._online = function () { if (self.kind() === 'offline') self.backOnline(); };
    window.addEventListener('online', this._online);
  }
  componentWillUnmount() { this.sharedUnmount(); window.removeEventListener('online', this._online); }
  componentDidUpdate(pp) { if (pp.demoKind !== this.props.demoKind) this.setState({ busy: false, tries: 0, status: '', online: false, notifyOn: false }); }
  kind() { return this.props.demoKind || 'not-found'; }
  backOnline() {
    var self = this;
    this.setState({ online: true, busy: false, status: 'ok' });
    this.later(1500, function () { self.go(self.goRef); });
  }
  dict() {
    var en = {
      'not-found': { title: 'We can’t find that page', body: 'The link may be broken, or the page may have moved. Try searching, or pick something popular below.' },
      server: { title: 'Something went wrong on our side', body: 'This isn’t your fault. Please try again in a moment. Your coins, unlocked episodes and library are safe.' },
      offline: { title: 'You’re offline', body: 'Check your Wi-Fi or mobile data. We’ll reconnect as soon as you’re back online.' },
      maintenance: { title: 'PhumiReader is getting an update', body: 'We’re making reading faster. We’ll be back soon, and your coins, unlocked episodes and library are safe.' },
      unavailable: { title: 'This series isn’t available', body: 'The creator may have removed it, or it isn’t available in your region.' },
      youAsked: 'You tried to open', didYouMean: 'Did you mean:', searchLabel: 'Search PhumiReader', searchPh: 'Search series or creators…', search: 'Search',
      home: 'Go to Home', library: 'My library', retry: 'Try again', trying: 'Trying…', remove: 'Remove from library', removed: 'Removed from your library',
      started: 'Started', backBy: 'Expected back', notify: 'Notify me when it’s back', notifyOn: 'We’ll notify you', ref: 'Reference', copied: 'Reference copied',
      needHelp: 'Need help?', helpCenter: 'Help center', report: 'Report a broken link', reported: 'Thanks. We’ll look at this link.', statusPage: 'Service status',
      popular: 'Popular right now', similar: 'Similar series you can read', browseAll: 'Browse all',
      stillServer: 'Still not working. We’ve been notified and are on it. Try again in a minute.', okServer: 'Fixed. Taking you back…',
      stillOffline: 'Still offline. Check your connection and try again.', okOffline: 'You’re back online. Taking you back…',
      tips: ['Turn airplane mode off', 'Turn Wi-Fi or mobile data off and on again', 'Move closer to your router, or try another network'],
      inLibrary: 'In your library', notInLibrary: 'Not in your library'
    };
    var km = {
      'not-found': { title: 'រកមិនឃើញទំព័រនេះទេ', body: 'តំណនេះអាចខូច ឬទំព័រនេះអាចត្រូវបានផ្លាស់ទី។ សូមសាកល្បងស្វែងរក ឬជ្រើសរើសរឿងពេញនិយមខាងក្រោម។' },
      server: { title: 'មានបញ្ហាពីខាងយើង', body: 'នេះមិនមែនជាកំហុសរបស់អ្នកទេ។ សូមព្យាយាមម្តងទៀតបន្តិចទៀត។ កាក់ ភាគដែលបានដោះសោ និងបណ្ណាល័យរបស់អ្នកនៅមានសុវត្ថិភាព។' },
      offline: { title: 'អ្នកមិនបានភ្ជាប់អ៊ីនធឺណិតទេ', body: 'សូមពិនិត្យ Wi-Fi ឬទិន្នន័យទូរស័ព្ទរបស់អ្នក។ យើងនឹងភ្ជាប់ឡើងវិញភ្លាមៗ ពេលអ្នកមានអ៊ីនធឺណិត។' },
      maintenance: { title: 'ភូមិReader កំពុងធ្វើបច្ចុប្បន្នភាព', body: 'យើងកំពុងធ្វើឲ្យការអានលឿនជាងមុន។ យើងនឹងត្រលប់មកវិញឆាប់ៗ ហើយកាក់ ភាគដែលបានដោះសោ និងបណ្ណាល័យរបស់អ្នកនៅមានសុវត្ថិភាព។' },
      unavailable: { title: 'រឿងនេះមិនអាចអានបានទេ', body: 'អ្នកនិពន្ធអាចបានដកវាចេញ ឬវាមិនមាននៅក្នុងតំបន់របស់អ្នក។' },
      youAsked: 'អ្នកបានព្យាយាមបើក', didYouMean: 'តើអ្នកចង់និយាយថា៖', searchLabel: 'ស្វែងរកក្នុង ភូមិReader', searchPh: 'ស្វែងរករឿង ឬអ្នកនិពន្ធ…', search: 'ស្វែងរក',
      home: 'ទៅទំព័រដើម', library: 'បណ្ណាល័យរបស់ខ្ញុំ', retry: 'ព្យាយាមម្តងទៀត', trying: 'កំពុងព្យាយាម…', remove: 'ដកចេញពីបណ្ណាល័យ', removed: 'បានដកចេញពីបណ្ណាល័យរបស់អ្នក',
      started: 'ចាប់ផ្តើម', backBy: 'រំពឹងថានឹងត្រលប់មកវិញ', notify: 'ជូនដំណឹងខ្ញុំពេលដំណើរការវិញ', notifyOn: 'យើងនឹងជូនដំណឹងអ្នក', ref: 'លេខយោង', copied: 'បានចម្លងលេខយោង',
      needHelp: 'ត្រូវការជំនួយ?', helpCenter: 'មជ្ឈមណ្ឌលជំនួយ', report: 'រាយការណ៍តំណខូច', reported: 'សូមអរគុណ។ យើងនឹងពិនិត្យតំណនេះ។', statusPage: 'ស្ថានភាពសេវាកម្ម',
      popular: 'ពេញនិយមឥឡូវនេះ', similar: 'រឿងស្រដៀងគ្នាដែលអ្នកអាចអានបាន', browseAll: 'មើលទាំងអស់',
      stillServer: 'នៅតែមិនដំណើរការ។ យើងបានទទួលដំណឹង ហើយកំពុងដោះស្រាយ។ សូមព្យាយាមម្តងទៀតក្នុងរយៈពេលមួយនាទី។', okServer: 'បានដោះស្រាយហើយ។ កំពុងនាំអ្នកត្រលប់…',
      stillOffline: 'នៅតែគ្មានអ៊ីនធឺណិត។ សូមពិនិត្យការតភ្ជាប់ ហើយព្យាយាមម្តងទៀត។', okOffline: 'អ្នកបានភ្ជាប់អ៊ីនធឺណិតវិញហើយ។ កំពុងនាំអ្នកត្រលប់…',
      tips: ['បិទរបៀបយន្តហោះ', 'បិទ ហើយបើក Wi-Fi ឬទិន្នន័យទូរស័ព្ទម្តងទៀត', 'ខិតទៅជិតរ៉ោតទ័រ ឬសាកល្បងបណ្តាញផ្សេង'],
      inLibrary: 'មាននៅក្នុងបណ្ណាល័យរបស់អ្នក', notInLibrary: 'មិនមាននៅក្នុងបណ្ណាល័យរបស់អ្នកទេ'
    };
    return this.state.lang === 'km' ? km : en;
  }

  renderVals() {
    var self = this;
    var st = this.state;
    var sv = this.sharedVals('');
    var k = this.kind();
    var d = this.dict();
    var t = Object.assign({}, d, d[k]);
    var pool = this.pool();
    var suggest = this.byTitle('Glass Compass') || pool[0];
    var gone = this.byTitle('Midnight Courier') || pool[1];
    var subs = this.read('toonwave.subs', null);
    if (!Array.isArray(subs)) subs = ['S10', 'S19', 'S34', 'S7', 'S2', 'S27', 'S45', 'S14', 'S22', 'S40'];
    var goneSubbed = subs.indexOf(gone.id) >= 0;
    var codes = {
      'not-found': ['Error 404', 'badge-secondary'], server: ['Error 500', 'badge-up'], offline: ['No connection', 'badge-warn'],
      maintenance: ['Scheduled maintenance', 'badge-brand'], unavailable: ['Not available', 'badge-secondary']
    };
    var popular = pool.slice().sort(function (a, b) { return parseFloat(b.views) - parseFloat(a.views); });
    var cards = k === 'unavailable'
      ? pool.filter(function (x) { return x.genre === gone.genre && x.id !== gone.id; }).concat(popular.filter(function (x) { return x.genre !== gone.genre; })).slice(0, 6)
      : popular.filter(function (x) { return x.id !== suggest.id; }).slice(0, 6);
    var statusMsg = '', statusCls = '', statusIc = '';
    if (st.status === 'still') { statusMsg = k === 'offline' ? t.stillOffline : t.stillServer; statusCls = 'warn'; statusIc = '!'; }
    if (st.status === 'ok') { statusMsg = k === 'offline' ? t.okOffline : t.okServer; statusCls = 'brand'; statusIc = '✓'; }
    var hasRetry = k === 'server' || k === 'offline';
    return Object.assign(sv, {
      goRef: this.goRef, goHref: st.goHref || sv.homeHref,
      t: t, lang: st.lang, isEn: st.lang === 'en', isKm: st.lang === 'km', enCls: st.lang === 'en' ? 'on' : '', kmCls: st.lang === 'km' ? 'on' : '',
      setEn: function () { self.put('toonwave.lang', 'en'); self.applyLang(); self.setState({ lang: 'en' }); },
      setKm: function () { self.put('toonwave.lang', 'km'); self.applyLang(); self.setState({ lang: 'km' }); },
      isNotFound: k === 'not-found', isServer: k === 'server', isOffline: k === 'offline', isMaint: k === 'maintenance', isUnavail: k === 'unavailable',
      code: codes[k][0], codeCls: codes[k][1],
      badPath: 'phumireader.app/series/glas-compas',
      suggest: suggest, suggestHref: this.href('Series'), openSuggest: function () { self.storeSeries(suggest); },
      q: st.q, onQ: function (ev) { self.setState({ q: ev.target.value }); },
      doSearch: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        var q = (st.q || '').trim() || 'glass compass';
        self.toSearchPage(q);
        self.setState({ goHref: self.href('Search') });
        self.later(0, function () { self.go(self.goRef); });
      },
      gone: gone, goneSubbed: goneSubbed && !st.goneRemoved,
      goneNote: goneSubbed && !st.goneRemoved ? t.inLibrary : t.notInLibrary,
      removeGone: function () {
        self.put('toonwave.subs', JSON.stringify(subs.filter(function (x) { return x !== gone.id; })));
        self.setState({ goneRemoved: true });
        self.say(t.removed);
      },
      hasStatus: !!st.status, statusMsg: statusMsg, statusCls: statusCls, statusIc: statusIc,
      hasRetry: hasRetry, busy: st.busy, notBusy: !st.busy, retryLabel: st.busy ? t.trying : t.retry,
      retry: function () {
        if (st.busy || st.status === 'ok') return;
        self.setState({ busy: true, status: '' });
        self.later(1200, function () {
          var tries = self.state.tries + 1;
          if (k === 'offline') {
            var on = self.state.online;
            if (on) self.backOnline(); else self.setState({ busy: false, tries: tries, status: 'still' });
            return;
          }
          // Prototype: the first retry still fails, the second one works.
          if (tries >= 2) { self.setState({ busy: false, tries: tries, status: 'ok' }); self.later(1500, function () { self.go(self.goRef); }); }
          else self.setState({ busy: false, tries: tries, status: 'still' });
        });
      },
      simOnline: function () { self.backOnline(); },
      tips: (t.tips || []).map(function (x) { return { t: x }; }),
      notifyOn: st.notifyOn, notifyLabel: st.notifyOn ? '✓ ' + t.notifyOn : t.notify,
      notify: function () {
        if (!sv.loggedIn) { self.toAuth(); self.setState({ goHref: self.href('Auth') }); self.later(0, function () { self.go(self.goRef); }); return; }
        self.setState({ notifyOn: !st.notifyOn });
        if (!st.notifyOn) self.say(t.notifyOn);
      },
      homeCls: k === 'unavailable' ? 'btn-primary' : 'btn-outline',
      hasLibrary: k === 'unavailable' || k === 'server',
      hasRef: k === 'server', refId: 'TW-500-8F3K2Q',
      copyRef: function () { try { navigator.clipboard.writeText('TW-500-8F3K2Q'); } catch (e) {} self.say(t.copied); },
      showReport: k === 'not-found', showStatus: k === 'server' || k === 'maintenance',
      report: function () { self.say(t.reported); },
      hasCards: k === 'not-found' || k === 'unavailable',
      cardsTitle: k === 'unavailable' ? t.similar : t.popular,
      cards: cards.map(function (x) { return self.card(x); })
    });
  }
