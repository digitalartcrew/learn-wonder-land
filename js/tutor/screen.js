/* =============================================================
   WonderWorld — tutor/screen.js
   The WonderTutor screen.

   THE FIRST-RUN FLOW IS THE PRODUCT
   ---------------------------------
   WonderTutor never opens with "what would you like to ask?". A
   tutor that does not know who it is teaching is a chatbot. So a new
   Explorer walks:

       Meet WonderTutor
            ↓
       Grade  (a grown-up confirms it, behind the gate)
            ↓
       Tutoring language
            ↓
       "Let's see what you already know!"   ← never called a test
            ↓
       Here's your learning path
            ↓
       First personalised lesson

   Grade sits behind the parental gate because it is the one setting
   a child could casually wreck, and because a grown-up should be the
   one to say it. We never ask for a birth date and never infer age.

   WHAT THE CHILD IS NEVER SHOWN
   -----------------------------
   No price. No "tokens remaining". No countdown. When the free demo
   is used up the child sees the same friendly handover every other
   premium door in the game uses — one sentence and a way to fetch a
   grown-up. Usage limits are a conversation with the PARENT.
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util, UI = WW.UI, Nav = WW.Nav, Sound = WW.Sound;
  var T = WW.tutorTaxonomy;
  var Profile = WW.learningProfile;
  var Tutor = WW.tutor;
  var Session = WW.tutorSession;
  var Assess = WW.tutorAssessment;
  var Langs = WW.tutorLanguages;

  function body() { return document.getElementById('tutor-body'); }

  /* The tutor's current line, spoken and shown. One place, so the mouth and
     the bubble can never disagree. */
  /* Show a line, and set the face. Speaking is NOT the default.

     The tutor used to speak on every screen, before every question and after
     every answer, which is far too much — it slowed the child down and turned
     into noise. Speech is now reserved for the places where hearing the words
     genuinely helps: the lesson explanation, a re-explanation after a miss,
     and the verdict at the end. Everything else is a sound effect. */
  function say(text, expression, speak) {
    var bubble = document.getElementById('tutor-bubble');
    if (bubble) bubble.textContent = text;
    if (expression && WW.tutorAvatar) WW.tutorAvatar.react(expression);
    if (speak && WW.tutorVoice) WW.tutorVoice.speak(text, Profile.language());
  }

  /* The stage: avatar + speech bubble. Rebuilt per screen state, so the
     avatar is re-mounted and its timers restart cleanly. */
  function stage(line) {
    var wrap = U.el('div', { class: 'tutor-stage' });
    var art = U.el('div', { class: 'tutor-art', id: 'tutor-art' });
    wrap.appendChild(art);
    wrap.appendChild(U.el('p', {
      class: 'tutor-bubble', id: 'tutor-bubble', role: 'status', text: line || ''
    }));
    return wrap;
  }

  /* `speak` is opt-in per call. Previously every mount spoke, which is why
     the tutor talked before every single assessment question. */
  function mountStage(container, line, expression, speak) {
    container.appendChild(stage(line));
    if (WW.tutorAvatar) {
      WW.tutorAvatar.mount(document.getElementById('tutor-art'));
      WW.tutorAvatar.setState(expression || 'idle');
    }
    if (speak && line && WW.tutorVoice) WW.tutorVoice.speak(line, Profile.language());
  }

  var Screen = WW.Screens.tutor = {

    enter: function (opts) {
      var b = body();
      if (!b) return;
      if (WW.tutorVoice) WW.tutorVoice.stop();
      b.innerHTML = '';

      var access = Tutor.access();

      /* Out of free demo: the child-facing handover, no price anywhere. */
      if (!access.allowed && access.blockedBy === 'plus') {
        Screen.locked(b);
        return;
      }
      /* Fair-use ceiling: a subscriber, so this is a "come back tomorrow",
         not a sales pitch. */
      if (!access.allowed && access.blockedBy === 'fair-use') {
        Screen.restingForToday(b);
        return;
      }

      var need = Tutor.setupNeeded();
      if (need.grade) { Screen.meet(b); return; }
      if (need.assessment) { Screen.assessIntro(b); return; }

      Screen.tutoring(b, opts);
    },

    leave: function () {
      if (WW.tutorVoice) WW.tutorVoice.stop();
      /* A live microphone must not survive leaving the screen. This is the
         single most important teardown in the project. */
      if (WW.tutorVoiceChat) WW.tutorVoiceChat.stop();
      if (WW.tutorAvatar) WW.tutorAvatar.unmount();
      if (Session.isRunning()) Session.end();
    },

    /* ---------- 1. meet ---------- */
    meet: function (b) {
      var line = 'Hello! I\'m WonderTutor, your learning guide. ' +
                 'Before we start, I need a grown-up for one quick question.';
      mountStage(b, line, 'happy', true);

      b.appendChild(UI.card('tutor-card', [
        U.el('h3', { text: 'Meet WonderTutor' }),
        U.el('p', { class: 'muted', text:
          'WonderTutor teaches at just the right level — but it needs to know ' +
          'which grade you\'re in first. A grown-up sets that.' }),
        UI.bigButton('Ask a Grown-Up', function () {
          Sound.play('tap');
          WW.parentGate.require({
            kind: 'multiply',
            scope: 'tutor-setup',
            title: 'Is a grown-up here?',
            blurb: 'Please choose the grade WonderTutor should teach at.',
            onPass: function () { Screen.setup(body()); }
          });
        }, 'primary wide')
      ]));
    },

    /* ---------- 2. grade + language (grown-up) ---------- */
    setup: function (b) {
      if (!b) return;
      b.innerHTML = '';
      if (WW.tutorVoice) WW.tutorVoice.stop();

      var chosenGrade = Profile.grade();
      var chosenLang = Profile.language();

      var card = UI.card('tutor-card', [
        U.el('h3', { text: 'WonderTutor setup' }),
        U.el('p', { class: 'muted', text:
          'This is for a grown-up. We never ask a child for their age or ' +
          'birth date — just pick the grade they are working in.' })
      ]);

      /* --- grade --- */
      card.appendChild(U.el('h4', { class: 'tutor-sub', text: 'Grade' }));
      var gradeRow = U.el('div', { class: 'tutor-grades', role: 'group',
                                   'aria-label': 'Choose a grade' });
      T.GRADES.forEach(function (g) {
        var btn = U.el('button', {
          class: 'chip tutor-grade' + (chosenGrade === g.value ? ' is-on' : ''),
          text: g.short,
          'aria-label': g.label,
          'aria-pressed': chosenGrade === g.value ? 'true' : 'false',
          onclick: function () {
            chosenGrade = g.value;
            Sound.play('tap');
            U.$$('.tutor-grade', gradeRow).forEach(function (el) {
              el.classList.remove('is-on');
              el.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('is-on');
            btn.setAttribute('aria-pressed', 'true');
            gradeLabel.textContent = g.label;
          }
        });
        gradeRow.appendChild(btn);
      });
      card.appendChild(gradeRow);
      var gradeLabel = U.el('p', { class: 'muted small', role: 'status',
        text: chosenGrade === null ? 'No grade chosen yet.' : T.gradeLabel(chosenGrade) });
      card.appendChild(gradeLabel);

      /* --- language --- */
      card.appendChild(U.el('h4', { class: 'tutor-sub', text: 'Tutoring language' }));
      card.appendChild(U.el('p', { class: 'muted small', text:
        'The language WonderTutor teaches in. This is not the same as learning ' +
        'a language as a subject.' }));

      var langWrap = U.el('div', { class: 'tutor-langs' });
      var note = U.el('p', { class: 'muted small tutor-lang-note', role: 'status' });

      Langs.all().forEach(function (l) {
        var ready = Langs.canTeachIn(l.code);
        var label = l.nativeName ? (l.name + ' · ' + l.nativeName) : l.name;
        var btn = U.el('button', {
          class: 'chip tutor-lang' + (chosenLang === l.code ? ' is-on' : '') +
                 (ready ? '' : ' is-unready'),
          'data-lang': l.code,
          'aria-pressed': chosenLang === l.code ? 'true' : 'false',
          onclick: function () {
            if (!ready) {
              /* Listed, explained, and honestly not selectable. */
              note.textContent = l.name + ': ' + Langs.disclosure(l.code);
              note.className = 'muted small tutor-lang-note bad';
              Sound.play('oops');
              return;
            }
            chosenLang = l.code;
            Sound.play('tap');
            U.$$('.tutor-lang', langWrap).forEach(function (el) {
              el.classList.remove('is-on');
              el.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('is-on');
            btn.setAttribute('aria-pressed', 'true');
            note.className = 'muted small tutor-lang-note';
            note.textContent = Langs.disclosure(l.code) || '';
          }
        }, [
          U.el('span', { class: 'tutor-lang-name', text: label }),
          /* State is a word, never only a color. */
          U.el('small', { class: 'tutor-lang-state', text:
            l.state === Langs.SUPPORTED ? 'ready'
              : (l.state === Langs.BETA ? 'beta' : 'needs validation') })
        ]);
        langWrap.appendChild(btn);
      });
      card.appendChild(langWrap);
      note.textContent = Langs.disclosure(chosenLang) || '';
      card.appendChild(note);

      var firstRun = !Profile.hasGrade();

      card.appendChild(UI.bigButton(firstRun ? 'Save and continue' : 'Save', function () {
        if (chosenGrade === null) {
          gradeLabel.textContent = 'Please choose a grade first.';
          gradeLabel.className = 'muted small bad';
          return;
        }
        var changed = chosenGrade !== Profile.grade();
        Profile.setGrade(chosenGrade);
        Profile.setLanguage(chosenLang);
        Sound.play('unlock');
        /* Only a brand-new Explorer goes straight into the diagnostic. Changing
           the grade later must not wipe what the child has already shown us —
           their skill levels stay, and the tutor pitches from the new grade. */
        if (firstRun) { Screen.assessIntro(body()); return; }
        if (changed) WW.FX.toast('WonderTutor will teach at ' + T.gradeLabel(chosenGrade) + '.');
        Screen.enter();
      }, 'primary wide'));

      if (!firstRun) {
        card.appendChild(U.el('p', { class: 'muted small', text:
          'If the questions have felt too hard or too easy, move the grade. ' +
          'Nothing your child has already learned is lost.' }));
        card.appendChild(U.el('button', {
          class: 'ghost-btn', text: '← Back without changing',
          onclick: function () { Sound.play('tap'); Screen.enter(); }
        }));
      }

      b.appendChild(card);
    },

    /* ---------- 3. assessment ---------- */
    assessIntro: function (b) {
      if (!b) return;
      b.innerHTML = '';
      var line = 'Let\'s see what you already know! There are no wrong answers — ' +
                 'this just helps me teach you the right things.';
      mountStage(b, line, 'curious', true);

      b.appendChild(UI.card('tutor-card', [
        U.el('h3', { text: 'Let\'s see what you already know!' }),
        U.el('p', { class: 'muted', text:
          'A few quick questions. Some will be easy and some will be tricky — ' +
          'that\'s on purpose. Just do your best.' }),
        UI.bigButton('I\'m ready!', function () {
          Sound.play('tap');
          var started = Assess.start();
          if (!started.ok) { Screen.enter(); return; }
          Screen.assessStep(body());
        }, 'primary wide')
      ]));
    },

    assessStep: function (b) {
      if (!b) return;
      var q = Assess.next();
      if (!q) { Screen.assessDone(b); return; }

      b.innerHTML = '';
      /* No spoken preamble and no filler line. Twenty questions each prefaced
         by "Here's one for you" is exactly the noise this screen does not
         need — the question itself is the content. */
      mountStage(b, '', 'curious');

      var card = UI.card('tutor-card');
      card.appendChild(U.el('p', { class: 'tutor-progress muted small',
        text: 'Question ' + (Profile.data().assessment.asked + 1) }));
      Screen._questionInto(card, q, function (given) {
        var res = Assess.submit(given);
        if (!res) return;
        Screen._afterAnswer(res.correct, res.explain, function () {
          if (res.complete) Screen.assessDone(body());
          else Screen.assessStep(body());
        });
      });
      b.appendChild(card);
    },

    assessDone: function (b) {
      if (!b) return;
      Assess.finish();
      b.innerHTML = '';

      /* A sound, not a sentence. Finishing is a moment to feel, and the
         learning path is on screen to read. */
      var line = 'All done — thank you! I\'ve built you a learning path.';
      mountStage(b, line, 'celebrating');
      Sound.play('levelup');
      if (WW.FX) WW.FX.confetti();

      var card = UI.card('tutor-card', [
        U.el('h3', { text: '🌟 Your learning path' }),
        U.el('p', { class: 'muted', text:
          'Here\'s where we\'ll start. We can always change it as you learn.' })
      ]);

      var list = U.el('ul', { class: 'tutor-path' });
      Assess.summary().forEach(function (row) {
        list.appendChild(U.el('li', {}, [
          U.el('span', { class: 'tutor-path-emoji', text: row.domain.emoji, 'aria-hidden': 'true' }),
          U.el('b', { text: row.domain.name }),
          U.el('small', { text: ' · starting at ' + T.gradeLabel(row.level) })
        ]));
      });
      card.appendChild(list);
      card.appendChild(UI.bigButton('Start my first lesson', function () {
        Sound.play('tap');
        Screen.tutoring(body());
      }, 'primary wide'));
      b.appendChild(card);
    },

    /* ---------- 4. the tutoring screen ---------- */
    tutoring: function (b, opts) {
      if (!b) return;
      b.innerHTML = '';
      opts = opts || {};

      var choice = Tutor.nextSkill();
      var opener = Tutor.proactiveOpener(choice);

      mountStage(b, opener, 'happy');

      var activity = U.el('div', { class: 'tutor-activity', id: 'tutor-activity' });
      b.appendChild(activity);

      b.appendChild(Screen._menu(choice, activity));
      b.appendChild(Screen._talkCard());
      Screen._demoNoteIfNeeded(b);
      b.appendChild(Screen._settingsLink());
    },

    /* ---------- the menu ----------
       "What would you like to do?" used to be a question with exactly one
       answer, which is not a choice. A child gets real options: the thing the
       tutor suggests, a subject of their own choosing, something they find
       tricky, or a surprise. */
    _menu: function (choice, activity) {
      var card = UI.card('tutor-card', [
        U.el('h3', { text: 'What would you like to do?' })
      ]);
      var list = U.el('div', { class: 'tutor-menu' });

      function option(emoji, label, sub, cls, onPick) {
        list.appendChild(U.el('button', {
          class: 'tutor-option' + (cls ? ' ' + cls : ''),
          onclick: function () { Sound.play('tap'); onPick(); }
        }, [
          U.el('span', { class: 'tutor-option-emoji', text: emoji, 'aria-hidden': 'true' }),
          U.el('span', { class: 'tutor-option-text' }, [
            U.el('b', { text: label }),
            sub ? U.el('small', { text: sub }) : null
          ].filter(Boolean))
        ]));
      }

      /* 1. What the tutor would pick, named so it is a real choice and not
            a mystery box. */
      if (choice) {
        var def = T.skill(choice.skillId);
        option('✨', 'Let\'s learn ' + (def ? def.name.toLowerCase() : 'something'),
          Screen._reasonLabel(choice.reason), 'is-primary',
          function () { Screen.runLesson(choice); });
      }

      /* 2. Their own pick. */
      option('📚', 'Choose a subject', 'Math, reading, science and more', null,
        function () { Screen.subjectPicker(activity); });

      /* 3. The honest one: work on a weak spot. Only offered when there
            actually is one, so it is never a fake option. */
      var weak = Profile.weakest(1)[0];
      if (weak && WW.tutorContent.has(weak.skillId)) {
        var wd = T.skill(weak.skillId);
        option('💪', 'Practice something tricky',
          wd ? wd.name : null, null,
          function () {
            Screen.runLesson({ skillId: weak.skillId, level: weak.level, reason: 'practice' });
          });
      }

      /* 4. Something genuinely different. */
      option('🎲', 'Surprise me', 'Anything at my level', null,
        function () {
          var all = T.skillsForGrade(Profile.grade() || 0)
            .filter(function (x) { return WW.tutorContent.has(x.id); });
          if (!all.length) { Screen.resting(activity); return; }
          var pick = all[Math.floor(Math.random() * all.length)];
          Screen.runLesson({ skillId: pick.id,
            level: Profile.level(pick.id), reason: 'new' });
        });

      card.appendChild(list);
      return card;
    },

    _reasonLabel: function (reason) {
      switch (reason) {
        case 'review':  return 'A quick refresh — it makes it stick';
        case 'prereq':  return 'This makes the next bit much easier';
        case 'practice':return 'I think this one needs a little work';
        case 'advance': return 'You\'re ready for something trickier';
        default:        return 'Something new';
      }
    },

    /* Pick a subject, then a skill inside it. Two taps, no reading required
       beyond the subject names the child already sees on the map. */
    subjectPicker: function (activity) {
      if (!activity) return;
      activity.innerHTML = '';
      var grade = Profile.grade() || 0;

      var card = UI.card('tutor-card', [
        U.el('h3', { text: 'What shall we learn?' })
      ]);
      var list = U.el('div', { class: 'tutor-menu' });

      T.DOMAINS.forEach(function (d) {
        var skills = T.skillsForGrade(grade).filter(function (x) {
          return x.domain === d.id && WW.tutorContent.has(x.id);
        });
        if (!skills.length) return;
        list.appendChild(U.el('button', {
          class: 'tutor-option',
          'aria-label': d.name + ', ' + skills.length + ' topics',
          onclick: function () {
            Sound.play('tap');
            Screen.skillPicker(activity, d, skills);
          }
        }, [
          U.el('span', { class: 'tutor-option-emoji', text: d.emoji, 'aria-hidden': 'true' }),
          U.el('span', { class: 'tutor-option-text' }, [
            U.el('b', { text: d.name }),
            U.el('small', { text: skills.length + ' thing' + (skills.length === 1 ? '' : 's') + ' to try' })
          ])
        ]));
      });

      card.appendChild(list);
      card.appendChild(U.el('button', {
        class: 'ghost-btn', text: '← Back',
        onclick: function () { Sound.play('tap'); activity.innerHTML = ''; }
      }));
      activity.appendChild(card);
    },

    skillPicker: function (activity, domain, skills) {
      activity.innerHTML = '';
      var card = UI.card('tutor-card', [
        U.el('h3', { text: domain.emoji + ' ' + domain.name })
      ]);
      var list = U.el('div', { class: 'tutor-menu' });

      skills.forEach(function (sk) {
        var rec = Profile.data().skills[sk.id];
        var sub = !rec || !rec.attempted ? 'Not tried yet'
          : (Profile.isMastered(sk.id) ? 'You\'ve got this one ⭐'
                                       : 'Keep going');
        list.appendChild(U.el('button', {
          class: 'tutor-option',
          onclick: function () {
            Sound.play('tap');
            Screen.runLesson({ skillId: sk.id, level: Profile.level(sk.id), reason: 'new' });
          }
        }, [
          U.el('span', { class: 'tutor-option-text' }, [
            U.el('b', { text: sk.name }),
            U.el('small', { text: sub })
          ])
        ]));
      });

      card.appendChild(list);
      card.appendChild(U.el('button', {
        class: 'ghost-btn', text: '← All subjects',
        onclick: function () { Sound.play('tap'); Screen.subjectPicker(activity); }
      }));
      activity.appendChild(card);
    },

    /* A way back to the grade and language settings at any time, behind the
       gate. Without this the only route was the first-run flow, which never
       reappears once a grade is set. */
    _settingsLink: function () {
      return U.el('button', {
        class: 'ghost-btn tutor-settings-link',
        text: '⚙️ Grown-ups: change grade or language',
        onclick: function () {
          Sound.play('tap');
          WW.parentGate.require({
            kind: 'multiply',
            scope: 'tutor-setup',
            title: 'Is a grown-up here?',
            blurb: 'Change the grade or language WonderTutor teaches at.',
            onPass: function () { Screen.setup(body()); }
          });
        }
      });
    },

    /* The free-demo reminder is for the GROWN-UP, phrased so a child reading
       it over their shoulder learns nothing about money. */
    _demoNoteIfNeeded: function (b) {
      var access = Tutor.access();
      if (!access.demo || access.demoLeft === undefined) return;
      b.appendChild(U.el('p', { class: 'muted small tutor-demo-note', text:
        'This is a free taste of WonderTutor. ' +
        (access.demoLeft > 0
          ? 'There\'s ' + access.demoLeft + ' more lesson to try.'
          : 'Ask a grown-up about more lessons.') }));
    },

    /* ---------- the lesson loop ---------- */
    runLesson: function (choice) {
      var act = document.getElementById('tutor-activity');
      if (!act) return;
      act.innerHTML = '';
      act.appendChild(U.el('p', { class: 'muted', text: 'One moment…' }));
      if (WW.tutorAvatar) WW.tutorAvatar.setState('thinking');

      Session.start(choice).then(function (step) {
        if (!step) { Screen.resting(act); return; }
        act.innerHTML = '';
        say(step.text, step.expression, true);

        var card = UI.card('tutor-card', [
          U.el('h3', { text: step.title }),
          U.el('p', { class: 'tutor-lesson-text', text: step.text })
        ]);
        card.appendChild(UI.bigButton('Got it — let\'s practice', function () {
          Sound.play('tap');
          Screen._step(Session.next());
        }, 'primary wide'));
        act.appendChild(card);
      });
    },

    _step: function (step) {
      var act = document.getElementById('tutor-activity');
      if (!act || !step) return;
      act.innerHTML = '';

      if (step.step === 'verdict') { Screen._verdict(step); return; }

      if (step.lead) say(step.lead, step.expression);   /* shown, not spoken */

      var card = UI.card('tutor-card');
      card.appendChild(U.el('p', { class: 'tutor-progress muted small',
        text: (step.step === 'check' ? 'Check ' : 'Practice ') +
              (step.index + 1) + ' of ' + step.total }));

      Screen._questionInto(card, step.question, function (given) {
        Session.answer(given).then(function (res) {
          if (!res) return;
          if (res.step === 'retry') {
            /* Same question again — do not clear what they typed away
               without telling them why. A sound is enough here. */
            say(res.text, res.expression);
            Screen._flash(card, res.text, false);
            /* A child who did not know how to do it still does not. Offer the
               method, not just encouragement. */
            Screen._offerHelp(card, Session._q);
            return;
          }
          Screen._afterAnswer(res.correct, res.explain || res.text, function () {
            Screen._step(Session.next());
          }, res);
        });
      });
      act.appendChild(card);
    },

    _verdict: function (step) {
      var act = document.getElementById('tutor-activity');
      if (!act) return;
      act.innerHTML = '';
      say(step.text, step.expression, true);
      if (step.mastered && WW.FX) WW.FX.confetti();

      var kids = [
        U.el('h3', { text: step.mastered ? '🌟 You\'ve got it!' : 'Good work' }),
        U.el('p', { class: 'muted', text: step.text }),
        U.el('p', { class: 'muted small', text:
          'You got ' + step.correct + ' of ' + step.total + ' on the check.' })
      ];
      if (step.xp) {
        kids.push(U.el('p', { class: 'tutor-reward', text:
          '+' + step.xp + ' XP' + (step.gems ? '  ·  +' + step.gems + ' 💎' : '') }));
      }
      var card = UI.card('tutor-card', kids);
      card.appendChild(UI.bigButton('What\'s next?', function () {
        Sound.play('tap');
        Session.end();
        Screen.enter();
      }, 'primary wide'));
      act.appendChild(card);
    },

    /* ---------- shared question renderer ---------- */
    _questionInto: function (card, q, onAnswer) {
      if (q.passage) {
        card.appendChild(U.el('p', { class: 'tutor-passage', text: q.passage }));
      }
      card.appendChild(U.el('p', { class: 'tutor-question', text: q.prompt }));

      if (q.kind === 'choice') {
        var row = U.el('div', { class: 'choices n' + Math.min(4, q.choices.length) });
        q.choices.forEach(function (c) {
          row.appendChild(U.el('button', {
            class: 'big-btn choice-btn', text: c,
            onclick: function () { Sound.play('tap'); onAnswer(c); }
          }));
        });
        card.appendChild(row);
        return;
      }

      var input = U.el('input', {
        type: 'text',
        inputmode: q.kind === 'number' ? 'numeric' : 'text',
        autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
        class: 'name-input tutor-input',
        'aria-label': q.prompt,
        placeholder: q.kind === 'number' ? '?' : 'Type your answer',
        maxlength: '40'
      });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { onAnswer(input.value); }
      });
      card.appendChild(input);
      card.appendChild(UI.bigButton('Answer', function () {
        onAnswer(input.value);
      }, 'primary wide'));
      setTimeout(function () { try { input.focus(); } catch (e) {} }, 120);
    },

    /* Feedback between questions. Never shames. */
    _afterAnswer: function (correct, explain, done, res) {
      var act = document.getElementById('tutor-activity');
      if (!act) { done(); return; }

      if (correct) Sound.play('good'); else Sound.play('oops');

      var expression = (res && res.expression) ||
        (correct ? 'happy' : 'encouraging');
      var line = (res && res.text) || (correct ? 'Nice one!' : 'Almost! Let\'s look at it another way.');
      /* The chime above already said "right" or "not yet". The only thing
         worth speaking here is a fresh explanation after a second miss. */
      var worthSaying = !correct && !!(res && res.steppedDown);
      say(line, expression, worthSaying);
      if (worthSaying && res.explain && WW.tutorVoice) {
        WW.tutorVoice.speak(res.explain, Profile.language());
      }

      act.innerHTML = '';
      var kids = [U.el('p', { class: correct ? 'tutor-feedback good' : 'tutor-feedback', text: line })];
      if (explain) kids.push(U.el('p', { class: 'muted', text: explain }));
      if (res && res.answer) {
        kids.push(U.el('p', { class: 'muted small', text: 'The answer was ' + res.answer + '.' }));
      }
      if (res && res.steppedDown) {
        kids.push(U.el('p', { class: 'muted small', text:
          'Let\'s build it up from a slightly easier one.' }));
      }
      var card = UI.card('tutor-card', kids);
      card.appendChild(UI.bigButton('Next', function () { Sound.play('tap'); done(); }, 'primary wide'));

      /* Even after the answer has been shown, the METHOD may not have been.
         `res.question` is the one they just missed. */
      if (!correct && res && res.question) {
        Screen._offerHelp(card, res.question, done);
      }
      act.appendChild(card);
    },

    /* ---------- "Show me how" ----------
       Appends the offer to a card. Only appears when there is a real
       walkthrough to give, so the button never leads to a shrug. */
    _offerHelp: function (card, question, onDone) {
      if (!card || !question || !WW.tutorSteps) return;
      var plan = WW.tutorSteps.build(question);
      if (!plan) return;
      if (card.querySelector('.tutor-help-btn')) return;

      card.appendChild(U.el('button', {
        class: 'big-btn secondary wide tutor-help-btn',
        text: '🤔 Show me how',
        onclick: function () {
          Sound.play('tap');
          Screen.walkthrough(question, plan, onDone);
        }
      }));
    },

    /* One step at a time, on demand. The answer is the last step, so a child
       who taps all the way through has at least passed the method on the way.

       Afterwards they get a FRESH question at the same level: being walked
       through one problem is not the same as having solved it, and it should
       not end the practice either. */
    walkthrough: function (question, plan, onDone) {
      var act = document.getElementById('tutor-activity');
      if (!act) return;
      plan = plan || WW.tutorSteps.build(question);
      if (!plan) return;

      act.innerHTML = '';
      say(plan.intro, 'encouraging', true);

      var card = UI.card('tutor-card', [
        U.el('h3', { text: 'Let\'s do it together' }),
        U.el('p', { class: 'tutor-question', text: question.prompt })
      ]);
      if (question.passage) {
        card.appendChild(U.el('p', { class: 'tutor-passage', text: question.passage }));
      }

      var list = U.el('ol', { class: 'tutor-steps' });
      card.appendChild(list);

      var counter = U.el('p', { class: 'tutor-progress muted small', role: 'status' });
      card.appendChild(counter);

      var shown = 0;
      var nextBtn, doneBtn;

      function reveal() {
        if (shown >= plan.steps.length) return;
        var text = plan.steps[shown];
        shown++;
        var li = U.el('li', { class: 'tutor-step', text: text });
        list.appendChild(li);
        if (WW.FX) WW.FX.pulse(li, 'pop');
        Sound.play('tap');
        /* Each step is read out — following a method aloud is the whole point
           of a walkthrough, and this is the one place extra speech earns it. */
        if (WW.tutorVoice) WW.tutorVoice.speak(text, Profile.language());

        counter.textContent = 'Step ' + shown + ' of ' + plan.steps.length;

        if (shown >= plan.steps.length) {
          if (nextBtn) nextBtn.remove();
          counter.textContent = plan.closing;
          if (WW.tutorAvatar) WW.tutorAvatar.react('happy');
          card.appendChild(doneBtn);
        }
      }

      doneBtn = UI.bigButton('Let me try another one', function () {
        Sound.play('tap');
        /* A fresh question at the same level, so they practice the method
           rather than re-reading the one they got wrong. */
        if (typeof onDone === 'function') { onDone(); return; }
        Screen._step(Session.next());
      }, 'primary wide');

      nextBtn = UI.bigButton('Next step →', function () { reveal(); }, 'secondary wide');
      card.appendChild(nextBtn);

      card.appendChild(U.el('button', {
        class: 'ghost-btn', text: 'Show me all the steps',
        onclick: function () {
          Sound.play('tap');
          if (WW.tutorVoice) WW.tutorVoice.stop();
          while (shown < plan.steps.length) {
            var text = plan.steps[shown];
            shown++;
            list.appendChild(U.el('li', { class: 'tutor-step', text: text }));
          }
          counter.textContent = plan.closing;
          if (nextBtn) nextBtn.remove();
          if (!card.contains(doneBtn)) card.appendChild(doneBtn);
        }
      }));

      act.appendChild(card);
      reveal();            /* open on step one, not an empty list */
    },

    _flash: function (card, text, good) {
      var p = card.querySelector('.tutor-feedback');
      if (!p) {
        p = U.el('p', { class: 'tutor-feedback' });
        card.appendChild(p);
      }
      p.className = 'tutor-feedback' + (good ? ' good' : '');
      p.textContent = text;
    },

    /* ---------- the typed question box: REMOVED ----------
       "Ask WonderTutor" is no longer offered to the child.

       The engine behind it still exists and is still tested —
       `WW.tutorAnswers.answer()` works out arithmetic, spells words it knows,
       and defines ~94 terms, and `WW.tutorSession.ask()` still routes through
       the provider and the safety screening. Nothing was deleted, so bringing
       it back is a matter of rendering a box again.

       It is not rendered because a free-text box set an expectation the tutor
       could not meet: without a configured model it answers a decent range of
       questions and then has to say "I don't know that one", and a child does
       not experience that as a careful boundary — they experience it as a
       thing that does not work. The guided menu above never has that problem,
       because every option on it leads somewhere.
       ---------------------------------------------------------- */

    /* ---------- talking out loud ----------
       Previously nested inside the question box; it now stands on its own so
       removing the box did not remove voice with it. */
    _talkCard: function () {
      var talk = Screen._talkControl();
      if (!talk) return U.el('div');
      var card = UI.card('tutor-talk-card', [
        U.el('h4', { class: 'tutor-sub', text: '🎤 Talk with me' })
      ]);
      card.appendChild(talk);
      return card;
    },

    /* ---------- talking out loud ----------
       Returns the push-to-talk control, an invitation to set it up, or null
       when the device simply cannot do it. Never an enabled mic button for a
       child whose grown-up has not consented. */
    _talkControl: function () {
      var VC = WW.tutorVoiceChat;
      if (!VC || !VC.isSupported()) return null;

      var wrap = U.el('div', { class: 'tutor-talk is-carded' });

      var gate = VC.available();

      /* Two different refusals that must not be muddled.

         Out of allowance for today is a REST — true, temporary, and nothing to
         do with money. Not being on the plan is a premium door, and dressing
         that up as "a rest" would be a small lie to a child. */
      if (VC.isEnabled() && !gate.ok && gate.reason === 'budget:plus') {
        wrap.appendChild(U.el('p', { class: 'muted small', text:
          '🎤 Talking out loud is part of WonderWorld+. Ask a grown-up if you ' +
          'would like to try it — I can still teach you here either way!' }));
        wrap.appendChild(U.el('button', {
          class: 'ghost-btn', text: 'Ask a Grown-Up',
          onclick: function () {
            Sound.play('tap');
            if (WW.Premium) WW.Premium.askGrownUp('wonder-tutor');
          }
        }));
        return wrap;
      }
      if (VC.isEnabled() && !gate.ok && /^budget/.test(gate.reason || '')) {
        wrap.appendChild(U.el('p', { class: 'muted small', text:
          '🎤 My talking voice needs a rest for now — but I can still teach you ' +
          'here! Type me a question any time.' }));
        return wrap;
      }

      if (!VC.isEnabled()) {
        /* Not consented. Offer the handover, and say plainly what it is — the
           child is allowed to know that talking needs a grown-up's yes. */
        wrap.appendChild(U.el('p', { class: 'muted small', text:
          'You can talk out loud with me, but a grown-up has to turn that on first.' }));
        wrap.appendChild(U.el('button', {
          class: 'ghost-btn', text: '🎤 Ask a grown-up about talking',
          onclick: function () {
            Sound.play('tap');
            WW.parentGate.require({
              kind: 'multiply-adjust',
              scope: 'voice-consent',
              title: 'Grown-ups only',
              blurb: 'The next page explains talking out loud with WonderTutor, ' +
                     'and what it means for your child\'s privacy.',
              onPass: function () { Screen.voiceConsent(); }
            });
          }
        }));
        return wrap;
      }

      /* Consented. Push-to-talk, with an unmistakable live indicator. */
      var status = U.el('p', { class: 'tutor-talk-status muted small', role: 'status',
        text: 'Hold the button to talk.' });

      var btn = U.el('button', {
        class: 'big-btn secondary wide tutor-talk-btn',
        id: 'tutor-talk-btn',
        'aria-label': 'Hold to talk to WonderTutor'
      }, [U.el('span', { text: '🎤 Hold to talk' })]);

      var dot = U.el('span', { class: 'tutor-mic-dot', 'aria-hidden': 'true' });
      btn.appendChild(dot);

      VC.onListening = function (live) {
        btn.classList.toggle('is-live', !!live);
        /* The indicator is a word as well as a color and a dot. */
        status.textContent = live ? '🔴 Listening — let go when you\'re done.'
                                  : 'Hold the button to talk.';
      };
      VC.onState = function (s) {
        if (s === 'connecting') status.textContent = 'Connecting…';
        else if (s === 'error') status.textContent = 'Voice isn\'t working right now — ' +
          'you can still type to me!';
      };
      VC.onError = function (reason) {
        btn.classList.remove('is-live');
        if (reason === 'budget_spent') {
          status.textContent = 'My talking voice needs a rest — keep typing to me!';
          btn.disabled = true;
        } else if (reason === 'mic_denied') {
          status.textContent = 'I can\'t hear the microphone. You can still type to me!';
        }
      };
      VC.onTranscript = function (who, text) {
        if (!text) return;
        var bubble = document.getElementById('tutor-bubble');
        if (who === 'tutor' && bubble) bubble.textContent = text;
      };

      var begin = function (e) {
        if (e && e.preventDefault) e.preventDefault();
        if (!VC.isOpen()) {
          status.textContent = 'Connecting…';
          VC.start({ skillId: Session.skillId }).then(function (r) {
            if (r && r.ok) VC.hold();
          });
          return;
        }
        VC.hold();
      };
      var finish = function () { if (VC.listening) VC.release(); };

      btn.addEventListener('pointerdown', begin);
      btn.addEventListener('pointerup', finish);
      /* Releasing outside the button, losing focus, or the tab going away must
         all end the turn — a mic that stays live because a gesture ended
         somewhere unexpected is exactly the bug worth designing out. */
      btn.addEventListener('pointercancel', finish);
      btn.addEventListener('pointerleave', finish);
      btn.addEventListener('blur', finish);
      btn.addEventListener('keydown', function (e) {
        if (e.key === ' ' || e.key === 'Enter') begin(e);
      });
      btn.addEventListener('keyup', function (e) {
        if (e.key === ' ' || e.key === 'Enter') finish();
      });

      wrap.appendChild(btn);
      wrap.appendChild(status);
      wrap.appendChild(U.el('button', {
        class: 'ghost-btn', text: 'Stop talking',
        onclick: function () { Sound.play('tap'); VC.stop(); }
      }));
      return wrap;
    },

    /* The grown-up's consent page. Behind the gate, and deliberately blunt
       about what is being agreed to. */
    voiceConsent: function () {
      var VC = WW.tutorVoiceChat;
      var b = body();
      if (!b || !VC) return;
      if (WW.tutorVoice) WW.tutorVoice.stop();
      b.innerHTML = '';

      var card = UI.card('tutor-card', [
        U.el('h3', { text: '🎤 Talking out loud with WonderTutor' }),
        U.el('p', { class: 'muted', text:
          'Your child can speak to WonderTutor and hear it answer. This is the ' +
          'only part of WonderWorld that sends anything off this device, so ' +
          'we want you to decide with the facts in front of you.' })
      ]);

      var list = U.el('ul', { class: 'trust-list consent-list' });
      [
        ['✓', 'Your child holds a button to talk. There is no open microphone — ' +
              'the mic is switched off between turns, not just ignored.'],
        ['✓', 'A red indicator shows whenever the microphone is live.'],
        ['✓', 'We never record, store or upload your child\'s voice. Nothing is ' +
              'saved on our side.'],
        ['✓', 'We never send their nickname, your email, or anything from their save.'],
        ['!', 'Their speech IS sent to our AI provider to be understood and ' +
              'answered, in the moment. That is how talking works, and it is the ' +
              'trade-off you are agreeing to.'],
        ['✓', 'You can turn this off again at any time in the Grown-Ups dashboard.'],
        ['✓', 'Everything WonderTutor teaches works by typing. Talking is never required.']
      ].forEach(function (row) {
        list.appendChild(U.el('li', {}, [
          U.el('span', { class: row[0] === '!' ? 'trust-tick is-warn' : 'trust-tick',
                         text: row[0], 'aria-hidden': 'true' }),
          row[1]
        ]));
      });
      card.appendChild(list);

      card.appendChild(U.el('p', { class: 'muted small', text:
        'Full detail is in our privacy policy.' }));
      card.appendChild(U.el('a', {
        class: 'ghost-btn', href: 'privacy.html', target: '_blank',
        rel: 'noopener', text: 'Read the privacy policy'
      }));

      if (VC.isEnabled()) {
        card.appendChild(U.el('p', { class: 'tutor-reward', text: 'Talking is ON' }));
        card.appendChild(UI.bigButton('Turn talking off', function () {
          VC.revokeConsent();
          Sound.play('tap');
          WW.FX.toast('Talking turned off.');
          Screen.voiceConsent();
        }, 'secondary wide'));
      } else {
        card.appendChild(UI.bigButton('I\'m the grown-up — turn talking on', function () {
          VC.grantConsent();
          Sound.play('unlock');
          WW.FX.toast('Talking turned on.');
          Screen.voiceConsent();
        }, 'primary wide'));
      }

      card.appendChild(U.el('button', {
        class: 'ghost-btn', text: '← Back to WonderTutor',
        onclick: function () { Sound.play('tap'); Screen.enter(); }
      }));

      b.appendChild(card);
    },

    /* ---------- the quiet states ---------- */

    /* Nothing to teach right now — rare, but it must not be a dead end. */
    resting: function (container) {
      container.innerHTML = '';
      container.appendChild(UI.card('tutor-card', [
        U.el('h3', { text: 'WonderTutor is resting right now' }),
        U.el('p', { class: 'muted', text:
          'You can keep exploring WonderWorld! I\'ll have something new for you soon.' }),
        UI.bigButton('Back to the map', function () { Nav.go('map'); }, 'primary wide')
      ]));
    },

    restingForToday: function (b) {
      mountStage(b, 'That\'s a lot of learning for one day — brilliant work!', 'happy');
      b.appendChild(UI.card('tutor-card', [
        U.el('h3', { text: 'See you tomorrow!' }),
        U.el('p', { class: 'muted', text:
          'You\'ve done a great amount of learning today. WonderTutor will be ' +
          'ready again tomorrow — go and explore WonderWorld!' }),
        UI.bigButton('Back to the map', function () { Nav.go('map'); }, 'primary wide')
      ]));
    },

    /* The premium door. Identical in tone to every other one in the game:
       no price, no "buy", no sense of having lost. */
    locked: function (b) {
      mountStage(b, 'I\'d love to keep teaching you! Ask a grown-up to help.', 'encouraging');
      b.appendChild(UI.card('tutor-card', [
        U.el('h3', { text: '✨ More lessons together' }),
        U.el('p', { class: 'muted', text:
          'WonderTutor is part of WonderWorld+. Ask a grown-up to help you ' +
          'keep learning with me.' }),
        U.el('p', { class: 'muted small', text:
          'Everything you\'ve already learned is still yours. Keep exploring! 🌳' }),
        UI.bigButton('Ask a Grown-Up', function () {
          Sound.play('tap');
          if (WW.Premium) WW.Premium.askGrownUp('wonder-tutor');
        }, 'primary wide'),
        U.el('button', {
          class: 'ghost-btn', text: '← Back to the map',
          onclick: function () { Sound.play('tap'); Nav.go('map'); }
        })
      ]));
    }
  };

})(window.WW);
