/* =============================================================
   WonderWorld — plus.js
   The two faces of WonderWorld+.

   WW.Premium   what a CHILD sees when they reach premium content.
                No price. No "buy". No "subscribe". No trial
                countdown. No sense of having lost. One friendly
                sentence and a way to fetch a grown-up.

   WW.Screens.plus   what a GROWN-UP sees, after the parental gate.
                This is the only screen in the entire game that is
                allowed to contain a price.

   That split is the whole design. If you are about to add a price
   string anywhere else, don't.
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util, UI = WW.UI, Nav = WW.Nav, Sound = WW.Sound, FX = WW.FX;

  /* ===========================================================
     CHILD-FACING
     =========================================================== */
  var Premium = WW.Premium = {

    /* Friendly, specific, and completely free of commerce.
       `contentId` is a world id or slug. */
    childPrompt: function (contentId) {
      var world = WW.Content.world(contentId);
      /* Not every premium thing is a world — WonderTutor is a feature — so
         fall back to the feature's own name rather than calling it an
         "adventure" the child cannot find on the map. */
      var feature = world ? null : WW.Content.feature(contentId);
      var name = world ? world.name : (feature ? feature.name : 'This adventure');
      var emoji = (world && world.emoji) || (feature ? '✨' : '✨');

      if (WW.events) {
        WW.events.track('premium_prompt_shown', { contentId: contentId, world: world ? world.id : null });
      }

      var body = U.el('div', { class: 'premium-prompt' }, [
        U.el('div', { class: 'premium-emoji', text: emoji, 'aria-hidden': 'true' }),
        U.el('p', { class: 'modal-text', text: name + ' is part of WonderWorld+.' }),
        U.el('p', { class: 'modal-text', text: 'Ask a grown-up to help you explore this world.' }),
        U.el('p', { class: 'modal-text muted small', text:
          'Everything you have already unlocked is still yours. Keep exploring! ' + '🌳' })
      ]);

      WW.Modal.open({
        title: '🚀 A New Adventure!',
        body: body,
        actions: [
          { text: 'Ask a Grown-Up', primary: true, onClick: function () {
              WW.Modal.close();
              Premium.askGrownUp(contentId);
            } },
          { text: 'Keep Exploring', onClick: function () { WW.Modal.close(); } }
        ]
      });
    },

    /* The handover. A grown-up proves they are here, then — and only then —
       the adult page with the pricing on it opens. */
    askGrownUp: function (contentId) {
      if (WW.events) WW.events.track('premium_help_requested', { contentId: contentId });
      WW.parentGate.require({
        kind: 'multiply-adjust',
        scope: 'purchase',
        title: 'Is a grown-up here?',
        blurb: 'The next page is for grown-ups. It explains WonderWorld+ and what it costs.',
        cancelText: 'Not now',
        onPass: function () { Nav.go('plus', { from: contentId }); }
      });
    },

    /* One entry point for "the child tapped something they cannot open".
       Learning is always reported before money — a subscriber who has not
       earned the content still sees the learning message. */
    blocked: function (contentId) {
      var v = WW.entitlements.check(contentId);
      if (v.allowed) return false;

      if (v.blockedBy === 'learning') {
        var world = WW.Content.world(contentId);
        Sound.play('oops');
        WW.Modal.open({
          title: '🔒 Not open yet',
          body: U.el('p', { class: 'modal-text', text:
            (world ? world.name + '. ' : '') + v.learningHint +
            ' Keep learning — you are getting closer!' })
        });
        return true;
      }

      if (v.blockedBy === 'plus') { Premium.childPrompt(contentId); return true; }

      /* Unknown content: say nothing clever, just do not open it. */
      FX.toast('That adventure is not ready yet.');
      return true;
    }
  };

  /* ===========================================================
     GROWN-UP-FACING: the WonderWorld+ page
     =========================================================== */
  WW.Screens.plus = {

    enter: function (opts) {
      var body = document.getElementById('plus-body');
      if (!body) return;

      /* Defence in depth: even a direct Nav.go('plus') has to pass the gate.
         The gate is the thing that protects the purchase UI, not the caller. */
      if (!WW.parentGate.isOpen('purchase')) {
        WW.parentGate.render(body, {
          kind: 'multiply-adjust',
          scope: 'purchase',
          title: 'Grown-ups only',
          blurb: 'This page explains WonderWorld+ and what it costs. Please answer:',
          onPass: function () { WW.Screens.plus.enter(opts); },
          onCancel: function () { Nav.go('map'); }
        });
        return;
      }

      if (WW.events) WW.events.track('plus_page_viewed', { status: WW.entitlements.status() });
      body.innerHTML = '';

      body.appendChild(this.statusCard());
      body.appendChild(this.pitchCard());
      body.appendChild(this.pricingCard());
      body.appendChild(this.accountCard());
      body.appendChild(this.trustCard());
      body.appendChild(this.legalCard());
    },

    /* ---------- current state ---------- */
    statusCard: function () {
      var E = WW.entitlements, status = E.status();
      var card = UI.card('plus-status');

      if (status === 'trial') {
        var left = E.trialDaysLeft();
        card.appendChild(U.el('h3', { text: '✨ Free trial active' }));
        card.appendChild(U.el('p', { class: 'muted', text:
          left + (left === 1 ? ' day' : ' days') + ' left. Everything in WonderWorld+ is unlocked.' }));
      } else if (status === 'plus') {
        card.appendChild(U.el('h3', { text: '✨ WonderWorld+ is active' }));
        card.appendChild(U.el('p', { class: 'muted', text: 'Thank you. Everything below is unlocked.' }));
      } else if (status === 'expired') {
        card.appendChild(U.el('h3', { text: 'WonderWorld+ has ended' }));
        card.appendChild(U.el('p', { class: 'muted', text:
          'The free five-crystal adventure and all of your child\'s progress are still here, ' +
          'exactly as they were. Nothing has been removed.' }));
      } else {
        card.appendChild(U.el('h3', { text: 'Take the adventure even further.' }));
        card.appendChild(U.el('p', { class: 'muted', text:
          'The core WonderWorld adventure is free and stays free. WonderWorld+ adds new ' +
          'worlds, family features and extra content on top of it.' }));
      }

      if (E.isSimulated()) {
        card.appendChild(U.el('p', { class: 'dev-note', text:
          '⚠️ DEVELOPMENT ONLY — this WonderWorld+ state is simulated locally and is not a real subscription.' }));
      }
      return card;
    },

    /* ---------- what you get ---------- */
    pitchCard: function () {
      var card = UI.card('plus-pitch', [U.el('h3', { text: 'WonderWorld+ includes' })]);
      var list = U.el('ul', { class: 'plus-list' });
      [
        ['🚀', 'WonderSpace', 'The sixth world, opened by restoring all five crystals.'],
        ['📚', 'New stories and adventures', 'More Story Forest chapters as they are written.'],
        ['🧮', 'More learning challenges', 'Additional Math adventures and modes.'],
        ['👧', 'Multiple Explorer profiles', 'Up to four Explorers, each with their own progress.'],
        ['📊', 'Advanced learning reports', 'Per-subject detail, strengths and what to practise.'],
        ['☁️', 'Progress backup', 'Keep a copy of progress and move it between devices.'],
        ['🎨', 'More ways to customize your Explorer', 'Included — never sold separately.']
      ].forEach(function (row) {
        list.appendChild(U.el('li', {}, [
          U.el('span', { class: 'plus-ico', text: row[0], 'aria-hidden': 'true' }),
          U.el('span', {}, [U.el('b', { text: row[1] }), U.el('small', { text: row[2] })])
        ]));
      });
      card.appendChild(list);
      card.appendChild(U.el('p', { class: 'muted small', text:
        'WonderWorld+ is one growing collection, not a shop. There is nothing to buy ' +
        'individually, and gems, XP and crystals are never for sale.' }));
      return card;
    },

    /* ---------- pricing ----------
       THE ONLY PLACE IN THE APP THAT MAY CONTAIN A PRICE. */
    pricingCard: function () {
      var B = WW.billing, E = WW.entitlements;
      var annual = B.product('plus_annual'), monthly = B.product('plus_monthly');
      var card = UI.card('plus-pricing');
      var self = this;

      if (E.isPlus()) {
        card.appendChild(U.el('h3', { text: 'Your plan' }));
        var current = B.product(E.record().productId);
        card.appendChild(U.el('p', { class: 'muted', text: current
          ? current.name + ' — ' + current.priceLabel
          : 'An active WonderWorld+ plan.' }));
        card.appendChild(U.el('p', { class: 'muted small', text: 'Cancel anytime.' }));
        return card;
      }

      card.appendChild(U.el('h3', { text: 'Choose a plan' }));

      /* --- annual, recommended --- */
      var annualPlan = U.el('div', { class: 'plan-card recommended' }, [
        U.el('span', { class: 'plan-badge', text: annual.badge }),
        U.el('p', { class: 'plan-headline', text: annual.trialLabel }),
        U.el('p', { class: 'plan-price', text: annual.priceLabel }),
        U.el('p', { class: 'plan-sub', text: annual.perMonthLabel })
      ]);
      annualPlan.appendChild(UI.bigButton('Start 7-Day Free Trial', function () {
        self.buy('plus_annual', true);
      }, 'primary wide'));
      annualPlan.appendChild(U.el('p', { class: 'plan-fine', text: annual.afterTrialLabel }));
      card.appendChild(annualPlan);

      /* --- monthly --- */
      var monthlyPlan = U.el('div', { class: 'plan-card' }, [
        U.el('p', { class: 'plan-price', text: monthly.priceLabel })
      ]);
      monthlyPlan.appendChild(UI.bigButton('Choose Monthly', function () {
        self.buy('plus_monthly', false);
      }, 'secondary wide'));
      card.appendChild(monthlyPlan);

      card.appendChild(U.el('p', { class: 'muted small cancel-note', text: 'Cancel anytime.' }));

      if (!B.isAvailable()) {
        card.appendChild(U.el('p', { class: 'plus-unavailable', role: 'status', text:
          'Subscriptions are not connected yet, so these buttons cannot take a payment. ' +
          'WonderWorld+ will go on sale in the app.' }));
      } else if (B.isSimulatedOnly()) {
        card.appendChild(U.el('p', { class: 'dev-note', text:
          '⚠️ DEVELOPMENT ONLY — the mock billing adapter is active. No payment is taken ' +
          'and nothing here is a real subscription.' }));
      }
      return card;
    },

    /* The one path from a button to the billing layer. No StoreKit here. */
    buy: function (productId, asTrial) {
      var self = this;
      var call = asTrial ? WW.billing.startTrial(productId) : WW.billing.purchase(productId);
      call.then(function (res) {
        if (res && res.ok) {
          Sound.play('reward');
          FX.toast('✨ WonderWorld+ is on.');
          self.enter();
          return;
        }
        self.explain(res);
      });
    },

    explain: function (res) {
      var reason = (res && res.reason) || 'not_connected';
      var text = {
        not_connected: 'Subscriptions are not connected in this build yet, so nothing was charged.',
        not_available: 'Subscriptions are not available on this device yet.',
        unknown_product: 'That plan is not available.',
        nothing_to_restore: 'We could not find a previous WonderWorld+ subscription on this device.',
        provider_error: 'Something went wrong. Nothing was charged. Please try again.'
      }[reason] || 'Something went wrong. Nothing was charged.';
      WW.Modal.open({
        title: 'Not yet',
        body: U.el('p', { class: 'modal-text', text: text })
      });
    },

    /* ---------- account controls ---------- */
    accountCard: function () {
      var self = this;
      var card = UI.card('', [U.el('h3', { text: 'Subscription' })]);
      var row = U.el('div', { class: 'parent-actions' }, [
        UI.bigButton('Restore Purchases', function () {
          WW.billing.restorePurchases().then(function (res) {
            if (res && res.ok) {
              if (WW.events) WW.events.track('subscription_restored', { provider: WW.billing.providerName() });
              FX.toast('✨ Subscription restored.');
              self.enter();
            } else { self.explain(res); }
          });
        }, 'secondary'),
        UI.bigButton('Manage Subscription', function () {
          if (WW.events) WW.events.track('subscription_manage_opened', { provider: WW.billing.providerName() });
          WW.billing.manageSubscription().then(function (res) {
            if (res && res.ok) {
              WW.Modal.open({
                title: 'Manage subscription',
                body: U.el('p', { class: 'modal-text', text:
                  'Subscriptions are managed in your device\'s account settings, where you can ' +
                  'change or cancel the plan at any time.' })
              });
            } else { self.explain(res); }
          });
        }, 'secondary')
      ]);
      card.appendChild(row);
      card.appendChild(U.el('p', { class: 'muted small', text:
        'Cancel anytime. Cancelling never removes your child\'s saved progress, and the free ' +
        'five-crystal adventure stays playable.' }));
      return card;
    },

    /* ---------- trust ---------- */
    trustCard: function () {
      var card = UI.card('trust-card', [U.el('h3', { text: 'Built for kids, not advertisers' })]);
      var list = U.el('ul', { class: 'trust-list' });
      [
        'No ads',
        'No chat',
        'No selling children\'s data',
        'No loot boxes',
        'No pay-to-win',
        'No child email required'
      ].forEach(function (t) {
        list.appendChild(U.el('li', {}, [
          U.el('span', { class: 'trust-tick', text: '✓', 'aria-hidden': 'true' }),
          U.el('span', { text: t })
        ]));
      });
      card.appendChild(list);
      card.appendChild(U.el('p', { class: 'muted small', text:
        'Educational progress is earned by learning. A subscription never grants XP, gems, ' +
        'crystals or answers, and never skips a learning requirement.' }));
      return card;
    },

    legalCard: function () {
      var card = UI.card('', []);
      card.appendChild(U.el('div', { class: 'legal-links' }, [
        U.el('a', { class: 'ghost-btn', href: 'terms.html', target: '_blank',
                    rel: 'noopener', text: 'Terms' }),
        U.el('a', { class: 'ghost-btn', href: 'privacy.html', target: '_blank',
                    rel: 'noopener', text: 'Privacy' })
      ]));
      return card;
    }
  };

})(window.WW);
