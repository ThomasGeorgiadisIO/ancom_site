// Compact vanilla JS for theme, nav, logo and hero effects
(function(){
  // Simplified: remove legacy/dark-theme handling. Keep only required elements.
  const logoLink = document.getElementById('logo-link');

  const lerp = (a,b,t) => a + (b - a) * t;

  /* Logo: always act as a 'go to start' and refresh the page so it behaves like first visit */
  if(logoLink){
    logoLink.addEventListener('click', function(e){
      e.preventDefault();
      // Immediately reload the current path (preserve query) without adding a history entry
      try{
        location.replace(location.pathname + (location.search || ''));
      }catch(err){
        // fallback to hard reload
        try{ location.reload(); }catch(e){ location.href = '/'; }
      }
    });
  }

  /* Smooth anchor scrolling offset by header height */
  (function(){
    const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 78;
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      const href = a.getAttribute('href'); if(!href || href === '#') return;
      const id = href.split('#')[1]; if(!id) return;
      const el = document.getElementById(id); if(!el) return;
      a.addEventListener('click', function(ev){
        ev.preventDefault();
        const rect = el.getBoundingClientRect();
        const top = (window.scrollY || window.pageYOffset) + rect.top - headerH - 8;
        window.scrollTo({top, behavior: 'smooth'});
      });
    });
  })();

  // --- Scrollspy: highlight top menu items based on sections in viewport ---
  (function(){
    // Find nav links that point to sections (internal anchors)
    const navLinks = Array.from(document.querySelectorAll('#top-menu a[href^="#"]'));
    const idToLink = {};
    navLinks.forEach(link => {
      const hash = link.getAttribute('href');
      if (hash && hash.startsWith('#')) idToLink[hash.slice(1)] = link;
    });

  // Robust scroll-based active section detector (replaces IntersectionObserver for reliability)
  // We'll only mark a section active once its top has passed the header offset (so visual navigation
  // corresponds to the section actually being entered). Keep `currentActiveId` to avoid flicker.
  // `manualActiveId` is set when the user clicks a nav link; it keeps the clicked link highlighted
  // (teal) until the destination section is actually entered (its top reaches the header offset).
  let currentActiveId = null;
  let manualActiveId = null;
    function updateActiveSection(){
      const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 78;
      const viewportOffset = headerH + 8; // same offset we use for scrolling
      let bestId = null;

      // If the user clicked a nav link recently, prefer keeping that clicked link active until the
      // destination section is actually entered (i.e., its top <= viewportOffset). This provides
      // a snappy UX where clicks immediately show the teal active state and persist while smooth-scrolling.
      if(manualActiveId){
        const manualEl = document.getElementById(manualActiveId);
        if(manualEl){
          const mrect = manualEl.getBoundingClientRect();
          // If the destination has now been reached (top passed header), clear manualActive and continue
          if(mrect.top <= viewportOffset){
            manualActiveId = null;
          } else {
            // keep the manually-clicked item active until destination is reached
            bestId = manualActiveId;
          }
        } else {
          manualActiveId = null;
        }
      }

      // Candidate sections: those whose top is at-or-above the header offset and which still extend below it
      if(!bestId){
        const candidates = [];
        Object.keys(idToLink).forEach(id => {
          const el = document.getElementById(id);
          if(!el) return;
          const rect = el.getBoundingClientRect();
          if(rect.top <= viewportOffset && rect.bottom > viewportOffset){
            candidates.push({ id, top: rect.top });
          }
        });

        if(candidates.length > 0){
          // pick the candidate whose top is closest to the header (largest top value)
          candidates.sort((a,b) => b.top - a.top);
          bestId = candidates[0].id;
        } else {
          // If we're at the very bottom of the page, ensure the last section becomes active
          const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 20);
          if(nearBottom){ const keys = Object.keys(idToLink); bestId = keys[keys.length - 1]; }
          else { bestId = currentActiveId || Object.keys(idToLink)[0]; }
        }
      }

      // Apply active classes
      try{
        navLinks.forEach(l => l.classList.remove('active'));
        Object.keys(idToLink).forEach(id => { const s = document.getElementById(id); if(s) s.classList.remove('active'); });
        if(bestId){ const link = idToLink[bestId]; link && link.classList.add('active'); const s = document.getElementById(bestId); if(s) s.classList.add('active'); }
      }catch(e){/* ignore */}

      // Update aria-pressed for accessibility: mark the active nav link as pressed
      try{
        navLinks.forEach(l => l.setAttribute('aria-pressed', 'false'));
        if(bestId){ const activeLink = idToLink[bestId]; if(activeLink) activeLink.setAttribute('aria-pressed', 'true'); }
      }catch(e){/* ignore */}

      // Also set aria-current="page" for strict semantic current-page reporting
      try{
        navLinks.forEach(l => l.removeAttribute('aria-current'));
        if(bestId){ const activeLink = idToLink[bestId]; if(activeLink) activeLink.setAttribute('aria-current','page'); }
      }catch(e){/* ignore */}

      // remember current active id so we can avoid flicker
      currentActiveId = bestId;
      // ensure header visual state is recomputed immediately after active section changes
      // (some browsers/flows with smooth scroll may not trigger the header update at the exact moment)
      try{ window.requestAnimationFrame(()=> window.dispatchEvent(new Event('scroll'))); }catch(e){}
    }

    // Throttled scroll handler
    let spyTimeout = null;
    function onSpyScroll(){ if(spyTimeout) return; spyTimeout = setTimeout(()=>{ updateActiveSection(); spyTimeout = null; }, 100); }

    window.addEventListener('scroll', onSpyScroll, {passive:true});
    window.addEventListener('resize', onSpyScroll);
    window.addEventListener('load', updateActiveSection);

    // Click behavior: set aria-pressed for accessibility and set active immediately for snappy feedback
    navLinks.forEach(link => {
      link.addEventListener('click', (ev) => {
        // clear any previous manual-active marker
        try{ navLinks.forEach(l => l.removeAttribute('data-manual-active')); }catch(e){}
        // mark this link as manually activated so it stays highlighted while scrolling
        try{ link.setAttribute('data-manual-active','true'); }catch(e){}
        // remember manual active id and update currentActiveId for fallback
        try{ const href = link.getAttribute('href') || ''; if(href && href.startsWith('#')){ manualActiveId = href.slice(1); currentActiveId = manualActiveId; } }catch(e){}

        navLinks.forEach(l => l.setAttribute('aria-pressed', 'false'));
        link.setAttribute('aria-pressed', 'true');
        // keep aria-current in sync for keyboard/AT users
        navLinks.forEach(l => l.removeAttribute('aria-current'));
        link.setAttribute('aria-current','page');
        try{ navLinks.forEach(l=>l.classList.remove('active')); link.classList.add('active'); }catch(e){}
      });
    });
  })();

  // Mirror active class to mobile overlay links (if any), so mobile shows the same highlighted item
  const mobileMenuList = document.getElementById('mobile-menu-list');
  const updateMobileActive = () => {
    if(!mobileMenuList) return;
    // remove existing
    mobileMenuList.querySelectorAll('a').forEach(a => { a.classList.remove('active'); a.setAttribute('aria-pressed','false'); a.removeAttribute('aria-current'); });
    // find the active desktop link and mark the corresponding mobile one (matching href)
    const activeDesktop = document.querySelector('#top-menu a.active');
    if(!activeDesktop) return;
    const href = activeDesktop.getAttribute('href');
    // ensure desktop aria state is also kept in sync
    try{
      document.querySelectorAll('#top-menu a').forEach(a => { a.setAttribute('aria-pressed','false'); a.removeAttribute('aria-current'); });
      activeDesktop.setAttribute('aria-pressed','true');
      activeDesktop.setAttribute('aria-current','page');
    }catch(e){}
    const mobileMatch = mobileMenuList.querySelector(`a[href="${href}"]`);
    if(mobileMatch){ mobileMatch.classList.add('active'); mobileMatch.setAttribute('aria-pressed','true'); mobileMatch.setAttribute('aria-current','page'); }
  };

  // tiny throttle helper
  function throttle(fn, wait){ let last=0; return function(){ const now=Date.now(); if(now-last>wait){ last=now; fn(); last=now; } }; }

  // run initially and whenever scrollspy updates.
  // We'll hook into the IntersectionObserver by wrapping its callback - simplest is to observe scroll and call updateMobileActive
  window.addEventListener('scroll', throttle(()=> updateMobileActive(), 100), {passive:true});
  // also run on load and resize
  window.addEventListener('load', updateMobileActive);
  window.addEventListener('resize', throttle(()=> updateMobileActive(), 150));

  /* Mobile nav: wire the hamburger -> overlay panel, clone desktop menu into the overlay,
     manage aria attributes and body scroll lock, and close on link click or Escape */
  (function(){
    const mobileToggle = document.getElementById('mobile-toggle');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const mobileCloseBtn = mobileOverlay && mobileOverlay.querySelector('.close-btn');
  const desktopMenu = document.getElementById('top-menu');
    const mobileMenuList = mobileOverlay && mobileOverlay.querySelector('#mobile-menu-list');

    if(!mobileToggle || !mobileOverlay) return;

    // initialize ARIA
    mobileToggle.setAttribute('aria-expanded','false');
    mobileOverlay.setAttribute('aria-hidden','true');

    function lockBody(lock){ document.body.style.overflow = lock ? 'hidden' : ''; }

    function openOverlay(){
      mobileOverlay.classList.add('open');
      mobileOverlay.classList.add('vertical');
      mobileOverlay.setAttribute('data-debug','1');
      mobileToggle.setAttribute('aria-expanded','true');
      mobileOverlay.setAttribute('aria-hidden','false');
      lockBody(true);
      // focus the first link for accessibility
      const firstLink = mobileOverlay.querySelector('a'); if(firstLink) firstLink.focus();
    }
    function closeOverlay(){
      mobileOverlay.classList.remove('open');
      mobileOverlay.classList.remove('vertical');
      mobileOverlay.removeAttribute('data-debug');
      mobileToggle.setAttribute('aria-expanded','false');
      mobileOverlay.setAttribute('aria-hidden','true');
      lockBody(false);
      mobileToggle.focus();
      // ensure mobile/desktop active state sync when overlay closes
      try{ if(typeof updateMobileActive === 'function') updateMobileActive(); }catch(e){}
    }

    // clicking the hamburger toggles the overlay
    mobileToggle.addEventListener('click', function(e){ e.preventDefault(); const isOpen = mobileOverlay.classList.contains('open'); if(isOpen) closeOverlay(); else openOverlay(); });

    // clicking the close button or background closes overlay
    mobileCloseBtn && mobileCloseBtn.addEventListener('click', function(e){ e.preventDefault(); closeOverlay(); });
    mobileOverlay.addEventListener('click', function(e){ if(e.target === mobileOverlay) closeOverlay(); });

    // close on Escape
    window.addEventListener('keydown', function(e){ if(e.key === 'Escape' && mobileOverlay.classList.contains('open')) closeOverlay(); });

    // populate mobile menu by cloning desktop items (keeps labels/hrefs)
    if(mobileMenuList && desktopMenu){
      mobileMenuList.innerHTML = '';
      Array.from(desktopMenu.children).forEach(li => {
        const clone = li.cloneNode(true);
        // remove any desktop-only classes that could interfere with layout
        clone.className = clone.className.replace(/(^|\s)desktop-only(\s|$)/g, ' ');
        mobileMenuList.appendChild(clone);
      });
    }

    // when a link inside the mobile overlay is clicked, close and smooth-scroll (if anchor)
    mobileOverlay.addEventListener('click', function(e){
      const a = e.target.closest && e.target.closest('a');
      if(!a) return;
      // allow external/normal links to work
      const href = a.getAttribute('href') || '';
      if(href.startsWith('#')){
        e.preventDefault();
        // compute header offset same as earlier smooth logic
        const id = href.split('#')[1];
        const targetEl = id ? document.getElementById(id) : null;
        const headerH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 78;
        if(targetEl){
          const rect = targetEl.getBoundingClientRect();
          const top = (window.scrollY || window.pageYOffset) + rect.top - headerH - 8;
          // perform the smooth scroll
          window.scrollTo({top, behavior: 'smooth'});
        }
        // Mark corresponding desktop/mobile links active immediately for snappy feedback
        try{
          // clear desktop aria-pressed and active state first
          document.querySelectorAll('#top-menu a').forEach(l=> { l.classList.remove('active'); l.setAttribute('aria-pressed','false'); });
          const desktop = document.querySelector(`#top-menu a[href="#${id}"]`);
          if(desktop){ desktop.classList.add('active'); desktop.setAttribute('aria-pressed','true'); desktop.setAttribute('aria-current','page'); }
          if(mobileMenuList){
            mobileMenuList.querySelectorAll('a').forEach(a=> { a.classList.remove('active'); a.setAttribute('aria-pressed','false'); a.removeAttribute('aria-current'); });
            const mobileMatch = mobileMenuList.querySelector(`a[href="#${id}"]`);
            if(mobileMatch){ mobileMatch.classList.add('active'); mobileMatch.setAttribute('aria-pressed','true'); mobileMatch.setAttribute('aria-current','page'); }
          }
          // keep currentActiveId in sync when a mobile link is clicked
          try{ currentActiveId = id; }catch(e){}
        }catch(e){}
        // close overlay immediately for snappy UX and sync active states
        closeOverlay();
      } else {
        // close overlay for regular links so navigation isn't blocked
        closeOverlay();
      }
    });
  })();

  /* Show hamburger only when the inline top-menu doesn't fit inside the header/nav area.
     The logic measures available width vs menu scrollWidth and toggles visibility. */
  (function(){
    const mobileToggle = document.getElementById('mobile-toggle');
    const topMenu = document.getElementById('top-menu');
    const nav = document.getElementById('top-menu-nav');
    if(!mobileToggle || !topMenu || !nav) return;

    function menuFits(){
      // on desktop we allow inline menu; on small screens always show hamburger
      return window.innerWidth > 880;
    }

    function updateMenuMode(){
      const fits = menuFits();
      if(fits){
        // show inline menu, hide hamburger
        topMenu.style.display = 'flex';
        mobileToggle.style.display = 'none';
        // ensure overlay closed
        const overlay = document.getElementById('mobile-overlay'); overlay && overlay.classList.remove('open');
      } else {
        // hide inline, show hamburger
        topMenu.style.display = 'none';
        mobileToggle.style.display = 'inline-flex';
        // ensure the hamburger sits at the far-right of the header
        try{ mobileToggle.style.marginLeft = 'auto'; mobileToggle.style.order = '2'; }catch(e){}
      }
    }

    // observe changes to the top-menu that may affect width (labels, language, etc.)
    const mo = new MutationObserver(()=> updateMenuMode());
    mo.observe(topMenu, { childList: true, subtree: true, characterData: true });

    window.addEventListener('resize', ()=> requestAnimationFrame(updateMenuMode), {passive:true});
    // initial check
    requestAnimationFrame(updateMenuMode);
  })();

  /* Header transparency handling: header is transparent over the hero and becomes opaque when scrolled past */
  (function(){
    const header = document.getElementById('main-header') || document.querySelector('header');
    const hero = document.querySelector('.et-pb-fullwidth-header-container');
    if(!header) return;

    // Ensure transitions are enabled
    header.classList.add('header-anim');
    // Start hidden at the very top. If there's a hero, keep header transparent while over it.
    const headerHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 78;
    if(hero){
      header.classList.add('transparent', 'hidden');
    }
    else { header.classList.add('scrolled', 'visible'); }

    // compute scrolled (opaque) vs transparent based on hero position
    function computeScrolledState(){
      if(!hero){ header.classList.remove('transparent'); header.classList.add('scrolled'); return; }
      const rect = hero.getBoundingClientRect();
      const heroBottom = rect.bottom;
      const heroH = rect.height || (hero.offsetHeight || 0);
      // Activate header (scrolled state) when the hero has passed roughly half its height
      if(heroBottom <= (heroH * 0.5)){
        header.classList.remove('transparent'); header.classList.add('scrolled');
      } else {
        header.classList.add('transparent'); header.classList.remove('scrolled');
      }
    }

    // Batch scroll updates with rAF for smoothness
    let ticking = false;
    function onScroll(){ if(!ticking){ window.requestAnimationFrame(()=>{ updateHeader(); ticking = false; }); ticking = true; } }

    function updateHeader(){
      // If we have a hero, show the header only after the hero has been scrolled past half its height.
      if(hero){
        const r = hero.getBoundingClientRect();
        const heroBottom = r.bottom;
        const heroH = r.height || (hero.offsetHeight || 0);
        if(heroBottom <= (heroH * 0.5)){
          header.classList.remove('hidden'); header.classList.add('visible');
        } else {
          header.classList.add('hidden'); header.classList.remove('visible');
        }
      } else {
        // fallback: show header after a small scroll
        const y = window.scrollY || window.pageYOffset;
        if(y <= 10){ header.classList.add('hidden'); header.classList.remove('visible'); }
        else { header.classList.remove('hidden'); header.classList.add('visible'); }
      }

      // update transparent/scrolled state relative to hero (keeps background/solid state in sync)
      computeScrolledState();
    }

    // initial state
    computeScrolledState();
    updateHeader();

    window.addEventListener('scroll', onScroll, {passive:true});
    window.addEventListener('resize', ()=>{ computeScrolledState(); }, {passive:true});
  })();

  /* Image fallback */
  document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function(){ if(img.dataset.fallback) return; img.dataset.fallback = '1'; img.src = img.getAttribute('data-fallback') || './assets/images/Logo-Only.png'; img.alt = img.alt || 'Image'; });
    if(!img.src || img.src.trim() === '') img.src = img.getAttribute('data-fallback') || './assets/images/Logo-Only.png';
  });

  // Ensure Solutions blurbs aren't treated as toggles: remove et_pb_toggle class inside #services-row-4
  (function(){
    const sol = document.getElementById('services-row-4');
    if(!sol) return;
    Array.from(sol.querySelectorAll('.et-pb-toggle')).forEach(el => {
      el.classList.remove('et-pb-toggle');
      // also remove accordion-related classes if present
      el.classList.remove('et_pb_accordion_item', 'et-pb-toggle-open', 'et_pb_toggle_close');
    });
  })();

  // Accordions removed: content is simplified and shown statically in HTML/CSS.

  /* Hero pointer-follow + parallax (desktop only) */
  (function(){
    const hero = document.querySelector('.et-pb-fullwidth-header-container');
    // Keep hero text static (no mouse-follow). Only enable parallax for the background image.
    if(!hero) return;
    if(('ontouchstart' in window) || (window.matchMedia && window.matchMedia('(max-width:880px)').matches)) return;

    (function(){
      const bg = hero.querySelector('.et-parallax-bg');
      if(!bg) return;
      let heroTop = hero.offsetTop, heroH = hero.offsetHeight;
      const strength = 0.22, pointerStrength = 0.025;
      let tY = 0, cY = 0;
      function updateSize(){ heroTop = hero.offsetTop; heroH = hero.offsetHeight; }
      function updateScroll(){ const scrollY = window.scrollY || window.pageYOffset; let progress = (scrollY - heroTop + window.innerHeight) / (heroH + window.innerHeight); progress = Math.max(0, Math.min(1, progress)); const maxY = heroH * 0.18; const scrollTarget = (progress - 0.5) * 2 * maxY * -1; tY = scrollTarget; }
      function raf(){ updateScroll(); cY = lerp(cY, tY, 0.08); bg.style.transform = `translate3d(0,${cY.toFixed(2)}px,0) scale(1.06)`; requestAnimationFrame(raf); }
      window.addEventListener('scroll', ()=> requestAnimationFrame(updateScroll), {passive:true}); window.addEventListener('resize', updateSize); updateSize(); updateScroll(); requestAnimationFrame(raf);
    })();

    // callout parallax: animate the callout-parallax-bg if present
    (function(){
      const callout = document.querySelector('.callout-parallax-wrap');
      if(!callout) return;
      const bg = callout.querySelector('.callout-parallax-bg');
      if(!bg) return;
      let top = callout.offsetTop, h = callout.offsetHeight;
      const strength = 0.18;
      let tY = 0, cY = 0;
      function updateSize(){ top = callout.offsetTop; h = callout.offsetHeight; }
      function updateScroll(){ const scrollY = window.scrollY || window.pageYOffset; let progress = (scrollY - top + window.innerHeight) / (h + window.innerHeight); progress = Math.max(0, Math.min(1, progress)); const maxY = h * strength; const scrollTarget = (progress - 0.5) * 2 * maxY * -1; tY = scrollTarget; }
      function raf2(){ cY = lerp(cY, tY, 0.08); bg.style.transform = `translate3d(0,${cY.toFixed(2)}px,0) scale(1.06)`; requestAnimationFrame(raf2); }
      window.addEventListener('scroll', ()=> requestAnimationFrame(updateScroll), {passive:true}); window.addEventListener('resize', updateSize); updateSize(); updateScroll(); requestAnimationFrame(raf2);
    })();
  })();

  /* Dynamic hero color picker: sample the hero background and pick grey or teal for foreground
    This tries to read the background image, paint it to a canvas, compute average brightness,
    and toggle CSS variables accordingly. Falls back gracefully on CORS errors. */
  (function(){
    const hero = document.querySelector('.et-pb-fullwidth-header-container');
    if(!hero) return;
    const applyHeroColors = (useTeal) => {
      if(useTeal){
        document.documentElement.style.setProperty('--hero-foreground','var(--accent)');
      } else {
        // fallback to the primary text color so we only use two colors per theme (text + accent)
        document.documentElement.style.setProperty('--hero-foreground','var(--text)');
      }
    };

    // helper: attempt to load image from computed background-image url
    const bg = hero.querySelector('.et-parallax-bg') || hero.querySelector('.callout-parallax-bg');
    if(!bg) return;
    const bgUrl = (getComputedStyle(bg).backgroundImage || '').replace(/^url\(["']?(.*?)["']?\)$/, '$1');
    if(!bgUrl || bgUrl === 'none') { applyHeroColors(false); return; }

    // image sampling with cross-origin handling
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = bgUrl;
    img.onload = function(){
      try{
        const canvas = document.createElement('canvas');
        const w = 120, h = Math.round(img.height * (120 / img.width));
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img,0,0,w,h);
        const data = ctx.getImageData(0,0,w,h).data;
        let r=0,g=0,b=0,count=0;
        for(let i=0;i<data.length;i+=4){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; count++; }
        r=Math.round(r/count); g=Math.round(g/count); b=Math.round(b/count);
        // compute perceived luminance
        const luminance = (0.299*r + 0.587*g + 0.114*b)/255;
        // if luminance is high (bright image) prefer teal, else grey text
        const preferTeal = luminance > 0.5;
        applyHeroColors(preferTeal);
      }catch(e){ applyHeroColors(false); }
    };
    img.onerror = function(){ applyHeroColors(false); };
    // if immediate decode supported
    if(img.decode) img.decode().catch(()=>{});
  })();

  /* Reveal .ser-card elements when they first scroll into view.
     - Adds a 'reveal-ready' marker to enable initial hidden state in CSS.
     - Uses IntersectionObserver to add .ser-card--pop and applies stagger via animationDelay.
     - Respects prefers-reduced-motion by skipping animation delays and keyframes.
  */
  (function(){
    try{
      // mark that JS is active for reveal styles (prevents FOUC for no-JS users)
      document.documentElement.classList.add('reveal-ready');

      const cards = Array.from(document.querySelectorAll('.ser-row .ser-card'));
      if(!cards.length) return;

      const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // IntersectionObserver options: trigger slightly before fully visible
      const io = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if(entry.isIntersecting){
            const el = entry.target;
            // compute stagger index from DOM order for predictable delays
            const idx = cards.indexOf(el);
            const delay = Math.max(0, (idx >= 0 ? idx : 0) * 80);
            if(!prefersReduced){
              // set inline animation delay so CSS uses it per-card
              el.style.animationDelay = `${delay}ms`;
            }
            // If this card is inside the Solutions section, use slide-in from left/right
            const inSolutions = !!el.closest && el.closest('#solutions');
            if(inSolutions){
              // determine side by position within its row: left (first) -> slide-left, right (second) -> slide-right
              let sideClass = 'ser-card--slide-left';
              try{
                const parent = el.parentElement;
                if(parent){
                  const siblings = Array.from(parent.querySelectorAll('.ser-card'));
                  const pos = siblings.indexOf(el);
                  // if it's the second item in the row (index 1), slide from right
                  if(pos % 2 === 1) sideClass = 'ser-card--slide-right';
                }
              }catch(e){/* ignore */}
              el.classList.add(sideClass);
            } else {
              el.classList.add('ser-card--pop');
            }
            // reveal only once per card
            obs.unobserve(el);
          }
        });
      }, { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

      cards.forEach(c => io.observe(c));
    }catch(e){ /* don't break other scripts if observer fails */ }
  })();
})();