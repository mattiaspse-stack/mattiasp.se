/* mattiasp.se — mobilmeny, TV-dekor och kontaktformulär.
   Varje vy är numera en egen sida, så all modalhantering är borta:
   navigering sköts av vanliga länkar. */
(() => {
  /* ---------------- mobilmeny ---------------- */
  const burger = document.getElementById('burger');
  const navPill = document.getElementById('navPill');

  burger?.addEventListener('click', () => {
    const open = navPill.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });

  /* ---------------- TV-rutan ---------------- */
  /* Ren dekoration. Texten skrivs här i stället för i varje HTML-fil,
     och dubbleras för att rullningen ska kunna loopa sömlöst. */
  const tv = document.getElementById('tvCode');
  if (tv) {
    const lines = `const agent = await
  claude.run({
    model: "opus-5",
    tools: [db, mail],
  });
> build ok   0.42s
for (const t of jobs)
  await t.flush();
if (!ctx.ready) {
  retry(ctx, 3);
}
export default app;
> deploy --prod
  ✓ 240 nodes live
`;
    tv.textContent = lines + lines;
  }

  /* ---------------- sidor som ligger som ett kort ---------------- */
  /* Esc gör samma sak som att klicka utanför kortet: ett steg tillbaka.
     På en case-sida är det caselistan, i övrigt startsidan. */
  const closeLink = document.querySelector('.modal--page .modal-scrim');
  if (closeLink) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') location.href = closeLink.getAttribute('href');
    });
  }

  /* ---------------- bakgrundsljud ----------------
     Ingen ljudfil — tonerna byggs i webbläsaren. Det håller sidan lätt och
     gör att inget behöver licensieras. En långsam ackordmatta genom ett
     lågpassfilter, med bandwobbel och brus, som ska ligga under TV-bilden
     utan att ta plats.

     Alltid avstängt tills någon klickar: webbläsare blockerar autoplay, och
     påtvingat ljud är ett bra sätt att bli bortklickad. Valet sparas, så den
     som slagit på det slipper göra om det vid varje sidbyte. */
  const soundBtn = document.getElementById('audioToggle');
  if (soundBtn) {
    const PREF = 'mp-ljud';
    /* Fyra takter i C-dur, I–V–vi–IV. Varje takt har ett ackord, en basnot
       och några melodinoter angivna i taktslag. */
    const BPM = 84;
    const BEAT = 60 / BPM;
    const BAR = BEAT * 4;
    const FADE = 1.6;

    const SONG = [
      { chord: [130.81, 164.81, 196.00], bass: 65.41,  // C
        lead: [[0, 329.63], [1, 392.00], [2, 523.25], [3, 392.00]] },
      { chord: [ 98.00, 123.47, 146.83], bass: 98.00,  // G
        lead: [[0, 587.33], [1.5, 493.88], [2.5, 392.00]] },
      { chord: [110.00, 130.81, 164.81], bass: 110.00, // Am
        lead: [[0, 523.25], [1, 440.00], [2, 659.25], [3, 523.25]] },
      { chord: [ 87.31, 110.00, 130.81], bass: 87.31,  // F
        lead: [[0, 440.00], [1, 523.25], [2.5, 349.23]] },
    ];

    let ctx, master, padBus, leadBus, bassBus, wobble, timer, nextBar, step = 0, on = false;

    /* brusklang som faller av — billig efterklang utan extern fil */
    function reverb() {
      const len = ctx.sampleRate * 3.2;
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
      }
      const node = ctx.createConvolver();
      node.buffer = buf;
      return node;
    }

    function build() {
      ctx = new (window.AudioContext || window.webkitAudioContext)();

      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      const verb = reverb();
      const wet = ctx.createGain();
      wet.gain.value = 0.4;
      verb.connect(wet).connect(master);

      /* mattan hålls dov — det är den som ligger mot bilden */
      const padLp = ctx.createBiquadFilter();
      padLp.type = 'lowpass';
      padLp.frequency.value = 620;
      padLp.Q.value = 0.5;
      padLp.connect(master);
      padBus = ctx.createGain();
      padBus.gain.value = 0.55;
      padBus.connect(padLp);
      padBus.connect(verb);

      /* melodin får ett öppnare filter, annars försvinner den under mattan,
         och ett eko på punkterad åttondel för retrokänslan */
      const leadLp = ctx.createBiquadFilter();
      leadLp.type = 'lowpass';
      leadLp.frequency.value = 2400;
      leadLp.connect(master);
      const echo = ctx.createDelay(1);
      echo.delayTime.value = BEAT * 0.75;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      echo.connect(fb).connect(echo);
      echo.connect(leadLp);
      leadBus = ctx.createGain();
      leadBus.connect(leadLp);
      leadBus.connect(echo);
      leadBus.connect(verb);

      const bassLp = ctx.createBiquadFilter();
      bassLp.type = 'lowpass';
      bassLp.frequency.value = 420;
      bassLp.connect(master);
      bassBus = ctx.createGain();
      bassBus.connect(bassLp);

      /* tonhöjden vandrar långsamt, som ett band som inte går alldeles jämnt.
         Bara på mattan — melodin ska hålla tonen. */
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.13;
      wobble = ctx.createGain();
      wobble.gain.value = 7;
      lfo.connect(wobble);
      lfo.start();

      /* svagt brus i botten */
      const noise = ctx.createBufferSource();
      const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.5;
      noise.buffer = nb;
      noise.loop = true;
      const ng = ctx.createGain();
      ng.gain.value = 0.012;
      noise.connect(ng).connect(padLp);
      noise.start();
    }

    function bar(t, part) {
      /* ackordmatta: mjuk in och ut så takterna flyter ihop */
      part.chord.forEach((f) => {
        [-7, 7].forEach((detune) => {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.frequency.value = f;
          osc.detune.value = detune;
          wobble.connect(osc.detune);

          const g = ctx.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.05, t + BAR * 0.4);
          g.gain.setValueAtTime(0.05, t + BAR * 0.7);
          g.gain.linearRampToValueAtTime(0, t + BAR + 0.4);

          osc.connect(g).connect(padBus);
          osc.start(t);
          osc.stop(t + BAR + 0.6);
        });
      });

      /* bas på ettan */
      const bs = ctx.createOscillator();
      bs.type = 'triangle';
      bs.frequency.value = part.bass;
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0, t);
      bg.gain.linearRampToValueAtTime(0.22, t + 0.04);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + BAR * 0.9);
      bs.connect(bg).connect(bassBus);
      bs.start(t);
      bs.stop(t + BAR);

      /* melodi */
      part.lead.forEach(([beat, freq]) => {
        const at = t + beat * BEAT;
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        g.gain.linearRampToValueAtTime(0.13, at + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, at + BEAT * 1.3);
        osc.connect(g).connect(leadBus);
        osc.start(at);
        osc.stop(at + BEAT * 1.4);
      });
    }

    /* Noterna läggs ut en halv sekund i förväg mot ljudklockan i stället för
       att spelas när en timer råkar löpa ut — annars vandrar taktkänslan. */
    function tick() {
      while (nextBar < ctx.currentTime + 0.5) {
        bar(nextBar, SONG[step++ % SONG.length]);
        nextBar += BAR;
      }
    }

    function start() {
      if (!ctx) build();
      ctx.resume();
      nextBar = ctx.currentTime + 0.15;
      tick();
      timer = setInterval(tick, 200);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.35, ctx.currentTime + FADE);
    }

    function stop() {
      clearInterval(timer);
      if (!ctx) return;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE);
      setTimeout(() => { if (!on) ctx.suspend(); }, FADE * 1000 + 100);
    }

    function set(next) {
      on = next;
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.setAttribute('aria-label', on ? 'Stäng av bakgrundsljud' : 'Slå på bakgrundsljud');
      try { localStorage.setItem(PREF, on ? 'on' : 'off'); } catch { /* privat läge */ }
      on ? start() : stop();
    }

    soundBtn.addEventListener('click', () => set(!on));

    /* Var det påslaget vid förra sidan? Ljudet får ändå inte starta förrän
       webbläsaren sett en interaktion, så vi väntar in första klicket. */
    let wasOn = false;
    try { wasOn = localStorage.getItem(PREF) === 'on'; } catch { /* privat läge */ }
    if (wasOn) {
      const resume = () => { set(true); document.removeEventListener('pointerdown', resume); };
      document.addEventListener('pointerdown', resume, { once: true });
    }
  }

  /* ---------------- kontaktformulär ---------------- */
  const MAILTO = 'info@mattiasp.se';
  const form = document.getElementById('buildForm');
  if (!form) return;

  const body = document.querySelector('.modal-body');
  const done = document.querySelector('.modal-done');
  const errorBox = document.getElementById('formError');
  const submit = form.querySelector('.modal-submit');
  const submitLabel = submit.querySelector('[data-label]');

  const endpointConfigured = () => !form.action.includes('DITT_ID');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = false;
  }

  function validate() {
    let ok = true;
    errorBox.hidden = true;
    /* radioknapparna är frivilliga, och skräpfällan ska aldrig fyllas i */
    form.querySelectorAll('input:not([type="radio"]):not([type="hidden"]):not(.hp), textarea').forEach((f) => {
      const bad = !f.value.trim() ||
        (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
      f.classList.toggle('invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) showError('Fyll i alla fält med en giltig e-postadress.');
    return ok;
  }

  function showSuccess() {
    body.hidden = true;
    done.hidden = false;
    done.querySelector('a')?.focus();
  }

  form.addEventListener('input', (e) => e.target.classList.remove('invalid'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = new FormData(form);
    const amne = data.get('amne') || 'Ej angivet';
    /* ämnesraden i mejlet — så inkorgen visar vad det gäller utan att öppnas */
    data.set('_subject', `${amne} — ${data.get('namn')}`);

    /* Ingen endpoint inlagd än → öppna e-post med allt förifyllt */
    if (!endpointConfigured()) {
      const subject = encodeURIComponent(`${amne} — ${data.get('namn')}`);
      const bodyText = encodeURIComponent(
        `Namn: ${data.get('namn')}\nE-post: ${data.get('email')}\nÄmne: ${amne}\n\n${data.get('beskrivning')}`
      );
      location.href = `mailto:${MAILTO}?subject=${subject}&body=${bodyText}`;
      showSuccess();
      return;
    }

    submit.disabled = true;
    submitLabel.textContent = 'Skickar …';

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(res.status);
      showSuccess();
    } catch {
      showError(`Något gick fel. Mejla oss gärna direkt på ${MAILTO}.`);
      submit.disabled = false;
      submitLabel.textContent = 'Skicka';
    }
  });
})();
