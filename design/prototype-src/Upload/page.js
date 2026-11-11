  constructor(props) {
    super(props);
    this.pageName = 'Upload';
    this.state = Object.assign({}, this.state || {}, this.initState(props), { toast: '', searchOpen: false, userMenu: false });
  }
  initState(props) {
    var ds = props.demoState || 'ready';
    var want = null; try { want = this.get('toonwave.uploadFor'); } catch (e) {}
    var works = this.myWorks().filter(function (w) { return w.status !== 'draft'; });
    var w = works.filter(function (x) { return x.id === want; })[0] || works[0] || this.myWorks()[0];
    var imgs = ds === 'empty' ? [] : this.demoImgs(ds);
    return { wid: w.id, title: ds === 'empty' ? '' : 'The Ferryman’s Promise', imgs: imgs, text: '', when: 'schedule', date: '0', time: '18', fastPass: true, comments: true, note: '', tried: ds === 'error', busy: false, done: ds === 'done', savedAt: '' };
  }
  demoImgs(ds) {
    var c = this.pool().map(function (x) { return x.cover; });
    var out = [];
    for (var i = 0; i < 8; i++) out.push({ id: 'i' + i, name: 'ep25_' + ('0' + (i + 1)).slice(-2) + '.jpg', w: 800, h: 2400 + (i % 3) * 200, mb: 1.4 + (i % 4) * 0.3, pct: 100, src: c[(i * 5 + 2) % c.length], err: '' });
    if (ds === 'uploading') { out[6].pct = 64; out[7].pct = 18; }
    if (ds === 'error') { out[5].w = 2400; out[5].err = 'Too wide: 2400 px. Use 690–1600 px.'; }
    return out;
  }
  componentDidMount() { this.sharedMount(); if ((this.props.demoState || '') === 'uploading') this.tickUpload(); }
  componentWillUnmount() { this.sharedUnmount(); this._dead = true; }
  componentDidUpdate(pp) { if (pp.demoState !== this.props.demoState) { this.setState(this.initState(this.props)); if (this.props.demoState === 'uploading') this.tickUpload(); } }
  userName() { var u = this.get('toonwave.user'); return u || 'Sokha Chan'; }
  tickUpload() {
    var self = this;
    this.later(400, function () {
      if (self._dead) return;
      var busy = false;
      var imgs = self.state.imgs.map(function (m) { if (m.pct < 100) { busy = true; return Object.assign({}, m, { pct: Math.min(100, m.pct + 22) }); } return m; });
      self.setState({ imgs: imgs });
      if (busy) self.tickUpload();
    });
  }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var all = this.myWorks();
    var w = all.filter(function (x) { return x.id === st.wid; })[0] || all[0];
    var nov = w.format === 'novel', unit = nov ? 'Chapter' : 'Episode', unitL = unit.toLowerCase();
    var epNo = w.eps + 1;
    var imgs = st.imgs;
    var loading = imgs.some(function (m) { return m.pct < 100; });
    var bad = imgs.filter(function (m) { return m.err; });
    var words = (st.text.trim().match(/\S+/g) || []).length;
    var errs = [];
    if (st.title.trim().length < 2) errs.push('Add a ' + unitL + ' title.');
    if (!nov && !imgs.length) errs.push('Add at least one image.');
    if (!nov && bad.length) errs.push('Fix or remove ' + bad.length + ' image' + (bad.length > 1 ? 's' : '') + ' that can’t be used.');
    if (!nov && loading) errs.push('Wait for images to finish uploading.');
    if (nov && words < 300) errs.push('Chapters need at least 300 words (now ' + words + ').');
    var shown = st.tried ? errs : [];
    var base = Date.UTC(2026, 10, 10), mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var dateLbl = function (k) { var d = new Date(base + (4 + k) * 86400000); return dn[d.getUTCDay()] + ', ' + mo[d.getUTCMonth()] + ' ' + d.getUTCDate(); };
    var timeLbl = { '12': '12:00 PM', '18': '6:00 PM', '20': '8:00 PM', '21': '9:00 PM' }[st.time];
    var when = st.when === 'now' ? 'now' : dateLbl(parseInt(st.date, 10)) + ' at ' + timeLbl;
    var freeDate = st.when === 'now' ? '7 days after release' : (function () { var d = new Date(base + (4 + parseInt(st.date, 10) + 7) * 86400000); return dn[d.getUTCDay()] + ', ' + mo[d.getUTCMonth()] + ' ' + d.getUTCDate(); })();
    var totalMb = imgs.reduce(function (a, m) { return a + m.mb; }, 0);
    var move = function (i, d) { var a = imgs.slice(); var t = a[i]; a[i] = a[i + d]; a[i + d] = t; self.setState({ imgs: a }); self.say('Moved to position ' + (i + d + 1)); };
    var set = function (o) { self.setState(o); };
    return Object.assign(sv, {
      cnav: this.creatorNav('Upload'),
      notDone: !st.done, isDone: st.done,
      w: w, unit: unit, unitLower: unitL, epNo: epNo, prevNo: w.eps, nextNo: epNo + 1,
      savedLine: st.savedAt ? 'Draft saved ' + st.savedAt : '',
      seriesOpts: all.filter(function (x) { return x.status !== 'draft'; }).map(function (x) { return { id: x.id, label: x.title + (x.status === 'review' ? ' (in review)' : '') }; }),
      onSeries: function (ev) { self.put('toonwave.uploadFor', ev.target.value); set({ wid: ev.target.value, tried: false }); },
      title: st.title, onTitle: function (ev) { set({ title: ev.target.value.slice(0, 60) }); },
      titlePh: nov ? 'e.g. The Letter With No Address' : 'e.g. The Ferryman’s Promise',
      titleBad: st.tried && st.title.trim().length < 2, titleCls: st.tried && st.title.trim().length < 2 ? 'bad' : '',
      titleHintCls: st.tried && st.title.trim().length < 2 ? 'err' : 'hint', titleHint: st.tried && st.title.trim().length < 2 ? 'Add a title.' : 'Shown as “' + unit + ' ' + epNo + ': ' + (st.title.trim() || 'Title') + '”',
      hasErrors: shown.length > 0, errCount: shown.length, errWord: shown.length === 1 ? 'thing' : 'things', errList: shown.map(function (t) { return { t: t }; }),
      isComic: !nov, isNovel: nov,
      contentTitle: nov ? 'Chapter text' : 'Images',
      contentSummary: nov ? '' : imgs.length ? imgs.length + ' images · ' + (Math.round(totalMb * 10) / 10) + ' MB · top to bottom' : 'No images yet',
      dropCls: st.tried && !imgs.length ? 'bad' : '', dropLabel: imgs.length ? 'Add more images' : 'Choose images',
      addImages: function () {
        var c = self.pool().map(function (x) { return x.cover; }), n = imgs.length;
        var add = [0, 1, 2].map(function (k) { var i = n + k; return { id: 'n' + Date.now() + k, name: 'ep' + epNo + '_' + ('0' + (i + 1)).slice(-2) + '.jpg', w: 800, h: 2400, mb: 1.6, pct: 5, src: c[(i * 5 + 2) % c.length], err: '' }; });
        set({ imgs: imgs.concat(add) }); self.tickUpload();
      },
      hasImgs: imgs.length > 0,
      imgs: imgs.map(function (m, i) {
        var load = m.pct < 100;
        return { n: i + 1, name: m.name, src: m.src, loading: load, pct: m.pct, pctW: m.pct + '%', cls: m.err ? 'bad' : '',
          meta: m.err ? m.err : load ? 'Uploading… ' + m.pct + '%' : m.w + ' × ' + m.h + ' px · ' + (Math.round(m.mb * 10) / 10) + ' MB',
          metaCls: m.err ? 'err' : 'muted', first: i === 0, last: i === imgs.length - 1,
          up: function () { if (i > 0) move(i, -1); }, down: function () { if (i < imgs.length - 1) move(i, 1); },
          remove: function () { set({ imgs: imgs.filter(function (x) { return x.id !== m.id; }) }); self.say(m.name + ' removed'); } };
      }),
      text: st.text, onText: function (ev) { set({ text: ev.target.value }); }, words: words, mins: Math.max(1, Math.round(words / 220)),
      textCls: st.tried && words < 300 ? 'bad' : '', textHintCls: st.tried && words < 300 ? 'err' : 'hint', textHint: words < 300 ? 'At least 300 words' : 'Looks good',
      whens: [['now', 'Publish now', 'Readers get it right away'], ['schedule', 'Schedule', 'Subscribers get an alert when it goes live']].map(function (o) { return { label: o[1], desc: o[2], on: st.when === o[0], cls: st.when === o[0] ? 'on' : '', pick: function () { set({ when: o[0] }); } }; }),
      isSchedule: st.when === 'schedule',
      date: st.date, dates: [0, 1, 2, 3, 4, 5, 6].map(function (k) { return { v: String(k), label: dateLbl(k) }; }), onDate: function (ev) { set({ date: ev.target.value }); },
      time: st.time, onTime: function (ev) { set({ time: ev.target.value }); },
      fastPass: st.fastPass, fpCls: st.fastPass ? 'on' : '', toggleFp: function () { set({ fastPass: !st.fastPass }); },
      fpDesc: st.fastPass ? 'Readers pay 5 coins to read early. Free for everyone on ' + freeDate + '.' : 'Free for everyone when it’s released.',
      comments: st.comments, cmCls: st.comments ? 'on' : '', toggleCm: function () { set({ comments: !st.comments }); },
      note: st.note, noteCount: st.note.length, onNote: function (ev) { set({ note: ev.target.value.slice(0, 300) }); },
      checks: [[st.title.trim().length >= 2, 'Title added'], [nov ? words >= 300 : imgs.length > 0 && !bad.length && !loading, nov ? 'At least 300 words' : 'Images ready (' + (imgs.length - bad.length) + '/' + imgs.length + ')'], [true, st.when === 'now' ? 'Publishing now' : 'Scheduled: ' + when], [true, st.fastPass ? 'Fast Pass on · 5 coins' : 'Free for everyone']].map(function (c) { return { t: c[1], cls: c[0] ? 'ok' : '', ic: c[0] ? '✓' : '!' }; }),
      previewTitle: st.title.trim() || 'Untitled', previewImgs: imgs.filter(function (m) { return !m.err; }).slice(0, 3).map(function (m) { return { src: m.src }; }), noPreview: !imgs.length,
      previewText: st.text.trim() ? st.text.trim().slice(0, 420) : 'Your chapter text will appear here, the way readers see it.',
      busy: st.busy, publishLabel: st.when === 'now' ? 'Publish ' + unitL : 'Schedule for ' + dateLbl(parseInt(st.date, 10)),
      saveDraft: function () { set({ savedAt: 'just now' }); self.say('Draft saved'); },
      publish: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (errs.length) { set({ tried: true }); try { window.scrollTo(0, 0); } catch (e) {} return; }
        set({ busy: true });
        self.later(900, function () {
          var list = self.myWorks().map(function (x) { return x.id === w.id ? Object.assign({}, x, { eps: x.eps + 1 }) : x; });
          self.put('toonwave.myWorks', JSON.stringify(list));
          set({ busy: false, done: true, doneWhen: when, doneNo: epNo });
        });
      },
      doneTitle: st.when === 'now' ? unit + ' ' + (st.doneNo || epNo) + ' is live' : unit + ' ' + (st.doneNo || epNo) + ' is scheduled',
      doneBody: st.when === 'now' ? 'Subscribers are getting a notification now.' : 'It goes live ' + (st.doneWhen || when) + '. Subscribers get a notification then. You can edit it until it goes live.',
      another: function () { set({ done: false, title: '', imgs: [], text: '', note: '', tried: false }); }
    });
  }
