import type { PetMoodMessage } from "../../lib/messages/protocol";
import type { NotificationPayload } from "../../types";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    const SHADOW_HOST_ID = "petmood-overlay-host";
    let dismissTimeout: ReturnType<typeof setTimeout> | null = null;
    // Per-overlay cleanup registry — every animation pushes its cancel fn here
    // so removeOverlay() can tear down rAF loops and pending setTimeouts that
    // would otherwise keep running on orphaned DOM nodes after a new overlay
    // is requested.
    const cancelFns: Array<() => void> = [];
    const registerCancel = (fn: () => void) => { cancelFns.push(fn); };

    chrome.runtime.onMessage.addListener(
      (message: PetMoodMessage, _sender, sendResponse) => {
        if (message.type === "SHOW_NOTIFICATION") {
          showOverlay(message.payload);
          sendResponse({ success: true });
        }
      }
    );

    function showOverlay(payload: NotificationPayload): void {
      removeOverlay();

      const host = document.createElement("div");
      host.id = SHADOW_HOST_ID;
      host.style.cssText = `
        position: fixed !important;
        top: 0 !important; left: 0 !important;
        width: 100vw !important; height: 100vh !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
      `;
      document.documentElement.appendChild(host);

      const shadow = host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = getStyles();
      shadow.appendChild(style);

      // SVG filter (bubble displacement only)
      const svg = document.createElement("div");
      svg.innerHTML = `<svg style="position:absolute;width:0;height:0;"><defs>
        <filter id="pmw"><feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="3" seed="2" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter>
      </defs></svg>`;
      shadow.appendChild(svg);

      const container = document.createElement("div");
      container.className = "pm-container";
      shadow.appendChild(container);

      switch (payload.displayType) {
        case "stampede":     startStampede(container, payload); break;
        case "rain":         startRain(container, payload); break;
        case "parade":       startParade(container, payload); break;
        case "peekaboo":     startPeekaboo(container, payload); break;
        case "bounce":       startBounce(container, payload); break;
        case "popcorn":      startPopcorn(container, payload); break;
        case "carousel":     startCarousel(container, payload); break;
        case "float":        startFloat(container, payload); break;
        case "tornado":      startTornado(container, payload); break;
        case "photoBooth":   startPhotoBooth(container, payload); break;
        case "teleport":     startTeleport(container, payload); break;
        case "dominoFall":   startDominoFall(container, payload); break;
        case "trampoline":   startTrampoline(container, payload); break;
        case "bowling":      startBowling(container, payload); break;
        case "fireworks":    startFireworks(container, payload); break;
        case "kiss":         startKiss(container, payload); break;
        case "rainbowArc":   startRainbowArc(container, payload); break;
        case "danceParty":   startDanceParty(container, payload); break;
        default:             startPeekaboo(container, payload);
      }
    }

    // ===== Stampede: a herd of pets runs across the screen =====
    //   - 12 runners at varying depths (size, Y level, speed) for parallax
    //   - Each has a running gait (hop + tilt) like a mini-bounce
    //   - Direction is randomized per run; pets are horizontally flipped to
    //     "face" the direction of travel
    //   - Staggered entry creates a continuous stream instead of a single wall
    function startStampede(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const count = 12;
      const direction = Math.random() < 0.5 ? 1 : -1;

      // Image pool
      const rawPool: string[] =
        ((payload as any).swarmImageUrls as string[] | undefined)?.filter(Boolean) ?? [];
      if (rawPool.length === 0) rawPool.push(payload.imageDataUrl);
      const shuffled = rawPool.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const pickImage = (i: number) => shuffled[i % shuffled.length];

      type Runner = {
        img: HTMLImageElement;
        size: number;
        y: number;
        speed: number;    // px/s
        delay: number;    // ms
        hopRate: number;  // rad/s
        hopOffset: number;
      };

      const runners: Runner[] = [];
      for (let i = 0; i < count; i++) {
        const depth = Math.random();                        // 0 = far, 1 = close
        const size = 75 + depth * 115;                      // 75 ~ 190 px
        const y = sh * (0.35 + depth * 0.45) - size;        // higher on screen = farther
        const speed = 750 + depth * 500;                    // closer = faster (parallax)
        const delay = 100 + i * (60 + Math.random() * 80);
        const hopRate = 14 + Math.random() * 6;             // ~2-3 hops/sec
        const hopOffset = Math.random() * Math.PI * 2;

        const img = document.createElement("img");
        img.src = pickImage(i);
        img.style.cssText = `
          position: fixed;
          left: 0; top: 0;
          width: ${size}px; height: ${size}px;
          object-fit: contain;
          transform-origin: 50% 100%;
          filter: drop-shadow(0 6px 10px rgba(0,0,0,0.25));
          opacity: 0;
          will-change: transform, opacity;
          z-index: ${Math.round(depth * 100)};
        `;
        container.appendChild(img);

        runners.push({ img, size, y, speed, delay, hopRate, hopOffset });
      }

      let frame: number;
      let cancelled = false;
      let t0 = 0;
      registerCancel(() => { cancelled = true; cancelAnimationFrame(frame); });

      function animate() {
        if (cancelled) return;
        const elapsed = performance.now() - t0;

        let allGone = true;

        for (const r of runners) {
          const localT = (elapsed - r.delay) / 1000;
          if (localT < 0) { allGone = false; continue; }

          const startX = direction === 1 ? -r.size : sw;
          const x = startX + direction * r.speed * localT;
          const gone = direction === 1 ? x > sw : x < -r.size;

          if (gone) {
            r.img.style.opacity = "0";
            continue;
          }
          allGone = false;

          const phase = localT * r.hopRate + r.hopOffset;
          const jump = Math.max(0, Math.sin(phase));
          const bounceY = -jump * r.size * 0.22;
          const scaleY = 0.92 + jump * 0.13;
          const scaleX = 1.06 - jump * 0.1;
          const flipX = direction === -1 ? -scaleX : scaleX;
          const tilt = direction * Math.sin(phase * 0.4) * 12;
          const fadeIn = localT < 0.22 ? localT / 0.22 : 1;

          r.img.style.transform =
            `translate(${x.toFixed(1)}px, ${(r.y + bounceY).toFixed(1)}px) ` +
            `scale(${flipX.toFixed(3)}, ${scaleY.toFixed(3)}) ` +
            `rotate(${tilt.toFixed(1)}deg)`;
          r.img.style.opacity = fadeIn.toFixed(3);
        }

        if (allGone && elapsed > 500) {
          cancelAnimationFrame(frame);
          removeOverlay();
          return;
        }
        frame = requestAnimationFrame(animate);
      }

      // Pre-decode the first few runners' images so the initial enters aren't
      // stalled by synchronous raster work on the first paint. Capped at 150ms
      // so we never block longer than a couple of frames.
      const criticalDecodes = runners.slice(0, 6).map((r) =>
        r.img.decode ? r.img.decode().catch(() => {}) : Promise.resolve()
      );
      const maxWait = new Promise<void>((r) => setTimeout(r, 150));
      Promise.race([Promise.all(criticalDecodes).then(() => {}), maxWait]).then(() => {
        if (cancelled) return;
        t0 = performance.now(); // anchor animation clock AFTER decode
        frame = requestAnimationFrame(animate);
      });

      dismissTimeout = setTimeout(() => {
        cancelAnimationFrame(frame);
        removeOverlay();
      }, 8200);
    }


    // ===== Rain: many small pets fall from top =====
    function startRain(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth;
      const count = 18;
      for (let i = 0; i < count; i++) {
        const wrapper = document.createElement("div");
        const img = document.createElement("img");
        img.src = payload.imageDataUrl;
        const size = 60 + Math.random() * 60;
        const x = Math.random() * Math.max(0, sw - size);
        const delay = Math.random() * 1800;
        const duration = 2800 + Math.random() * 1800;
        const rot = (Math.random() - 0.5) * 30;
        wrapper.style.cssText = `
          position: fixed;
          left: ${x}px; top: -${size + 20}px;
          width: ${size}px; height: ${size}px;
          animation: pmRainFall ${duration}ms ${delay}ms linear forwards;
          will-change: transform, opacity;
        `;
        img.style.cssText = `
          width: 100%; height: 100%;
          object-fit: contain;
          transform: rotate(${rot}deg);
          filter: drop-shadow(0 4px 6px rgba(0,0,0,0.18));
        `;
        wrapper.appendChild(img);
        container.appendChild(wrapper);
      }
      dismissTimeout = setTimeout(() => removeOverlay(), 5500);
    }

    // ===== Parade: pets march across screen bobbing up and down =====
    function startParade(container: HTMLElement, payload: NotificationPayload): void {
      const count = 5;
      const sh = window.innerHeight;
      const y = sh * 0.7;
      const marchDuration = 7000;
      for (let i = 0; i < count; i++) {
        const wrapper = document.createElement("div");
        const img = document.createElement("img");
        img.src = payload.imageDataUrl;
        const size = 110 + Math.random() * 40;
        const delay = i * 500;
        wrapper.style.cssText = `
          position: fixed;
          top: ${y - size / 2}px; left: -${size}px;
          width: ${size}px; height: ${size}px;
          animation: pmMarch ${marchDuration}ms ${delay}ms linear forwards;
          will-change: transform;
        `;
        img.style.cssText = `
          width: 100%; height: 100%;
          object-fit: contain;
          animation: pmBob 0.55s ${delay}ms ease-in-out infinite;
          filter: drop-shadow(0 6px 10px rgba(0,0,0,0.25));
        `;
        wrapper.appendChild(img);
        container.appendChild(wrapper);
      }
      dismissTimeout = setTimeout(() => removeOverlay(), marchDuration + count * 500 + 600);
    }

    // ===== Peekaboo: pet slides in from a random edge or corner =====
    //   - 8 entry directions (4 edges + 4 diagonal corners)
    //   - For edge entries, the along-edge position is randomized per run
    //     (e.g. from the left, the Y level varies)
    //   - JS transition controls the slide so we can compute the hide offset
    //     based on actual screen geometry (one formula instead of 8 keyframes)
    function startPeekaboo(container: HTMLElement, payload: NotificationPayload): void {
      const size = 200;
      const sw = window.innerWidth, sh = window.innerHeight;

      const directions = [
        "left", "right", "top", "bottom",
        "top-left", "top-right", "bottom-left", "bottom-right",
      ] as const;
      const dir = directions[Math.floor(Math.random() * directions.length)];

      const mX = size * 0.3;
      const mY = size * 0.3;
      const hideMargin = 20;
      const rand = (min: number, max: number) => min + Math.random() * Math.max(0, max - min);

      let visX = 0, visY = 0, outX = 0, outY = 0;
      switch (dir) {
        case "left":
          visX = mX;
          visY = rand(mY, sh - mY - size);
          outX = -(visX + size + hideMargin);
          break;
        case "right":
          visX = sw - mX - size;
          visY = rand(mY, sh - mY - size);
          outX = sw - visX + hideMargin;
          break;
        case "top":
          visX = rand(mX, sw - mX - size);
          visY = mY;
          outY = -(visY + size + hideMargin);
          break;
        case "bottom":
          visX = rand(mX, sw - mX - size);
          visY = sh - mY - size;
          outY = sh - visY + hideMargin;
          break;
        case "top-left":
          visX = mX;       visY = mY;
          outX = -(visX + size + hideMargin);
          outY = -(visY + size + hideMargin);
          break;
        case "top-right":
          visX = sw - mX - size; visY = mY;
          outX = sw - visX + hideMargin;
          outY = -(visY + size + hideMargin);
          break;
        case "bottom-left":
          visX = mX;       visY = sh - mY - size;
          outX = -(visX + size + hideMargin);
          outY = sh - visY + hideMargin;
          break;
        case "bottom-right":
          visX = sw - mX - size; visY = sh - mY - size;
          outX = sw - visX + hideMargin;
          outY = sh - visY + hideMargin;
          break;
      }

      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        position: fixed;
        left: ${visX}px; top: ${visY}px;
        width: ${size}px; height: ${size}px;
        transform: translate(${outX}px, ${outY}px);
        will-change: transform;
      `;
      const img = document.createElement("img");
      img.src = payload.imageDataUrl;
      img.style.cssText = `
        width: 100%; height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 8px 14px rgba(0,0,0,0.3));
      `;
      wrapper.appendChild(img);
      container.appendChild(wrapper);

      const timers: ReturnType<typeof setTimeout>[] = [];
      let cancelled = false;
      registerCancel(() => {
        cancelled = true;
        for (const t of timers) clearTimeout(t);
      });

      // Slide in
      timers.push(setTimeout(() => {
        if (cancelled) return;
        wrapper.style.transition = "transform 0.55s cubic-bezier(.25, 1.1, .4, 1)";
        wrapper.style.transform = "translate(0, 0)";
      }, 100));

      // Wiggle after settling
      timers.push(setTimeout(() => {
        if (cancelled) return;
        img.style.animation = "pmWiggle 0.4s ease-in-out 3";
      }, 900));

      // Slide back out (same direction)
      timers.push(setTimeout(() => {
        if (cancelled) return;
        wrapper.style.transition = "transform 0.5s cubic-bezier(.5, 0, .75, 0)";
        wrapper.style.transform = `translate(${outX}px, ${outY}px)`;
      }, 2700));

      dismissTimeout = setTimeout(() => removeOverlay(), 3400);
    }

    // ===== Bounce: wall-bouncing dog with asymmetric running gait =====
    //   - Asymmetric hop cycle (half airborne, half grounded) instead of a
    //     smooth sinusoidal bob — gives a real "hop-pause-hop" rhythm.
    //   - On ground: squished flat (scaleX > 1, scaleY < 1) with strong shadow.
    //   - At peak: stretched tall (scaleY > 1, scaleX < 1) with faint shadow.
    //   - Tilt swings ±45° at half the hop frequency → alternating legs feel.
    //   - Origin at bottom-center so feet stay planted through squash/stretch.
    function startBounce(container: HTMLElement, payload: NotificationPayload): void {
      const size = 150;
      const sw = window.innerWidth, sh = window.innerHeight;

      const wrapper = document.createElement("div");
      wrapper.style.cssText = `
        position: fixed; left: 0; top: 0;
        width: ${size}px; height: ${size + 14}px;
        pointer-events: none;
        will-change: transform;
      `;
      const img = document.createElement("img");
      img.src = payload.imageDataUrl;
      img.style.cssText = `
        display: block;
        width: ${size}px; height: ${size}px;
        object-fit: contain;
        transform-origin: 50% 100%;
        filter: drop-shadow(0 6px 10px rgba(0,0,0,0.22));
        will-change: transform;
      `;
      const shadow = document.createElement("div");
      shadow.style.cssText = `
        position: absolute;
        left: 15%;
        top: ${size - 4}px;
        width: 70%;
        height: 12px;
        background: radial-gradient(ellipse, rgba(0,0,0,0.28) 0%, transparent 70%);
        will-change: transform, opacity;
      `;
      wrapper.appendChild(img);
      wrapper.appendChild(shadow);
      container.appendChild(wrapper);

      let x = Math.random() * (sw - size);
      let y = Math.random() * (sh - size - 14);
      const SPEED = 5.5;
      const a = (Math.random() * 0.6 + 0.3) * (Math.random() < 0.5 ? 1 : -1);
      let vx = Math.cos(a) * SPEED;
      let vy = Math.sin(a) * SPEED;
      let bouncePhase = 0;
      let frame: number;
      let cancelled = false;
      const duration = 10000;
      const t0 = performance.now();
      registerCancel(() => { cancelled = true; cancelAnimationFrame(frame); });

      function animate() {
        if (cancelled) return;
        const elapsed = performance.now() - t0;
        x += vx; y += vy;
        if (x <= 0) { x = 0; vx = Math.abs(vx); }
        else if (x + size >= sw) { x = sw - size; vx = -Math.abs(vx); }
        if (y <= 0) { y = 0; vy = Math.abs(vy); }
        else if (y + size + 14 >= sh) { y = sh - size - 14; vy = -Math.abs(vy); }

        const currentSpeed = Math.sqrt(vx * vx + vy * vy);
        bouncePhase += currentSpeed * 0.05;
        const t = bouncePhase % (Math.PI * 2);
        // Asymmetric hop: jump=0 during the "ground" half of the cycle, then
        // a smooth arc up to 1 and back down for the "airborne" half.
        const jump = Math.max(0, Math.sin(t));
        const bounceY = -jump * 55;               // higher jumps (was 24)
        const scaleY = 0.9 + jump * 0.15;         // 0.9 ground → 1.05 peak
        const scaleX = 1.08 - jump * 0.12;        // 1.08 ground → 0.96 peak
        const shadowScale = 1 - jump * 0.55;
        const shadowOpacity = Math.max(0.15, 0.85 - jump * 0.55);
        const tiltDeg = Math.sin(bouncePhase * 0.4) * 45;

        wrapper.style.transform = `translate(${x}px, ${y + bounceY}px)`;
        img.style.transform = `rotate(${tiltDeg}deg) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
        shadow.style.transform = `scaleX(${(shadowScale * 0.9 + 0.1).toFixed(3)})`;
        shadow.style.opacity = shadowOpacity.toFixed(3);

        if (elapsed < duration) frame = requestAnimationFrame(animate);
      }
      frame = requestAnimationFrame(animate);
      dismissTimeout = setTimeout(() => {
        cancelled = true;
        cancelAnimationFrame(frame);
        wrapper.style.transition = "opacity 0.6s";
        wrapper.style.opacity = "0";
        setTimeout(removeOverlay, 600);
      }, duration);
    }

    // ===== Popcorn: pets pop up from bottom with arcing motion =====
    function startPopcorn(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      const count = 14;
      const pets: HTMLImageElement[] = [];
      const states: Array<{
        x: number; y: number; vx: number; vy: number;
        rot: number; rotVel: number; delay: number; startT: number | null;
        size: number;
      }> = [];
      for (let i = 0; i < count; i++) {
        const img = document.createElement("img");
        img.src = payload.imageDataUrl;
        const size = 80 + Math.random() * 55;
        const startX = Math.random() * (sw - size);
        img.style.cssText = `
          position: fixed;
          left: 0; top: 0;
          width: ${size}px; height: ${size}px;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.22));
          will-change: transform, opacity;
          opacity: 0;
          transform: translate(${startX}px, ${sh + size}px);
        `;
        container.appendChild(img);
        pets.push(img);
        states.push({
          x: startX,
          y: sh + size,
          vx: (Math.random() - 0.5) * 4,
          vy: -(18 + Math.random() * 10),
          rot: 0,
          rotVel: (Math.random() - 0.5) * 12,
          delay: Math.random() * 2200,
          startT: null,
          size,
        });
      }
      let frame: number;
      let cancelled = false;
      const t0 = performance.now();
      const gravity = 0.55;
      const duration = 4800;
      registerCancel(() => { cancelled = true; cancelAnimationFrame(frame); });
      function animate() {
        if (cancelled) return;
        const now = performance.now();
        const t = now - t0;
        if (t > duration) { cancelAnimationFrame(frame); removeOverlay(); return; }
        for (let i = 0; i < count; i++) {
          const s = states[i];
          if (t < s.delay) continue;
          if (s.startT === null) s.startT = now;
          s.vy += gravity;
          s.x += s.vx;
          s.y += s.vy;
          s.rot += s.rotVel;
          const localT = now - s.startT;
          const opacity = localT < 200 ? localT / 200 : s.y > sh + s.size ? 0 : 1;
          pets[i].style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg)`;
          pets[i].style.opacity = `${opacity}`;
        }
        frame = requestAnimationFrame(animate);
      }
      frame = requestAnimationFrame(animate);
      dismissTimeout = setTimeout(() => { cancelAnimationFrame(frame); removeOverlay(); }, duration + 200);
    }

    // ===== Carousel: orbit, then unspool — pets peel off one by one from the
    // break point and fly off to the right in sequence =====
    function startCarousel(container: HTMLElement, payload: NotificationPayload): void {
      const count = 6;
      const sw = window.innerWidth, sh = window.innerHeight;
      const cx = sw / 2, cy = sh / 2;
      const radius = Math.min(sw, sh) * 0.28;
      const size = 130;
      const pets: HTMLImageElement[] = [];
      for (let i = 0; i < count; i++) {
        const img = document.createElement("img");
        img.src = payload.imageDataUrl;
        img.style.cssText = `
          position: fixed;
          left: 0; top: 0;
          width: ${size}px; height: ${size}px;
          object-fit: contain;
          filter: drop-shadow(0 6px 12px rgba(0,0,0,0.22));
          will-change: transform, opacity;
          opacity: 0;
        `;
        container.appendChild(img);
        pets.push(img);
      }

      const phase1End = 3000;           // orbit duration before the break
      const ω1 = (2 * Math.PI) / 3500;  // slow orbit speed (rad/ms)
      const ω2 = (2 * Math.PI) / 900;   // accelerated unspool speed
      // Randomized break direction — each run, pets peel off toward a random
      // angle around the clock face.
      const breakAngle = Math.random() * 2 * Math.PI;
      const exitSpeedPx = 1100;         // px/s after detaching
      const exitVx = Math.cos(breakAngle) * exitSpeedPx;
      const exitVy = Math.sin(breakAngle) * exitSpeedPx;
      const fadeInDuration = 600;

      // Pre-compute each pet's exact detach time: when its running angle
      // next crosses the break angle during phase 2.
      const detachTimes: number[] = [];
      for (let i = 0; i < count; i++) {
        const initial = (i / count) * 2 * Math.PI;
        const atPhase1End = initial + phase1End * ω1;
        let offset = (atPhase1End - breakAngle) % (2 * Math.PI);
        if (offset < 0) offset += 2 * Math.PI;
        const remaining = 2 * Math.PI - offset; // always in (0, 2π]
        detachTimes[i] = phase1End + remaining / ω2;
      }

      // Cumulative orbit angle given piecewise speed
      const cumulativeAngle = (t: number) =>
        t <= phase1End ? t * ω1 : phase1End * ω1 + (t - phase1End) * ω2;

      const detached = new Array<boolean>(count).fill(false);
      const detachState = pets.map(() => ({
        x: 0, y: 0, vx: 0, vy: 0, rot: 0, detachT: 0,
      }));

      let frame: number;
      let cancelled = false;
      const t0 = performance.now();
      registerCancel(() => { cancelled = true; cancelAnimationFrame(frame); });

      function animate() {
        if (cancelled) return;
        const t = performance.now() - t0;
        const fadeIn = Math.min(1, t / fadeInDuration);
        const baseRot = cumulativeAngle(t);

        let allGone = true;

        for (let i = 0; i < count; i++) {
          if (detached[i]) {
            const s = detachState[i];
            const dt = t - s.detachT;
            const x = s.x + (s.vx * dt) / 1000;
            const y = s.y + (s.vy * dt) / 1000;
            const offscreen =
              x < -size * 2 || x > sw + size * 2 ||
              y < -size * 2 || y > sh + size * 2;
            if (!offscreen) allGone = false;
            pets[i].style.transform = `translate(${x}px, ${y}px) rotate(${s.rot}deg)`;
            pets[i].style.opacity = offscreen ? "0" : "1";
          } else if (t >= detachTimes[i]) {
            detached[i] = true;
            const x = cx + Math.cos(breakAngle) * radius - size / 2;
            const y = cy + Math.sin(breakAngle) * radius - size / 2;
            // Face the exit direction so the pet flies nose-first
            const facingDeg = (breakAngle * 180) / Math.PI;
            detachState[i] = {
              x, y,
              vx: exitVx, vy: exitVy,
              rot: facingDeg,
              detachT: t,
            };
            allGone = false;
            pets[i].style.transform = `translate(${x}px, ${y}px) rotate(${facingDeg}deg)`;
            pets[i].style.opacity = "1";
          } else {
            allGone = false;
            const angle = (i / count) * 2 * Math.PI + baseRot;
            const x = cx + Math.cos(angle) * radius - size / 2;
            const y = cy + Math.sin(angle) * radius - size / 2;
            pets[i].style.transform = `translate(${x}px, ${y}px) rotate(${(angle * 180) / Math.PI}deg)`;
            pets[i].style.opacity = `${fadeIn}`;
          }
        }

        if (allGone) { cancelAnimationFrame(frame); removeOverlay(); return; }
        frame = requestAnimationFrame(animate);
      }
      frame = requestAnimationFrame(animate);
      // Safety cap
      dismissTimeout = setTimeout(() => { cancelAnimationFrame(frame); removeOverlay(); }, 7500);
    }

    // ===== Photo Booth Strip: 4 vertical photos flash-captured in sequence =====
    function startPhotoBooth(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const cellSize = 150;
      const cellGap = 10;
      const stripPadding = 14;
      const stripW = cellSize + stripPadding * 2;
      const stripH = 4 * cellSize + 3 * cellGap + stripPadding * 2;
      const cellCount = 4;

      // Pick 4 distinct photos if available, otherwise repeat pool
      const pool: string[] = ((payload as any).swarmImageUrls as string[] | undefined)
        ?.filter(Boolean) ?? [];
      if (pool.length === 0) pool.push(payload.imageDataUrl);
      const shuffled = pool.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const photos: string[] = [];
      for (let i = 0; i < cellCount; i++) {
        photos.push(shuffled[i % shuffled.length]);
      }

      const bottomBrandingHeight = 48; // extra black space below the 4 cells
      const stripHWithBranding = stripH + bottomBrandingHeight;

      const strip = document.createElement("div");
      strip.style.cssText = `
        position: fixed;
        left: ${(sw - stripW) / 2}px;
        top: ${(sh - stripHWithBranding) / 2}px;
        width: ${stripW}px;
        height: ${stripHWithBranding}px;
        background: #0a0a0a;
        padding: ${stripPadding}px ${stripPadding}px ${bottomBrandingHeight + stripPadding}px;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: ${cellGap}px;
        box-shadow: 10px 14px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04);
        border-radius: 4px;
        opacity: 0;
        transform: rotate(0deg) scale(0.95);
        transition: opacity 0.25s ease-out, transform 0.55s cubic-bezier(.3,1.3,.5,1);
        will-change: transform, opacity;
      `;

      const cells: HTMLDivElement[] = [];
      for (let i = 0; i < cellCount; i++) {
        const cell = document.createElement("div");
        cell.style.cssText = `
          width: ${cellSize}px;
          height: ${cellSize}px;
          background: #eaf2f8;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: inset 0 0 0 3px rgba(255,255,255,0.7);
          border-radius: 1px;
        `;
        strip.appendChild(cell);
        cells.push(cell);
      }

      // Bottom branding area (photo booth strip style)
      const d = new Date();
      const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
      const branding = document.createElement("div");
      branding.style.cssText = `
        position: absolute;
        left: 0;
        bottom: 0;
        width: 100%;
        height: ${bottomBrandingHeight}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 2px;
        pointer-events: none;
      `;
      branding.innerHTML = `
        <div style="
          font-family: 'Courier New', ui-monospace, monospace;
          font-size: 11px;
          letter-spacing: 3px;
          color: rgba(255,255,255,0.85);
          font-weight: 700;
        ">P E T M O O D</div>
        <div style="
          font-family: 'Courier New', ui-monospace, monospace;
          font-size: 9px;
          letter-spacing: 2px;
          color: rgba(255,255,255,0.5);
        ">${dateStr}</div>
      `;
      strip.appendChild(branding);

      container.appendChild(strip);

      const timers: ReturnType<typeof setTimeout>[] = [];
      let cancelled = false;
      registerCancel(() => {
        cancelled = true;
        for (const t of timers) clearTimeout(t);
      });

      // Strip fade-in
      requestAnimationFrame(() => {
        strip.style.opacity = "1";
        strip.style.transform = "rotate(0deg) scale(1)";
      });

      // Flash + reveal each cell in sequence.
      // A fresh flash div is created per capture so we get a CLEAN CSS
      // keyframe run every time — precise peak timing, no leftover transition
      // state, no interference between consecutive captures.
      //
      // Keyframe timing (pmCameraFlash, 520ms):
      //   0%  opacity 0
      //   17% opacity 1    ← peak reached at 88ms
      //   22% opacity 1    ← short hold at peak (88~114ms)
      //   100% opacity 0   ← smooth fade to transparent
      // Photo opacity snap happens at 100ms → lands inside the peak hold
      // window, so the photo is fully rendered *under* the white flash and
      // emerges as the flash fades away.
      const firstDelay = 380;
      const cellInterval = 700;
      const flashDuration = 520;
      const photoSnapMs = 100;
      for (let i = 0; i < cellCount; i++) {
        const delay = firstDelay + i * cellInterval;
        timers.push(setTimeout(() => {
          if (cancelled) return;

          // Fresh flash element — CSS animation runs exactly once, precisely.
          const flash = document.createElement("div");
          flash.style.cssText = `
            position: fixed;
            left: 0; top: 0;
            width: 100vw; height: 100vh;
            background: rgba(255, 245, 225, 0.5);
            pointer-events: none;
            opacity: 0;
            animation: pmCameraFlash ${flashDuration}ms ease-out forwards;
            will-change: opacity;
          `;
          container.appendChild(flash);

          // Pre-place the photo (invisible) during the flash rise.
          const img = document.createElement("img");
          img.src = photos[i];
          const rot = (Math.random() - 0.5) * 12;
          const tx = (Math.random() - 0.5) * 10;
          const ty = (Math.random() - 0.5) * 10;
          img.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
            transform: translate(${tx.toFixed(1)}%, ${ty.toFixed(1)}%) scale(1.95) rotate(${rot.toFixed(1)}deg);
            transform-origin: 50% 50%;
            opacity: 0;
          `;
          cells[i].appendChild(img);

          // At flash peak-hold (100ms), snap photo to full visibility.
          timers.push(setTimeout(() => {
            if (cancelled) return;
            img.style.opacity = "1";
          }, photoSnapMs));

          // Flash auto-removes once its keyframe finishes
          timers.push(setTimeout(() => flash.remove(), flashDuration + 40));
        }, delay));
      }

      const finalCaptureAt = firstDelay + (cellCount - 1) * cellInterval;
      timers.push(setTimeout(() => {
        strip.style.transform = "rotate(-4deg) scale(1)";
      }, finalCaptureAt + 300));

      const holdDuration = 2000;
      const fadeOutAt = finalCaptureAt + 300 + holdDuration;
      timers.push(setTimeout(() => {
        strip.style.transition = "opacity 0.5s ease-in, transform 0.5s ease-in";
        strip.style.opacity = "0";
        strip.style.transform = "rotate(-4deg) scale(0.88) translateY(20px)";
      }, fadeOutAt));

      dismissTimeout = setTimeout(() => {
        for (const t of timers) clearTimeout(t);
        removeOverlay();
      }, fadeOutAt + 650);
    }

    // ===== Float: many pets drift upward like balloons, swaying =====
    function startFloat(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth;
      const count = 14;
      for (let i = 0; i < count; i++) {
        const wrapper = document.createElement("div");
        const img = document.createElement("img");
        img.src = payload.imageDataUrl;
        const size = 70 + Math.random() * 60;
        const startX = Math.random() * Math.max(0, sw - size);
        const delay = Math.random() * 2400;
        const duration = 4200 + Math.random() * 1800;
        const swayDir = Math.random() < 0.5 ? 1 : -1;
        const swayAmp = 30 + Math.random() * 40;
        wrapper.style.cssText = `
          position: fixed;
          left: ${startX}px;
          bottom: -${size + 20}px;
          width: ${size}px; height: ${size}px;
          will-change: transform, opacity;
        `;
        // Animate vertical rise on wrapper
        wrapper.style.animation = `pmFloatRise ${duration}ms ${delay}ms ease-in forwards`;
        // Animate horizontal sway on the img itself
        img.style.cssText = `
          width: 100%; height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
          animation: pmFloatSway ${1800 + Math.random() * 800}ms ${delay}ms ease-in-out infinite;
          --sway-dir: ${swayDir};
          --sway-amp: ${swayAmp}px;
        `;
        wrapper.appendChild(img);
        container.appendChild(wrapper);
      }
      dismissTimeout = setTimeout(() => removeOverlay(), 7000);
    }

    // ===== Teleport: pet flashes between random positions with glow =====
    // State-machine chain of setTimeouts (not rAF) — flicker is intentional.
    // Each hop accelerates slightly; final hop holds longer.
    function startTeleport(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const size = 170;
      const hops = 7;

      const img = document.createElement("img");
      img.src = payload.imageDataUrl;
      img.style.cssText = `
        position: fixed;
        left: 0; top: 0;
        width: ${size}px; height: ${size}px;
        object-fit: contain;
        opacity: 0;
        transform: translate(0, 0) scale(1);
        will-change: transform, opacity, filter;
      `;

      // Pre-generate all hop positions so we don't repeat
      const positions: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < hops; i++) {
        positions.push({
          x: Math.random() * (sw - size),
          y: Math.random() * (sh - size),
        });
      }

      let idx = 0;
      let cancelled = false;
      const chain: ReturnType<typeof setTimeout>[] = [];
      registerCancel(() => {
        cancelled = true;
        for (const t of chain) clearTimeout(t);
      });

      const step = () => {
        if (cancelled) return;
        if (idx >= positions.length) {
          // Final fade out
          img.style.transition = "opacity 0.35s, transform 0.35s, filter 0.35s";
          img.style.opacity = "0";
          img.style.filter = "drop-shadow(0 0 40px rgba(180,120,255,1))";
          img.style.transform = `translate(${positions[positions.length - 1].x}px, ${positions[positions.length - 1].y}px) scale(1.3)`;
          chain.push(setTimeout(() => removeOverlay(), 420));
          return;
        }
        const pos = positions[idx];
        // Appear: from slightly bigger → settle, with glow
        img.style.transition = "none";
        img.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(1.4)`;
        img.style.opacity = "0";
        img.style.filter = "drop-shadow(0 0 28px rgba(180,120,255,1)) drop-shadow(0 0 56px rgba(120,180,255,0.6))";
        // Force reflow so the transition starts cleanly
        void img.offsetHeight;
        img.style.transition = "opacity 0.08s ease-out, transform 0.16s ease-out, filter 0.22s";
        img.style.opacity = "1";
        img.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(1)`;

        // Hold duration: later hops are slightly faster for accelerating feel
        const isLast = idx === positions.length - 1;
        const hold = isLast ? 900 : 260 - idx * 18;

        chain.push(
          setTimeout(() => {
            if (isLast) {
              idx++;
              step();
              return;
            }
            // Flash out: brief but visible
            img.style.transition = "opacity 0.09s, filter 0.09s";
            img.style.opacity = "0";
            img.style.filter = "drop-shadow(0 0 44px rgba(180,120,255,1))";
            chain.push(
              setTimeout(() => {
                idx++;
                step();
              }, 95)
            );
          }, hold)
        );
      };

      container.appendChild(img);
      const insert = () => {
        chain.push(setTimeout(step, 80));
      };
      if (img.decode) img.decode().then(insert).catch(insert);
      else insert();

      dismissTimeout = setTimeout(() => {
        for (const t of chain) clearTimeout(t);
        removeOverlay();
      }, 6000);
    }

    // ===== Tornado: pets spiral upward in a vortex =====
    function startTornado(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const cx = sw / 2;
      const count = 18;
      const pets: HTMLImageElement[] = [];
      const states: Array<{
        size: number; delay: number; initialAngle: number;
        rotVelMul: number; radiusMul: number;
      }> = [];
      for (let i = 0; i < count; i++) {
        const img = document.createElement("img");
        img.src = payload.imageDataUrl;
        const size = 70 + Math.random() * 50;
        img.style.cssText = `
          position: fixed;
          left: 0; top: 0;
          width: ${size}px; height: ${size}px;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
          will-change: transform, opacity;
          opacity: 0;
        `;
        container.appendChild(img);
        pets.push(img);
        states.push({
          size,
          delay: Math.random() * 1200,
          initialAngle: Math.random() * Math.PI * 2,
          rotVelMul: 0.8 + Math.random() * 0.6,
          radiusMul: 0.75 + Math.random() * 0.5,
        });
      }
      let frame: number;
      let cancelled = false;
      let t0 = 0;
      const duration = 5000;
      const lifespan = 3400;
      registerCancel(() => { cancelled = true; cancelAnimationFrame(frame); });
      function animate() {
        if (cancelled) return;
        const t = performance.now() - t0;
        if (t > duration) { cancelAnimationFrame(frame); removeOverlay(); return; }
        for (let i = 0; i < count; i++) {
          const s = states[i];
          const localT = t - s.delay;
          if (localT < 0) continue;
          const p = Math.min(1, localT / lifespan);
          if (p >= 1) { pets[i].style.opacity = "0"; continue; }
          // Spiral up: y rises, radius narrows near top
          const angle = s.initialAngle + p * Math.PI * 4 * s.rotVelMul;
          const y = sh + 40 - p * (sh + 80) - s.size / 2;
          const baseR = sw * 0.22 * s.radiusMul;
          const radius = baseR * (1 - p * 0.75);
          const x = cx + Math.cos(angle) * radius - s.size / 2;
          const spin = angle * 60;
          const opacity = p < 0.12 ? p / 0.12 : p > 0.85 ? (1 - p) / 0.15 : 1;
          pets[i].style.transform = `translate(${x}px, ${y}px) rotate(${spin}deg)`;
          pets[i].style.opacity = `${opacity}`;
        }
        frame = requestAnimationFrame(animate);
      }
      // All 18 pets share the same source image — a single decode primes the
      // browser cache for every subsequent <img>. Wait up to 120ms so the
      // first paint doesn't stall mid-animation.
      const decodePromise = pets[0].decode().catch(() => {});
      const maxWait = new Promise<void>((r) => setTimeout(r, 120));
      Promise.race([decodePromise, maxWait]).then(() => {
        if (cancelled) return;
        t0 = performance.now();
        frame = requestAnimationFrame(animate);
      });
      dismissTimeout = setTimeout(() => { cancelAnimationFrame(frame); removeOverlay(); }, duration + 300);
    }

    // ============================================================
    //  Shared helper: resolve a shuffled image pool from the payload
    // ============================================================
    function getImagePool(payload: NotificationPayload): string[] {
      const pool: string[] =
        ((payload as any).swarmImageUrls as string[] | undefined)?.filter(Boolean) ?? [];
      if (pool.length === 0) pool.push(payload.imageDataUrl);
      const copy = pool.slice();
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    }

    // ===== Domino fall: pets stand in a line, first tips → cascade =====
    function startDominoFall(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const count = 7;
      const size = 120;
      const floorY = sh * 0.7 + size / 2;
      const spacing = (sw - size) / (count + 1);
      const pool = getImagePool(payload);

      const pets: HTMLImageElement[] = [];
      const floor = document.createElement("div");
      floor.style.cssText = `
        position: fixed;
        left: 0; top: ${floorY + 2}px;
        width: 100vw; height: 2px;
        background: rgba(0,0,0,0.15);
      `;
      container.appendChild(floor);

      for (let i = 0; i < count; i++) {
        const x = spacing * (i + 1);
        const img = document.createElement("img");
        img.src = pool[i % pool.length];
        img.style.cssText = `
          position: fixed;
          left: ${x}px;
          top: ${floorY - size}px;
          width: ${size}px;
          height: ${size}px;
          object-fit: contain;
          transform-origin: 100% 100%;
          filter: drop-shadow(0 6px 10px rgba(0,0,0,0.25));
          opacity: 0;
          transform: scale(0.92);
          transition: opacity 0.3s, transform 0.3s cubic-bezier(.2,1.4,.4,1);
          will-change: transform, opacity;
        `;
        container.appendChild(img);
        pets.push(img);
      }

      const timers: ReturnType<typeof setTimeout>[] = [];
      let cancelled = false;
      registerCancel(() => { cancelled = true; for (const t of timers) clearTimeout(t); });

      // Phase 1: pets pop in from left to right
      pets.forEach((pet, i) => {
        timers.push(setTimeout(() => {
          if (cancelled) return;
          pet.style.opacity = "1";
          pet.style.transform = "scale(1)";
        }, 60 + i * 70));
      });

      // Phase 2: cascade fall (one by one, like dominoes)
      const cascadeStart = 60 + count * 70 + 350;
      const cascadeStep = 140;
      pets.forEach((pet, i) => {
        timers.push(setTimeout(() => {
          if (cancelled) return;
          pet.style.transition = "transform 0.35s cubic-bezier(.55, 0, .95, .4)";
          pet.style.transform = "rotate(90deg)";
        }, cascadeStart + i * cascadeStep));
      });

      // Phase 3: linger + fade out
      const cascadeEnd = cascadeStart + count * cascadeStep + 400;
      timers.push(setTimeout(() => {
        if (cancelled) return;
        pets.forEach((p) => {
          p.style.transition = "opacity 0.5s ease-in";
          p.style.opacity = "0";
        });
        floor.style.transition = "opacity 0.5s";
        floor.style.opacity = "0";
      }, cascadeEnd + 600));

      dismissTimeout = setTimeout(() => removeOverlay(), cascadeEnd + 1300);
    }

    // ===== Trampoline: pet bounces higher and higher, exits up =====
    function startTrampoline(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const size = 150;
      const floorY = sh - 60;
      const cx = sw / 2;

      // Trampoline
      const tramp = document.createElement("div");
      tramp.style.cssText = `
        position: fixed;
        left: ${cx - 160}px;
        top: ${floorY}px;
        width: 320px; height: 14px;
        background: linear-gradient(180deg, #5b5b5b 0%, #2a2a2a 60%, #111 100%);
        border-radius: 8px;
        box-shadow: 0 6px 14px rgba(0,0,0,0.35);
        transform-origin: 50% 0%;
        will-change: transform;
      `;
      container.appendChild(tramp);
      // Legs
      const leftLeg = document.createElement("div");
      leftLeg.style.cssText = `
        position: fixed; left: ${cx - 150}px; top: ${floorY + 10}px;
        width: 6px; height: 40px; background: #333; border-radius: 3px;
        transform: rotate(-6deg); transform-origin: 50% 0%;
      `;
      const rightLeg = document.createElement("div");
      rightLeg.style.cssText = `
        position: fixed; left: ${cx + 144}px; top: ${floorY + 10}px;
        width: 6px; height: 40px; background: #333; border-radius: 3px;
        transform: rotate(6deg); transform-origin: 50% 0%;
      `;
      container.appendChild(leftLeg);
      container.appendChild(rightLeg);

      // Pet
      const pet = document.createElement("img");
      pet.src = payload.imageDataUrl;
      pet.style.cssText = `
        position: fixed;
        left: ${cx - size/2}px;
        top: ${floorY - size}px;
        width: ${size}px; height: ${size}px;
        object-fit: contain;
        transform-origin: 50% 100%;
        filter: drop-shadow(0 10px 14px rgba(0,0,0,0.25));
        will-change: transform;
      `;
      container.appendChild(pet);

      // Bounce schedule: progressively higher; the last one LAUNCHES off-screen
      // (ease-out rise, no return to floor).
      const bounces = [
        { height: 140,        duration: 700,  exit: false },
        { height: 280,        duration: 900,  exit: false },
        { height: 500,        duration: 1100, exit: false },
        { height: sh + size,  duration: 1200, exit: true  }, // shoots off top
      ];
      let frame: number;
      let cancelled = false;
      let t0 = 0;
      registerCancel(() => { cancelled = true; cancelAnimationFrame(frame); });

      function animate() {
        if (cancelled) return;
        const elapsed = performance.now() - t0;
        // Find current bounce
        let cum = 0;
        let bi = 0;
        for (; bi < bounces.length; bi++) {
          if (elapsed < cum + bounces[bi].duration) break;
          cum += bounces[bi].duration;
        }
        if (bi >= bounces.length) { cancelAnimationFrame(frame); removeOverlay(); return; }
        const b = bounces[bi];
        const local = (elapsed - cum) / b.duration; // 0→1
        // Motion curve — exit bounce uses ease-out up-only (never returns).
        const arc = b.exit
          ? 1 - Math.pow(1 - local, 2)   // 0 → 1 (decelerating rise)
          : 4 * local * (1 - local);     // 0 → 1 → 0 (bounce with return)
        const petRise = b.height * arc;
        // Contact squash (takeoff + landing). On exit bounce, only the takeoff squash.
        const contact = b.exit
          ? Math.max(0, 1 - local * 3.5)                        // only at start
          : Math.max(0, 1 - Math.min(local, 1 - local) * 3.5);  // both ends
        const scaleY = 1 - contact * 0.25 + arc * 0.05;
        const scaleX = 1 + contact * 0.18 - arc * 0.04;
        const rot = b.exit
          ? local * 180                                  // free rotation on exit
          : Math.sin(local * Math.PI * 2) * 20;          // normal mid-air wobble
        pet.style.transform = `translateY(-${petRise.toFixed(1)}px) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`;
        // Trampoline dip on contact (only for non-exit bounces, at both ends)
        tramp.style.transform = `scaleY(${(1 - contact * 0.6).toFixed(3)}) translateY(${(contact * 6).toFixed(1)}px)`;
        frame = requestAnimationFrame(animate);
      }
      if (pet.decode) pet.decode().catch(() => {}).then(() => {
        if (cancelled) return; t0 = performance.now(); frame = requestAnimationFrame(animate);
      }); else { t0 = performance.now(); frame = requestAnimationFrame(animate); }
      dismissTimeout = setTimeout(() => { cancelAnimationFrame(frame); removeOverlay(); }, 4500);
    }

    // ===== Bowling: ball rolls into pin formation (pure CSS transitions) =====
    //   Physics moved from rAF-per-frame math to one-shot CSS transitions.
    //   The browser compositor handles the interpolation on the GPU so there's
    //   no JS work during the scatter — eliminates the impact-moment jank.
    function startBowling(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const ballSize = 110;
      const pinSize = 90;
      const laneY = sh * 0.55;
      const pool = getImagePool(payload);

      const pinLayout = [
        { dx: 0,   dy: 0 },
        { dx: 60,  dy: -55 },
        { dx: 60,  dy: 55 },
        { dx: 120, dy: -110 },
        { dx: 120, dy: 0 },
        { dx: 120, dy: 110 },
      ];
      const pinX0 = sw * 0.72;
      type Pin = {
        el: HTMLImageElement;
        scatterAngle: number;
        scatterDist: number;
        rotDeg: number;
      };
      const pins: Pin[] = [];
      pinLayout.forEach((p, i) => {
        const x = pinX0 + p.dx;
        const y = laneY + p.dy;
        const img = document.createElement("img");
        img.src = pool[(i + 1) % pool.length];
        img.style.cssText = `
          position: fixed;
          left: ${x - pinSize/2}px; top: ${y - pinSize/2}px;
          width: ${pinSize}px; height: ${pinSize}px;
          object-fit: contain;
          filter: drop-shadow(0 6px 10px rgba(0,0,0,0.25));
          transform: translate(0, 0) rotate(0deg);
          will-change: transform, opacity;
        `;
        container.appendChild(img);
        const baseAngle = Math.atan2(p.dy, p.dx);
        const forwardAngle = (Math.atan2(p.dy, p.dx + 60) + baseAngle) / 2;
        pins.push({
          el: img,
          scatterAngle: forwardAngle + (Math.random() - 0.5) * 0.45,
          scatterDist: 480 + Math.random() * 220,
          rotDeg: (Math.random() - 0.5) * 540,
        });
      });

      // Ball
      const ball = document.createElement("img");
      ball.src = pool[0];
      ball.style.cssText = `
        position: fixed;
        left: 0; top: ${laneY - ballSize/2}px;
        width: ${ballSize}px; height: ${ballSize}px;
        object-fit: contain;
        filter: drop-shadow(0 6px 12px rgba(0,0,0,0.3));
        transform: translate(-${ballSize}px, 0) rotate(0deg);
        transition: transform 1.2s cubic-bezier(.3, 0, .7, .4);
        will-change: transform, opacity;
      `;
      container.appendChild(ball);

      const timers: ReturnType<typeof setTimeout>[] = [];
      let cancelled = false;
      registerCancel(() => { cancelled = true; for (const t of timers) clearTimeout(t); });

      const rollEndX = pinX0 - pinSize * 0.6;

      // Decode upfront so the CSS transitions aren't stalled by raster
      const decodes = [ball, ...pins.map((p) => p.el)].map((e) =>
        e.decode ? e.decode().catch(() => {}) : Promise.resolve()
      );
      const waitCap = new Promise<void>((r) => setTimeout(r, 180));
      Promise.race([Promise.all(decodes).then(() => {}), waitCap]).then(() => {
        if (cancelled) return;

        // Phase 1: ball rolls toward the pins (1.2s)
        requestAnimationFrame(() => {
          ball.style.transform = `translate(${rollEndX.toFixed(0)}px, 0) rotate(1000deg)`;
        });

        // Phase 2: impact — ball continues + pins scatter, all via CSS
        timers.push(setTimeout(() => {
          if (cancelled) return;
          // Ball flies past & fades
          ball.style.transition =
            "transform 0.9s cubic-bezier(.25, 0, .75, .4), opacity 0.9s ease-in";
          ball.style.transform =
            `translate(${(sw + ballSize).toFixed(0)}px, 120px) rotate(1900deg)`;
          ball.style.opacity = "0";
          // Pins scatter outward with gravity-biased vertical drop
          for (const pin of pins) {
            const endDx = Math.cos(pin.scatterAngle) * pin.scatterDist;
            const endDy = Math.sin(pin.scatterAngle) * pin.scatterDist + 420; // +fall
            const dur = 0.85 + Math.random() * 0.2;
            pin.el.style.transition =
              `transform ${dur}s cubic-bezier(.35, 0, .85, .35), opacity ${dur}s ease-in`;
            pin.el.style.transform =
              `translate(${endDx.toFixed(0)}px, ${endDy.toFixed(0)}px) rotate(${pin.rotDeg.toFixed(0)}deg)`;
            pin.el.style.opacity = "0";
          }
        }, 1200));
      });

      dismissTimeout = setTimeout(() => removeOverlay(), 2500);
    }

    // ===== Fireworks (sparkle): twinkling stars + pet photos across the screen =====
    function startFireworks(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const pool = getImagePool(payload);
      const timers: ReturnType<typeof setTimeout>[] = [];
      let cancelled = false;
      registerCancel(() => {
        cancelled = true;
        for (const t of timers) clearTimeout(t);
      });

      const colors = [
        "rgba(255, 220, 120, 1)", // gold
        "rgba(255, 150, 200, 1)", // pink
        "rgba(150, 220, 255, 1)", // cyan
        "rgba(220, 180, 255, 1)", // lavender
        "rgba(255, 255, 255, 1)", // white
        "rgba(180, 255, 190, 1)", // mint
      ];

      // Pet "sparkle stars" — pet photos with a glowing halo that pop & fade.
      const petCount = 24;
      const pets: HTMLImageElement[] = [];
      for (let i = 0; i < petCount; i++) {
        const size = 70 + Math.random() * 55;
        const x = Math.random() * (sw - size);
        const y = Math.random() * (sh - size);
        const color = colors[Math.floor(Math.random() * colors.length)];
        const delay = Math.random() * 3800;
        const duration = 1430 + Math.random() * 910;
        const rotStart = (Math.random() - 0.5) * 20;
        const rotEnd = rotStart + (Math.random() - 0.5) * 16;

        const pet = document.createElement("img");
        pet.src = pool[i % pool.length];
        // Single drop-shadow (was 2) — halves filter cost per pet
        pet.style.cssText = `
          position: fixed;
          left: ${x}px; top: ${y}px;
          width: ${size}px; height: ${size}px;
          object-fit: contain;
          filter: drop-shadow(0 0 22px ${color});
          opacity: 0;
          transform: scale(0.3) rotate(${rotStart}deg);
          pointer-events: none;
          transition:
            opacity ${(duration / 2).toFixed(0)}ms ease-out,
            transform ${duration}ms cubic-bezier(.3, 1.1, .4, 1);
        `;
        container.appendChild(pet);
        pets.push(pet);

        // Fade in + scale up
        timers.push(setTimeout(() => {
          if (cancelled) return;
          pet.style.opacity = "1";
          pet.style.transform = `scale(1) rotate(${rotEnd}deg)`;
        }, delay));
        // Fade out near end
        timers.push(setTimeout(() => {
          if (cancelled) return;
          pet.style.transition = `opacity ${(duration / 2).toFixed(0)}ms ease-in, transform ${(duration / 2).toFixed(0)}ms ease-in`;
          pet.style.opacity = "0";
          pet.style.transform = `scale(0.6) rotate(${rotEnd + (Math.random() - 0.5) * 20}deg)`;
        }, delay + duration / 2));
      }

      // Pure sparkle dots — small, lightweight, no will-change (many of them)
      const dotCount = 24;
      for (let i = 0; i < dotCount; i++) {
        const size = 18 + Math.random() * 36;
        const x = Math.random() * (sw - size);
        const y = Math.random() * (sh - size);
        const color = colors[Math.floor(Math.random() * colors.length)];
        const delay = Math.random() * 3200;
        const duration = 500 + Math.random() * 500;

        const dot = document.createElement("div");
        dot.style.cssText = `
          position: fixed;
          left: ${x}px; top: ${y}px;
          width: ${size}px; height: ${size}px;
          background: radial-gradient(circle, ${color} 0%, ${color.replace(", 1)", ", 0.4)")} 35%, transparent 65%);
          opacity: 0;
          transform: scale(0.3);
          pointer-events: none;
          transition: opacity ${(duration / 2).toFixed(0)}ms ease-out, transform ${duration}ms ease-out;
        `;
        container.appendChild(dot);

        timers.push(setTimeout(() => {
          if (cancelled) return;
          dot.style.opacity = "1";
          dot.style.transform = "scale(1.3)";
        }, delay));
        timers.push(setTimeout(() => {
          if (cancelled) return;
          dot.style.transition = `opacity ${(duration / 2).toFixed(0)}ms ease-in, transform ${(duration / 2).toFixed(0)}ms ease-in`;
          dot.style.opacity = "0";
          dot.style.transform = "scale(0.5)";
        }, delay + duration / 2));
      }

      // Decode first 6 pet images upfront so the initial burst doesn't stall
      const decodes = pets.slice(0, 6).map((p) =>
        p.decode ? p.decode().catch(() => {}) : Promise.resolve()
      );
      const waitCap = new Promise<void>((r) => setTimeout(r, 120));
      Promise.race([Promise.all(decodes).then(() => {}), waitCap]).then(() => {
        // decode priming only; nothing else to do here since each pet's animation
        // is a pure CSS transition scheduled by its own setTimeout.
      });

      dismissTimeout = setTimeout(() => removeOverlay(), 7200);
    }

    // ===== Kiss: two pets meet + overflowing heart storm =====
    function startKiss(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const size = 180;
      const cx = sw / 2, cy = sh / 2;
      const pool = getImagePool(payload);

      // Heart parametric curve. y is math-up; flipped when projecting to screen.
      // The heart is SPLIT down the middle and shifted ±SPLIT_DX so the two halves
      // never overlap — each pet traces its own half from lobe peak to bottom tip.
      const ANCHOR_OFFSET = 60;
      const HEART_BOTTOM_Y = -17;
      const HEART_SCALE = Math.max(4, Math.min(11, (cy + ANCHOR_OFFSET - 30) / 30));
      const SPLIT_DX = 50;

      function heartScreen(s: number, side: -1 | 1) {
        const hx = 16 * Math.pow(Math.sin(s), 3);
        const hy = 13 * Math.cos(s) - 5 * Math.cos(2 * s) - 2 * Math.cos(3 * s) - Math.cos(4 * s);
        return {
          x: cx + HEART_SCALE * hx + side * SPLIT_DX,
          y: cy + ANCHOR_OFFSET - HEART_SCALE * (hy - HEART_BOTTOM_Y),
        };
      }

      // Numerically the lobe peak (max math-y) sits around s ≈ 0.95 on the right
      // and 2π − 0.95 on the left — slightly past π/4 (cleaner constants but the
      // peak is the truer "topmost point" the user asked for).
      const sA0 = 2 * Math.PI - 0.95; // left lobe peak (start)
      const sB0 = 0.95;                // right lobe peak (start)
      const sEnd = Math.PI;            // bottom tip of each half (end)
      const startA = heartScreen(sA0, -1);
      const startB = heartScreen(sB0, 1);

      const baseStyle = `
        position: fixed;
        left: 0; top: 0;
        width: ${size}px; height: ${size}px;
        object-fit: contain;
        filter: drop-shadow(0 8px 14px rgba(0,0,0,0.25));
        will-change: transform;
      `;
      const petA = document.createElement("img");
      petA.src = pool[0];
      petA.style.cssText = `${baseStyle} transform: translate(${(startA.x - size / 2).toFixed(1)}px, ${(startA.y - size / 2).toFixed(1)}px);`;
      const petB = document.createElement("img");
      petB.src = pool[Math.min(1, pool.length - 1)];
      petB.style.cssText = `${baseStyle} transform: translate(${(startB.x - size / 2).toFixed(1)}px, ${(startB.y - size / 2).toFixed(1)}px) scaleX(-1);`;
      container.appendChild(petA);
      container.appendChild(petB);

      const timers: ReturnType<typeof setTimeout>[] = [];
      const intervals: ReturnType<typeof setInterval>[] = [];
      let rafId = 0;
      let cancelled = false;
      registerCancel(() => {
        cancelled = true;
        if (rafId) cancelAnimationFrame(rafId);
        for (const t of timers) clearTimeout(t);
        for (const iv of intervals) clearInterval(iv);
      });

      const heartGlyphs = ["❤", "💕", "💖", "💗", "💘", "💞", "♥"];
      const heartColors = [
        "#ff2a52", "#ff4472", "#ff5e8a", "#ff7aa4",
        "#ff96bc", "#ffb0cd", "#ff3f69", "#e91e63",
      ];

      function spawnHeart(originX: number, originY: number) {
        const hs = 18 + Math.random() * 32;
        const heart = document.createElement("div");
        heart.textContent = heartGlyphs[Math.floor(Math.random() * heartGlyphs.length)];
        heart.style.cssText = `
          position: fixed;
          left: ${(originX + (Math.random() - 0.5) * 50).toFixed(0)}px;
          top: ${(originY - 10 + (Math.random() - 0.5) * 30).toFixed(0)}px;
          font-size: ${hs.toFixed(0)}px;
          color: ${heartColors[Math.floor(Math.random() * heartColors.length)]};
          text-shadow: 0 0 10px rgba(255,80,120,0.55), 0 2px 4px rgba(0,0,0,0.25);
          pointer-events: none;
          transform: translate(-50%, 0) scale(0.2);
          opacity: 0;
          will-change: transform, opacity;
        `;
        container.appendChild(heart);
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
        const dist = 120 + Math.random() * 260;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - Math.random() * 120;
        const swayX = (Math.random() - 0.5) * 60;
        const dur = 1200 + Math.random() * 700;
        requestAnimationFrame(() => {
          heart.style.transition =
            `transform ${dur}ms cubic-bezier(.3,.55,.4,1), opacity ${dur}ms ease-in`;
          heart.style.transform =
            `translate(calc(-50% + ${(dx + swayX).toFixed(0)}px), ${dy.toFixed(0)}px) ` +
            `scale(${(0.9 + Math.random() * 0.7).toFixed(2)}) rotate(${((Math.random() - 0.5) * 60).toFixed(0)}deg)`;
          heart.style.opacity = "1";
        });
        timers.push(setTimeout(() => { heart.style.opacity = "0"; }, dur * 0.7));
        timers.push(setTimeout(() => heart.remove(), dur + 80));
      }

      // After the trace, burst hearts at each pet's final position and drift them
      // off the bottom of the screen.
      function finishKiss(a: { x: number; y: number }, b: { x: number; y: number }) {
        for (let i = 0; i < 8; i++) spawnHeart(a.x, a.y);
        for (let i = 0; i < 8; i++) spawnHeart(b.x, b.y);
        let stream = 0;
        const streamMax = 10;
        const iv = setInterval(() => {
          if (cancelled || stream >= streamMax) { clearInterval(iv); return; }
          // 3 hearts per tick — alternate sides for left/right balance
          spawnHeart(a.x, a.y);
          spawnHeart(b.x, b.y);
          spawnHeart(stream % 2 === 0 ? a.x : b.x, stream % 2 === 0 ? a.y : b.y);
          stream++;
        }, 50);
        intervals.push(iv);

        const exitY = sh + 50;
        petA.style.transition = "transform 0.7s cubic-bezier(.4,0,.7,.3)";
        petB.style.transition = "transform 0.7s cubic-bezier(.4,0,.7,.3)";
        petA.style.transform = `translate(${(a.x - size / 2).toFixed(1)}px, ${exitY}px)`;
        petB.style.transform = `translate(${(b.x - size / 2).toFixed(1)}px, ${exitY}px) scaleX(-1)`;
      }

      // Trace down: each pet follows its own half from lobe peak to bottom tip
      const TRACE_MS = 1300;
      const traceStart = performance.now();
      function frame() {
        if (cancelled) return;
        const t = Math.min(1, (performance.now() - traceStart) / TRACE_MS);
        const ease = 1 - Math.pow(1 - t, 2);
        const sA = sA0 + (sEnd - sA0) * ease;
        const sB = sB0 + (sEnd - sB0) * ease;
        const a = heartScreen(sA, -1);
        const b = heartScreen(sB, 1);
        petA.style.transform = `translate(${(a.x - size / 2).toFixed(1)}px, ${(a.y - size / 2).toFixed(1)}px)`;
        petB.style.transform = `translate(${(b.x - size / 2).toFixed(1)}px, ${(b.y - size / 2).toFixed(1)}px) scaleX(-1)`;
        if (t < 1) {
          rafId = requestAnimationFrame(frame);
        } else {
          finishKiss(a, b);
        }
      }
      rafId = requestAnimationFrame(frame);

      // Pet exit (700ms) + heart drift (up to 1900ms) + small buffer
      dismissTimeout = setTimeout(() => removeOverlay(), TRACE_MS + 2200);
    }


    // ===== Rainbow Arc: pet flies in a parabolic arc with pastel trail =====
    function startRainbowArc(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const petSize = 140;
      const pool = getImagePool(payload);

      // Arc path parameters
      const startX = -petSize * 0.8;
      const endX = sw + petSize * 0.8;
      const midY = sh * 0.55;
      const archHeight = sh * 0.42;
      const duration = 3200;

      const rainbowColors = [
        "rgba(255, 120, 130, 0.85)",
        "rgba(255, 180,  90, 0.85)",
        "rgba(255, 230, 110, 0.85)",
        "rgba(150, 230, 150, 0.85)",
        "rgba(120, 190, 255, 0.85)",
        "rgba(200, 140, 255, 0.85)",
      ];

      const timers: ReturnType<typeof setTimeout>[] = [];
      let frame: number;
      let cancelled = false;
      let t0 = 0;
      registerCancel(() => {
        cancelled = true;
        cancelAnimationFrame(frame);
        for (const t of timers) clearTimeout(t);
      });

      // Pre-place trail dots along the arc; each fades in as the pet reaches
      // it and fades out shortly after (a rainbow tail the pet leaves behind).
      const trailCount = 28;
      for (let i = 0; i < trailCount; i++) {
        const progress = (i + 0.5) / trailCount; // 0~1
        const x = startX + (endX - startX) * progress;
        const y = midY - archHeight * 4 * progress * (1 - progress);
        const dotSize = 44 + Math.random() * 22;
        const color = rainbowColors[i % rainbowColors.length];
        const dot = document.createElement("div");
        dot.style.cssText = `
          position: fixed;
          left: ${(x - dotSize / 2).toFixed(0)}px;
          top: ${(y - dotSize / 2).toFixed(0)}px;
          width: ${dotSize.toFixed(0)}px;
          height: ${dotSize.toFixed(0)}px;
          border-radius: 50%;
          background: radial-gradient(circle, ${color} 0%, ${color.replace(", 0.85", ", 0.3")} 45%, transparent 70%);
          opacity: 0;
          transition: opacity 0.35s ease-out;
          pointer-events: none;
        `;
        container.appendChild(dot);

        const fadeInAt = progress * duration * 0.95;
        const fadeOutAt = fadeInAt + 750;
        timers.push(setTimeout(() => { if (!cancelled) dot.style.opacity = "1"; }, fadeInAt));
        timers.push(setTimeout(() => {
          if (cancelled) return;
          dot.style.transition = "opacity 0.55s ease-in";
          dot.style.opacity = "0";
        }, fadeOutAt));
      }

      // Pet (spinning as it flies)
      const pet = document.createElement("img");
      pet.src = pool[0];
      pet.style.cssText = `
        position: fixed;
        left: 0; top: 0;
        width: ${petSize}px; height: ${petSize}px;
        object-fit: contain;
        filter: drop-shadow(0 0 14px rgba(255,255,255,0.65));
        transform: translate(${(startX - petSize / 2).toFixed(0)}px, ${(midY - petSize / 2).toFixed(0)}px);
        will-change: transform;
      `;
      container.appendChild(pet);

      function animate() {
        if (cancelled) return;
        const elapsed = performance.now() - t0;
        if (elapsed > duration + 200) {
          cancelAnimationFrame(frame);
          return;
        }
        const p = Math.min(1, elapsed / duration);
        const x = startX + (endX - startX) * p;
        const y = midY - archHeight * 4 * p * (1 - p);
        // Face direction of travel (approximate tangent) by rotating with p
        const rot = p * 360;
        pet.style.transform = `translate(${(x - petSize / 2).toFixed(1)}px, ${(y - petSize / 2).toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
        frame = requestAnimationFrame(animate);
      }

      const decodePromise = pet.decode ? pet.decode().catch(() => {}) : Promise.resolve();
      const waitCap = new Promise<void>((r) => setTimeout(r, 120));
      Promise.race([decodePromise, waitCap]).then(() => {
        if (cancelled) return;
        t0 = performance.now();
        frame = requestAnimationFrame(animate);
      });

      dismissTimeout = setTimeout(() => {
        cancelAnimationFrame(frame);
        removeOverlay();
      }, duration + 1500);
    }

    // ===== Dance Party: mirror-ball club with rotating beams + disco pets =====
    function startDanceParty(container: HTMLElement, payload: NotificationPayload): void {
      const sw = window.innerWidth, sh = window.innerHeight;
      const count = 6;
      const petSize = 130;
      const pool = getImagePool(payload);
      // W-shape:
      //   P                           P   ← wings (far edges, HIGH)
      //           P         P             ← center pair (close together, MID)
      //       P                   P       ← valleys (between wings & center, LOW)
      const base     = sh - petSize - 180;
      const wingLift = Math.min(230, sh * 0.26);
      const midLift  = Math.min(95,  sh * 0.11);
      const positions = [
        { x: 50,                        y: base - wingLift },  // 0: left wing
        { x: sw * 0.19 - petSize / 2,  y: base },             // 1: left valley
        { x: sw * 0.37 - petSize / 2,  y: base - midLift },   // 2: center-left
        { x: sw * 0.57 - petSize / 2,  y: base - midLift },   // 3: center-right
        { x: sw * 0.75 - petSize / 2,  y: base },             // 4: right valley
        { x: sw - petSize - 50,        y: base - wingLift },  // 5: right wing
      ];

      const timers: ReturnType<typeof setTimeout>[] = [];
      const intervals: ReturnType<typeof setInterval>[] = [];
      let cancelled = false;
      registerCancel(() => {
        cancelled = true;
        for (const t of timers) clearTimeout(t);
        for (const iv of intervals) clearInterval(iv);
      });

      // 1. Dark vignette background (club atmosphere)
      const vignette = document.createElement("div");
      vignette.style.cssText = `
        position: fixed;
        left: 0; top: 0;
        width: 100vw; height: 100vh;
        background: radial-gradient(ellipse at center, rgba(20,8,40,0.35) 0%, rgba(0,0,0,0.7) 100%);
        opacity: 0;
        transition: opacity 0.4s ease-out;
        pointer-events: none;
      `;
      container.appendChild(vignette);
      requestAnimationFrame(() => { vignette.style.opacity = "1"; });

      // 2. Two rotating conic-gradient beam layers (at different speeds, opposite directions)
      const beams1 = document.createElement("div");
      beams1.style.cssText = `
        position: fixed;
        left: 50%; top: 120px;
        width: 260vmax; height: 260vmax;
        margin-left: -130vmax; margin-top: -130vmax;
        background: conic-gradient(
          from 0deg,
          rgba(255, 80, 180, 0.22) 0deg,  transparent 22deg,
          rgba(100, 200, 255, 0.22) 45deg, transparent 67deg,
          rgba(255, 220, 100, 0.22) 90deg, transparent 112deg,
          rgba(140, 255, 160, 0.22) 135deg, transparent 157deg,
          rgba(200, 140, 255, 0.22) 180deg, transparent 202deg,
          rgba(255, 130, 130, 0.22) 225deg, transparent 247deg,
          rgba(120, 255, 240, 0.22) 270deg, transparent 292deg,
          rgba(255, 180,  80, 0.22) 315deg, transparent 337deg
        );
        animation: pmDiscoBeams 8s linear infinite;
        pointer-events: none;
      `;
      container.appendChild(beams1);

      const beams2 = document.createElement("div");
      beams2.style.cssText = `
        position: fixed;
        left: 50%; top: 120px;
        width: 260vmax; height: 260vmax;
        margin-left: -130vmax; margin-top: -130vmax;
        background: conic-gradient(
          from 30deg,
          rgba(255, 255, 255, 0.14) 0deg, transparent 12deg,
          rgba(255, 200, 240, 0.14) 60deg, transparent 72deg,
          rgba(200, 255, 255, 0.14) 120deg, transparent 132deg,
          rgba(255, 240, 180, 0.14) 180deg, transparent 192deg,
          rgba(255, 180, 200, 0.14) 240deg, transparent 252deg,
          rgba(180, 220, 255, 0.14) 300deg, transparent 312deg
        );
        animation: pmDiscoBeams2 5s linear infinite;
        pointer-events: none;
      `;
      container.appendChild(beams2);

      // 3. Mirror ball at top center
      const ballSize = 85;
      const ballWrap = document.createElement("div");
      ballWrap.style.cssText = `
        position: fixed;
        left: ${(sw / 2 - ballSize / 2).toFixed(0)}px;
        top: 40px;
        width: ${ballSize}px; height: ${ballSize}px;
        filter: drop-shadow(0 0 30px rgba(255,255,255,0.6)) drop-shadow(0 0 60px rgba(180,200,255,0.4));
        animation: pmBallSwing 2.4s ease-in-out infinite alternate;
      `;
      // Ball body
      const ball = document.createElement("div");
      ball.style.cssText = `
        position: absolute; inset: 0;
        border-radius: 50%;
        background:
          radial-gradient(circle at 30% 28%, #fff 0%, #dce0e8 12%, #9ba0ac 38%, #525862 72%, #2a2d35 100%);
        overflow: hidden;
      `;
      // Facet grid overlay (makes it look like a disco ball)
      const facets = document.createElement("div");
      facets.style.cssText = `
        position: absolute; inset: 0;
        border-radius: 50%;
        background:
          repeating-linear-gradient(0deg,   rgba(0,0,0,0.18) 0 1px, transparent 1px ${(ballSize/8).toFixed(1)}px),
          repeating-linear-gradient(90deg,  rgba(0,0,0,0.18) 0 1px, transparent 1px ${(ballSize/8).toFixed(1)}px),
          repeating-linear-gradient(45deg,  rgba(255,255,255,0.07) 0 1px, transparent 1px 10px);
        mix-blend-mode: overlay;
        animation: pmBallShimmer 1.6s linear infinite;
      `;
      // Hanging string
      const string = document.createElement("div");
      string.style.cssText = `
        position: fixed;
        left: ${(sw / 2 - 1).toFixed(0)}px;
        top: 0;
        width: 2px; height: 45px;
        background: linear-gradient(180deg, rgba(200,200,220,0.3), rgba(200,200,220,0.6));
      `;
      ball.appendChild(facets);
      ballWrap.appendChild(ball);
      container.appendChild(string);
      container.appendChild(ballWrap);

      // 4. Random sparkle flashes around the scene (mirror-ball reflections)
      const sparkleColors = ["#fff", "#ffe4f5", "#e4f5ff", "#fff5e4"];
      const sparkleIv = setInterval(() => {
        if (cancelled) { clearInterval(sparkleIv); return; }
        for (let k = 0; k < 3; k++) {
          const size = 8 + Math.random() * 22;
          const sp = document.createElement("div");
          sp.style.cssText = `
            position: fixed;
            left: ${(Math.random() * (sw - size)).toFixed(0)}px;
            top: ${(Math.random() * (sh - size)).toFixed(0)}px;
            width: ${size.toFixed(0)}px; height: ${size.toFixed(0)}px;
            border-radius: 50%;
            background: radial-gradient(circle, ${sparkleColors[Math.floor(Math.random() * sparkleColors.length)]} 0%, transparent 70%);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.12s ease-out, transform 0.4s ease-out;
            transform: scale(0.4);
          `;
          container.appendChild(sp);
          requestAnimationFrame(() => {
            sp.style.opacity = "1";
            sp.style.transform = "scale(1.3)";
          });
          timers.push(setTimeout(() => {
            sp.style.transition = "opacity 0.35s ease-in";
            sp.style.opacity = "0";
          }, 180));
          timers.push(setTimeout(() => sp.remove(), 650));
        }
      }, 90);
      intervals.push(sparkleIv);

      // 5. Pets with VARIED dance moves (each gets its own style)
      // Moves: 0=bop, 1=spin, 2=slide, 3=scalePulse
      const moves = ["pmMoveBop", "pmMoveSpin", "pmMoveSlide", "pmMoveScale", "pmMoveNod", "pmMoveShimmy"];
      for (let i = 0; i < count; i++) {
        const { x, y } = positions[i];
        const pet = document.createElement("img");
        pet.src = pool[i % pool.length];
        const moveName = moves[i % moves.length];
        pet.style.cssText = `
          position: fixed;
          left: ${x.toFixed(0)}px;
          top: ${y.toFixed(0)}px;
          width: ${petSize}px; height: ${petSize}px;
          object-fit: contain;
          transform-origin: 50% 100%;
          filter: drop-shadow(0 8px 14px rgba(0,0,0,0.4));
          opacity: 0;
          transition: opacity 0.35s ease-out;
          animation: ${moveName} ${(0.5 + Math.random() * 0.2).toFixed(2)}s ${(i * 0.09).toFixed(2)}s ease-in-out infinite;
          will-change: transform, opacity;
        `;
        container.appendChild(pet);
        timers.push(setTimeout(() => { if (!cancelled) pet.style.opacity = "1"; }, 100));
        timers.push(setTimeout(() => {
          if (cancelled) return;
          pet.style.transition = "opacity 0.4s ease-in";
          pet.style.opacity = "0";
        }, 5200));
      }

      dismissTimeout = setTimeout(() => removeOverlay(), 5900);
    }

    function removeOverlay(): void {
      // Cancel any in-flight rAF loops and pending setTimeouts from previous
      // animations BEFORE tearing down the DOM — prevents CPU leaks when
      // users rapid-fire through the test buttons.
      for (const fn of cancelFns) { try { fn(); } catch {} }
      cancelFns.length = 0;
      if (dismissTimeout) { clearTimeout(dismissTimeout); dismissTimeout = null; }
      document.getElementById(SHADOW_HOST_ID)?.remove();
    }

    function getStyles(): string {
      return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .pm-container {
          position: fixed; top: 0; left: 0;
          width: 100vw; height: 100vh;
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ===== Bubble (notification) ===== */
        .pm-notif {
          position: fixed;
          display: flex; flex-direction: column; align-items: center;
          animation: pmFadeIn 0.3s ease-out;
        }

        .pm-bubble, .pm-run-bubble {
          position: relative;
          background: #fff;
          padding: 12px 20px;
          font-size: 14px; color: #111; font-weight: 700;
          letter-spacing: -0.2px; line-height: 1.5;
          max-width: 220px;
          border: 3.5px solid #111;
          border-radius: 38% 48% 42% 52% / 52% 38% 48% 42%;
          filter: url(#pmw);
          box-shadow: 5px 5px 0px #111;
          transform: rotate(-1.5deg);
          margin-bottom: 46px;
        }

        .pm-bubble p, .pm-run-bubble p {
          word-break: keep-all; text-align: center;
        }

        .pm-d1, .pm-d2 {
          position: absolute; background: #fff;
          border: 3.5px solid #111;
          filter: url(#pmw);
          box-shadow: 3px 3px 0px #111;
        }
        .pm-d1 { width: 17px; height: 14px; bottom: -26px; left: 36%; border-radius: 55% 45% 50% 50%; }
        .pm-d2 { width: 11px; height: 10px; bottom: -44px; left: 41%; border-radius: 50%; }

        .pm-pet, .pm-run-pet {
          width: 150px; height: 150px;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
        }

        @keyframes pmFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ===== Running ===== */
        .pm-runner {
          position: fixed;
          display: flex; flex-direction: column; align-items: center;
          will-change: transform;
          transition: opacity 1.2s ease-out;
        }

        .pm-run-bubble {
          white-space: normal;
          word-break: keep-all;
          overflow-wrap: break-word;
          opacity: 1;
        }
        .pm-run-bubble p { transition: opacity 0.2s; }

        .pm-shadow {
          width: 70px; height: 12px;
          background: radial-gradient(ellipse, rgba(0,0,0,0.12) 0%, transparent 70%);
          border-radius: 50%;
          margin-top: -4px;
        }

        .pm-caught .pm-run-pet {
          animation: pmCaughtShake 0.4s ease-in-out;
        }
        @keyframes pmCaughtShake {
          0%, 100% { transform: rotate(0deg); }
          20% { transform: rotate(-8deg); }
          40% { transform: rotate(8deg); }
          60% { transform: rotate(-4deg); }
          80% { transform: rotate(4deg); }
        }

        /* ===== Swarm ===== */
        .pm-swarm-pet { backface-visibility: hidden; }

        /* ===== Rain ===== */
        @keyframes pmRainFall {
          0% { transform: translateY(0); opacity: 0; }
          10%, 90% { opacity: 1; }
          100% { transform: translateY(calc(100vh + 200px)); opacity: 0; }
        }

        /* ===== Parade ===== */
        @keyframes pmMarch {
          from { transform: translateX(0); }
          to { transform: translateX(calc(100vw + 200px)); }
        }
        @keyframes pmBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        /* ===== Peekaboo wiggle (slide in/out handled by JS transitions) ===== */
        @keyframes pmWiggle {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-6deg); }
          75% { transform: rotate(6deg); }
        }

        /* ===== Dance Party — Mirror ball club ===== */
        @keyframes pmDiscoBeams {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pmDiscoBeams2 {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes pmBallSwing {
          from { transform: translateX(-8px) rotate(-4deg); }
          to   { transform: translateX( 8px) rotate( 4deg); }
        }
        @keyframes pmBallShimmer {
          0%   { background-position: 0 0, 0 0, 0 0; }
          100% { background-position: 12px 0, 0 12px, 14px 14px; }
        }
        /* Dance moves */
        @keyframes pmMoveBop {
          0%, 100% { transform: translateY(0)    scale(1.06, 0.94); }
          50%      { transform: translateY(-48px) scale(0.94, 1.08); }
        }
        @keyframes pmMoveSpin {
          0%, 100% { transform: translateY(0)    rotate(0deg)   scale(1.02, 0.98); }
          25%      { transform: translateY(-24px) rotate(180deg) scale(0.98, 1.02); }
          50%      { transform: translateY(0)    rotate(360deg) scale(1.02, 0.98); }
          75%      { transform: translateY(-24px) rotate(540deg) scale(0.98, 1.02); }
        }
        @keyframes pmMoveSlide {
          0%, 100% { transform: translateX(-18px) translateY(-6px) rotate(-5deg); }
          50%      { transform: translateX( 18px) translateY(-6px) rotate( 5deg); }
        }
        @keyframes pmMoveScale {
          0%, 100% { transform: translateY(-8px) scale(0.88, 1.1); }
          50%      { transform: translateY(0)    scale(1.15, 0.88); }
        }
        @keyframes pmMoveNod {
          0%, 100% { transform: rotate(-7deg); }
          50%      { transform: rotate(7deg); }
        }
        @keyframes pmMoveShimmy {
          0%, 100% { transform: translateX(-12px); }
          50%      { transform: translateX(12px); }
        }

        /* ===== Photo Booth camera flash ===== */
        @keyframes pmCameraFlash {
          0%   { opacity: 0; }
          17%  { opacity: 1; }
          22%  { opacity: 1; }
          100% { opacity: 0; }
        }

        /* ===== Float ===== */
        @keyframes pmFloatRise {
          0%   { transform: translateY(0);                      opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(calc(-100vh - 200px));   opacity: 0; }
        }
        @keyframes pmFloatSway {
          0%, 100% { transform: translateX(calc(var(--sway-amp, 30px) * var(--sway-dir, 1) * -0.5)); }
          50%      { transform: translateX(calc(var(--sway-amp, 30px) * var(--sway-dir, 1) *  0.5)); }
        }

      `;
    }
  },
});
