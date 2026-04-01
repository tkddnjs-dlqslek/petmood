import type { PetMoodMessage } from "../../lib/messages/protocol";
import type { NotificationPayload } from "../../types";

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",

  main() {
    const SHADOW_HOST_ID = "petmood-overlay-host";
    let dismissTimeout: ReturnType<typeof setTimeout> | null = null;

    chrome.runtime.onMessage.addListener(
      (message: PetMoodMessage, _sender, sendResponse) => {
        if (message.type === "SHOW_NOTIFICATION") {
          showOverlay(message.payload);
          sendResponse({ success: true });
        } else if (message.type === "DISMISS_NOTIFICATION") {
          removeOverlay();
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

      // SVG filter
      const svg = document.createElement("div");
      svg.innerHTML = `<svg style="position:absolute;width:0;height:0;"><defs>
        <filter id="pmw"><feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="3" seed="2" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/></filter>
      </defs></svg>`;
      shadow.appendChild(svg);

      const container = document.createElement("div");
      container.className = "pm-container";
      shadow.appendChild(container);

      if (payload.displayType === "running") {
        startRunning(container, payload);
      } else {
        showBubble(container, payload);
      }
    }

    // ===== Bubble =====
    function showBubble(container: HTMLElement, payload: NotificationPayload): void {
      const el = document.createElement("div");
      el.className = "pm-notif";
      el.innerHTML = `
        <div class="pm-bubble"><p>${payload.message}</p><div class="pm-d1"></div><div class="pm-d2"></div></div>
        <img class="pm-pet" src="${payload.imageDataUrl}" />
      `;

      const x = Math.floor(Math.random() * (window.innerWidth - 300));
      const y = Math.floor(Math.random() * (window.innerHeight - 320));
      el.style.left = `${Math.max(20, x)}px`;
      el.style.top = `${Math.max(20, y)}px`;
      el.style.pointerEvents = "auto";
      el.style.cursor = "pointer";
      el.addEventListener("click", () => removeOverlay());

      container.appendChild(el);
      dismissTimeout = setTimeout(() => removeOverlay(), payload.durationSeconds * 1000);
    }

    // ===== Running (wall-bounce + catch/escape) =====
    function startRunning(container: HTMLElement, payload: NotificationPayload): void {
      const runner = document.createElement("div");
      runner.className = "pm-runner";
      runner.innerHTML = `
        <div class="pm-run-bubble"><p>${payload.message}</p><div class="pm-d1"></div><div class="pm-d2"></div></div>
        <div class="pm-pet-wrap"><img class="pm-run-pet" src="${payload.imageDataUrl}" /></div>
        <div class="pm-shadow"></div>
      `;
      container.appendChild(runner);

      const pet = runner.querySelector(".pm-run-pet") as HTMLElement;
      const bubble = runner.querySelector(".pm-run-bubble") as HTMLElement;
      const bubbleP = bubble.querySelector("p") as HTMLElement;
      const shadowEl = runner.querySelector(".pm-shadow") as HTMLElement;

      const SPEED = 7;
      const PET_W = 120, PET_H = 120, BUBBLE_OFFSET = 90;
      const sw = window.innerWidth, sh = window.innerHeight;

      // Random start angle & position
      const angle = (Math.random() * 0.8 + 0.2) * (Math.random() < 0.5 ? 1 : -1);
      let vx = Math.cos(angle) * SPEED;
      let vy = Math.sin(angle) * SPEED;
      let x = Math.random() * (sw - PET_W - 100) + 50;
      let y = Math.random() * (sh - PET_H - BUBBLE_OFFSET - 100) + 50;
      let bouncePhase = 0;
      let dialogueTimer = 0;
      let wallHitCount = 0;
      let caught = false;
      let frame: number;
      const DIALOGUE_INTERVAL = 180;

      // Bubble helpers
      function setBubbleText(text: string) {
        bubbleP.textContent = text;
      }
      function showBubbleTemp(text: string, duration = 2500) {
        setBubbleText(text);
        bubble.classList.add("show");
        setTimeout(() => bubble.classList.remove("show"), duration);
      }

      // Running dialogues (from messages.json, injected at build)
      const runLines = (payload as any).runLines ?? ["Catch me if you can!"];
      const bounceLines = (payload as any).bounceLines ?? ["Boing!"];
      const caughtLines = (payload as any).caughtLines ?? ["Oh no... you got me..."];
      const escapedLines = (payload as any).escapedLines ?? ["Hehehe~ can't catch me!"];
      const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

      // Initial dialogue
      runner.style.pointerEvents = "auto";
      runner.style.cursor = "pointer";
      setTimeout(() => showBubbleTemp(pick(runLines)), 200);

      // Blink effect (disappear briefly every 3s)
      const blinkTimer = setInterval(() => {
        if (caught) return;
        runner.style.opacity = "0";
        runner.style.transition = "opacity 0.12s";
        setTimeout(() => {
          if (caught) return;
          runner.style.opacity = "1";
          setTimeout(() => { runner.style.transition = "opacity 1.2s ease-out"; }, 50);
        }, 300);
      }, 3000);

      // Caught!
      runner.addEventListener("click", () => {
        if (caught) return;
        caught = true;
        clearInterval(blinkTimer);
        runner.style.transition = "none";
        runner.style.opacity = "1";

        setBubbleText(pick(caughtLines));
        bubble.classList.add("show");
        runner.classList.add("pm-caught");

        setTimeout(() => {
          runner.style.transition = "opacity 1.2s ease-out";
          runner.style.opacity = "0";
          setTimeout(() => removeOverlay(), 1200);
        }, 2000);
      });

      // Animation loop
      function animate() {
        if (caught) return;
        dialogueTimer++;

        x += vx;
        y += vy;

        // Wall collision (bounce)
        const petX = x, petY = y + BUBBLE_OFFSET;
        let hitWall = false;

        if (petX <= 0) { x = 0; vx = Math.abs(vx); hitWall = true; }
        else if (petX + PET_W >= sw) { x = sw - PET_W; vx = -Math.abs(vx); hitWall = true; }
        if (petY <= 0) { y = -BUBBLE_OFFSET; vy = Math.abs(vy); hitWall = true; }
        else if (petY + PET_H >= sh) { y = sh - PET_H - BUBBLE_OFFSET; vy = -Math.abs(vy); hitWall = true; }

        if (hitWall) {
          wallHitCount++;
          if (wallHitCount % 3 === 0) showBubbleTemp(pick(bounceLines), 1500);
        }

        // Bounce (spring jump)
        const currentSpeed = Math.sqrt(vx * vx + vy * vy);
        bouncePhase += currentSpeed * 0.028;
        const t = bouncePhase % (Math.PI * 2);
        const jump = (1 - Math.cos(t)) * 0.5;
        const bounceY = -jump * 28;
        const scaleY = 1 - jump * 0.04;
        const shadowScale = 1 - jump * 0.35;

        runner.style.transform = `translate(${x}px, ${y + bounceY}px)`;
        pet.style.transform = `scaleY(${scaleY})`;
        shadowEl.style.transform = `scaleX(${shadowScale * 0.9 + 0.1})`;
        shadowEl.style.opacity = `${shadowScale * 0.8 + 0.2}`;

        // Periodic dialogue
        if (dialogueTimer > DIALOGUE_INTERVAL) {
          dialogueTimer = 0;
          showBubbleTemp(pick(runLines));
        }

        frame = requestAnimationFrame(animate);
      }

      frame = requestAnimationFrame(animate);
      dismissTimeout = setTimeout(() => {
        if (!caught) {
          showBubbleTemp(pick(escapedLines), 1500);
          setTimeout(() => {
            runner.style.transition = "opacity 0.8s";
            runner.style.opacity = "0";
            setTimeout(() => removeOverlay(), 800);
          }, 1500);
        }
        cancelAnimationFrame(frame);
        clearInterval(blinkTimer);
      }, 20000);
    }

    function removeOverlay(): void {
      if (dismissTimeout) { clearTimeout(dismissTimeout); dismissTimeout = null; }
      document.getElementById(SHADOW_HOST_ID)?.remove();
      chrome.runtime.sendMessage({ type: "NOTIFICATION_DISMISSED" }).catch(() => {});
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
          width: 120px; height: 120px;
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
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.4s;
        }
        .pm-run-bubble.show { opacity: 1; }

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
      `;
    }
  },
});
