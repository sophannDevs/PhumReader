  constructor(props) {
    super(props);
    this.pageName = 'Manage';
    this.state = Object.assign({}, this.state || {}, this.initState(props), { toast: '', searchOpen: false, userMenu: false });
  }
  initState(props) {
    var demoChanges = (props.demoSeries || 'published') === 'changes-requested';
    var want = null; try { want = this.get('toonwave.editSeries'); } catch (e) {}
    var works = this.myWorks();
    var picked = works.filter(function (x) { return x.id === want; })[0];
    var w = demoChanges ? works.filter(function (x) { return x.id === 'C2'; })[0] : (picked || works[0]);
    // A series the review team sent back shows the "changes requested" view.
    var changes = demoChanges || (!!w && w.status === 'changes');
    w = w || works[0];
    var f = { title: w.title, summary: demoChanges ? 'Two noodle-stall cousins solve tiny mysteries at the Russian Market. Follow us on Telegram @nightmarket_kh for extras!' : (w.summary || ''), genre: w.genre, run: 'ongoing', note: '', days: [w.day || 'Sat'], cover: w.cover, coverFixed: !demoChanges };
    var rn = (this.read('toonwave.reviewNotes', {}) || {})[w.id] || null;
    return { wid: w.id, demoChanges: demoChanges, review: rn, manualFixed: {}, changes: changes, resubmitted: false, tab: props.demoTab || 'episodes', filter: 'all', sortNew: true, shown: 8, eps: this.makeEps(w, changes), f: f, saved: Object.assign({}, f), fp: { on: !changes, n: '3' }, fpSaved: { on: !changes, n: '3' }, comments: true, unpub: false, dlg: null, cfText: '', edTried: false };
  }
  makeEps(w, changes) {
    var c = this.pool().map(function (x) { return x.cover; });
    var names = ['The Lantern Wakes', 'Fog on the Mekong', 'A Ferry With No Name', 'The Night Ferryman', 'Paper Boats', 'River Market', 'The Lost Girl', 'Monsoon Bells', 'Under the Bridge', 'Spirit Tide', 'Two Shores', 'Ash and Water', 'The Old Pier', 'Lantern Festival', 'Floodwater', 'Moon on the River', 'The Ferry Strike', 'Driftwood', 'Grandmother’s Map', 'The Tenth Lantern', 'Whispering Reeds', 'Low Tide', 'The Crossing', 'The Ferry at Dawn', 'The Ferryman’s Promise', 'Untitled draft'];
    var mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var day = function (n) { var d = new Date(Date.UTC(2026, 10, 7) + (n - 24) * 7 * 86400000); return mo[d.getUTCMonth()] + ' ' + d.getUTCDate(); };
    var out = [];
    if (changes) {
      for (var j = 1; j <= 3; j++) out.push({ n: j, title: ['Cold Noodles, Hot Case', 'The Missing Chopsticks', 'Market After Midnight'][j - 1], status: 'draft', thumb: c[(j * 7) % c.length], views: '–', likes: '–', cms: '–', date: 'Ready for launch' });
      return out;
    }
    for (var n = 1; n <= 26; n++) {
      var st = n <= 21 ? 'published' : n <= 24 ? 'fastpass' : n === 25 ? 'scheduled' : 'draft';
      out.push({ n: n, title: names[n - 1], status: n === 9 ? 'hidden' : st, thumb: c[(n * 5) % c.length], views: st === 'scheduled' || st === 'draft' ? '–' : this.fmt(4200 + ((n * 977) % 3800) + (24 - n) * 120), likes: st === 'scheduled' || st === 'draft' ? '–' : this.fmt(310 + ((n * 131) % 420)), cms: st === 'scheduled' || st === 'draft' ? '–' : String(12 + ((n * 17) % 60)), date: day(n), free: day(n + 1) });
    }
    return out;
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  componentDidUpdate(pp) { if (pp.demoSeries !== this.props.demoSeries || pp.demoTab !== this.props.demoTab) this.setState(this.initState(this.props)); }
  userName() { var u = this.get('toonwave.user'); return u || 'Sokha Chan'; }
  renderVals() {
    var self = this, st = this.state, f = st.f;
    var sv = this.sharedVals('');
    var works = this.myWorks();
    var w = works.filter(function (x) { return x.id === st.wid; })[0] || works[0];
    var nov = w.format === 'novel', unit = nov ? 'Chapter' : 'Episode', unitL = unit.toLowerCase();
    var eps = st.eps;
    var stInfo = {
      published: ['Published', 'badge-brand'], fastpass: ['Fast Pass', 'badge-warn'], scheduled: ['Scheduled', 'badge-default'], draft: ['Draft', 'badge-secondary'], hidden: ['Hidden', 'badge-outline']
    };
    var groups = { all: function () { return true; }, live: function (e) { return e.status === 'published' || e.status === 'fastpass'; }, scheduled: function (e) { return e.status === 'scheduled'; }, drafts: function (e) { return e.status === 'draft' || e.status === 'hidden'; } };
    var list = eps.filter(groups[st.filter]);
    if (st.sortNew) list = list.slice().reverse();
    var shown = list.slice(0, st.shown);
    var setEps = function (ne) { self.setState({ eps: ne }); };
    var upd = function (n, o) { setEps(eps.map(function (e) { return e.n === n ? Object.assign({}, e, o) : e; })); };
    var set = function (k, v) { var n = Object.assign({}, st.f); n[k] = v; self.setState({ f: n }); };
    var clean = JSON.stringify(f) === JSON.stringify(st.saved);
    var contact = /(@\w|t\.me|telegram|facebook|https?:|\b0\d{8,9}\b)/i.test(f.summary);
    var fixes = st.demoChanges || !st.review ? [
      ['Remove contact details from the summary', 'Summaries can’t include social handles, links or phone numbers.', !contact, 'details'],
      ['Replace the cover', 'The cover has a watermark in the bottom corner. Upload a clean version.', f.coverFixed && st.saved.coverFixed, 'details']
    ] : st.review.items.map(function (t, i) { return [t, i === 0 && st.review.note ? 'Note from the reviewer: “' + st.review.note + '”' : 'Mark it fixed once you’ve changed it.', !!st.manualFixed[i], 'details', i]; });
    var fixedN = fixes.filter(function (x) { return x[2]; }).length;
    var dlg = st.dlg;
    var live = eps.filter(groups.live).length;
    var fpQueue = eps.filter(function (e) { return e.status === 'fastpass'; });
    var cfData = !dlg || dlg.t !== 'confirm' ? { title: '', body: '', btn: '', btnCls: '', typeIt: false } : dlg.cf;
    var runs = [['ongoing', 'Ongoing'], ['hiatus', 'On break'], ['completed', 'Completed']];
    return Object.assign(sv, {
      cnav: this.creatorNav('Creator'),
      w: Object.assign({}, w, { title: st.saved.title, cover: st.saved.cover }), unit: unit, unitLower: unitL,
      seriesHref: this.href('Series'), viewAsReader: function () { self.storeSeries({ id: w.id, title: st.saved.title, genre: w.genre, creator: sv.userName, cover: st.saved.cover, likes: w.likes, views: w.views, episodes: w.eps, schedule: 'Every ' + self.dayLong(st.saved.days[0] || 'Sat') }); },
      isLive: !st.changes, isChanges: st.changes && !st.resubmitted, isResubmitted: st.resubmitted,
      statusLabel: st.changes ? (st.resubmitted ? 'In review' : 'Changes requested') : st.unpub ? 'Hidden from readers' : 'Published', statusCls: st.changes ? (st.resubmitted ? 'badge-warn' : 'badge-up') : st.unpub ? 'badge-outline' : 'badge-brand',
      formatLabel: nov ? 'Web novel' : 'Comic', runLabel: { ongoing: 'Ongoing', hiatus: 'On break', completed: 'Completed' }[st.saved.run],
      headMeta: st.changes ? eps.length + ' ' + unitL + 's ready · Submitted Nov 9' : live + ' published · ' + w.subs + ' subscribers · ' + w.views + ' views · Every ' + st.saved.days.map(function (d) { return self.dayLong(d); }).join(', '),
      toUpload: function () { self.put('toonwave.uploadFor', w.id); },
      fixTotal: fixes.length,
      fixes: fixes.map(function (x) { return { t: x[0], d: x[1], todo: !x[2], cls: x[2] ? 'ok' : '', ic: x[2] ? '✓' : '!', go: function () {
        if (x[4] !== undefined) { var m = Object.assign({}, st.manualFixed); m[x[4]] = true; self.setState({ manualFixed: m }); return; }
        self.setState({ tab: x[3] }); } }; }),
      fixBtn: st.review && !st.demoChanges ? 'Mark fixed' : 'Fix',
      cantResubmit: fixedN < fixes.length, fixLine: fixedN + ' of ' + fixes.length + ' fixed' + (fixedN < fixes.length ? ' · Save your changes in Series details' : ''),
      resubmit: function () {
        if (fixedN < fixes.length) return;
        self.put('toonwave.myWorks', JSON.stringify(self.myWorks().map(function (x) { return x.id === w.id ? Object.assign({}, x, { status: 'review' }) : x; })));
        self.put('toonwave.admin.series', JSON.stringify(self.read('toonwave.admin.series', []).filter(function (x) { return x !== w.id; })));
        self.setState({ resubmitted: true }); self.say('Resubmitted for review');
      },
      tabs: [['episodes', unit + 's', eps.length], ['details', 'Series details', 0], ['fastpass', 'Fast Pass', 0], ['settings', 'Settings', 0]].map(function (t) { var on = st.tab === t[0]; return { label: t[1], hasCount: t[2] > 0, count: t[2], on: on, cls: on ? 'on' : '', pick: function () { self.setState({ tab: t[0] }); } }; }),
      tabEps: st.tab === 'episodes', tabDetails: st.tab === 'details', tabFp: st.tab === 'fastpass', tabSettings: st.tab === 'settings',
      filters: [['all', 'All'], ['live', 'Published'], ['scheduled', 'Scheduled'], ['drafts', 'Drafts and hidden']].map(function (x) { var on = st.filter === x[0]; return { label: x[1], count: eps.filter(groups[x[0]]).length, on: on, cls: on ? 'on' : '', pick: function () { self.setState({ filter: x[0], shown: 8 }); } }; }),
      sortLabel: st.sortNew ? 'Newest first' : 'Oldest first', toggleSort: function () { self.setState({ sortNew: !st.sortNew }); },
      hasEps: shown.length > 0, noEps: !shown.length,
      emptyTitle: st.filter === 'scheduled' ? 'Nothing scheduled' : 'No ' + unitL + 's here', emptyBody: st.filter === 'scheduled' ? 'Schedule your next ' + unitL + ' so subscribers get it on time.' : 'Try another filter.',
      eps: shown.map(function (e) {
        var info = stInfo[e.status], hidden = e.status === 'hidden';
        return { label: unit + ' ' + e.n + ': ' + e.title, thumb: e.thumb, stLabel: info[0], stCls: info[1], rowCls: hidden ? 'hidden' : '',
          when: e.status === 'fastpass' ? 'Released ' + e.date + ' · free for everyone ' + e.free : e.status === 'scheduled' ? 'Goes live ' + ({ a: 'Sat, Nov 14 · 6:00 PM', b: 'Sat, Nov 14 · 8:00 PM', c: 'Sun, Nov 15 · 6:00 PM', d: 'Sat, Nov 21 · 6:00 PM' }[e.slot || 'a']) : e.status === 'draft' ? (st.changes ? e.date : 'Not scheduled') : hidden ? 'Hidden from readers since Nov 2' : 'Released ' + e.date,
          views: e.views, likes: e.likes, cms: e.cms, hasStats: e.views !== '–',
          canHide: e.status !== 'draft' && e.status !== 'scheduled', isDraft: e.status === 'draft',
          hideLabel: hidden ? 'Show' : 'Hide', hideAria: (hidden ? 'Show ' : 'Hide ') + unit + ' ' + e.n,
          edit: function () { self.setState({ dlg: { t: 'edit', n: e.n, title: e.title, slot: e.slot || 'a', status: e.status }, edTried: false, dlgY: self.layerY(-160) }); },
          hide: function () {
            if (hidden) { upd(e.n, { status: e.n > 21 ? 'fastpass' : 'published' }); self.say(unit + ' ' + e.n + ' is visible again'); return; }
            self.setState({ dlgY: self.layerY(-140), dlg: { t: 'confirm', act: 'hide', n: e.n, cf: { title: 'Hide ' + unitL + ' ' + e.n + '?', body: e.status === 'fastpass' ? 'Readers can’t open it, including people who unlocked it with coins. Their coins aren’t refunded automatically. You can show it again any time.' : 'Readers can’t open it, and it’s skipped in the reader. Likes and comments are kept. You can show it again any time.', btn: 'Hide ' + unitL, btnCls: 'btn-primary', typeIt: false } } });
          },
          del: function () { self.setState({ dlgY: self.layerY(-140), dlg: { t: 'confirm', act: 'del', n: e.n, cf: { title: 'Delete this draft?', body: unit + ' ' + e.n + ': ' + e.title + ' and its images will be deleted. This can’t be undone.', btn: 'Delete draft', btnCls: 'btn-destructive', typeIt: false } } }); }
        };
      }),
      hasMore: list.length > st.shown, shownCount: shown.length, totalCount: list.length, more: function () { self.setState({ shown: st.shown + 8 }); },
      // Series details
      f: f, clean: clean,
      onTitle: function (ev) { set('title', ev.target.value.slice(0, 60)); },
      titleCls: f.title.trim().length < 2 ? 'bad' : '', titleHintCls: f.title.trim().length < 2 ? 'err' : 'hint',
      titleHint: f.title.trim().length < 2 ? 'Enter a title.' : f.title !== st.saved.title && !st.changes ? 'Changing the title of a published series sends it for a quick review. Subscribers keep the series.' : f.title.length + '/60',
      onSum: function (ev) { set('summary', ev.target.value.slice(0, 500)); }, sumCount: f.summary.length,
      sumCls: contact || f.summary.trim().length < 50 ? 'bad' : '', sumHintCls: contact || f.summary.trim().length < 50 ? 'err' : 'hint',
      sumHint: contact ? 'Remove handles, links or phone numbers.' : f.summary.trim().length < 50 ? 'At least 50 characters.' : 'Looks good',
      genres: ['Drama', 'Fantasy', 'Comedy', 'Action', 'Slice of life', 'Romance', 'Superhero', 'Sci-fi'].map(function (g) { return { v: g }; }), onGenre: function (ev) { set('genre', ev.target.value); },
      runs: runs.map(function (r) { var on = f.run === r[0]; return { label: r[1], on: on, cls: on ? 'on' : '', pick: function () { set('run', r[0]); } }; }),
      runHint: { ongoing: 'New ' + unitL + 's on your schedule.', hiatus: 'Readers see that you’re on a break. Your schedule is paused.', completed: 'No more ' + unitL + 's. Fast Pass ends and every ' + unitL + ' becomes free.' }[f.run],
      isHiatus: f.run === 'hiatus', onNote: function (ev) { set('note', ev.target.value.slice(0, 120)); },
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { var on = f.days.indexOf(x) >= 0; return { label: x, on: on, cls: on ? 'on' : '', toggle: function () { set('days', on ? f.days.filter(function (y) { return y !== x; }) : f.days.concat([x])); } }; }),
      coverCls: f.coverFixed ? '' : 'bad', coverHintCls: f.coverFixed ? 'hint' : 'err', coverHint: f.coverFixed ? '3:4 · JPG or PNG · up to 2 MB' : 'Has a watermark. Replace it.',
      replaceCover: function () { var p = self.pool(); var n = Object.assign({}, st.f, { cover: p[(p.findIndex(function (x) { return x.cover === f.cover; }) + 6 + p.length) % p.length].cover, coverFixed: true }); self.setState({ f: n }); self.say('New cover uploaded (prototype)'); },
      discard: function () { self.setState({ f: Object.assign({}, st.saved) }); },
      saveDetails: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (f.title.trim().length < 2 || f.summary.trim().length < 50 || !f.days.length) { self.say(!f.days.length ? 'Choose at least one update day' : 'Fix the highlighted fields'); return; }
        var list2 = self.myWorks().map(function (x) { return x.id === w.id ? Object.assign({}, x, { title: f.title.trim(), summary: f.summary, genre: f.genre, cover: f.cover, day: f.days[0] }) : x; });
        self.put('toonwave.myWorks', JSON.stringify(list2));
        self.setState({ saved: Object.assign({}, f), f: Object.assign({}, f) }); self.say('Series details saved');
      },
      // Fast Pass
      fp: st.fp, fpOn: st.fp.on, fpOff: !st.fp.on, fpCls: st.fp.on ? 'on' : '', fpN: st.fp.n, fpClean: JSON.stringify(st.fp) === JSON.stringify(st.fpSaved),
      toggleFp: function () { self.setState({ fp: Object.assign({}, st.fp, { on: !st.fp.on }) }); },
      onFpN: function (ev) { self.setState({ fp: Object.assign({}, st.fp, { n: ev.target.value }) }); },
      fpHint: 'You need at least ' + st.fp.n + ' ' + unitL + (st.fp.n === '1' ? '' : 's') + ' ready ahead of the free one. More ' + unitL + 's ahead usually means more coins, but needs a bigger buffer.',
      fpQueue: fpQueue.length ? fpQueue.map(function (e) { return { t: unit + ' ' + e.n + ': ' + e.title, d: 'Free ' + e.free }; }) : [{ t: 'No Fast Pass ' + unitL + 's yet', d: '' }],
      saveFp: function () { self.setState({ fpSaved: Object.assign({}, st.fp) }); self.say(st.fp.on ? 'Fast Pass: ' + st.fp.n + ' ' + unitL + 's ahead' : 'Fast Pass turned off'); },
      // Settings
      comments: st.comments, cmCls: st.comments ? 'on' : '', toggleCm: function () { self.setState({ comments: !st.comments }); self.say(st.comments ? 'Comments turned off' : 'Comments turned on'); },
      unpubTitle: st.unpub ? 'Show series to readers' : 'Hide series from readers', unpubBtn: st.unpub ? 'Show series' : 'Hide series',
      unpubDesc: st.unpub ? 'It’s hidden now. Subscribers can’t open it.' : 'It disappears from search, rankings and libraries. Nothing is deleted.',
      openUnpub: function () {
        if (st.unpub) { self.setState({ unpub: false }); self.say('Series is visible again'); return; }
        self.setState({ cfText: '', dlgY: self.layerY(-160), dlg: { t: 'confirm', act: 'unpub', cf: { title: 'Hide ' + st.saved.title + '?', body: 'Readers can’t find or open it, including subscribers and people who unlocked Fast Pass episodes. You can show it again any time.', btn: 'Hide series', btnCls: 'btn-destructive', typeIt: true } } });
      },
      cantDelete: live > 0, delDesc: live > 0 ? 'Series with published ' + unitL + 's can’t be deleted, because readers bought and saved them. Hide it instead.' : 'Deletes the series and all drafts. This can’t be undone.',
      delSeries: function () { self.say('Series deleted (prototype)'); },
      // Dialogs
      dlgEdit: !!dlg && dlg.t === 'edit', dlgConfirm: !!dlg && dlg.t === 'confirm', dlgTop: st.dlgY || '140px',
      ed: dlg && dlg.t === 'edit' ? { label: unit + ' ' + dlg.n, title: dlg.title, slot: dlg.slot, isScheduled: dlg.status === 'scheduled', isPublished: dlg.status === 'published' || dlg.status === 'fastpass' || dlg.status === 'hidden' } : { label: '', title: '', slot: 'a', isScheduled: false, isPublished: false },
      edBad: !!dlg && st.edTried && (dlg.title || '').trim().length < 2, edBadCls: !!dlg && st.edTried && (dlg.title || '').trim().length < 2 ? 'bad' : '',
      onEdTitle: function (ev) { self.setState({ dlg: Object.assign({}, dlg, { title: ev.target.value.slice(0, 60) }) }); },
      onEdSlot: function (ev) { self.setState({ dlg: Object.assign({}, dlg, { slot: ev.target.value }) }); },
      replaceImgs: function () { self.say('Opens the image uploader (prototype)'); },
      saveEp: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if ((dlg.title || '').trim().length < 2) { self.setState({ edTried: true }); return; }
        var ne = eps.map(function (e) { return e.n === dlg.n ? Object.assign({}, e, { title: dlg.title.trim(), slot: dlg.slot }) : e; });
        self.setState({ eps: ne, dlg: null }); self.say(unit + ' ' + dlg.n + ' saved');
      },
      cf: cfData, cfText: st.cfText, onCfText: function (ev) { self.setState({ cfText: ev.target.value }); },
      cfBlocked: !!cfData.typeIt && st.cfText.trim() !== st.saved.title,
      confirmGo: function () {
        if (!dlg) return;
        if (dlg.act === 'hide') { self.setState({ dlg: null, eps: eps.map(function (e) { return e.n === dlg.n ? Object.assign({}, e, { status: 'hidden' }) : e; }) }); self.say(unit + ' ' + dlg.n + ' hidden'); }
        if (dlg.act === 'del') { self.setState({ dlg: null, eps: eps.filter(function (e) { return e.n !== dlg.n; }) }); self.say('Draft deleted'); }
        if (dlg.act === 'unpub') { if (st.cfText.trim() !== st.saved.title) return; self.setState({ dlg: null, unpub: true }); self.say('Series hidden from readers'); }
      },
      closeDlg: function () { self.setState({ dlg: null }); }
    });
  }
