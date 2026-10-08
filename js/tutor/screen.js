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
  function say(text, expression) {
    var bubble = document.getElementById('tutor-bubble');
    if (bubble) bubble.textContent = text;
    if (expression && WW.tutorAvatar) WW.tutorAvatar.react(expression);
    if (WW.tutorVoice) {
      WW.tutorVoice.speak(text, Profile.language());
    }
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

  function mountStage(container, line, expression) {
    container.appendChild(stage(line));
    if (WW.tutorAvatar) {
      WW.tutorAvatar.mount(document.getElementById('tutor-art'));
      WW.tutorAvatar.setState(expression || 'idle');
    }
    if (line && WW.tutorVoice) WW.tutorVoice.speak(line, Profile.language());
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
      if (WW.tutorAvatar) WW.tutorAvatar.unmount();
      if (Session.isRunning()) Session.end();
    },

    /* ---------- 1. meet ---------- */
    meet: function (b) {
      var line = 'Hello! I\'m WonderTutor, your learning guide. ' +
                 'Before we start, I need a grown-up for one quick question.';
      mountStage(b, line, 'happy');

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
          /* State is a word, never only a colour. */
          U.el('small', { class: 'tutor-lang-state', text:
            l.state === Langs.SUPPORTED ? 'ready'
              : (l.state === Langs.BETA ? 'beta' : 'needs validation') })
        ]);
        langWrap.appendChild(btn);
      });
      card.appendChild(langWrap);
      note.textContent = Langs.disclosure(chosenLang) || '';
      card.appendChild(note);

      card.appendChild(UI.bigButton('Save and continue', function () {
        if (chosenGrade === null) {
          gradeLabel.textContent = 'Please choose a grade first.';
          gradeLabel.className = 'muted small bad';
          return;
        }
        Profile.setGrade(chosenGrade);
        Profile.setLanguage(chosenLang);
        Sound.play('unlock');
        Screen.assessIntro(body());
      }, 'primary wide'));

      b.appendChild(card);
    },

    /* ---------- 3. assessment ---------- */
    assessIntro: function (b) {
      if (!b) return;
      b.innerHTML = '';
      var line = 'Let\'s see what you already know! There are no wrong answers — ' +
                 'this just helps me teach you the right things.';
      mountStage(b, line, 'curious');

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
      mountStage(b, 'Here\'s one for you.', 'curious');

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

      var line = 'All done — thank you! I\'ve built you a learning path.';
      mountStage(b, line, 'celebrating');
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

      var card = UI.card('tutor-card', [
        U.el('p', { class: 'muted', text: 'What would you like to do?' })
      ]);
      card.appendChild(UI.bigButton(
        choice ? 'Let\'s learn it!' : 'Find me something',
        function () {
          Sound.play('tap');
          if (!choice) { Screen.resting(activity); return; }
          Screen.runLesson(choice);
        }, 'primary wide'));
      b.appendChild(card);

      b.appendChild(Screen._askBox());
      Screen._demoNoteIfNeeded(b);
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
        say(step.text, step.expression);

        var card = UI.card('tutor-card', [
          U.el('h3', { text: step.title }),
          U.el('p', { class: 'tutor-lesson-text', text: step.text })
        ]);
        card.appendChild(UI.bigButton('Got it — let\'s practise', function () {
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

      if (step.lead) say(step.lead, step.expression);

      var card = UI.card('tutor-card');
      card.appendChild(U.el('p', { class: 'tutor-progress muted small',
        text: (step.step === 'check' ? 'Check ' : 'Practice ') +
              (step.index + 1) + ' of ' + step.total }));

      Screen._questionInto(card, step.question, function (given) {
        Session.answer(given).then(function (res) {
          if (!res) return;
          if (res.step === 'retry') {
            /* Same question again — do not clear what they typed away
               without telling them why. */
            say(res.text, res.expression);
            Screen._flash(card, res.text, false);
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
      say(step.text, step.expression);
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
      say(line, expression);

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
      act.appendChild(card);
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

    /* ---------- ask the tutor ---------- */
    _askBox: function () {
      var card = UI.card('tutor-ask');
      var input = U.el('input', {
        type: 'text', autocomplete: 'off', class: 'name-input tutor-ask-input',
        'aria-label': 'Ask WonderTutor a question',
        placeholder: 'Ask WonderTutor something…', maxlength: '160'
      });
      var send = function () {
        var text = input.value;
        if (!text.trim()) return;
        input.value = '';
        if (WW.tutorAvatar) WW.tutorAvatar.setState('thinking');
        Session.ask(text).then(function (res) {
          say(res.text, res.expression);
          var act = document.getElementById('tutor-activity');
          if (!act) return;
          act.innerHTML = '';
          act.appendChild(UI.card('tutor-card', [
            U.el('p', { class: 'tutor-question', text: 'You asked: ' + text }),
            U.el('p', { class: 'tutor-answer', text: res.text })
          ]));
        });
      };
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });

      card.appendChild(U.el('h4', { class: 'tutor-sub', text: 'Ask WonderTutor' }));
      card.appendChild(input);
      card.appendChild(UI.bigButton('Send', function () { Sound.play('tap'); send(); }, 'secondary wide'));
      /* Voice INPUT is deliberately absent: a microphone in a children's app
         needs a privacy review we have not done. Text is enough. */
      return card;
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
