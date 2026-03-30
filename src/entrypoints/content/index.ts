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
      removeOverlay(); // Clean up any existing overlay

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
        container.innerHTML = createNotificationCardHTML(payload);
        container.className += ` position-${payload.position}`;
      }

      shadow.appendChild(container);

      // Make card clickable for dismiss
      const card = container.querySelector(".petmood-card");
      if (card) {
        (card as HTMLElement).style.pointerEvents = "auto";
        card.addEventListener("click", () => removeOverlay());
      }

      // Auto-dismiss
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
      if (host) {
        host.remove();
      }
      chrome.runtime.sendMessage({ type: "NOTIFICATION_DISMISSED" }).catch(() => {});
    }

    function createNotificationCardHTML(payload: NotificationPayload): string {
      return `
        <div class="petmood-card petmood-slide-in">
          <div class="petmood-card-inner">
            <img class="petmood-pet-image" src="${payload.imageDataUrl}" alt="Your pet" />
            <div class="petmood-message">
              <p>${payload.message}</p>
            </div>
          </div>
          <button class="petmood-close">&times;</button>
        </div>
      `;
    }

    function createRunningPetHTML(payload: NotificationPayload): string {
      return `
        <div class="petmood-running">
          <img class="petmood-running-pet" src="${payload.imageDataUrl}" alt="Running pet" />
          <p class="petmood-running-message">${payload.message}</p>
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

        /* Notification Card */
        .petmood-card {
          position: fixed;
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          padding: 16px;
          max-width: 320px;
          cursor: pointer;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .petmood-card:hover {
          transform: scale(1.02);
        }

        .position-top-right .petmood-card { top: 20px; right: 20px; }
        .position-top-left .petmood-card { top: 20px; left: 20px; }
        .position-bottom-right .petmood-card { bottom: 20px; right: 20px; }
        .position-bottom-left .petmood-card { bottom: 20px; left: 20px; }

        .petmood-card-inner {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .petmood-pet-image {
          width: 80px;
          height: 80px;
          border-radius: 12px;
          object-fit: cover;
          background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
        }

        .petmood-message {
          flex: 1;
        }

        .petmood-message p {
          font-size: 14px;
          line-height: 1.5;
          color: #333;
          word-break: keep-all;
        }

        .petmood-close {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          font-size: 18px;
          color: #999;
          cursor: pointer;
          pointer-events: auto;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .petmood-close:hover {
          background: #f0f0f0;
          color: #333;
        }

        /* Slide-in Animation */
        .petmood-slide-in {
          animation: slideIn 0.3s ease-out forwards;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Running Pet Animation */
        .petmood-running {
          position: fixed;
          bottom: 100px;
          pointer-events: none;
          animation: petRun 4s ease-in-out forwards;
        }

        .petmood-running-pet {
          width: 100px;
          height: 100px;
          object-fit: contain;
        }

        .petmood-running-message {
          text-align: center;
          font-size: 13px;
          color: #555;
          background: rgba(255, 255, 255, 0.9);
          padding: 4px 12px;
          border-radius: 12px;
          white-space: nowrap;
          margin-top: 4px;
        }

        @keyframes petRun {
          0%   { transform: translateX(-200px) translateY(0px); }
          25%  { transform: translateX(25vw) translateY(-20px); }
          50%  { transform: translateX(50vw) translateY(0px); }
          75%  { transform: translateX(75vw) translateY(-20px); }
          100% { transform: translateX(calc(100vw + 200px)) translateY(0px); }
        }
      `;
    }
  },
});
