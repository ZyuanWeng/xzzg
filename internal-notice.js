(function () {
  "use strict";

  var storageKey = "internal-development-notice";
  var acceptedValue = "accepted-v1";
  var testMode = false;
  var root = document.documentElement;
  var accepted = false;

  try {
    accepted = localStorage.getItem(storageKey) === acceptedValue;
  } catch (error) {
    accepted = false;
  }

  if (testMode) accepted = false;

  if (accepted) return;

  root.classList.add("internal-notice-pending");

  var style = document.createElement("style");
  style.textContent = [
    "html.internal-notice-pending{overflow:hidden}",
    ".internal-notice{position:fixed;z-index:10000;inset:0;display:grid;place-items:center;padding:24px;background:rgba(7,22,39,.74);backdrop-filter:blur(5px)}",
    ".internal-notice-panel{width:min(100%,520px);padding:38px 40px 34px;background:#fff;border-top:3px solid #c18b32;border-radius:6px;box-shadow:0 22px 60px rgba(3,18,34,.28);text-align:center}",
    ".internal-notice-panel>p{margin:0 0 12px;color:#9b6d24;font-size:11px;font-weight:800}",
    ".internal-notice-panel h2{margin:0;color:#102f51;font-size:22px;line-height:1.55}",
    ".internal-notice-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:30px}",
    ".internal-notice-button{min-height:44px;padding:0 18px;border:1px solid #cdd7e4;border-radius:4px;background:#fff;color:#29425f;font:inherit;font-weight:700;cursor:pointer}",
    ".internal-notice-button:hover,.internal-notice-button:focus-visible{border-color:#8fa8c4;outline:none}",
    ".internal-notice-button.primary{border-color:#235d99;background:#235d99;color:#fff}",
    ".internal-notice-button.primary:hover,.internal-notice-button.primary:focus-visible{border-color:#17497e;background:#17497e}",
    "@media(max-width:560px){.internal-notice-panel{padding:30px 20px 24px}.internal-notice-panel h2{font-size:19px}}"
  ].join("");
  document.head.appendChild(style);

  function mountNotice() {
    var notice = document.createElement("div");
    notice.id = "internalNotice";
    notice.className = "internal-notice";
    notice.setAttribute("role", "dialog");
    notice.setAttribute("aria-modal", "true");
    notice.setAttribute("aria-labelledby", "internalNoticeTitle");
    notice.innerHTML = [
      '<div class="internal-notice-panel">',
      '<p>INTERNAL DEVELOPMENT</p>',
      '<h2 id="internalNoticeTitle">本内容目前为内部开发，请勿外传。</h2>',
      '<div class="internal-notice-actions">',
      '<button id="internalNoticeAccept" class="internal-notice-button primary" type="button">彳亍</button>',
      '<button id="internalNoticeDecline" class="internal-notice-button" type="button">不行</button>',
      "</div>",
      "</div>"
    ].join("");
    document.body.insertBefore(notice, document.body.firstChild);

    var acceptButton = document.getElementById("internalNoticeAccept");
    var declineButton = document.getElementById("internalNoticeDecline");

    acceptButton.addEventListener("click", function () {
      try {
        localStorage.setItem(storageKey, acceptedValue);
      } catch (error) {
        // Continue without persistence when storage is unavailable.
      }
      root.classList.remove("internal-notice-pending");
      notice.remove();
      style.remove();
    });

    declineButton.addEventListener("click", function () {
      window.location.replace("about:blank");
    });

    acceptButton.focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountNotice, { once: true });
  } else {
    mountNotice();
  }
})();
