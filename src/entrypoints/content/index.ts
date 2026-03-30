import type { PetMoodMessage } from "../../lib/messages/protocol";
import type { NotificationPayload, DisplayType } from "../../types";

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

      const container = document.createElement("div");
      container.className = "petmood-container";
      shadow.appendChild(container);

      if (payload.displayType === "running") {
        startRunningAnimation(container, payload);
      } else {
        showBubbleNotification(container, payload);
      }
    }

    // ===== Bubble Notification (말풍선) =====
    function showBubbleNotification(
      container: HTMLElement,
      payload: NotificationPayload
    ): void {
      const notification = document.createElement("div");
      notification.className = "petmood-notification";
      notification.innerHTML = `
        <div class="petmood-bubble">
          <p>${payload.message}</p>
          <div class="petmood-tail"></div>
        </div>
        <img class="petmood-pet" src="${payload.imageDataUrl}" />
      `;

      // Random position
      const x = Math.floor(Math.random() * (window.innerWidth - 280));
      const y = Math.floor(Math.random() * (window.innerHeight - 280));
      notification.style.left = `${Math.max(20, x)}px`;
      notification.style.top = `${Math.max(20, y)}px`;

      // Click to dismiss
      notification.style.pointerEvents = "auto";
      notification.style.cursor = "pointer";
      notification.addEventListener("click", () => removeOverlay());

      container.appendChild(notification);

      // Auto-dismiss
      dismissTimeout = setTimeout(
        () => removeOverlay(),
        payload.durationSeconds * 1000
      );
    }

    // ===== Running Animation (달리기 — 사선이동 + 잡기) =====
    function startRunningAnimation(
      container: HTMLElement,
      payload: NotificationPayload
    ): void {
      const runner = document.createElement("div");
      runner.className = "petmood-runner";
      runner.innerHTML = `
        <div class="petmood-run-bubble"><p>${payload.message}</p></div>
        <img class="petmood-run-pet" src="${payload.imageDataUrl}" />
      `;
      container.appendChild(runner);

      // Animation state
      let x = -150;
      const screenW = window.innerWidth;
      const speed = 5; // faster
      let stepCount = 0;
      let caught = false;
      let frame: number;
      const baseY = window.innerHeight * 0.55;
      // Zigzag: 사선 45도 구간 (올라가기 / 내려가기 반복)
      let goingUp = true;
      let zigzagY = 0;
      const zigzagRange = 80; // 위아래 이동 범위
      const zigzagSpeed = 3; // Y축 이동 속도

      runner.style.pointerEvents = "auto";
      runner.style.cursor = "pointer";

      // Click = caught!
      runner.addEventListener("click", () => {
        if (caught) return;
        caught = true;

        const bubble = runner.querySelector(".petmood-run-bubble p");
        if (bubble) bubble.textContent = "아이고고... 잡혔다...";

        // Pet stops and shrinks down
        const pet = runner.querySelector(".petmood-run-pet") as HTMLElement;
        if (pet) pet.style.transition = "transform 0.3s";

        runner.style.transition = "opacity 1.5s ease-out";
        setTimeout(() => {
          runner.style.opacity = "0";
          setTimeout(() => removeOverlay(), 1500);
        }, 800);
      });

      // Running movement (발발발발 뛰는 느낌)
      function animate() {
        if (caught) return;

        x += speed;
        stepCount++;

        // Zigzag: 사선 올라가기 / 내려가기 반복
        if (goingUp) {
          zigzagY -= zigzagSpeed;
          if (zigzagY <= -zigzagRange) goingUp = false;
        } else {
          zigzagY += zigzagSpeed;
          if (zigzagY >= zigzagRange) goingUp = true;
        }

        // 발발발발 효과: 2-3px 미세 바운스 (매 프레임 위아래)
        const microBounce = stepCount % 4 < 2 ? -3 : 0;
        const currentY = baseY + zigzagY + microBounce;

        runner.style.left = `${x}px`;
        runner.style.top = `${currentY}px`;

        // Exited screen → show escape message
        if (x > screenW + 100) {
          const bubble = runner.querySelector(".petmood-run-bubble p");
          if (bubble) bubble.textContent = "우헤헿 안 잡혔당~";
          runner.style.transition = "opacity 1s ease-out";
          setTimeout(() => {
            runner.style.opacity = "0";
            setTimeout(() => removeOverlay(), 1000);
          }, 300);
          return;
        }

        frame = requestAnimationFrame(animate);
      }

      frame = requestAnimationFrame(animate);

      // Fallback timeout
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

        /* ===== Bubble Notification ===== */
        .petmood-notification {
          position: fixed;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: fadeIn 0.3s ease-out;
        }

        .petmood-bubble {
          position: relative;
          background: white;
          border-radius: 20px;
          padding: 14px 20px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.12);
          max-width: 240px;
          margin-bottom: 8px;
        }

        .petmood-bubble p {
          font-size: 14px;
          line-height: 1.6;
          color: #333;
          word-break: keep-all;
          text-align: center;
        }

        .petmood-tail {
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-top: 12px solid white;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.06));
        }

        .petmood-pet {
          width: 120px;
          height: 120px;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0,0,0,0.15));
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ===== Running Animation ===== */
        .petmood-runner {
          position: fixed;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .petmood-run-bubble {
          background: white;
          border-radius: 16px;
          padding: 8px 14px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
          margin-bottom: 6px;
          white-space: nowrap;
        }

        .petmood-run-bubble p {
          font-size: 13px;
          color: #555;
        }

        .petmood-run-pet {
          width: 120px;
          height: 120px;
          object-fit: contain;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));
        }
      `;
    }
  },
});
