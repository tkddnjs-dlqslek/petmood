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
      container.innerHTML = createHTML(payload);
      shadow.appendChild(container);

      // Random position (except running which traverses screen)
      if (payload.displayType !== "running") {
        const notification = container.querySelector(".petmood-notification") as HTMLElement;
        if (notification) {
          const randX = Math.floor(Math.random() * (window.innerWidth - 280));
          const randY = Math.floor(Math.random() * (window.innerHeight - 300));
          notification.style.left = `${Math.max(20, randX)}px`;
          notification.style.top = `${Math.max(20, randY)}px`;
          notification.style.right = "auto";
          notification.style.bottom = "auto";
        }
      }

      // Click anywhere on notification to dismiss immediately
      const clickTarget = container.querySelector(".petmood-notification, .petmood-running");
      if (clickTarget) {
        (clickTarget as HTMLElement).style.pointerEvents = "auto";
        (clickTarget as HTMLElement).style.cursor = "pointer";
        clickTarget.addEventListener("click", () => removeOverlay());
      }

      dismissTimeout = setTimeout(
        () => removeOverlay(),
        payload.displayType === "running" ? 5000 : payload.durationSeconds * 1000
      );
    }

    function removeOverlay(): void {
      if (dismissTimeout) {
        clearTimeout(dismissTimeout);
        dismissTimeout = null;
      }
      document.getElementById(SHADOW_HOST_ID)?.remove();
      chrome.runtime.sendMessage({ type: "NOTIFICATION_DISMISSED" }).catch(() => {});
    }

    function createHTML(payload: NotificationPayload): string {
      const { imageDataUrl, message, displayType } = payload;

      if (displayType === "running") {
        return `
          <div class="petmood-running">
            <div class="petmood-run-bubble"><p>${message}</p></div>
            <img class="petmood-run-pet" src="${imageDataUrl}" />
          </div>`;
      }

      return `
        <div class="petmood-notification anim-${displayType}">
          <div class="petmood-bubble">
            <p>${message}</p>
            <div class="petmood-tail"></div>
          </div>
          <img class="petmood-pet" src="${imageDataUrl}" />
        </div>`;
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

        .petmood-notification {
          position: fixed;
          display: flex;
          flex-direction: column;
          align-items: center;
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

        /* bounce */
        .anim-bounce { animation: bounceIn 0.5s ease-out forwards; }
        .anim-bounce .petmood-pet { animation: bounceJump 0.6s ease-in-out 0.5s infinite alternate; }
        @keyframes bounceIn {
          0% { opacity: 0; transform: scale(0.3) translateY(40px); }
          60% { opacity: 1; transform: scale(1.1) translateY(-10px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes bounceJump {
          0% { transform: translateY(0); }
          100% { transform: translateY(-18px); }
        }

        /* peek */
        .anim-peek { animation: peekUp 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        @keyframes peekUp {
          0% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }

        /* running */
        .petmood-running {
          position: fixed;
          bottom: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: petRun 4s ease-in-out forwards;
        }
        .petmood-run-bubble {
          background: white;
          border-radius: 16px;
          padding: 8px 14px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.1);
          margin-bottom: 6px;
          white-space: nowrap;
        }
        .petmood-run-bubble p { font-size: 12px; color: #555; }
        .petmood-run-pet {
          width: 90px; height: 90px;
          object-fit: contain;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.15));
        }
        @keyframes petRun {
          0%   { transform: translateX(-200px) translateY(0); }
          25%  { transform: translateX(25vw) translateY(-15px); }
          50%  { transform: translateX(50vw) translateY(0); }
          75%  { transform: translateX(75vw) translateY(-15px); }
          100% { transform: translateX(calc(100vw + 200px)) translateY(0); }
        }

        /* float */
        .anim-float { animation: floatIn 0.8s ease-out forwards; }
        .anim-float .petmood-pet { animation: floatDrift 2.5s ease-in-out infinite alternate; }
        .anim-float .petmood-bubble { animation: floatDrift 2.5s ease-in-out 0.3s infinite alternate; }
        @keyframes floatIn {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes floatDrift {
          0% { transform: translateY(0); }
          100% { transform: translateY(-12px); }
        }

        /* wobble */
        .anim-wobble { animation: wobbleIn 0.5s ease-out forwards; }
        .anim-wobble .petmood-pet {
          animation: wobbleSwing 1s ease-in-out 0.5s infinite alternate;
          transform-origin: bottom center;
        }
        @keyframes wobbleIn {
          0% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes wobbleSwing {
          0% { transform: rotate(-8deg); }
          100% { transform: rotate(8deg); }
        }

        /* spin */
        .anim-spin { animation: spinAppear 0.6s ease-out forwards; }
        .anim-spin .petmood-pet {
          animation: spinIn 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .anim-spin .petmood-bubble {
          animation: shakeAngry 0.4s ease-in-out 0.7s 3;
        }
        @keyframes spinAppear { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes spinIn {
          0% { transform: rotate(-360deg) scale(0.3); opacity: 0; }
          100% { transform: rotate(0deg) scale(1); opacity: 1; }
        }
        @keyframes shakeAngry {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `;
    }
  },
});
