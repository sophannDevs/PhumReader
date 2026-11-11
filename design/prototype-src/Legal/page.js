  constructor(props) {
    super(props);
    this.pageName = 'Legal';
    var d = null; try { d = this.get('toonwave.legalDoc'); } catch (e) {}
    this.state = Object.assign({}, this.state || {}, { doc: props.demoDoc && props.demoDoc !== 'terms' ? props.demoDoc : (d || 'terms'), toast: '', searchOpen: false, userMenu: false });
  }
  componentDidMount() { this.sharedMount(); }
  componentWillUnmount() { this.sharedUnmount(); }
  componentDidUpdate(pp) { if (pp.demoDoc !== this.props.demoDoc) this.setState({ doc: this.props.demoDoc || 'terms' }); }
  docs() {
    return {
      terms: { label: 'Terms of service', kind: 'Legal', title: 'Terms of service', tpl: true,
        summary: ['You need to be at least 13 to use PhumiReader. Readers 13–17 need a parent’s permission.', 'Creators own their stories. You give us permission to show them on PhumiReader.', 'Coins are for unlocking Fast Pass episodes. They have no cash value.', 'Break the community guidelines and we may remove content or close accounts.'],
        sections: [
          ['Who we are', ['PhumiReader is run by [COMPANY NAME], registered in the Kingdom of Cambodia at [ADDRESS]. “We” means [COMPANY NAME]. “You” means anyone who uses PhumiReader.']],
          ['Your account', ['You must be at least 13 years old. If you are 13–17, a parent or guardian must agree to these terms for you.', 'Keep your password safe. You are responsible for what happens on your account. Tell us right away if you think someone else used it.']],
          ['Content and ownership', ['Creators keep ownership of the comics and stories they publish. By publishing, a creator gives [COMPANY NAME] a non-exclusive licence to host, show, translate for display, and promote that work on PhumiReader, as set out in the creator agreement.', 'Don’t copy, download or share series outside PhumiReader unless the creator allows it.']],
          ['Coins and Fast Pass', ['Coins are a virtual item used to unlock Fast Pass episodes early. Coins have no cash value and can’t be exchanged, sold or transferred.', 'Refunds follow our Coins and refunds policy.']],
          ['Rules', ['Follow the community guidelines. Don’t post illegal content, harass people, spam, or upload work that isn’t yours.', 'We may remove content, limit features or close accounts that break these rules. You can appeal by contacting us.']],
          ['Changes and ending', ['We may update these terms. If changes are important, we’ll tell you in the app at least [NOTICE PERIOD] days before they apply.', 'You can delete your account at any time in Settings.']],
          ['Liability and law', ['[LIABILITY TERMS — to be written by your lawyer.]', 'These terms are governed by [GOVERNING LAW]. Disputes go to [DISPUTE VENUE].']]
        ] },
      privacy: { label: 'Privacy policy', kind: 'Legal', title: 'Privacy policy', tpl: true,
        summary: ['We collect what we need to run your account, show you series, and process payments.', 'We don’t sell your personal information.', 'Payment details go to the payment provider. We never see your full card number.', 'You can download or delete your data in Settings.'],
        sections: [
          ['What we collect', ['Account details: name, email, birth year and app language.', 'Reading activity: series you subscribe to, episodes you read, likes and comments.', 'Purchases: order numbers, coin amounts and payment status. Card and bank details are handled by [PAYMENT PROVIDER].', 'Device information: browser, app version and approximate location from your IP address, used for security and region availability.']],
          ['How we use it', ['To run your account and library, send the alerts you choose, process coin purchases, keep PhumiReader safe, and improve the service.', 'Creators see totals (views, likes, subscribers), not who you are.']],
          ['Who we share it with', ['Service providers who help us run PhumiReader: hosting ([HOSTING PROVIDER]), email ([EMAIL PROVIDER]) and payments ([PAYMENT PROVIDER]).', 'Authorities, when the law requires it.']],
          ['How long we keep it', ['We keep your data while your account is open. After you delete your account, we remove personal data within [RETENTION PERIOD], except records we must keep by law, such as payment records.']],
          ['Your choices', ['Download your data or delete your account in Settings → Privacy and safety.', 'Turn notifications on or off in Notifications → Alert settings.']],
          ['Children', ['PhumiReader isn’t for children under 13. If we learn an account belongs to a child under 13, we close it.']],
          ['Contact', ['Questions or requests: [PRIVACY EMAIL].']]
        ] },
      refund: { label: 'Coins and refunds', kind: 'Policy', title: 'Coins and refunds', tpl: true,
        summary: ['Coins you buy never expire.', 'Unused coins can be refunded within [REFUND WINDOW] days of purchase.', 'Coins already spent on episodes can’t be refunded.', 'Double charges and failed payments are always refunded in full.'],
        sections: [
          ['How coins work', ['You buy coins in packs and spend them to unlock Fast Pass episodes (5 coins each). Every Fast Pass episode becomes free for everyone after 7 days. Unlocked episodes stay in your library.']],
          ['Refunds for unused coins', ['If you haven’t spent the coins from a purchase, you can ask for a refund within [REFUND WINDOW] days. Bonus and first-purchase coins are removed when the pack is refunded.']],
          ['Payment problems', ['If you were charged but didn’t get coins, or were charged twice, contact us with your order number (TW-…). We check with the bank and either add the coins or refund the payment to the same method, usually within [REFUND TIME].']],
          ['How to ask for a refund', ['Go to Help center → Contact us, choose “Coins or payment”, and add your order number. You’ll find it in Coins → Purchase history.']],
          ['What we can’t refund', ['Coins already spent, coins from events or promotions, and purchases older than [REFUND WINDOW] days, unless the law requires it.']]
        ] },
      community: { label: 'Community guidelines', kind: 'Guidelines', title: 'Community guidelines', tpl: false,
        summary: ['Be kind. Disagree with ideas, not people.', 'Warn before spoilers.', 'Only post work you made or have the right to share.', 'Report anything that breaks these rules. Reports are anonymous.'],
        sections: [
          ['Be respectful', ['No harassment, bullying, threats or insults. No hate speech against anyone’s ethnicity, religion, gender, disability or any other part of who they are.']],
          ['Keep it safe', ['Never post sexual content involving anyone under 18. We remove it and report it to the authorities.', 'No content that encourages self-harm, violence or dangerous acts.', 'No sharing other people’s private information, like phone numbers or addresses.']],
          ['Respect creators', ['Don’t re-upload or claim someone else’s work. Don’t post leaks of Fast Pass episodes.', 'Give feedback that helps. Creators read your comments.']],
          ['Spoilers and spam', ['Don’t reveal what happens in later episodes without a warning.', 'No ads, link spam, repeated comments or fake accounts.']],
          ['What happens if rules are broken', ['Depending on how serious it is, we may remove the content, give a warning, limit commenting, or close the account. Very serious cases, like content harming children, lead to an immediate ban.', 'If you think we made a mistake, contact us and we’ll look again.']],
          ['How to report', ['Tap “Report” next to a comment, on a profile, or on a series’ About tab. Choose a reason and send. We review reports within 24 hours. You can follow your reports in Settings → Privacy and safety.', 'If someone is in danger right now, contact local emergency services. In Cambodia: police 117, ambulance 119.']]
        ] },
      creator: { label: 'Creator guidelines', kind: 'Guidelines', title: 'Creator guidelines', tpl: false,
        summary: ['Publish only your original work, or work you have the rights to.', 'Choose an honest age rating.', 'Covers and summaries can’t contain contact details, ads or watermarks.', 'New series are reviewed within 1–2 days before they go live.'],
        sections: [
          ['Original work', ['Only publish comics and stories you made, or have written permission to publish. Fan works must follow [FAN WORK POLICY].', 'Use of AI-generated images or text: [AI CONTENT POLICY].']],
          ['Age ratings', ['All ages: fine for everyone. 13+: mild violence or language. 16+: stronger themes. 18+: only shown to adults who turn on mature series. Sexual content involving anyone under 18 is never allowed.']],
          ['Covers, titles and summaries', ['Covers must be 3:4, at least 1080 × 1440 px, with no borders or watermarks. Titles and summaries can’t include phone numbers, social handles, links or ads.']],
          ['Episodes', ['Comics: JPG or PNG, 690–1600 px wide, up to 20 MB per image. Web novels: at least 300 words per chapter.', 'Keep your schedule. If you need a break, set the series to hiatus so readers know.']],
          ['Review and changes requested', ['We review new series within 1–2 days. If something needs fixing, we’ll tell you exactly what, and you can resubmit right away.']],
          ['Earnings', ['You earn from coins readers spend on your Fast Pass episodes, at [REVENUE SHARE]% as set out in the creator agreement. Payouts follow [PAYOUT SCHEDULE].']]
        ] }
    };
  }
  renderVals() {
    var self = this, st = this.state;
    var sv = this.sharedVals('');
    var all = this.docs();
    var keys = ['terms', 'privacy', 'refund', 'community', 'creator'];
    var k = all[st.doc] ? st.doc : 'terms', d = all[k];
    return Object.assign(sv, {
      docs: keys.map(function (x) { var on = x === k; return { label: all[x].label, cls: on ? 'on' : '', cur: on ? 'page' : 'false', pick: function () { self.put('toonwave.legalDoc', x); self.setState({ doc: x }); try { window.scrollTo(0, 0); } catch (e) {} } }; }),
      doc: { kind: d.kind, title: d.title, isTemplate: d.tpl, summary: d.summary.map(function (t) { return { t: t }; }),
        sections: d.sections.map(function (s, i) { return { n: i + 1, h: s[0], id: 'lg-' + (i + 1), anchor: '#lg-' + (i + 1), ps: s[1].map(function (t) { return { t: t }; }) }; }) },
      kmSoon: function () { self.say('Khmer version coming before launch'); }
    });
  }
