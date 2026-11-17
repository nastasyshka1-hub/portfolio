(() => {
  'use strict';
  const intro = document.querySelector('.motion-intro');
  if (!intro) return;
  const params = new URLSearchParams(location.search);
  const variant = params.get('intro') === 'b' ? 'b' : 'a';
  const isReview = params.get('preview') === '1';
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const rootStyle = getComputedStyle(document.documentElement);
  const easeOut = rootStyle.getPropertyValue('--ease-out').trim();
  const easeInOut = rootStyle.getPropertyValue('--ease-in-out').trim();
  const sessionKey = 'anastasia-motion-intro-v2';
  const sceneHost = intro.querySelector('.motion-scenes');
  const counter = intro.querySelector('.motion-count');
  const skip = intro.querySelector('.motion-skip');
  const replay = document.querySelector('.intro-replay');
  let pauseButton = null;
  let paused = false;
  if (isReview) {
    pauseButton = document.createElement('button');
    pauseButton.type = 'button';
    pauseButton.className = 'motion-pause';
    pauseButton.textContent = 'Пауза';
    intro.querySelector('.motion-top').insertBefore(pauseButton, skip);
  }
  const phrases = [
    ['Привет'],
    ['Я', 'Анастасия'],
    ['UX/UI-дизайнер'],
    ['В\u00a0дизайне', 'с', '2021\u00a0года']
  ];
  const reviewBar = document.querySelector('.motion-reviewbar');
  if (isReview && reviewBar) {
    reviewBar.hidden = false;
    document.querySelector('.header')?.before(reviewBar);
    reviewBar.querySelector('.motion-variant-label').textContent = variant === 'a' ? 'А / Монтажная рамка' : 'Б / Типографический монтаж';
    reviewBar.querySelectorAll('a').forEach(link => {
      if (new URL(link.href).searchParams.get('intro') === variant) link.setAttribute('aria-current', 'page');
    });
  }
  intro.dataset.variant = variant;
  let animations = [];
  let playing = false;
  let leaving = false;
  let safetyTimer = 0;
  let restoreFocus = null;
  let timelineStart = 0;
  let background = [];
  const remember = () => { try { sessionStorage.setItem(sessionKey, 'seen'); } catch {} };
  const wasSeen = () => { try { return sessionStorage.getItem(sessionKey) === 'seen'; } catch { return false; } };
  const track = (element, frames, delay, duration, easing = easeOut, fill = 'both') => {
    const animation = element.animate(frames, { delay, duration, easing, fill });
    animation.startTime = timelineStart;
    animations.push(animation);
    return animation;
  };
  const cancelAnimations = (freezeIntro = false) => {
    for (const animation of animations) {
      const target = animation.effect?.target;
      if (freezeIntro && target && intro.contains(target)) {
        try { animation.commitStyles(); } catch {}
      }
      animation.cancel();
    }
    animations = [];
  };
  const unlock = () => {
    document.body.classList.remove('motion-playing');
    for (const element of background) {
      if (element.dataset.motionInert === 'added') {
        element.inert = false;
        delete element.dataset.motionInert;
      }
    }
  };
  const complete = (state = 'complete') => {
    clearTimeout(safetyTimer);
    intro.hidden = true;
    intro.classList.remove('is-opening');
    intro.dataset.state = state;
    playing = false;
    leaving = false;
    paused = false;
    unlock();
    cancelAnimations();
    remember();
    const focusTarget = restoreFocus || document.querySelector('.portrait-hero h1');
    focusTarget?.focus({ preventScroll: true });
  };
  const skipScene = (immediate = false) => {
    if ((!playing && !leaving) || leaving) return;
    playing = false;
    leaving = true;
    clearTimeout(safetyTimer);
    remember();
    if (immediate || motionPreference.matches) { complete('skipped'); return; }
    cancelAnimations(true);
    intro.classList.add('is-opening');
    unlock();
    const exit = intro.animate([{ opacity: getComputedStyle(intro).opacity }, { opacity: 0 }], { duration: 180, easing: easeOut, fill: 'forwards' });
    animations.push(exit);
    exit.finished.then(() => complete('skipped')).catch(() => {});
  };
  const buildScenes = () => {
    sceneHost.replaceChildren();
    return phrases.map((words, sceneIndex) => {
      const scene = document.createElement('div');
      scene.className = 'motion-scene';
      scene.dataset.scene = String(sceneIndex);
      const displayWords = variant === 'b' && sceneIndex === 2 ? ['UX/UI-', 'дизайнер'] : words;
      displayWords.forEach((word, wordIndex) => {
        const mask = document.createElement('span');
        mask.className = 'motion-mask';
        if (variant === 'a') {
          const token = document.createElement('span');
          token.className = 'motion-token';
          token.textContent = word;
          mask.append(token);
        } else {
          const wordElement = document.createElement('span');
          wordElement.className = 'motion-word';
          [...word].forEach(character => {
            const token = document.createElement('span');
            token.className = 'motion-token';
            token.textContent = character;
            wordElement.append(token);
          });
          mask.append(wordElement);
        }
        scene.append(mask);
        if (wordIndex < displayWords.length - 1 && sceneIndex !== 2) scene.append(document.createTextNode(' '));
      });
      sceneHost.append(scene);
      return scene;
    });
  };
  const revealHero = openingAt => {
    const elements = [
      document.querySelector('.hero-name'), document.querySelector('.portrait-hero h1'),
      document.querySelector('.word-help'), document.querySelector('.hero-description'),
      document.querySelector('.hero-primary-actions'), document.querySelector('.hero-secondary-actions')
    ];
    elements.forEach((element, index) => {
      if (!element) return;
      track(element, [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }], openingAt + 40 + index * 35, 420);
    });
    const portrait = document.querySelector('.portrait-frame');
    if (portrait) track(portrait, [{ clipPath: 'inset(8% 0 8% 0)', opacity: 0 }, { clipPath: 'inset(0 0 0 0)', opacity: 1 }], openingAt + 20, 700, easeInOut);
  };
  const play = () => {
    if (playing || leaving) return;
    if (motionPreference.matches || !Element.prototype.animate) {
      intro.hidden = true;
      remember();
      return;
    }
    closeProjectPreview(false);
    cancelAnimations();
    intro.querySelectorAll('[style]').forEach(element => element.removeAttribute('style'));
    intro.removeAttribute('style');
    intro.classList.remove('is-opening');
    restoreFocus = document.activeElement?.matches('.intro-replay,.review-replay') ? document.activeElement : null;
    const scenes = buildScenes();
    intro.querySelector('.motion-echo').textContent = 'Анастасия';
    intro.dataset.phase = '0';
    intro.dataset.state = 'playing';
    counter.textContent = '01 / 04';
    window.scrollTo({ top: 0, behavior: 'instant' });
    background = [...document.body.children].filter(element => element !== intro && element.tagName !== 'SCRIPT');
    background.forEach(element => { if (!element.inert) { element.inert = true; element.dataset.motionInert = 'added'; } });
    playing = true;
    paused = false;
    if (pauseButton) pauseButton.textContent = 'Пауза';
    intro.hidden = false;
    document.body.classList.add('motion-playing');
    skip.focus({ preventScroll: true });
    timelineStart = document.timeline.currentTime ?? performance.now();
    const cues = variant === 'a' ? [120, 1360, 2600, 3880] : [120, 1320, 2680, 4080];
    const openingAt = variant === 'a' ? 5120 : 5520;
    const frame = intro.querySelector('.motion-frame');
    track(frame, [{ transform: 'scaleX(.65)', opacity: 0 }, { transform: 'scaleX(1)', opacity: 1 }], 0, 700, easeInOut);
    track(frame, [{ opacity: 1 }, { opacity: 0 }], openingAt - 180, 300, easeOut, 'forwards');
    track(intro.querySelector('.motion-progress i'), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], 0, openingAt + 600, 'linear');
    if (variant === 'b') {
      track(intro.querySelector('.motion-echo'), [{ transform: 'translateX(8%)', opacity: 0 }, { transform: 'translateX(0)', opacity: .035 }], cues[1], 900, easeInOut);
      track(intro.querySelector('.motion-echo'), [{ opacity: .035 }, { opacity: 0 }], openingAt - 300, 300, easeOut, 'forwards');
    }
    scenes.forEach((scene, sceneIndex) => {
      const start = cues[sceneIndex];
      const exitAt = sceneIndex === 3 ? openingAt - 260 : cues[sceneIndex + 1] - 280;
      const presence = track(scene, [{ opacity: 0 }, { opacity: 1 }], start, 1, 'linear');
      presence.finished.then(() => {
        if (!playing) return;
        intro.dataset.phase = String(sceneIndex + 1);
        counter.textContent = String(sceneIndex + 1).padStart(2, '0') + ' / 04';
      }).catch(() => {});
      track(scene, [{ opacity: 1 }, { opacity: 0 }], exitAt + 260, 1, 'linear', 'forwards');
      const tokens = [...scene.querySelectorAll('.motion-token')];
      tokens.forEach((token, tokenIndex) => {
        const stagger = variant === 'a' ? tokenIndex * 50 : tokenIndex * (sceneIndex === 2 ? 18 : 22);
        const entrance = variant === 'a'
          ? [{ transform: 'translateY(112%)' }, { transform: 'translateY(0)' }]
          : [{ transform: `translateY(${tokenIndex % 2 ? '-112%' : '112%'}) rotate(${tokenIndex % 2 ? '-5deg' : '5deg'}) scale(.97)` }, { transform: 'translateY(0) rotate(0) scale(1)' }];
        track(token, entrance, start + stagger, variant === 'a' ? 620 : 620);
        track(token, [{ transform: 'translateY(0) rotate(0) scale(1)' }, { transform: variant === 'a' ? 'translateY(-112%)' : 'translateY(-112%) rotate(-2deg)' }], exitAt + (variant === 'a' ? tokenIndex * 20 : tokenIndex * 4), 260, easeInOut, 'forwards');
      });
    });
    track(intro.querySelector('.motion-top'), [{ opacity: 1 }, { opacity: 0 }], openingAt, 200, easeOut, 'forwards');
    track(intro.querySelector('.motion-bottom'), [{ opacity: 1 }, { opacity: 0 }], openingAt, 200, easeOut, 'forwards');
    const shutters = intro.querySelectorAll('.motion-shutter');
    track(shutters[0], [{ transform: 'translate(0,0)' }, { transform: variant === 'a' ? 'translateY(-101%)' : 'translateX(-101%)' }], openingAt, 720, easeInOut, 'forwards');
    const gate = track(shutters[1], [{ transform: 'translate(0,0)' }, { transform: variant === 'a' ? 'translateY(101%)' : 'translateX(101%)' }], openingAt, 720, easeInOut, 'forwards');
    revealHero(openingAt);
    gate.finished.then(() => { if (playing) complete(); }).catch(() => {});
    safetyTimer = setTimeout(() => complete('safety-finish'), openingAt + 2500);
  };
  const wordButtons = [...document.querySelectorAll('.hero-word')];
  const preview = document.querySelector('.word-preview');
  if (preview) document.body.append(preview);
  const examples = {
    clear: { label: 'Понятные', image: 'assets/university-analytics-dynamics.png', href: 'university.html', caption: 'UI-дизайн аналитических экранов в составе команды.' },
    usable: { label: 'Удобные', image: 'assets/photoschool-programs.png', href: 'photoschool.html', caption: 'Выбор программы и путь к записи на пробный урок.' },
    expressive: { label: 'Выразительные', image: 'assets/marketing-hero.png', href: 'marketing.html', caption: 'Визуальная подача сайта Вебпрактик.Маркетинг.' }
  };
  let lastTrigger = null;
  let closeTimer;
  let openedExplicitly = false;

  function closeProjectPreview(returnFocus = false) {
    clearTimeout(closeTimer);
    if (!preview || preview.hidden) return;
    preview.hidden = true;
    preview.classList.remove('is-entering');
    lastTrigger?.setAttribute('aria-expanded', 'false');
    if (returnFocus) lastTrigger?.focus({ preventScroll: true });
  }

  function showProjectPreview(button, interactive = false) {
    if (!preview || playing) return;
    const key = button.dataset.project;
    const example = examples[key];
    if (!example) return;
    const wasOpen = !preview.hidden;
    lastTrigger = button;
    clearTimeout(closeTimer);
    openedExplicitly = interactive;
    preview.dataset.project = key;
    preview.querySelector('.word-preview-label').textContent = example.label;
    const image = preview.querySelector('img');
    image.src = example.image;
    image.alt = example.caption;
    preview.querySelector('.word-preview-caption').textContent = example.caption;
    preview.querySelector('.word-preview-link').href = example.href;
    wordButtons.forEach(word => word.setAttribute('aria-expanded', String(word === button)));
    preview.hidden = false;
    if (!wasOpen && !motionPreference.matches) {
      preview.classList.add('is-entering');
      requestAnimationFrame(() => requestAnimationFrame(() => preview.classList.remove('is-entering')));
    } else preview.classList.remove('is-entering');
    if (interactive) preview.querySelector('.word-preview-link').focus({ preventScroll: true });
  }

  wordButtons.forEach(button => {
    button.addEventListener('pointermove', event => {
      if (!finePointer.matches || event.pointerType !== 'mouse') return;
      clearTimeout(closeTimer);
      if (!preview?.hidden && (lastTrigger === button || openedExplicitly)) return;
      showProjectPreview(button);
    });
    button.addEventListener('pointerleave', () => {
      if (!preview?.hidden && !openedExplicitly && lastTrigger === button) {
        closeTimer = setTimeout(closeProjectPreview, 500);
      }
    });
    button.addEventListener('click', event => {
      if (event.detail === 0 || event.pointerType === 'touch' || !finePointer.matches) {
        if (!preview?.hidden && openedExplicitly && lastTrigger === button) closeProjectPreview();
        else showProjectPreview(button, true);
      }
    });
  });
  preview?.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  preview?.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse' && !openedExplicitly && event.relatedTarget !== lastTrigger) {
      closeProjectPreview();
    }
  });
  document.addEventListener('click', event => {
    if (!preview?.contains(event.target) && !event.target.closest('.hero-word')) closeProjectPreview();
  });
  window.addEventListener('scroll', () => closeProjectPreview(), { passive: true });
  document.addEventListener('keydown', event => {
    if (playing && event.key === 'Escape') { event.preventDefault(); skipScene(true); }
    else if (playing && event.key === 'Tab') {
      event.preventDefault();
      if (pauseButton) (document.activeElement === skip ? pauseButton : skip).focus();
      else skip.focus();
    }
    else if (!preview?.hidden && event.key === 'Escape') { event.preventDefault(); closeProjectPreview(true); }
  });
  skip.addEventListener('click', () => skipScene());
  pauseButton?.addEventListener('click', () => {
    if (!playing) return;
    paused = !paused;
    clearTimeout(safetyTimer);
    animations.forEach(animation => paused ? animation.pause() : animation.play());
    pauseButton.textContent = paused ? 'Продолжить' : 'Пауза';
    intro.dataset.state = paused ? 'paused' : 'playing';
    if (!paused) safetyTimer = setTimeout(() => complete('safety-finish'), 9000);
  });
  replay?.addEventListener('click', play);
  reviewBar?.querySelector('.review-replay')?.addEventListener('click', play);
  document.addEventListener('visibilitychange', () => { if (document.hidden && (playing || leaving)) complete('interrupted'); });
  motionPreference.addEventListener('change', event => { if (event.matches && (playing || leaving)) complete('reduced-motion'); });
  document.querySelector('.portrait-hero h1')?.setAttribute('tabindex', '-1');
  if (motionPreference.matches || (!isReview && (wasSeen() || location.hash))) {
    intro.hidden = true;
    remember();
  } else play();
})();
