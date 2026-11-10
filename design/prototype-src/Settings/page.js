  constructor(props) {
    super(props);
    this.pageName = 'Settings';
    this.goRef = { current: null };
    var saved = this.loadSettings();
    this.state = Object.assign({}, this.state || {}, {
      saved: saved, f: Object.assign({}, saved), lang: props.demoLang === 'km' ? 'km' : 'en', sec: 'account', pwOpen: false, pw: { cur: '', nw: '', again: '' }, pwErr: '',
      delOpen: false, delText: '', dlBusy: false, langErr: false, toast: '', searchOpen: false, userMenu: false
    });
  }
  componentDidMount() { this.sharedMount(); this.setState({ lang: this.lang() }); }
  componentWillUnmount() { this.sharedUnmount(); }
  // Prototype: the canvas shows a signed-in reader unless someone logged out.
  userName() { var u = this.get('toonwave.user'); if (u === null || u === undefined) return this.get('toonwave.loggedOut') ? '' : 'Sokha Chan'; return u; }
  loadSettings() {
    var d = { name: '', mode: 'scroll', quality: 'auto', theme: 'system', size: 'm', autoNext: true, saveData: false, region: 'KH', langs: ['en', 'km'], publicLib: false, mature: false, google: true, facebook: false };
    var s = null; try { s = this.read('toonwave.settings', null); } catch (e) {}
    var o = Object.assign(d, s || {});
    if (!o.name) { try { o.name = this.userName(); } catch (e) { o.name = 'Sokha Chan'; } }
    return o;
  }
  renderVals() {
    var self = this, st = this.state, f = st.f;
    var sv = this.sharedVals('');
    var set = function (k, v) { var n = Object.assign({}, st.f); n[k] = v; self.setState({ f: n, langErr: false }); };
    var keys = Object.keys(st.saved);
    var dirty = keys.some(function (k) { return JSON.stringify(st.saved[k]) !== JSON.stringify(f[k]); });
    var nameTrim = (f.name || '').trim();
    var nameBad = nameTrim.length < 2;
    var sw = function (id, k, label, desc) { return { id: id, label: label, desc: desc, on: !!f[k], cls: f[k] ? 'on' : '', toggle: function () { set(k, !f[k]); } }; };
    var notifPrefs = this.read('toonwave.notifPrefs', null);
    var reps = this.read('toonwave.reports', null);
    if (!Array.isArray(reps)) reps = [{ id: 'R-20477', kind: 'comment', target: 'comment by spam_bot_88', at: Date.UTC(2026, 9, 30), status: 'Removed' }];
    var pwRule = function (p) { return p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p); };
    return Object.assign(sv, {
      goRef: this.goRef,
      sections: [['account', 'Account'], ['reading', 'Reading'], ['language', 'Language and region'], ['notifs', 'Notifications'], ['privacy', 'Privacy and safety'], ['coins', 'Coins and payments'], ['danger', 'Account actions']].map(function (x) {
        return { label: x[1], href: '#set-' + x[0], cls: st.sec === x[0] ? 'on' : '', cur: st.sec === x[0] ? 'true' : 'false', pick: function () { self.setState({ sec: x[0] }); } };
      }),
      initials: this.initials(nameTrim || sv.userName), f: f, email: 'reader@phumireader.app',
      changePhoto: function () { self.say('Photo upload opens here (prototype)'); },
      onName: function (ev) { set('name', ev.target.value.slice(0, 30)); },
      nameBad: nameBad ? 'bad' : '', nameInvalid: nameBad, nameHintCls: nameBad ? 'err' : 'hint',
      nameHint: nameBad ? 'Enter at least 2 characters.' : nameTrim.length + '/30 · Shown on your comments',
      pwOpen: st.pwOpen, pwBtn: st.pwOpen ? 'Close' : 'Change password', pw: st.pw,
      togglePw: function () { self.setState({ pwOpen: !st.pwOpen, pw: { cur: '', nw: '', again: '' }, pwErr: '' }); },
      onPwCur: function (ev) { self.setState({ pw: Object.assign({}, st.pw, { cur: ev.target.value }), pwErr: '' }); },
      onPwNew: function (ev) { self.setState({ pw: Object.assign({}, st.pw, { nw: ev.target.value }), pwErr: '' }); },
      onPwAgain: function (ev) { self.setState({ pw: Object.assign({}, st.pw, { again: ev.target.value }), pwErr: '' }); },
      pwErr: !!st.pwErr, pwErrMsg: st.pwErr,
      savePw: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        var p = st.pw;
        var e = !p.cur ? 'Enter your current password.' : !pwRule(p.nw) ? 'Use at least 8 characters, with a letter and a number.' : p.nw !== p.again ? 'The new passwords don’t match.' : p.nw === p.cur ? 'Choose a password you haven’t used here.' : '';
        if (e) { self.setState({ pwErr: e }); return; }
        self.setState({ pwOpen: false, pw: { cur: '', nw: '', again: '' } }); self.say('Password updated');
      },
      socials: [['google', 'Google', 'G'], ['facebook', 'Facebook', 'f']].map(function (x) {
        var on = !!f[x[0]];
        return { name: x[1], ic: x[2], note: on ? 'Connected · you can log in with ' + x[1] : 'Not connected', btn: on ? 'Disconnect' : 'Connect', btnCls: on ? 'btn-ghost' : 'btn-outline', toggle: function () { set(x[0], !on); } };
      }),
      modes: [['scroll', 'Vertical scroll', 'Scroll through the whole episode'], ['page', 'Page by page', 'Tap or swipe to turn panels']].map(function (m) {
        return { label: m[1], desc: m[2], on: f.mode === m[0], cls: f.mode === m[0] ? 'on' : '', pick: function () { set('mode', m[0]); } };
      }),
      onQuality: function (ev) { set('quality', ev.target.value); },
      qualityHint: { auto: 'Adjusts to your connection.', high: 'Sharpest images. Uses more data.', saver: 'Smaller images. Good for mobile data.' }[f.quality],
      themes: [['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(function (t) { return { label: t[1], on: f.theme === t[0], cls: f.theme === t[0] ? 'on' : '', pick: function () { set('theme', t[0]); } }; }),
      sizes: [['s', 'A', 'Small'], ['m', 'A', 'Medium'], ['l', 'A', 'Large'], ['xl', 'A', 'Extra large']].map(function (z, i) { return { label: ['A−', 'A', 'A+', 'A++'][i], aria: z[2], on: f.size === z[0], cls: f.size === z[0] ? 'on' : '', pick: function () { set('size', z[0]); } }; }),
      sizePx: { s: '15px', m: '17px', l: '19px', xl: '22px' }[f.size],
      readToggles: [sw('t-next', 'autoNext', 'Open the next episode automatically', 'When you reach the end of an episode.'), sw('t-data', 'saveData', 'Save data on mobile networks', 'Loads images only as you scroll.')],
      isEn: st.lang === 'en', isKm: st.lang === 'km', enCls: st.lang === 'en' ? 'on' : '', kmCls: st.lang === 'km' ? 'on' : '',
      setEn: function () { self.put('toonwave.lang', 'en'); self.applyLang(); self.setState({ lang: 'en' }); self.say('Language: English'); },
      setKm: function () { self.put('toonwave.lang', 'km'); self.applyLang(); self.setState({ lang: 'km' }); self.say('ភាសា៖ ខ្មែរ'); },
      onRegion: function (ev) { set('region', ev.target.value); },
      contentLangs: [['en', 'English'], ['km', 'ខ្មែរ (Khmer)']].map(function (c) {
        var on = f.langs.indexOf(c[0]) >= 0;
        return { label: c[1], on: on, cls: on ? 'on' : '', tick: on ? '✓ ' : '', toggle: function () {
          var l = on ? f.langs.filter(function (x) { return x !== c[0]; }) : f.langs.concat([c[0]]);
          if (!l.length) { self.setState({ langErr: true }); return; }
          set('langs', l);
        } };
      }),
      langErr: st.langErr,
      notifSummary: notifPrefs ? 'Your custom alert choices are on.' : 'New episodes, replies and payments. Push on, email off.',
      toNotifSettings: function () { self.put('toonwave.notifTab', 'settings'); },
      privToggles: [sw('t-pub', 'publicLib', 'Show my library on my profile', 'Others can see which series you subscribe to.'), sw('t-mature', 'mature', 'Show mature series', 'Only for readers 18 and older. Series rated 18+ appear in search and genres.')],
      hasBlocked: this.blocked().length > 0, noBlocked: !this.blocked().length,
      blockedList: this.blocked().map(function (n) { return { name: n, ini: self.initials(n), unblock: function () { self.put('toonwave.blocked', JSON.stringify(self.blocked().filter(function (x) { return x !== n; }))); self.setState({ _sync: Date.now() }); self.say(n + ' is unblocked'); } }; }),
      hasReports: reps.length > 0, noReports: !reps.length,
      reports: reps.map(function (r) { var d = new Date(r.at); return { what: (r.target.charAt(0).toUpperCase() + r.target.slice(1)), meta: 'Case ' + r.id + ' · ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getDate(), status: r.status, cls: r.status === 'In review' ? 'badge-warn' : r.status === 'Removed' ? 'badge-brand' : 'badge-secondary' }; }),
      dlBusy: st.dlBusy, dlLabel: st.dlBusy ? 'Preparing…' : 'Request download',
      download: function () { self.setState({ dlBusy: true }); self.later(1200, function () { self.setState({ dlBusy: false }); self.say('We’ll email you a download link'); }); },
      logoutAll: function () { self.put('toonwave.user', null); self.put('toonwave.loggedOut', '1'); self.setState({ _sync: Date.now() }); self.say('Logged out on all devices'); },
      dirty: dirty && sv.loggedIn, saveBlocked: nameBad,
      discard: function () { self.setState({ f: Object.assign({}, st.saved), langErr: false }); },
      save: function () {
        if (nameBad) return;
        var n = Object.assign({}, f, { name: nameTrim });
        self.put('toonwave.settings', JSON.stringify(n));
        self.put('toonwave.user', nameTrim);
        self.setState({ saved: n, f: Object.assign({}, n) }); self.say('Settings saved');
      },
      delOpen: st.delOpen, delText: st.delText, delBlocked: st.delText.trim() !== 'DELETE', dlgTop: st.dlgY || '160px',
      openDelete: function () { self.setState({ delOpen: true, delText: '', dlgY: self.layerY(-160) }); },
      closeDelete: function () { self.setState({ delOpen: false }); },
      onDelText: function (ev) { self.setState({ delText: ev.target.value }); },
      doDelete: function () {
        if (st.delText.trim() !== 'DELETE') return;
        self.put('toonwave.loggedOut', '1');
        ['toonwave.user', 'toonwave.settings', 'toonwave.subs', 'toonwave.coins'].forEach(function (k) { self.put(k, null); });
        self.setState({ delOpen: false }); self.say('Account deleted'); self.later(800, function () { self.go(self.goRef); });
      }
    });
  }
