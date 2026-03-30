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

      const container = document.createElement("div");
      container.className = "petmood-container";

      if (payload.displayType === "running") {
        container.innerHTML = createRunningPetHTML(payload);
      } else {
        container.innerHTML = createBubbleNotificationHTML(payload);
        container.className += ` position-${payload.position}`;
      }

      shadow.appendChild(container);

      // Make clickable for dismiss
      const card = container.querySelector(".petmood-notification");
      if (card) {
        (card as HTMLElement).style.pointerEvents = "auto";
        card.addEventListener("click", () => removeOverlay());
      }

      dismissTimeout = setTimeout(
        () => removeOverlay(),
        payload.durationSeconds * 1000
      );
    }

    function removeOverlay(): void {
      if (dismissTimeout) {
        clearTimeout(dismissTimeout);
        dismissTimeout = null;
      }
      const host = document.getElementById(SHADOW_HOST_ID);
      if (host) host.remove();
      chrome.runtime.sendMessage({ type: "NOTIFICATION_DISMISSED" }).catch(() => {});
    }

    function createBubbleNotificationHTML(payload: NotificationPayload): string {
      return `
        <div class="petmood-notification petmood-pop-in">
          <div class="petmood-bubble">
            <p class="petmood-bubble-text">${payload.message}</p>
            <div class="petmood-bubble-tail"></div>
          </div>
          <img class="petmood-pet-image" src="${payload.imageDataUrl}" alt="Pet" />
        </div>
      `;
    }

    function createRunningPetHTML(payload: NotificationPayload): string {
      return `
        <div class="petmood-running">
          <div class="petmood-running-bubble">
            <p>${payload.message}</p>
          </div>
          <img class="petmood-running-pet" src="${payload.imageDataUrl}" alt="Running pet" />
        </div>
      `;
    }

    function getOverlayStyles(): string {
      return `
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        .petmood-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          pointer-events: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* ===== Bubble Notification ===== */
        .petmood-notification {
          position: fixed;
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
        }

        .position-top-right .petmood-notification { top: 20px; right: 20px; }
        .position-top-left .petmood-notification { top: 20px; left: 20px; }
        .position-bottom-right .petmood-notification { bottom: 20px; right: 20px; }
        .position-bottom-left .petmood-notification { bottom: 20px; left: 20px; }

        /* Speech Bubble */
        .petmood-bubble {
          position: relative;
          background: white;
          border-radius: 20px;
          padding: 14px 20px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
          max-width: 240px;
          margin-bottom: 8px;
        }

        .petmood-bubble-text {
          font-size: 14px;
          line-height: 1.6;
          color: #333;
          word-break: keep-all;
          text-align: center;
        }

        /* Bubble tail (triangle pointing down to pet) */
        .petmood-bubble-tail {
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-top: 12px solid white;
          filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.06));
        }

        /* Pet cutout image */
        .petmood-pet-image {
          width: 120px;
          height: 120px;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
        }

        /* Pop-in Animation */
        .petmood-pop-in {
          animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes popIn {
          0% {
            opacity: 0;
            transform: scale(0.5) translateY(30px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        /* ===== Running Pet ===== */
        .petmood-running {
          position: fixed;
          bottom: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          pointer-events: none;
          animation: petRun 4s ease-in-out forwards;
        }

        .petmood-running-bubble {
          background: white;
          border-radius: 16px;
          padding: 8px 14px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
          margin-bottom: 6px;
          white-space: nowrap;
        }

        .petmood-running-bubble p {
          font-size: 12px;
          color: #555;
        }

        .petmood-running-pet {
          width: 90px;
          height: 90px;
          object-fit: contain;
          filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.15));
        }

        @keyframes petRun {
          0%   { transform: translateX(-200px) translateY(0px); }
          25%  { transform: translateX(25vw) translateY(-15px); }
          50%  { transform: translateX(50vw) translateY(0px); }
          75%  { transform: translateX(75vw) translateY(-15px); }
          100% { transform: translateX(calc(100vw + 200px)) translateY(0px); }
        }
      `;
    }
  },
});
