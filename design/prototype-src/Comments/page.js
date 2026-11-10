  constructor(props) {
    super(props);
    this.pageName = 'Comments';
    var ds = props.demoState || 'top';
    this.state = Object.assign({}, this.state || {}, {
      sort: ds === 'newest' ? 'new' : 'top', creatorOnly: false, draft: '', spoiler: false, mine: [], liked: {}, open: { c1: true }, replying: ds === 'replying' ? 'c2' : '', rpDraft: ds === 'replying' ? 'Same, I screamed at the last page!' : '',
      myReplies: {}, revealed: ds === 'spoiler-open' ? { c3: true } : {}, editing: '', edText: '', deleted: {}, shown: 6, showHidden: false, toast: '', searchOpen: false, userMenu: false
    });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  base(s) {
    var cr = s.creator || 'Owen Blake';
    return [
      { id: 'c0', name: cr, creator: true, pinned: true, when: '1d', ago: 24, likes: 2140, text: 'Thank you for 1 million likes! Episode 66 has a small cameo from someone you met in episode 3. 👀', replies: [] },
      { id: 'c1', name: 'Sokha P.', when: '2h', ago: 2, likes: 412, text: 'That last page!! I did not see that coming. Waiting a whole week is going to hurt.', replies: [{ name: cr, creator: true, when: '1h', likes: 318, text: 'Sorry not sorry 😄 Next week is worth it.' }, { name: 'Dara K.', when: '1h', likes: 22, text: 'Same, I refreshed the page three times.' }] },
      { id: 'c2', name: 'Linh T.', when: '5h', ago: 5, likes: 168, text: 'The colors in this series keep getting better. The rain panels were beautiful.', replies: [{ name: 'Mai L.', when: '4h', likes: 9, text: 'The rain panels made me want to go outside.' }] },
      { id: 'c3', name: 'Vibol K.', when: '9h', ago: 9, likes: 97, spoiler: true, text: 'So the compass was pointing at her brother the whole time. Rereading from episode 1 with that in mind is wild.', replies: [] },
      { id: 'c4', name: 'Chenda P.', when: '1d', ago: 26, likes: 54, text: 'Reading this in Khmer on the bus every morning. Thank you for the translation!', replies: [] },
      { id: 'c5', name: 'Rithy S.', when: '2d', ago: 50, likes: 31, text: 'Who else thinks the guild master is not the real villain?', replies: [{ name: 'Sophea R.', when: '2d', likes: 12, text: 'Yes! Look at the background in episode 40.' }] },
      { id: 'c6', name: 'Nary M.', when: '3d', ago: 72, likes: 12, text: 'First time commenting. This is my favourite series on the app.', replies: [] }
    ];
  }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var s = this.series();
    var epN = parseInt(this.get('toonwave.commentsEp') || '0', 10) || 0;
    var blocked = this.blocked();
    var all = st.mine.concat(this.base(s)).filter(function (c) { return !st.deleted[c.id]; });
    var hiddenN = all.filter(function (c) { return blocked.indexOf(c.name) >= 0; }).length;
    var list = all.filter(function (c) { return (st.showHidden || blocked.indexOf(c.name) < 0) && (!st.creatorOnly || c.creator || c.replies.some(function (r) { return r.creator; })); });
    var pinned = list.filter(function (c) { return c.pinned; }), rest = list.filter(function (c) { return !c.pinned; });
    rest.sort(st.sort === 'top' ? function (a, b) { return b.likes - a.likes; } : function (a, b) { return a.ago - b.ago; });
    var shown = pinned.concat(rest).slice(0, st.shown + pinned.length);
    var set = function (k, v) { var o = {}; o[k] = v; self.setState(o); };
    var flip = function (k, id) { var n = Object.assign({}, st[k]); n[id] = !n[id]; set(k, n); };
    var needLogin = function () { if (!sv.loggedIn) { self.say('Log in first'); return true; } return false; };
    var fmt = function (n) { return n >= 1000 ? (Math.round(n / 100) / 10) + 'K' : String(n); };
    return Object.assign(sv, {
      s: s, seriesHref: this.href('Series'),
      scopeLabel: epN ? 'Episode ' + epN : 'All episodes',
      total: fmt(2400 + st.mine.length), readHref: epN ? this.href('Viewer') : this.href('Series'), readLabel: epN ? 'Back to episode ' + epN : 'Back to series',
      toRead: function () { if (epN) self.put('toonwave.openEp', String(epN)); },
      draft: st.draft, draftCount: st.draft.length, onDraft: function (ev) { set('draft', ev.target.value.slice(0, 500)); },
      spoiler: st.spoiler, spoilerCls: st.spoiler ? 'on' : '', toggleSpoiler: function () { set('spoiler', !st.spoiler); },
      cantPost: !st.draft.trim(),
      post: function () {
        if (needLogin() || !st.draft.trim()) return;
        var c = { id: 'm' + Date.now(), name: sv.userName, mine: true, when: 'Just now', ago: 0, likes: 0, text: st.draft.trim(), spoiler: st.spoiler, replies: [] };
        self.setState({ mine: [c].concat(st.mine), draft: '', spoiler: false, sort: 'new' }); self.say('Comment posted');
      },
      sorts: [['top', 'Top'], ['new', 'Newest']].map(function (o) { var on = st.sort === o[0]; return { label: o[1], on: on, cls: on ? 'on' : '', pick: function () { set('sort', o[0]); } }; }),
      creatorOnly: st.creatorOnly, creatorOnlyCls: st.creatorOnly ? 'on' : '', toggleCreatorOnly: function () { set('creatorOnly', !st.creatorOnly); },
      threads: shown.map(function (c) {
        var mine = !!c.mine, liked = !!st.liked[c.id], open = !!st.open[c.id];
        var reps = c.replies.concat(st.myReplies[c.id] || []).filter(function (r) { return st.showHidden || blocked.indexOf(r.name) < 0; });
        var editing = st.editing === c.id;
        return {
          name: c.name, ini: self.initials(c.name), when: c.when, pinned: !!c.pinned, cls: c.pinned ? 'pinned' : '', avCls: c.creator ? 'creator' : mine ? 'brand' : '',
          isCreator: !!c.creator, isMine: mine, notMine: !mine && !c.creator, edited: !!c.edited,
          hideText: !!c.spoiler && !st.revealed[c.id] && !editing, showText: (!c.spoiler || !!st.revealed[c.id]) && !editing, text: c.text,
          reveal: function () { flip('revealed', c.id); },
          editing: editing, edId: 'ed-' + c.id, edText: st.edText, onEd: function (ev) { set('edText', ev.target.value.slice(0, 500)); },
          saveEd: function () { if (!st.edText.trim()) return; self.setState({ mine: st.mine.map(function (m) { return m.id === c.id ? Object.assign({}, m, { text: st.edText.trim(), edited: true }) : m; }), editing: '' }); self.say('Comment updated'); },
          cancelEd: function () { set('editing', ''); },
          liked: liked, likes: fmt(c.likes + (liked ? 1 : 0)), likeAria: (liked ? 'Unlike' : 'Like') + ' comment by ' + c.name,
          like: function () { if (needLogin()) return; flip('liked', c.id); },
          reply: function () { if (needLogin()) return; self.setState({ replying: c.id, rpDraft: '', open: Object.assign({}, st.open, (function () { var o = {}; o[c.id] = true; return o; })()) }); },
          report: function () { if (needLogin()) return; self.openReport('comment', 'comment by ' + c.name, c.name); },
          block: function () { if (needLogin()) return; self.openBlock(c.name); },
          edit: function () { self.setState({ editing: c.id, edText: c.text }); },
          del: function () { flip('deleted', c.id); self.setState({ mine: st.mine.filter(function (m) { return m.id !== c.id; }) }); self.say('Comment deleted'); },
          hasReplies: reps.length > 0, open: open, repliesLabel: open ? 'Hide replies' : 'View ' + reps.length + (reps.length === 1 ? ' reply' : ' replies') + (reps.some(function (r) { return r.creator; }) ? ' · includes the creator' : ''),
          toggleReplies: function () { flip('open', c.id); },
          replies: reps.map(function (r, i) {
            var k = c.id + 'r' + i, rl = !!st.liked[k];
            return { name: r.name, ini: self.initials(r.name), when: r.when, text: r.text, isCreator: !!r.creator, avCls: r.creator ? 'creator' : r.mine ? 'brand' : '', notMine: !r.mine && !r.creator,
              liked: rl, likes: fmt(r.likes + (rl ? 1 : 0)), like: function () { if (needLogin()) return; flip('liked', k); },
              report: function () { if (needLogin()) return; self.openReport('comment', 'reply by ' + r.name, r.name); } };
          }),
          replying: st.replying === c.id, rpId: 'rp-' + c.id, rpDraft: st.rpDraft, onRp: function (ev) { set('rpDraft', ev.target.value.slice(0, 300)); },
          cancelReply: function () { set('replying', ''); },
          sendReply: function (ev) {
            if (ev && ev.preventDefault) ev.preventDefault();
            if (!st.rpDraft.trim()) return;
            var m = Object.assign({}, st.myReplies); m[c.id] = (m[c.id] || []).concat([{ name: sv.userName, mine: true, when: 'Just now', likes: 0, text: st.rpDraft.trim() }]);
            self.setState({ myReplies: m, replying: '', rpDraft: '' }); self.say('Reply posted');
          }
        };
      }),
      isEmpty: !shown.length,
      hasHidden: hiddenN > 0, hiddenLine: hiddenN + ' comment' + (hiddenN > 1 ? 's' : '') + ' from people you blocked ' + (st.showHidden ? 'shown.' : 'hidden.'), hiddenBtn: st.showHidden ? 'Hide' : 'Show', toggleHidden: function () { set('showHidden', !st.showHidden); },
      hasMore: rest.length > st.shown, more: function () { set('shown', st.shown + 6); }
    });
  }
