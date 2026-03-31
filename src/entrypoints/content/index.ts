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
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
      `;
      document.documentElement.appendChild(host);

      const shadow = host.attachShadow({ mode: "closed" });
      const style = document.createElement("style");
      style.textContent = getOverlayStyles();
      shadow.appendChild(style);

      // SVG filter for wobbly bubble
      const svgFilter = document.createElement("div");
      svgFilter.innerHTML = `
        <svg style="position:absolute;width:0;height:0;">
          <defs>
            <filter id="petmood-wobble">
              <feTurbulence type="turbulence" baseFrequency="0.015" numOctaves="3" seed="2" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
        </svg>`;
      shadow.appendChild(svgFilter);

      const container = document.createElement("div");
      container.className = "petmood-container";
      shadow.appendChild(container);

      if (payload.displayType === "running") {
        startRunningAnimation(container, payload);
      } else {
        showBubbleNotification(container, payload);
      }
    }

    // ===== Bubble Notification =====
    function showBubbleNotification(
      container: HTMLElement,
      payload: NotificationPayload
    ): void {
      const notification = document.createElement("div");
      notification.className = "petmood-notification";
      notification.innerHTML = `
        <div class="petmood-bubble">
          <p>${payload.message}</p>
          <div class="petmood-dot d1"></div>
          <div class="petmood-dot d2"></div>
        </div>
        <img class="petmood-pet" src="${payload.imageDataUrl}" />
      `;

      const x = Math.floor(Math.random() * (window.innerWidth - 300));
      const y = Math.floor(Math.random() * (window.innerHeight - 320));
      notification.style.left = `${Math.max(20, x)}px`;
      notification.style.top = `${Math.max(20, y)}px`;

      notification.style.pointerEvents = "auto";
      notification.style.cursor = "pointer";
      notification.addEventListener("click", () => removeOverlay());

      container.appendChild(notification);

      dismissTimeout = setTimeout(
        () => removeOverlay(),
        payload.durationSeconds * 1000
      );
    }

    // ===== Running Animation =====
    function startRunningAnimation(
      container: HTMLElement,
      payload: NotificationPayload
    ): void {
      const runner = document.createElement("div");
      runner.className = "petmood-runner";
      runner.innerHTML = `
        <div class="petmood-run-bubble">
          <p>${payload.message}</p>
          <div class="petmood-dot d1"></div>
          <div class="petmood-dot d2"></div>
        </div>
        <img class="petmood-run-pet" src="${payload.imageDataUrl}" />
      `;
      container.appendChild(runner);

      let x = -180;
      let stepCount = 0;
      let caught = false;
      let frame: number;
      const screenW = window.innerWidth;
      const speed = 4.5;
      const baseY = window.innerHeight * 0.5;

      let goingUp = true;
      let zigzagY = 0;
      const zigzagRange = 90;
      const zigzagSpeed = 2.5;

      runner.style.pointerEvents = "auto";
      runner.style.cursor = "pointer";

      const pet = runner.querySelector(".petmood-run-pet") as HTMLElement;

      runner.addEventListener("click", () => {
        if (caught) return;
        caught = true;
        const bubble = runner.querySelector(".petmood-run-bubble p");
        if (bubble) bubble.textContent = "아이고고... 잡혔다...";
        runner.style.transition = "opacity 1.5s ease-out";
        setTimeout(() => {
          runner.style.opacity = "0";
          setTimeout(() => removeOverlay(), 1500);
        }, 800);
      });

      function animate() {
        if (caught) return;

        x += speed;
        stepCount++;

        if (goingUp) {
          zigzagY -= zigzagSpeed;
          if (zigzagY <= -zigzagRange) goingUp = false;
        } else {
          zigzagY += zigzagSpeed;
          if (zigzagY >= zigzagRange) goingUp = true;
        }

        // Bounce animation (탄성 바운스)
        const t = (stepCount % 25) / 25;
        const bounceY = -Math.abs(Math.sin(t * Math.PI)) * 25;
        const currentY = baseY + zigzagY + bounceY;

        runner.style.left = `${x}px`;
        runner.style.top = `${currentY}px`;

        if (x > screenW + 100) {
          const bubble = runner.querySelector(".petmood-run-bubble p");
          if (bubble) bubble.textContent = "우헤헿 안 잡혔당~";
          setTimeout(() => {
            runner.style.transition = "opacity 0.8s";
            runner.style.opacity = "0";
            setTimeout(() => removeOverlay(), 800);
          }, 300);
          return;
        }

        frame = requestAnimationFrame(animate);
      }

      frame = requestAnimationFrame(animate);

      dismissTimeout = setTimeout(() => {
        cancelAnimationFrame(frame);
        removeOverlay();
      }, 15000);
    }

    function removeOverlay(): void {
      if (dismissTimeout) {
        clearTimeout(dismissTimeout);
        dismissTimeout = null;
      }
      document.getElementById(SHADOW_HOST_ID)?.remove();
      chrome.runtime.sendMessage({ type: "NOTIFICATION_DISMISSED" }).catch(() => {});
    }

    function getOverlayStyles(): string {
      return `
        * { margin: 0; padding: 0; box-sizing: border-box; }

        .petmood-container {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ===== Heavy Bubble Style ===== */
        .petmood-notification {
          position: fixed;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeIn 0.3s ease-out;
        }

        .petmood-bubble, .petmood-run-bubble {
          position: relative;
          background: #fff;
          padding: 12px 20px;
          font-size: 14px;
          color: #111;
          font-weight: 700;
          letter-spacing: -0.2px;
          line-height: 1.5;
          max-width: 220px;
          border: 3.5px solid #111;
          border-radius: 38% 48% 42% 52% / 52% 38% 48% 42%;
          filter: url(#petmood-wobble);
          box-shadow: 5px 5px 0px #111;
          transform: rotate(-1.5deg);
          margin-bottom: 46px;
        }

        .petmood-bubble p, .petmood-run-bubble p {
          word-break: keep-all;
          text-align: center;
        }

        /* Dot tail */
        .petmood-dot {
          position: absolute;
          background: #fff;
          border: 3.5px solid #111;
          filter: url(#petmood-wobble);
          box-shadow: 3px 3px 0px #111;
        }

        .petmood-dot.d1 {
          width: 17px;
          height: 14px;
          bottom: -26px;
          left: 36%;
          border-radius: 55% 45% 50% 50%;
        }

        .petmood-dot.d2 {
          width: 11px;
          height: 10px;
          bottom: -44px;
          left: 41%;
          border-radius: 50%;
        }

        .petmood-pet, .petmood-run-pet {
          width: 120px;
          height: 120px;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ===== Running ===== */
        .petmood-runner {
          position: fixed;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .petmood-run-bubble {
          white-space: nowrap;
          margin-bottom: 46px;
        }
      `;
    }
  },
});
