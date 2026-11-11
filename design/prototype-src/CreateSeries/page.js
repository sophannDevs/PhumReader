  constructor(props) {
    super(props);
    this.pageName = 'CreateSeries';
    this.state = Object.assign({}, this.state || {}, this.initState(props), { toast: '', searchOpen: false, userMenu: false });
  }
  initState(props) {
    var order = ['basics', 'story', 'cover', 'publishing', 'submitted'];
    var step = props.demoStep || 'basics';
    var d = this.blank();
    // Demo steps after "basics" start with the earlier steps filled in.
    if (order.indexOf(step) > 0) d = Object.assign(d, { title: 'Monsoon Letters', genre: 'Romance', genre2: 'Drama', summary: 'Every rainy season, a Phnom Penh postman finds a letter with no address. This year, he decides to deliver it.', tags: ['slowburn', 'phnompenh', 'letters'] });
    if (order.indexOf(step) > 2) d.cover = this.pool()[15].cover;
    if (step === 'submitted') { d.days = ['Sun']; d.agree = true; }
    var saved = null; try { saved = this.read('toonwave.draftSeries', null); } catch (e) {}
    if (saved && step === 'basics') d = Object.assign(d, saved);
    return { step: step, d: d, tried: {}, tagDraft: '', busy: false, savedAt: '' };
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); if (this._as) clearTimeout(this._as); }
  componentDidUpdate(pp) { if (pp.demoStep !== this.props.demoStep) this.setState(this.initState(this.props)); }
  userName() { var u = this.get('toonwave.user'); return u || 'Sokha Chan'; }
  blank() { return { format: 'comic', title: '', genre: '', genre2: '', age: 'all', lang: 'km', summary: '', tags: [], cover: '', days: [], time: '18', fastPass: false, agree: false }; }
  errors(step, d) {
    var e = [];
    var taken = this.pool().some(function (s) { return s.title.toLowerCase() === d.title.trim().toLowerCase(); });
    if (step === 'basics') {
      if (d.title.trim().length < 2) e.push(['title', 'Enter a title (2–60 characters).']);
      else if (taken) e.push(['title', 'A series called “' + d.title.trim() + '” already exists. Choose another title.']);
      if (!d.genre) e.push(['genre', 'Choose a main genre.']);
    }
    if (step === 'story' && d.summary.trim().length < 50) e.push(['sum', 'Write a summary of at least 50 characters.']);
    if (step === 'cover' && !d.cover) e.push(['cover', 'Add a cover image.']);
    if (step === 'publishing') { if (!d.days.length) e.push(['day', 'Choose at least one update day.']); if (!d.agree) e.push(['agree', 'Confirm that this is your original work.']); }
    return e;
  }
  renderVals() {
    var self = this, st = this.state, d = st.d;
    var sv = this.sharedVals('');
    var order = ['basics', 'story', 'cover', 'publishing'];
    var ix = order.indexOf(st.step);
    var set = function (k, v) { var n = Object.assign({}, st.d); n[k] = v; self.setState({ d: n }); self.autosave(n); };
    this.autosave = function (n) { if (self._as) clearTimeout(self._as); self._as = setTimeout(function () { self.put('toonwave.draftSeries', JSON.stringify(n)); self.setState({ savedAt: 'just now' }); }, 600); };
    var errs = ix >= 0 ? this.errors(st.step, d) : [];
    var shownErrs = st.tried[st.step] ? errs : [];
    var has = function (k) { return shownErrs.some(function (x) { return x[0] === k; }); };
    var msg = function (k) { var f = shownErrs.filter(function (x) { return x[0] === k; })[0]; return f ? f[1] : ''; };
    var nov = d.format === 'novel', unit = nov ? 'chapter' : 'episode';
    var genres = ['Drama', 'Fantasy', 'Comedy', 'Action', 'Slice of life', 'Romance', 'Superhero', 'Sci-fi'];
    var sumLen = d.summary.trim().length;
    var dayNames = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
    var addTag = function (t) { t = String(t || '').replace(/^#/, '').trim().toLowerCase().replace(/\s+/g, ''); if (!t || d.tags.indexOf(t) >= 0 || d.tags.length >= 5) return; set('tags', d.tags.concat([t])); self.setState({ tagDraft: '' }); };
    var go = function (s) { self.setState({ step: s }); try { window.scrollTo(0, 0); } catch (e) {} };
    var info = {
      basics: ['The basics', 'What you’re making and who it’s for.'],
      story: ['Your story', 'This is what readers see before they subscribe.'],
      cover: ['Cover', 'The first thing readers see in lists and search.'],
      publishing: ['Publishing', 'When new ' + unit + 's come out.']
    }[st.step] || ['', ''];
    var cover = d.cover;
    return Object.assign(sv, {
      cnav: this.creatorNav('CreateSeries'),
      notDone: st.step !== 'submitted', isDone: st.step === 'submitted',
      heading: d.title.trim() ? d.title.trim() : 'New series',
      savedLine: st.savedAt ? 'Draft saved ' + st.savedAt : 'Drafts save automatically',
      steps: order.map(function (s, i) {
        var done = i < ix;
        return { label: ['Basics', 'Story', 'Cover', 'Publishing'][i], mark: done ? '✓' : String(i + 1), cls: i === ix ? 'cur' : done ? 'done' : '', cur: i === ix ? 'step' : 'false', locked: i > ix, go: function () { if (i <= ix) go(s); } };
      }),
      stepTitle: info[0], stepHint: info[1],
      isBasics: st.step === 'basics', isStory: st.step === 'story', isCover: st.step === 'cover', isPublishing: st.step === 'publishing',
      hasErrors: shownErrs.length > 0, errCount: shownErrs.length, errWord: shownErrs.length === 1 ? 'thing' : 'things', errList: shownErrs.map(function (x) { return { t: x[1] }; }),
      d: d,
      formats: [['comic', 'Comic', 'Vertical-scroll images'], ['novel', 'Web novel', 'Text chapters']].map(function (o) { return { label: o[1], desc: o[2], on: d.format === o[0], cls: d.format === o[0] ? 'on' : '', pick: function () { set('format', o[0]); } }; }),
      onTitle: function (ev) { set('title', ev.target.value.slice(0, 60)); },
      e: {
        titleCls: has('title') ? 'bad' : '', titleBad: has('title'), titleHintCls: has('title') ? 'err' : 'hint', titleHint: has('title') ? msg('title') : d.title.length + '/60 · You can change this later',
        genreCls: has('genre') ? 'bad' : '', genreBad: has('genre'),
        sumCls: has('sum') ? 'bad' : '', sumBad: has('sum'), sumHintCls: has('sum') ? 'err' : 'hint', sumHint: has('sum') ? msg('sum') : (sumLen < 50 ? (50 - sumLen) + ' more characters needed' : 'Looks good'),
        coverCls: has('cover') ? 'bad' : '', coverBad: has('cover'),
        dayHintCls: has('day') ? 'err' : 'hint', dayHint: has('day') ? msg('day') : (d.days.length ? 'New ' + unit + 's every ' + d.days.map(function (x) { return dayNames[x]; }).join(' and ') : 'Readers subscribe more when updates are regular.'),
        agreeBad: has('agree')
      },
      genres: genres.map(function (g) { return { v: g }; }), genres2: genres.filter(function (g) { return g !== d.genre; }).map(function (g) { return { v: g }; }),
      onGenre: function (ev) { set('genre', ev.target.value); }, onGenre2: function (ev) { set('genre2', ev.target.value); },
      ages: [['all', 'All ages'], ['13', '13+'], ['16', '16+'], ['18', '18+']].map(function (a) { return { label: a[1], on: d.age === a[0], cls: d.age === a[0] ? 'on' : '', pick: function () { set('age', a[0]); } }; }),
      ageHint: { all: 'Fine for everyone.', '13': 'Mild violence or language.', '16': 'Stronger themes. Hidden from readers under 16.', '18': 'Only shown to readers 18+ who turn on mature series.' }[d.age],
      onLang: function (ev) { set('lang', ev.target.value); },
      onSum: function (ev) { set('summary', ev.target.value.slice(0, 500)); }, sumCount: d.summary.length,
      tags: d.tags.map(function (t) { return { t: t, remove: function () { set('tags', d.tags.filter(function (x) { return x !== t; })); } }; }),
      canTag: d.tags.length < 5, tagDraft: st.tagDraft,
      onTag: function (ev) { var v = ev.target.value; if (/[,\s]$/.test(v)) addTag(v); else self.setState({ tagDraft: v.slice(0, 20) }); },
      tagKey: function (ev) { if (ev.key === 'Enter') { if (ev.preventDefault) ev.preventDefault(); addTag(st.tagDraft); } if (ev.key === 'Backspace' && !st.tagDraft && d.tags.length) set('tags', d.tags.slice(0, -1)); },
      tagIdeas: ['khmer', 'slowburn', 'foundfamily', 'magic', 'schoollife'].filter(function (t) { return d.tags.indexOf(t) < 0; }).slice(0, 4).map(function (t) { return { t: t, add: function () { addTag(t); } }; }),
      noCover: !cover, hasCover: !!cover,
      pickCover: function () { var p = self.pool(); set('cover', p[(p.findIndex(function (x) { return x.cover === cover; }) + 4 + p.length) % p.length].cover); self.say('Cover uploaded (prototype)'); },
      removeCover: function () { set('cover', ''); },
      reqs: [['3:4 portrait, at least 1080 × 1440 px', !!cover], ['JPG or PNG, up to 2 MB', !!cover], ['Title text readable at small sizes', !!cover], ['No borders or watermarks', !!cover]].map(function (r) { return { t: r[0], cls: r[1] ? 'ok' : '', ic: r[1] ? '✓' : '•' }; }),
      thumbFallback: cover ? '' : '1:1',
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(function (x) { var on = d.days.indexOf(x) >= 0; return { label: x, on: on, cls: on ? 'on' : '', toggle: function () { set('days', on ? d.days.filter(function (y) { return y !== x; }) : d.days.concat([x])); } }; }),
      onTime: function (ev) { set('time', ev.target.value); },
      fpCls: d.fastPass ? 'on' : '', toggleFp: function () { set('fastPass', !d.fastPass); },
      agreeCls: d.agree ? 'on' : '', toggleAgree: function () { set('agree', !d.agree); },
      canBack: ix > 0, back: function () { go(order[ix - 1]); },
      saveDraft: function () { self.put('toonwave.draftSeries', JSON.stringify(d)); self.setState({ savedAt: 'just now' }); self.say('Draft saved'); },
      busy: st.busy, nextLabel: st.step === 'publishing' ? 'Submit for review' : 'Continue',
      next: function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        var t = Object.assign({}, st.tried); t[st.step] = true;
        if (errs.length) { self.setState({ tried: t }); return; }
        if (st.step !== 'publishing') { self.setState({ tried: t }); go(order[ix + 1]); return; }
        self.setState({ busy: true, tried: t });
        self.later(900, function () {
          var w = self.myWorks().filter(function (x) { return x.title !== d.title.trim(); });
          w.push({ id: 'C' + (w.length + 10), title: d.title.trim(), format: d.format, genre: d.genre, status: 'review', eps: 0, day: d.days[0], cover: d.cover, views: '0', subs: '0', likes: '0', summary: d.summary });
          self.put('toonwave.myWorks', JSON.stringify(w)); self.put('toonwave.draftSeries', null);
          self.setState({ busy: false, step: 'submitted' });
        });
      },
      unitLower: unit,
      coverFallback: cover ? '' : 'Cover 3:4',
      pv: {
        title: d.title.trim() || 'Your series title', genre: d.genre || 'Genre', format: nov ? 'Web novel' : 'Comic',
        age: { all: 'All ages', '13': '13+', '16': '16+', '18': '18+' }[d.age],
        schedule: d.days.length ? 'Every ' + d.days.join(', ') : 'Schedule not set',
        summary: d.summary.trim() || 'Your summary will appear here.'
      }
    });
  }
