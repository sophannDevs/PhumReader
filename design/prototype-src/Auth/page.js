  constructor(props) {
    super(props);
    this.pageName = 'Auth';
    this.goRef = { current: null };
    var step = props.demoStep || 'login';
    var start = this.get('toonwave.authMode') === 'signup' ? 'signup' : 'login';
    this.state = Object.assign({}, this.state || {}, this.demoState(step === 'login' ? start : step), {
      lang: this.get('toonwave.lang') === 'km' ? 'km' : 'en',
      toast: '', searchOpen: false, userMenu: false, now: Date.now()
    });
  }
  // Starting values for each step, so every step can be reviewed from the canvas.
  demoState(step) {
    var base = {
      mode: step === 'verify' ? 'code' : (step === 'new-password' ? 'newpass' : step), purpose: step === 'verify' ? 'signup' : 'reset',
      liEmail: '', liPass: '', liShow: false, remember: true, caps: false, liTried: false, attempts: 0, formErr: '',
      suName: '', suEmail: '', suPass: '', suPass2: '', suShow: false, suUi: 'en', suYear: '', agree: false, suTried: false,
      fgEmail: '', fgTried: false, code: '', codeTried: false, resendAt: 0,
      npPass: '', npPass2: '', npTried: false, busy: '', flash: '', doneName: ''
    };
    if (step === 'signup') return Object.assign(base, { suName: 'Sokha', suEmail: 'sokha@example.com', suPass: 'PhumiReader', suPass2: 'PhumiReader' });
    if (step === 'verify') return Object.assign(base, { suName: 'Sokha', suEmail: 'sokha@example.com', code: '12', resendAt: Date.now() + 30000 });
    if (step === 'forgot') return Object.assign(base, { fgEmail: 'reader@phumireader.app' });
    if (step === 'new-password') return Object.assign(base, { fgEmail: 'reader@phumireader.app', npPass: 'Mango2026' });
    if (step === 'error') return Object.assign(base, { mode: 'login', liEmail: 'reader@phumireader.app', liPass: 'toonwave', liTried: true, attempts: 1, formErr: 'wrong' });
    return base;
  }
  componentDidMount() {
    this.sharedMount();
    var self = this;
    this.tick = setInterval(function () { if (self.state.resendAt > Date.now() - 1000) self.setState({ now: Date.now() }); }, 1000);
  }
  componentDidUpdate(pp) {
    if (pp.demoStep !== this.props.demoStep && this.props.demoStep) this.setState(this.demoState(this.props.demoStep));
  }
  componentWillUnmount() { this.sharedUnmount(); if (this.tick) clearInterval(this.tick); }
  dict() {
    var en = {
      panelEyebrow: 'PhumiReader', panelTitle: 'Read, follow and publish stories you love.',
      panelSub: 'One account for comics and web novels, your library, coins and comments, in English or Khmer.',
      b1: 'Pick up where you left off, on any device', b2: 'Get alerts when series you follow update', b3: 'Unlock Fast Pass episodes with coins',
      cameFrom: 'You came from:', unlockCtx: 'Log in to unlock',
      login: 'Log in', signup: 'Sign up', welcome: 'Welcome back', loginSub: 'Log in to keep your library, coins and comments in sync.',
      email: 'Email', password: 'Password', passPh: 'At least 8 characters', show: 'Show', hide: 'Hide', caps: 'Caps Lock is on',
      remember: 'Remember me', forgot: 'Forgot password?', or: 'or', google: 'Continue with Google', facebook: 'Continue with Facebook', apple: 'Continue with Apple',
      noAccount: 'New to PhumiReader?', createFree: 'Create an account', resetNow: 'Reset your password',
      signupTitle: 'Create your account', signupSub: 'Free to join. Read, subscribe and comment in minutes.',
      name: 'Display name', namePh: 'e.g. Sokha', nameHint: 'Shown on your comments. 2 to 20 characters.',
      confirm: 'Confirm password', match: 'Passwords match', uiLang: 'App language', birthYear: 'Birth year', choose: 'Choose',
      agree1: 'I agree to the', terms: 'Terms of Service', and: 'and', privacy: 'Privacy Policy',
      create: 'Create account', haveAccount: 'Already have an account?', loginInstead: 'Log in instead',
      weak: 'Weak', fair: 'Fair', strong: 'Strong', r1: '8+ characters', r2: 'Upper and lower case', r3: 'A number', r4: 'A symbol',
      teen: 'Mature series will stay hidden until you turn 18.', adult: 'We use this to show age-appropriate series.',
      forgotTitle: 'Reset your password', forgotSub: 'Enter the email you use for PhumiReader. We’ll send you a 6-digit code.', sendCode: 'Send code', backLogin: 'Back to log in',
      verifyTitle: 'Verify your email', resetTitle: 'Enter your reset code', sentTo: 'We sent a 6-digit code to', codeLabel: '6-digit code',
      verifyBtn: 'Verify and create account', resetBtn: 'Continue', noCode: 'Didn’t get it?', resendIn: 'Resend in', resend: 'Resend code', spam: 'Check your spam folder too', changeEmail: 'Change email',
      newPassTitle: 'Choose a new password', newPassSub: 'For', newPassword: 'New password', savePass: 'Save new password',
      welcomeName: 'Welcome back,', hello: 'Welcome to PhumiReader,', taking: 'Taking you back to',
      eEmail: 'Enter your email.', eEmailBad: 'Enter a valid email, like you@example.com.', ePass: 'Enter your password.',
      eWrong: 'Email or password is incorrect.', eLocked: 'Too many tries. Reset your password to continue.',
      eName: 'Enter a display name (2 to 20 characters).', eTaken: 'This email already has an account.', eRules: 'Your password doesn’t meet all the rules yet.',
      eMatch: 'Passwords don’t match.', eYear: 'Choose your birth year.', eYoung: 'You need to be 13 or older to create an account.', eAgree: 'Accept the terms to continue.',
      eCodeShort: 'Enter all 6 digits.', eCode: 'That code isn’t right. Check the email and try again.',
      flashReset: 'Password updated. Log in with your new password.', codeSent: 'New code sent', openTerms: 'Terms of Service would open here', openPrivacy: 'Privacy Policy would open here'
    };
    var km = {
      panelEyebrow: 'PhumiReader', panelTitle: 'អាន តាមដាន និងបោះពុម្ពរឿងដែលអ្នកស្រឡាញ់។',
      panelSub: 'គណនីតែមួយ សម្រាប់រឿងកំប្លែង ប្រលោមលោក បណ្ណាល័យ កាក់ និងមតិយោបល់ ជាភាសាខ្មែរ ឬអង់គ្លេស។',
      b1: 'បន្តអានពីកន្លែងដែលអ្នកឈប់ លើគ្រប់ឧបករណ៍', b2: 'ទទួលការជូនដំណឹងពេលរឿងដែលអ្នកតាមដានមានភាគថ្មី', b3: 'ដោះសោភាគ Fast Pass ដោយប្រើកាក់',
      cameFrom: 'អ្នកមកពី៖', unlockCtx: 'ចូល ដើម្បីដោះសោ',
      login: 'ចូល', signup: 'ចុះឈ្មោះ', welcome: 'សូមស្វាគមន៍ការត្រឡប់មកវិញ', loginSub: 'ចូល ដើម្បីរក្សាបណ្ណាល័យ កាក់ និងមតិយោបល់របស់អ្នកឱ្យដូចគ្នា។',
      email: 'អ៊ីមែល', password: 'ពាក្យសម្ងាត់', passPh: 'យ៉ាងតិច ៨ តួអក្សរ', show: 'បង្ហាញ', hide: 'លាក់', caps: 'Caps Lock កំពុងបើក',
      remember: 'ចងចាំខ្ញុំ', forgot: 'ភ្លេចពាក្យសម្ងាត់?', or: 'ឬ', google: 'បន្តជាមួយ Google', facebook: 'បន្តជាមួយ Facebook', apple: 'បន្តជាមួយ Apple',
      noAccount: 'ថ្មីនៅ ភូមិReader?', createFree: 'បង្កើតគណនី', resetNow: 'កំណត់ពាក្យសម្ងាត់ឡើងវិញ',
      signupTitle: 'បង្កើតគណនីរបស់អ្នក', signupSub: 'ចូលរួមដោយឥតគិតថ្លៃ។ អាន តាមដាន និងបញ្ចេញមតិបានភ្លាមៗ។',
      name: 'ឈ្មោះបង្ហាញ', namePh: 'ឧ. សុខា', nameHint: 'បង្ហាញនៅលើមតិយោបល់របស់អ្នក។ ២ ដល់ ២០ តួអក្សរ។',
      confirm: 'បញ្ជាក់ពាក្យសម្ងាត់', match: 'ពាក្យសម្ងាត់ដូចគ្នា', uiLang: 'ភាសាកម្មវិធី', birthYear: 'ឆ្នាំកំណើត', choose: 'ជ្រើសរើស',
      agree1: 'ខ្ញុំយល់ព្រមលើ', terms: 'លក្ខខណ្ឌប្រើប្រាស់', and: 'និង', privacy: 'គោលការណ៍ឯកជនភាព',
      create: 'បង្កើតគណនី', haveAccount: 'មានគណនីរួចហើយ?', loginInstead: 'ចូលវិញ',
      weak: 'ខ្សោយ', fair: 'មធ្យម', strong: 'ខ្លាំង', r1: '៨ តួអក្សរឡើងទៅ', r2: 'អក្សរធំ និងអក្សរតូច', r3: 'លេខយ៉ាងតិចមួយ', r4: 'និមិត្តសញ្ញាយ៉ាងតិចមួយ',
      teen: 'រឿងសម្រាប់មនុស្សពេញវ័យនឹងត្រូវលាក់ រហូតដល់អ្នកមានអាយុ ១៨ ឆ្នាំ។', adult: 'យើងប្រើវា ដើម្បីបង្ហាញរឿងដែលសមស្របនឹងអាយុ។',
      forgotTitle: 'កំណត់ពាក្យសម្ងាត់ឡើងវិញ', forgotSub: 'បញ្ចូលអ៊ីមែលដែលអ្នកប្រើសម្រាប់ ភូមិReader។ យើងនឹងផ្ញើលេខកូដ ៦ ខ្ទង់។', sendCode: 'ផ្ញើលេខកូដ', backLogin: 'ត្រឡប់ទៅការចូល',
      verifyTitle: 'ផ្ទៀងផ្ទាត់អ៊ីមែលរបស់អ្នក', resetTitle: 'បញ្ចូលលេខកូដកំណត់ឡើងវិញ', sentTo: 'យើងបានផ្ញើលេខកូដ ៦ ខ្ទង់ទៅ', codeLabel: 'លេខកូដ ៦ ខ្ទង់',
      verifyBtn: 'ផ្ទៀងផ្ទាត់ និងបង្កើតគណនី', resetBtn: 'បន្ត', noCode: 'មិនបានទទួល?', resendIn: 'ផ្ញើម្តងទៀតក្នុង', resend: 'ផ្ញើលេខកូដម្តងទៀត', spam: 'សូមពិនិត្យថត Spam ផងដែរ', changeEmail: 'ប្តូរអ៊ីមែល',
      newPassTitle: 'ជ្រើសរើសពាក្យសម្ងាត់ថ្មី', newPassSub: 'សម្រាប់', newPassword: 'ពាក្យសម្ងាត់ថ្មី', savePass: 'រក្សាទុកពាក្យសម្ងាត់ថ្មី',
      welcomeName: 'សូមស្វាគមន៍ការត្រឡប់មកវិញ', hello: 'សូមស្វាគមន៍មកកាន់ ភូមិReader', taking: 'កំពុងនាំអ្នកត្រឡប់ទៅ',
      eEmail: 'សូមបញ្ចូលអ៊ីមែលរបស់អ្នក។', eEmailBad: 'សូមបញ្ចូលអ៊ីមែលត្រឹមត្រូវ ដូចជា you@example.com។', ePass: 'សូមបញ្ចូលពាក្យសម្ងាត់។',
      eWrong: 'អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ។', eLocked: 'ព្យាយាមច្រើនដងពេក។ សូមកំណត់ពាក្យសម្ងាត់ឡើងវិញ ដើម្បីបន្ត។',
      eName: 'សូមបញ្ចូលឈ្មោះបង្ហាញ (២ ដល់ ២០ តួអក្សរ)។', eTaken: 'អ៊ីមែលនេះមានគណនីរួចហើយ។', eRules: 'ពាក្យសម្ងាត់មិនទាន់គ្រប់លក្ខខណ្ឌ។',
      eMatch: 'ពាក្យសម្ងាត់មិនដូចគ្នា។', eYear: 'សូមជ្រើសរើសឆ្នាំកំណើត។', eYoung: 'អ្នកត្រូវមានអាយុ ១៣ ឆ្នាំឡើងទៅ ដើម្បីបង្កើតគណនី។', eAgree: 'សូមយល់ព្រមលើលក្ខខណ្ឌ ដើម្បីបន្ត។',
      eCodeShort: 'សូមបញ្ចូលលេខទាំង ៦ ខ្ទង់។', eCode: 'លេខកូដមិនត្រឹមត្រូវ។ សូមពិនិត្យអ៊ីមែល ហើយព្យាយាមម្តងទៀត។',
      flashReset: 'បានប្តូរពាក្យសម្ងាត់។ សូមចូលដោយប្រើពាក្យសម្ងាត់ថ្មី។', codeSent: 'បានផ្ញើលេខកូដថ្មី', openTerms: 'លក្ខខណ្ឌប្រើប្រាស់នឹងបើកនៅទីនេះ', openPrivacy: 'គោលការណ៍ឯកជនភាពនឹងបើកនៅទីនេះ'
    };
    return this.state.lang === 'km' ? km : en;
  }
  accounts() {
    var a = this.read('toonwave.v2accounts', {}) || {};
    if (!a['reader@phumireader.app']) a['reader@phumireader.app'] = { name: 'Sokha Chan', pass: 'PhumiReader1!' };
    a['creator@phumireader.app'] = a['creator@phumireader.app'] || { name: 'Dara Vann', pass: 'Creator1!' };
    return a;
  }
  rules(p) {
    var t = this.dict();
    return [{ label: t.r1, ok: p.length >= 8 }, { label: t.r2, ok: /[a-z]/.test(p) && /[A-Z]/.test(p) }, { label: t.r3, ok: /[0-9]/.test(p) }, { label: t.r4, ok: /[^A-Za-z0-9]/.test(p) }];
  }
  strength(p) {
    var t = this.dict();
    var n = this.rules(p).filter(function (r) { return r.ok; }).length;
    if (!p) return { w: '0%', cls: '', label: '' };
    if (n <= 1) return { w: '25%', cls: 'weak', label: t.weak };
    if (n <= 3) return { w: n === 2 ? '50%' : '75%', cls: 'fair', label: t.fair };
    return { w: '100%', cls: 'strong', label: t.strong };
  }
  emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()); }
  errors() {
    var st = this.state, t = this.dict(), e = {};
    var acc = this.accounts();
    if (st.liTried) {
      if (!st.liEmail.trim()) e.liEmail = t.eEmail; else if (!this.emailOk(st.liEmail)) e.liEmail = t.eEmailBad;
      if (!st.liPass) e.liPass = t.ePass;
    }
    if (st.suTried) {
      var nm = st.suName.trim();
      if (nm.length < 2 || nm.length > 20) e.suName = t.eName;
      if (!st.suEmail.trim()) e.suEmail = t.eEmail; else if (!this.emailOk(st.suEmail)) e.suEmail = t.eEmailBad; else if (acc[st.suEmail.trim().toLowerCase()]) e.suEmail = t.eTaken;
      if (this.rules(st.suPass).some(function (r) { return !r.ok; })) e.suPass = t.eRules;
      if (st.suPass2 !== st.suPass) e.suPass2 = t.eMatch;
      if (!st.suYear) e.suYear = t.eYear; else if (2026 - parseInt(st.suYear, 10) < 13) e.suYear = t.eYoung;
      if (!st.agree) e.agree = t.eAgree;
    }
    if (st.fgTried) { if (!st.fgEmail.trim()) e.fgEmail = t.eEmail; else if (!this.emailOk(st.fgEmail)) e.fgEmail = t.eEmailBad; }
    if (st.npTried) {
      if (this.rules(st.npPass).some(function (r) { return !r.ok; })) e.npPass = t.eRules;
      if (st.npPass2 !== st.npPass) e.npPass2 = t.eMatch;
    }
    return e;
  }
  returnHref() {
    var r = this.get('toonwave.returnTo') || '';
    return /\.dc\.html$/.test(r) && r.indexOf('Auth') < 0 ? r : this.href('Home');
  }
  returnName() {
    var r = this.get('toonwave.returnTo') || '';
    var names = { Home: 'Home', Series: 'the series', Viewer: 'the episode', Novel: 'the chapter', Library: 'My library', Shop: 'Coins', Search: 'Search', Settings: 'Settings', Creator: 'Creator dashboard', Main: 'Home', Mobile: 'Home' };
    for (var k in names) if (r.indexOf(k) >= 0) return names[k];
    return 'Home';
  }
  context() {
    var t = this.dict();
    var p = this.read('toonwave.v2pending', null);
    if (p && p.id) {
      var s = this.pool().filter(function (x) { return x.id === p.id; })[0];
      if (s) return t.unlockCtx + ' ' + (s.novel ? 'Ch. ' : 'Ep. ') + p.ep + ' · ' + s.title;
    }
    return t.cameFrom + ' ' + this.returnName();
  }
  finish(name, isNew) {
    var self = this;
    this.put('toonwave.user', name);
    this.put('toonwave.authMode', null);
    // New accounts go through first-time setup, then back to where they were.
    if (isNew) this.put('toonwave.welcomeNext', this.returnHref());
    this.setState({ mode: 'done', busy: '', doneName: name, isNew: !!isNew });
    this.later(1400, function () { self.go(self.goRef); });
  }
  sendCode(purpose, email) {
    this.setState({ mode: 'code', purpose: purpose, code: '', codeTried: false, resendAt: Date.now() + 30000, now: Date.now(), busy: '' });
  }

  renderVals() {
    var self = this;
    var st = this.state;
    var sv = this.sharedVals('');
    var t = this.dict();
    var errs = this.errors();
    var ef = function (k) { var m = errs[k]; return { on: !!m, off: !m, cls: m ? 'bad' : '', msg: m || '' }; };
    var stop = function (ev) { if (ev && ev.preventDefault) ev.preventDefault(); };
    var code = (st.code || '').replace(/\D/g, '').slice(0, 6);
    var wait = Math.max(0, Math.ceil((st.resendAt - st.now) / 1000));
    var years = [{ v: '', label: t.choose }];
    for (var y = 2026; y >= 1940; y--) years.push({ v: String(y), label: String(y) });
    var age = st.suYear ? 2026 - parseInt(st.suYear, 10) : 0;
    var set = function (k) { return function (ev) { var o = {}; o[k] = ev.target.value; o.formErr = ''; self.setState(o); }; };
    var socials = [['google', t.google], ['facebook', t.facebook], ['apple', t.apple]].map(function (s) {
      return { label: s[1], busy: st.busy === s[0], g: s[0] === 'google' && st.busy !== s[0], f: s[0] === 'facebook' && st.busy !== s[0], a: s[0] === 'apple' && st.busy !== s[0],
        go: function () { self.setState({ busy: s[0], formErr: '' }); self.later(1000, function () { self.finish('Sokha Chan'); }); } };
    });

    return Object.assign(sv, {
      goRef: this.goRef, returnHref: st.isNew ? this.href('Welcome') : this.returnHref(),
      t: t, lang: st.lang,
      art: ['Glass Compass', 'Letters to Tuesday', 'Tiny Dragon Café'].map(function (n) { return self.byTitle(n); }),
      ctxLine: this.context(),
      isEn: st.lang === 'en', isKm: st.lang === 'km', enCls: st.lang === 'en' ? 'on' : '', kmCls: st.lang === 'km' ? 'on' : '',
      setEn: function () { self.put('toonwave.lang', 'en'); self.applyLang(); self.setState({ lang: 'en' }); },
      setKm: function () { self.put('toonwave.lang', 'km'); self.applyLang(); self.setState({ lang: 'km' }); },
      showTabs: st.mode === 'login' || st.mode === 'signup',
      isLogin: st.mode === 'login', isSignup: st.mode === 'signup', isForgot: st.mode === 'forgot', isCode: st.mode === 'code', isNewPass: st.mode === 'newpass', isDone: st.mode === 'done',
      loginCls: st.mode === 'login' ? 'on' : '', signupCls: st.mode === 'signup' ? 'on' : '',
      toLogin: function () { self.setState({ mode: 'login', formErr: '', liTried: false, flash: '' }); },
      toSignup: function () { self.setState({ mode: 'signup', suTried: false, flash: '', suEmail: st.suEmail || st.liEmail }); },
      toForgot: function () { self.setState({ mode: 'forgot', fgTried: false, flash: '', fgEmail: st.fgEmail || st.liEmail }); },
      hasFlash: !!st.flash, flash: st.flash,
      e: { liEmail: ef('liEmail'), liPass: ef('liPass'), suName: ef('suName'), suEmail: ef('suEmail'), suPass: ef('suPass'), suPass2: ef('suPass2'), suYear: ef('suYear'), agree: ef('agree'), fgEmail: ef('fgEmail'), npPass: ef('npPass'), npPass2: ef('npPass2') },

      // log in
      hasFormErr: !!st.formErr, formErr: st.attempts >= 3 ? t.eLocked : t.eWrong, locked: st.attempts >= 3,
      liEmail: st.liEmail, liPass: st.liPass, onLiEmail: set('liEmail'), onLiPass: set('liPass'),
      liType: st.liShow ? 'text' : 'password', liShow: st.liShow, liEye: st.liShow ? t.hide : t.show,
      toggleLi: function () { self.setState({ liShow: !st.liShow }); },
      capsCheck: function (ev) { var on = !!(ev && ev.getModifierState && ev.getModifierState('CapsLock')); if (on !== st.caps) self.setState({ caps: on }); },
      caps: st.caps,
      remember: st.remember, rememberCls: st.remember ? 'on' : '', toggleRemember: function () { self.setState({ remember: !st.remember }); },
      busyLogin: st.busy === 'login', anyBusy: !!st.busy, socials: socials,
      submitLogin: function (ev) {
        stop(ev);
        if (st.attempts >= 3) return;
        self.setState({ liTried: true, formErr: '' }, function () {
          var e = self.errors();
          if (e.liEmail || e.liPass) return;
          self.setState({ busy: 'login' });
          self.later(900, function () {
            var a = self.accounts()[self.state.liEmail.trim().toLowerCase()];
            if (a && a.pass === self.state.liPass) self.finish(a.name);
            else self.setState({ busy: '', formErr: 'wrong', attempts: self.state.attempts + 1, liPass: '' });
          });
        });
      },

      // sign up
      suName: st.suName, suEmail: st.suEmail, suPass: st.suPass, suPass2: st.suPass2,
      onSuName: set('suName'), onSuEmail: set('suEmail'), onSuPass: set('suPass'), onSuPass2: set('suPass2'),
      suType: st.suShow ? 'text' : 'password', suShow: st.suShow, suEye: st.suShow ? t.hide : t.show,
      toggleSu: function () { self.setState({ suShow: !st.suShow }); },
      str: this.strength(st.suPass),
      rules: this.rules(st.suPass).map(function (r) { return { label: r.label, cls: r.ok ? 'ok' : '' }; }),
      pass2Match: !!st.suPass2 && st.suPass2 === st.suPass && !errs.suPass2,
      emailTaken: errs.suEmail === t.eTaken,
      takenToLogin: function () { self.setState({ mode: 'login', liEmail: st.suEmail, liTried: false, formErr: '' }); },
      uiEnCls: st.suUi === 'en' ? 'on' : '', uiKmCls: st.suUi === 'km' ? 'on' : '', uiIsEn: st.suUi === 'en', uiIsKm: st.suUi === 'km',
      uiEn: function () { self.setState({ suUi: 'en' }); }, uiKm: function () { self.setState({ suUi: 'km' }); },
      years: years, suYear: st.suYear, onSuYear: set('suYear'),
      ageNote: age >= 13 && age < 18 ? t.teen : t.adult,
      agree: st.agree, agreeCls: st.agree ? 'on' : '', toggleAgree: function () { self.setState({ agree: !st.agree }); },
      openTerms: function () { self.say(t.openTerms); }, openPrivacy: function () { self.say(t.openPrivacy); },
      busySignup: st.busy === 'signup',
      submitSignup: function (ev) {
        stop(ev);
        self.setState({ suTried: true }, function () {
          var e = self.errors();
          if (e.suName || e.suEmail || e.suPass || e.suPass2 || e.suYear || e.agree) return;
          self.setState({ busy: 'signup' });
          self.later(900, function () { self.sendCode('signup'); });
        });
      },

      // forgot + code + new password
      fgEmail: st.fgEmail, onFgEmail: set('fgEmail'), busyForgot: st.busy === 'forgot',
      submitForgot: function (ev) {
        stop(ev);
        self.setState({ fgTried: true }, function () {
          if (self.errors().fgEmail) return;
          self.setState({ busy: 'forgot' });
          self.later(900, function () { self.sendCode('reset'); });
        });
      },
      codeTitle: st.purpose === 'signup' ? t.verifyTitle : t.resetTitle,
      codeEmail: st.purpose === 'signup' ? st.suEmail : st.fgEmail,
      codeBtn: st.purpose === 'signup' ? t.verifyBtn : t.resetBtn,
      codeBack: function () { self.setState({ mode: st.purpose === 'signup' ? 'signup' : 'forgot', code: '', codeTried: false }); },
      slots: [0, 1, 2, 3, 4, 5].map(function (i) { return { ch: code.charAt(i), cls: (i === code.length ? 'cur' : '') + (st.codeTried && code !== '123456' ? ' bad' : '') }; }),
      code: code, onCode: function (ev) { self.setState({ code: ev.target.value.replace(/\D/g, '').slice(0, 6), codeTried: false }); },
      codeErr: st.codeTried && code !== '123456', codeErrMsg: code.length < 6 ? t.eCodeShort : t.eCode,
      busyCode: st.busy === 'code',
      submitCode: function (ev) {
        stop(ev);
        self.setState({ codeTried: true });
        if (code !== '123456') return;
        self.setState({ busy: 'code' });
        self.later(800, function () {
          if (self.state.purpose === 'signup') {
            var acc = self.read('toonwave.v2accounts', {}) || {};
            acc[self.state.suEmail.trim().toLowerCase()] = { name: self.state.suName.trim(), pass: self.state.suPass };
            self.put('toonwave.v2accounts', JSON.stringify(acc));
            self.put('toonwave.lang', self.state.suUi);
            self.finish(self.state.suName.trim(), true);
          } else self.setState({ mode: 'newpass', busy: '', npTried: false });
        });
      },
      resendWait: wait > 0, resendLabel: wait > 0 ? t.resendIn + ' ' + wait + 's' : t.resend,
      resend: function () { self.setState({ resendAt: Date.now() + 30000, now: Date.now(), code: '', codeTried: false }); self.say(t.codeSent); },
      npPass: st.npPass, npPass2: st.npPass2, onNpPass: set('npPass'), onNpPass2: set('npPass2'),
      npStr: this.strength(st.npPass), npRules: this.rules(st.npPass).map(function (r) { return { label: r.label, cls: r.ok ? 'ok' : '' }; }),
      busyNew: st.busy === 'new',
      submitNewPass: function (ev) {
        stop(ev);
        self.setState({ npTried: true }, function () {
          var e = self.errors();
          if (e.npPass || e.npPass2) return;
          self.setState({ busy: 'new' });
          self.later(800, function () {
            var acc = self.read('toonwave.v2accounts', {}) || {};
            var k = self.state.fgEmail.trim().toLowerCase();
            acc[k] = { name: (self.accounts()[k] || {}).name || 'Reader', pass: self.state.npPass };
            self.put('toonwave.v2accounts', JSON.stringify(acc));
            self.setState({ mode: 'login', busy: '', liEmail: self.state.fgEmail, liPass: '', liTried: false, attempts: 0, formErr: '', flash: t.flashReset });
          });
        });
      },

      // done
      doneTitle: (st.isNew ? t.hello : t.welcomeName) + ' ' + String(st.doneName || 'reader').split(' ')[0],
      doneSub: t.taking + ' ' + this.returnName() + '…'
    });
  }
