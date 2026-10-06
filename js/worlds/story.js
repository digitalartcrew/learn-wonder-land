/* =============================================================
   WonderWorld — worlds/story.js
   STORY FOREST: "Luna and the Missing Star" — an interactive
   story where reading activities move the plot forward.

   ADDING A CHAPTER: push a new object onto CHAPTERS.
     { title, emoji, level, beats: [...] }
   Beat types:
     { type:'passage', emoji, text }
     { type:'activity', act: { kind: 'phonics'|'rhyme'|'vocab'|'comp'
                                     |'spell'|'sentence', ... } }
   ============================================================= */
(function (WW) {
  'use strict';

  var U = WW.Util, S = WW.State, P = WW.Progress, FX = WW.FX,
      UI = WW.UI, Nav = WW.Nav, Sound = WW.Sound;

  /* ===========================================================
     STORY CONTENT
     =========================================================== */
  var CHAPTERS = [
    {
      title: 'The Star That Fell',
      emoji: '🌙',
      level: 'Ages 5–7 · short words',
      beats: [
        { type: 'passage', scene: 'hill-night', emoji: '🦊', text:
          'Luna the fox lived in the Story Forest. Every night she sat on a soft green hill and counted the stars.' },
        { type: 'passage', scene: 'star-falls', emoji: '💫', text:
          'One night, a little star slipped out of the sky. It fell behind the tall trees. "Oh no!" said Luna. "I must help it get home."' },
        { type: 'activity', act: {
          kind: 'phonics',
          q: 'Luna needs the word that starts with the /s/ sound, like "sss".',
          options: [{ t: 'star', e: '⭐' }, { t: 'moon', e: '🌙' }, { t: 'tree', e: '🌳' }, { t: 'leaf', e: '🍃' }],
          answer: 'star',
          hint: 'Say each word slowly. Which one begins with a hissing "sss"?',
          teach: '"Star" begins with the letter s.' } },
        { type: 'passage', scene: 'dark-woods', emoji: '🌳', text:
          'Luna walked into the woods. The path was dark, but the star glowed like a tiny lamp. Luna could see it winking between the leaves.' },
        { type: 'activity', act: {
          kind: 'spell',
          word: 'star', emoji: '⭐',
          clue: 'It twinkles in the night sky. Spell it!',
          teach: 's-t-a-r spells star.' } },
        { type: 'activity', act: {
          kind: 'comp',
          q: 'Why did Luna go into the woods?',
          options: ['To help the fallen star get home', 'To find her dinner', 'To climb a tall tree'],
          answer: 'To help the fallen star get home',
          hint: 'Look back at what Luna said: "I must help it get home."',
          teach: 'Good readers remember WHY characters do things.' } },
        { type: 'passage', scene: 'found-star', emoji: '🌟', text:
          'Luna found the star under a fern. It was no bigger than a button, and it was shivering. "Don\'t worry," said Luna softly. "I know someone who can help."' },
        { type: 'activity', act: {
          kind: 'sentence',
          words: ['Luna', 'found', 'the', 'little', 'star'],
          hint: 'Start with WHO. Then say what they DID.',
          teach: 'A sentence starts with a capital letter and tells a whole idea.' } }
      ]
    },

    {
      title: 'The Whispering Woods',
      emoji: '🍄',
      level: 'Ages 7–9 · longer words',
      beats: [
        { type: 'passage', scene: 'owl-oak', emoji: '🦉', text:
          'Luna carried the star to Old Owl, who lived in the tallest oak. "A star cannot fly on its own," hooted Owl. "It needs a gust of wind to lift it back to the sky."' },
        { type: 'activity', act: {
          kind: 'vocab',
          q: 'Owl said the star needs a GUST of wind. What is a gust?',
          options: ['A sudden strong puff of wind', 'A kind of cloud', 'A small bird', 'A quiet song'],
          answer: 'A sudden strong puff of wind',
          hint: 'Think about a windy day when your hat almost blows off.',
          teach: 'A gust is a short, strong burst of wind.' } },
        { type: 'passage', scene: 'misty-woods', emoji: '🌬️', text:
          '"The Wind sleeps in the Whispering Woods," said Owl. "She only wakes for a polite word." Luna tucked the star into her fur and set off through the misty trees.' },
        { type: 'activity', act: {
          kind: 'rhyme',
          q: 'The Wind only wakes for a word that rhymes with "sleep".',
          options: [{ t: 'deep', e: '🕳️' }, { t: 'sled', e: '🛷' }, { t: 'slip', e: '🧊' }, { t: 'soap', e: '🧼' }],
          answer: 'deep',
          hint: 'Rhyming words have the same ENDING sound. Say them out loud.',
          teach: 'sleep / deep — both end with the "-eep" sound.' } },
        { type: 'activity', act: {
          kind: 'spell',
          word: 'wind', emoji: '🌬️',
          clue: 'It blows the leaves and fills a sail. Spell it!',
          teach: 'w-i-n-d spells wind.' } },
        { type: 'passage', scene: 'wind-wakes', emoji: '💨', text:
          '"Please wake up," whispered Luna. The Wind stretched, yawned, and swirled the fallen leaves into a dancing ring. "Who is polite enough to wake me?" she laughed.' },
        { type: 'activity', act: {
          kind: 'sentence',
          words: ['The', 'kind', 'wind', 'lifted', 'the', 'star'],
          hint: 'Who did the lifting? Put that first.',
          teach: 'Word order changes meaning — that\'s why we build sentences carefully.' } },
        { type: 'activity', act: {
          kind: 'comp',
          q: 'How did Luna wake the Wind?',
          options: ['She asked politely', 'She shouted very loudly', 'She shook a tree'],
          answer: 'She asked politely',
          hint: 'Owl said the Wind "only wakes for a polite word".',
          teach: 'Clues earlier in a story often explain what happens later.' } }
      ]
    },

    {
      title: 'The Star Bridge',
      emoji: '🌉',
      level: 'Ages 9–12 · tricky words',
      beats: [
        { type: 'passage', scene: 'star-falters', emoji: '🌌', text:
          'The Wind lifted the little star, but halfway up it faltered and drifted back down. "It is too weak to travel alone," the Wind sighed. "It needs a bridge of light."' },
        { type: 'activity', act: {
          kind: 'vocab',
          q: 'The star FALTERED. What does "faltered" mean?',
          options: ['Lost strength and slowed down', 'Grew twice as bright', 'Spun in a fast circle', 'Made a loud noise'],
          answer: 'Lost strength and slowed down',
          hint: 'The next sentence says the star was "too weak". That is a clue.',
          teach: 'Nearby sentences give context clues for new words.' } },
        { type: 'passage', scene: 'knowledge-tree', emoji: '🔮', text:
          'Luna remembered the Knowledge Tree. Its glowing crystals could throw light far into the night. If she could borrow one beam, the star might climb home on it.' },
        { type: 'activity', act: {
          kind: 'spell',
          word: 'bridge', emoji: '🌉',
          clue: 'It helps you cross over a river. Spell it!',
          teach: 'b-r-i-d-g-e — the "dge" at the end makes a soft /j/ sound.' } },
        { type: 'activity', act: {
          kind: 'comp',
          q: 'Why did Luna think of the Knowledge Tree?',
          options: ['Its crystals shine light far into the night',
                    'It is the tallest tree in the forest',
                    'Old Owl told her to go there'],
          answer: 'Its crystals shine light far into the night',
          hint: 'The star needed a BRIDGE OF LIGHT. What makes light?',
          teach: 'Connecting a problem to a solution is called inferring.' } },
        { type: 'passage', scene: 'star-bridge', emoji: '✨', text:
          'Together they made a shining path. The little star rolled up the beam, bounced once, and leapt into its old place in the sky. The whole forest glittered.' },
        { type: 'activity', act: {
          kind: 'sentence',
          words: ['Every', 'star', 'found', 'its', 'way', 'home'],
          hint: 'The sentence begins with the word that has a capital letter.',
          teach: 'Capital letters show where a sentence begins.' } },
        { type: 'passage', scene: 'star-home', emoji: '💚', text:
          '"Thank you," twinkled the star. And from that night on, one star in the Story Forest always shines a little brighter — the one that Luna carried home.' }
      ]
    }
  ];

  var EXTRA_LETTERS = 'abcdeghilmnoprstuw'.split('');

  /* ===========================================================
     WORLD MODULE
     =========================================================== */
  var Story = WW.Worlds.story = {
    session: null,

    back: function () {
      if (this.session) { this.quit(); return; }
      Nav.go('map');
    },

    enter: function () { this.session = null; this.renderHub(); },

    /* Goes through Sound.readAloud so it uses an on-device voice only —
       story text must never be shipped to a cloud TTS service. */
    speak: function (text) {
      if (!('speechSynthesis' in window)) {
        FX.toast('Read-aloud is not available on this device');
        return;
      }
      if (!S.data.settings.sound) {
        FX.toast('Turn sound on to hear it read aloud 🔊');
        return;
      }
      Sound.readAloud(text);
    },

    /* ---------------- HUB ---------------- */
    renderHub: function () {
      var self = this, body = document.getElementById('story-body');
      var w = S.world('story');
      body.innerHTML = '';
      document.getElementById('story-bar').innerHTML = '';

      body.appendChild(UI.worldHero('story', 'Story Forest',
        'Read the story of Luna and the missing star — and help it home.'));

      var scene = U.el('div', { class: 'forest-scene', 'aria-hidden': 'true' });
      scene.innerHTML = '<span class="t t1">🌲</span><span class="t t2">🌳</span><span class="fx-star">⭐</span>' +
        '<span class="t t3">🌲</span><span class="t t4">🍄</span><span class="t t5">🌳</span>';
      body.appendChild(scene);

      var card = UI.card('', [U.el('h3', { text: '📖 Chapters' }), UI.progressRow('story')]);
      CHAPTERS.forEach(function (ch, i) {
        var done = w.done.indexOf(i) !== -1;
        var locked = i > 0 && w.done.indexOf(i - 1) === -1;
        card.appendChild(U.el('button', {
          class: 'chapter-row' + (done ? ' done' : '') + (locked ? ' locked' : ''),
          'aria-label': 'Chapter ' + (i + 1) + ': ' + ch.title + '. ' +
            (locked ? 'Finish the chapter before to open this.' : (done ? 'Finished.' : 'Not finished yet.')),
          onclick: function () {
            if (locked) {
              Sound.play('oops');
              FX.toast('Finish chapter ' + i + ' first 📖');
              return;
            }
            Sound.play('tap');
            self.start(i);
          }
        }, [
          U.el('span', { class: 'chapter-emoji', text: locked ? '🔒' : ch.emoji, 'aria-hidden': 'true' }),
          U.el('span', { class: 'chapter-text' }, [
            U.el('b', { text: 'Chapter ' + (i + 1) + ': ' + ch.title }),
            U.el('small', { text: ch.level })
          ]),
          U.el('span', { class: 'chapter-state', text: done ? '✅' : (locked ? '' : '▶️'), 'aria-hidden': 'true' })
        ]));
      });
      body.appendChild(card);

      var tries = w.correct + w.wrong;
      body.appendChild(UI.card('', [
        U.el('h4', { text: '📚 My reading so far' }),
        U.el('div', { class: 'stat-row' }, [
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: String(w.done.length) }), U.el('small', { text: 'chapters' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: String(w.spelled) }), U.el('small', { text: 'words spelled' })]),
          U.el('div', { class: 'stat-pill' }, [U.el('b', { text: tries ? Math.round(w.correct / tries * 100) + '%' : '—' }), U.el('small', { text: 'accuracy' })])
        ])
      ]));
    },

    quit: function () {
      var self = this;
      WW.Modal.open({
        title: 'Leave the story?',
        body: U.el('p', { class: 'modal-text', text: 'You can come back and start this chapter again whenever you like.' }),
        actions: [
          { text: 'Keep reading', primary: true, onClick: function () { WW.Modal.close(); } },
          { text: 'Leave', onClick: function () {
              WW.Modal.close();
              try { window.speechSynthesis.cancel(); } catch (e) {}
              self.session = null; self.renderHub();
            } }
        ]
      });
    },

    /* ---------------- CHAPTER PLAYER ---------------- */
    start: function (index) {
      this.session = {
        chapter: index, beat: 0, correctFirst: 0, activities: 0, xp: 0, gems: 0,
        replay: S.world('story').done.indexOf(index) !== -1
      };
      this.renderBeat();
      WW.Buddy.say('I love this part! 📖');
    },

    renderBeat: function () {
      var self = this, se = this.session;
      var ch = CHAPTERS[se.chapter];
      var body = document.getElementById('story-body');
      body.innerHTML = '';

      var total = ch.beats.length;
      document.getElementById('story-bar').innerHTML =
        '<span class="chip">' + (se.beat + 1) + ' / ' + total + '</span>';

      if (se.beat >= total) { this.finish(); return; }
      var beat = ch.beats[se.beat];

      var head = U.el('div', { class: 'story-head' }, [
        U.el('b', { text: ch.emoji + ' ' + ch.title }),
        U.el('span', { class: 'story-dots' },
          ch.beats.map(function (b, i) {
            return U.el('i', { class: 'dot' + (i < se.beat ? ' on' : '') + (i === se.beat ? ' now' : '') });
          }))
      ]);
      body.appendChild(head);

      if (beat.type === 'passage') {
        var card = UI.card('passage-card', []);
        /* An illustration for every passage — drawn in SVG, never fetched */
        if (beat.scene && WW.Art && WW.Art.has(beat.scene)) {
          var art = U.el('div', { class: 'story-art' });
          art.innerHTML = WW.Art.scene(beat.scene);
          art.appendChild(U.el('span', { class: 'story-art-badge', text: beat.emoji, 'aria-hidden': 'true' }));
          card.appendChild(art);
        } else {
          card.appendChild(U.el('div', { class: 'passage-emoji', text: beat.emoji, 'aria-hidden': 'true' }));
        }
        card.appendChild(U.el('p', { class: 'passage-text', text: beat.text }));
        card.appendChild(U.el('div', { class: 'passage-tools' }, [
          U.el('button', { class: 'ghost-btn', html: '🔊 Read it to me',
            onclick: function () { Sound.play('tap'); self.speak(beat.text); } })
        ]));
        card.appendChild(UI.bigButton('Next ▶️', function () { se.beat++; self.renderBeat(); }, 'primary wide'));
        body.appendChild(card);
        FX.pulse(card, 'slide-in');
      } else {
        this.renderActivity(beat.act, body);
      }
    },

    /* Common "you got it" path for every activity kind */
    succeed: function (act, firstTry, node) {
      var se = this.session;
      se.activities++;
      if (firstTry) se.correctFirst++;
      var gained = firstTry ? 14 : 6;
      se.xp += gained;
      if (firstTry) se.gems += 1;
      P.answer('story', firstTry);
      Sound.play('good');
      FX.burst(node, '✨', 10);
      FX.gain('+' + gained + ' XP', 'xp', node);
      if (Math.random() < 0.5) WW.Buddy.cheer();

      var self = this;
      var teach = U.el('div', { class: 'teach-note' }, [
        U.el('b', { text: U.pick(WW.Data.cheers) + ' ' }),
        U.el('span', { text: act.teach || '' })
      ]);
      var holder = document.querySelector('.activity-feedback');
      if (holder) { holder.innerHTML = ''; holder.appendChild(teach); }
      var nextBtn = document.querySelector('.activity-next');
      if (nextBtn) {
        nextBtn.innerHTML = '';
        nextBtn.appendChild(UI.bigButton('Keep reading ▶️', function () {
          se.beat++; self.renderBeat();
        }, 'primary wide'));
      }
    },

    missed: function (act, node, tries) {
      P.answer('story', false);
      Sound.play('oops');
      FX.pulse(node, 'shake');
      var holder = document.querySelector('.activity-feedback');
      if (holder) {
        holder.innerHTML = '';
        holder.appendChild(U.el('div', { class: 'hint-note', text:
          (tries >= 2 ? '🤝 ' : '💡 ') + (tries >= 2 ? 'Here is the answer — try tapping it now. ' : U.pick(WW.Data.nudges) + ' ') +
          (act.hint || '') }));
      }
      WW.Buddy.say('Keep going — mistakes help your brain grow!');
    },

    renderActivity: function (act, body) {
      var self = this;
      var card = UI.card('activity-card', []);
      card.appendChild(U.el('span', { class: 'chip chip-soft', text: ({
        phonics: '🔤 Sounds', rhyme: '🎵 Rhyming', vocab: '📘 Word meaning',
        comp: '🧠 Understanding', spell: '✏️ Spelling', sentence: '🧩 Sentence building'
      })[act.kind] || 'Activity' }));

      var tries = 0;

      if (act.kind === 'phonics' || act.kind === 'rhyme') {
        card.appendChild(U.el('p', { class: 'q-text', text: act.q }));
        var grid = U.el('div', { class: 'choices n' + act.options.length });
        act.options.forEach(function (o) {
          grid.appendChild(U.el('button', { class: 'choice choice-word',
            onclick: function (e) {
              var btn = e.currentTarget;
              if (btn.disabled) return;
              if (o.t === act.answer) {
                btn.classList.add('right');
                U.$$('.choice').forEach(function (b) { b.disabled = true; });
                self.succeed(act, tries === 0, btn);
              } else {
                tries++; btn.classList.add('wrong'); btn.disabled = true;
                self.missed(act, btn, tries);
                if (tries >= 2) U.$$('.choice-word').forEach(function (b) {
                  if (b.textContent.indexOf(act.answer) !== -1) b.classList.add('reveal');
                });
              }
            } }, [
            U.el('span', { class: 'word-emoji', text: o.e, 'aria-hidden': 'true' }),
            U.el('span', { text: o.t })
          ]));
        });
        card.appendChild(grid);

      } else if (act.kind === 'vocab' || act.kind === 'comp') {
        card.appendChild(U.el('p', { class: 'q-text', text: act.q }));
        var list = U.el('div', { class: 'choices stack' });
        U.shuffle(act.options).forEach(function (o) {
          list.appendChild(U.el('button', { class: 'choice choice-long', text: o,
            onclick: function (e) {
              var btn = e.currentTarget;
              if (btn.disabled) return;
              if (o === act.answer) {
                btn.classList.add('right');
                U.$$('.choice').forEach(function (b) { b.disabled = true; });
                self.succeed(act, tries === 0, btn);
              } else {
                tries++; btn.classList.add('wrong'); btn.disabled = true;
                self.missed(act, btn, tries);
                if (tries >= 2) U.$$('.choice-long').forEach(function (b) {
                  if (b.textContent === act.answer) b.classList.add('reveal');
                });
              }
            } }));
        });
        card.appendChild(list);

      } else if (act.kind === 'spell') {
        card.appendChild(U.el('div', { class: 'spell-emoji', text: act.emoji, 'aria-hidden': 'true' }));
        card.appendChild(U.el('p', { class: 'q-text', text: act.clue }));

        var word = act.word.toLowerCase();
        var slotsWrap = U.el('div', { class: 'spell-slots', 'aria-label': 'Spelling spaces' });
        var filled = [];
        for (var i = 0; i < word.length; i++) {
          slotsWrap.appendChild(U.el('span', { class: 'slot', 'data-i': i }));
        }
        var pool = word.split('');
        var extras = U.shuffle(EXTRA_LETTERS.filter(function (l) { return word.indexOf(l) === -1; })).slice(0, 2);
        pool = U.shuffle(pool.concat(extras));

        var tileWrap = U.el('div', { class: 'letter-tiles' });

        function redraw() {
          U.$$('.slot', slotsWrap).forEach(function (sl, i) {
            sl.textContent = filled[i] ? filled[i].ch : '';
            sl.classList.toggle('filled', !!filled[i]);
          });
        }
        function check() {
          if (filled.length < word.length) return;
          var guess = filled.map(function (f) { return f.ch; }).join('');
          if (guess === word) {
            slotsWrap.classList.add('right');
            U.$$('.tile', tileWrap).forEach(function (t) { t.disabled = true; });
            S.world('story').spelled++;
            if (S.world('story').spelled >= 10) P.badge('super_speller');
            self.succeed(act, tries === 0, slotsWrap);
          } else {
            tries++;
            self.missed(act, slotsWrap, tries);
            setTimeout(function () {
              filled.forEach(function (f) { f.tile.disabled = false; f.tile.classList.remove('used'); });
              filled = [];
              slotsWrap.classList.remove('right');
              redraw();
              if (tries >= 2) {
                var fb = document.querySelector('.activity-feedback');
                if (fb) fb.appendChild(U.el('div', { class: 'hint-note', text: 'It is spelled: ' + word.split('').join(' ') }));
              }
            }, 700);
          }
        }
        pool.forEach(function (ch) {
          var tile = U.el('button', { class: 'tile', text: ch, 'aria-label': 'Letter ' + ch,
            onclick: function () {
              if (filled.length >= word.length) return;
              Sound.play('tap');
              tile.disabled = true; tile.classList.add('used');
              filled.push({ ch: ch, tile: tile });
              redraw();
              check();
            } });
          tileWrap.appendChild(tile);
        });

        card.appendChild(slotsWrap);
        card.appendChild(tileWrap);
        card.appendChild(U.el('div', { class: 'spell-tools' }, [
          U.el('button', { class: 'ghost-btn', html: '⬅️ Undo', onclick: function () {
            var last = filled.pop();
            if (last) { last.tile.disabled = false; last.tile.classList.remove('used'); Sound.play('tap'); }
            redraw();
          } }),
          U.el('button', { class: 'ghost-btn', html: '🔊 Hear the word', onclick: function () { self.speak(act.word); } })
        ]));
        redraw();

      } else if (act.kind === 'sentence') {
        card.appendChild(U.el('p', { class: 'q-text', text: 'Tap the words in the right order to build the sentence.' }));
        var line = U.el('div', { class: 'sentence-line', 'aria-label': 'Your sentence' });
        var bank = U.el('div', { class: 'word-bank' });
        var placed = [];
        var target = act.words;

        function redrawLine() {
          line.innerHTML = '';
          placed.forEach(function (p, i) {
            line.appendChild(U.el('button', { class: 'word-chip placed', text: p.w,
              'aria-label': 'Remove ' + p.w,
              onclick: function () {
                Sound.play('tap');
                p.chip.disabled = false; p.chip.classList.remove('used');
                placed.splice(i, 1); redrawLine();
              } }));
          });
          if (!placed.length) line.appendChild(U.el('span', { class: 'line-ghost', text: 'Your sentence appears here…' }));
        }
        function checkSentence() {
          if (placed.length < target.length) return;
          var ok = placed.every(function (p, i) { return p.w === target[i]; });
          if (ok) {
            line.classList.add('right');
            U.$$('.word-chip', bank).forEach(function (c) { c.disabled = true; });
            self.succeed(act, tries === 0, line);
          } else {
            tries++;
            self.missed(act, line, tries);
            setTimeout(function () {
              placed.forEach(function (p) { p.chip.disabled = false; p.chip.classList.remove('used'); });
              placed = [];
              line.classList.remove('right');
              redrawLine();
              if (tries >= 2) {
                var fb = document.querySelector('.activity-feedback');
                if (fb) fb.appendChild(U.el('div', { class: 'hint-note', text: 'It should say: "' + target.join(' ') + '"' }));
              }
            }, 800);
          }
        }
        U.shuffle(target.slice()).forEach(function (w) {
          var chip = U.el('button', { class: 'word-chip', text: w,
            onclick: function () {
              Sound.play('tap');
              chip.disabled = true; chip.classList.add('used');
              placed.push({ w: w, chip: chip });
              redrawLine(); checkSentence();
            } });
          bank.appendChild(chip);
        });
        card.appendChild(line);
        card.appendChild(bank);
        redrawLine();
      }

      card.appendChild(U.el('div', { class: 'activity-feedback', role: 'status' }));
      card.appendChild(U.el('div', { class: 'activity-next' }));
      body.appendChild(card);
      FX.pulse(card, 'slide-in');
    },

    finish: function () {
      var self = this, se = this.session;
      var ch = CHAPTERS[se.chapter];
      var w = S.world('story');
      var firstTime = w.done.indexOf(se.chapter) === -1;
      if (firstTime) w.done.push(se.chapter);
      w.chapter = Math.max(w.chapter, se.chapter + 1);

      var bonus = firstTime ? 25 : 8;
      P.addXP(se.xp + bonus);
      P.addGems(se.gems + (firstTime ? 5 : 1));
      if (firstTime) P.addWorldProgress('story', 100 / CHAPTERS.length);
      P.badge('story_reader');
      P.logActivity({
        world: 'story', name: 'Chapter ' + (se.chapter + 1) + ': ' + ch.title,
        detail: se.correctFirst + '/' + se.activities + ' first try',
        stars: se.activities ? (se.correctFirst === se.activities ? 3 : (se.correctFirst >= se.activities - 1 ? 2 : 1)) : 1,
        xp: se.xp + bonus
      });
      S.save(true);

      var body = document.getElementById('story-body');
      body.innerHTML = '';
      document.getElementById('story-bar').innerHTML = '';
      var card = UI.card('result-card', [
        U.el('div', { class: 'result-emoji', text: ch.emoji }),
        U.el('h3', { text: 'Chapter finished!' }),
        U.el('p', { class: 'muted', text: '"' + ch.title + '" — ' + se.correctFirst + ' of ' +
          se.activities + ' activities right on the first try.' }),
        U.el('div', { class: 'reward-row' }, [
          U.el('div', { class: 'reward-pill' }, [U.el('span', { class: 'reward-emoji', text: '⭐' }), U.el('span', { text: '+' + (se.xp + bonus) + ' XP' })]),
          U.el('div', { class: 'reward-pill' }, [U.el('span', { class: 'reward-emoji', text: '💎' }), U.el('span', { text: '+' + (se.gems + (firstTime ? 5 : 1)) + ' gems' })])
        ])
      ]);
      card.appendChild(UI.progressRow('story'));
      var next = se.chapter + 1;
      if (CHAPTERS[next]) {
        card.appendChild(UI.bigButton('📖 Next chapter', function () { self.start(next); }, 'primary wide'));
      }
      card.appendChild(UI.bigButton('🌲 Back to the forest', function () { self.session = null; self.renderHub(); }, 'secondary wide'));
      body.appendChild(card);
      this.session = null;
      Sound.win('big');
      FX.confetti();
    }
  };

  Story.CHAPTERS = CHAPTERS;
  WW.Screens.story = Story;

})(window.WW);
