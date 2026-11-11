  constructor(props) {
    super(props);
    this.pageName = 'Foundations';
    this.state = Object.assign({}, this.state || {}, { chk: true, sw: true, tab: 0 });
  }
  renderVals() {
    var self = this;
    var st = this.state;
    var p = this.pool();
    var demo = this.byTitle('Glass Compass');
    return {
      colors: [
        ['--primary', '#00DC64', 'Primary actions, progress', '#00DC64'], ['--primary-foreground', '#04210F', 'Text on primary', '#04210F'],
        ['--brand-ink', '#047A3A', 'Green text and links', '#047A3A'], ['--brand-soft', '#E8FBF0', 'Info / brand alerts', '#E8FBF0'],
        ['--foreground', '#09090B', 'Text, default button', '#09090B'], ['--muted-foreground', '#71717A', 'Secondary text', '#71717A'],
        ['--background', '#FFFFFF', 'Page, cards, popovers', '#FFFFFF'], ['--muted', '#F4F4F5', 'Tabs track, skeletons', '#F4F4F5'],
        ['--border', '#E4E4E7', 'Borders, inputs, separators', '#E4E4E7'], ['--ring', '#00A650', 'Focus ring', '#00A650'],
        ['--destructive', '#DC2626', 'Errors, delete', '#DC2626'], ['--warning', '#B45309', 'Fast Pass, cautions', '#B45309']
      ].map(function (c) { return { name: c[0], v: c[1], use: c[2], hex: c[3] }; }),
      type: [
        ['Display', 'Inter 48/52 · 700', 'hero-like', 'Glass Compass', 'font-size: 48px'],
        ['H1', 'Inter 36/42 · 700', 'h1', 'Daily updates'],
        ['H2', 'Inter 24/30 · 600', 'h2', 'Trending now'],
        ['H3', 'Inter 18/26 · 600', 'h3', 'Order summary'],
        ['Body', 'Inter 14/20 · 400', 'small', 'New episodes every Thursday. Read the first 48 free.'],
        ['Lead', 'Inter 16/26 · 400', 'lead', 'Unlock Fast Pass episodes before they’re free.'],
        ['Caption', 'Inter 12/16 · 500', 'xs muted', 'Nov 5, 2026 · 52.1K likes']
      ].map(function (t) { return { name: t[0], spec: t[1], cls: t[2] === 'hero-like' ? 'h1 fd-display' : t[2], sample: t[3] }; }),
      chk: st.chk, chkCls: st.chk ? 'on' : '', toggleChk: function () { self.setState({ chk: !st.chk }); },
      sw: st.sw, swCls: st.sw ? 'on' : '', toggleSw: function () { self.setState({ sw: !st.sw }); },
      tabs: ['Comics', 'Web novels', 'All'].map(function (l, i) { return { label: l, on: st.tab === i, cls: st.tab === i ? 'on' : '', pick: function () { self.setState({ tab: i }); } }; }),
      demo: demo,
      rows: [
        { title: 'Episode 50', date: 'Nov 19, 2026', thumb: p[3].cover, fp: true, read: false, cls: 'fp' },
        { title: 'Episode 48', date: 'Nov 5, 2026', thumb: p[8].cover, fp: false, read: false, cls: '' },
        { title: 'Episode 47', date: 'Oct 29, 2026', thumb: p[13].cover, fp: false, read: true, cls: 'read' }
      ],
      map: [
        ['Button', 'Button'], ['Chip (filters)', 'Toggle / Badge'], ['Tabs', 'Tabs'], ['Modal', 'Dialog'], ['Dropdown (avatar menu)', 'DropdownMenu'],
        ['Header search', 'Command (⌘K)'], ['Episode list panel', 'Sheet / Popover'], ['Input, Textarea', 'Input, Textarea + Form (react-hook-form + zod)'],
        ['Switch, Checkbox, Radio', 'Switch, Checkbox, RadioGroup'], ['Verification code', 'InputOTP'], ['Alert', 'Alert'], ['Toast', 'Sonner'],
        ['ProgressBar', 'Progress'], ['Accordion (FAQ)', 'Accordion'], ['Table (history)', 'Table'], ['Avatar', 'Avatar']
      ].map(function (m) { return { a: m[0], b: m[1] }; })
    };
  }
