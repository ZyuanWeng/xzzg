(function () {
  "use strict";

  var storageKey = "internal-development-notice";
  var acceptedValue = "accepted-v2";
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
    ".internal-notice-face{--eye-x:0px;--eye-y:0px;position:relative;width:84px;height:84px;margin:0 auto 20px;border:1px solid #daa83d;border-radius:50%;background:#f1b93f;box-shadow:inset 0 -6px 0 rgba(151,91,12,.1);transition:transform .2s ease,background-color .2s ease}",
    ".internal-notice-eyes{position:absolute;top:22px;left:15px;display:flex;gap:10px}",
    ".internal-notice-eye{position:relative;width:22px;height:25px;overflow:hidden;border-radius:50%;background:#fff}",
    ".internal-notice-pupil{position:absolute;top:8px;left:8px;width:8px;height:9px;border-radius:50%;background:#17395e;transform:translate(var(--eye-x),var(--eye-y));transition:transform .08s linear}",
    ".internal-notice-brow{position:absolute;top:18px;width:15px;height:2px;border-radius:2px;background:#9a671f;opacity:0;transition:opacity .2s ease}",
    ".internal-notice-brow.left{left:17px}",
    ".internal-notice-brow.right{right:17px}",
    ".internal-notice-tear{position:absolute;top:44px;right:17px;width:7px;height:11px;border-radius:7px 7px 8px 8px;background:#67a9de;opacity:0;transition:opacity .2s ease}",
    ".internal-notice-mouth{position:absolute;top:59px;left:50%;width:26px;height:3px;border-radius:3px;background:#84520f;transform:translateX(-50%);transition:all .2s ease}",
    ".internal-notice-face.is-happy{background:#f3bd48;transform:translateY(-2px)}",
    ".internal-notice-face.is-happy .internal-notice-mouth{top:52px;width:30px;height:17px;border-radius:0 0 20px 20px;background:#84520f}",
    ".internal-notice-face.is-sad{background:#eab461;transform:translateY(2px)}",
    ".internal-notice-face.is-sad .internal-notice-brow,.internal-notice-face.is-sad .internal-notice-tear{opacity:1}",
    ".internal-notice-face.is-sad .internal-notice-brow.left{transform:rotate(-13deg)}",
    ".internal-notice-face.is-sad .internal-notice-brow.right{transform:rotate(13deg)}",
    ".internal-notice-face.is-sad .internal-notice-mouth{top:59px;width:24px;height:3px;border:0;border-radius:3px;background:#84520f;transform:translateX(-50%) rotate(-4deg)}",
    ".internal-notice-panel>p{margin:0 0 12px;color:#9b6d24;font-size:11px;font-weight:800}",
    ".internal-notice-panel h2{margin:0;color:#102f51;font-size:22px;line-height:1.55}",
    ".internal-notice-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:30px}",
    ".internal-notice-button{min-height:44px;padding:0 18px;border:1px solid #cdd7e4;border-radius:4px;background:#fff;color:#29425f;font:inherit;font-weight:700;cursor:pointer}",
    ".internal-notice-button:hover,.internal-notice-button:focus-visible{border-color:#8fa8c4;outline:none}",
    ".internal-notice-button.primary{border-color:#235d99;background:#235d99;color:#fff}",
    ".internal-notice-button.primary:hover,.internal-notice-button.primary:focus-visible{border-color:#17497e;background:#17497e}",
    "@media(max-width:560px){.internal-notice-panel{padding:30px 20px 24px}.internal-notice-panel h2{font-size:19px}}",
    "@media(prefers-reduced-motion:reduce){.internal-notice-face,.internal-notice-mouth,.internal-notice-pupil{transition:none}}"
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
      '<div id="internalNoticeFace" class="internal-notice-face" aria-hidden="true">',
      '<i class="internal-notice-brow left"></i>',
      '<i class="internal-notice-brow right"></i>',
      '<div class="internal-notice-eyes">',
      '<span class="internal-notice-eye"><i class="internal-notice-pupil"></i></span>',
      '<span class="internal-notice-eye"><i class="internal-notice-pupil"></i></span>',
      "</div>",
      '<i class="internal-notice-tear"></i>',
      '<span class="internal-notice-mouth"></span>',
      "</div>",
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
    var face = document.getElementById("internalNoticeFace");

    function setMood(mood) {
      face.classList.toggle("is-happy", mood === "happy");
      face.classList.toggle("is-sad", mood === "sad");
    }

    acceptButton.addEventListener("mouseenter", function () { setMood("happy"); });
    acceptButton.addEventListener("mouseleave", function () { setMood("neutral"); });
    declineButton.addEventListener("mouseenter", function () { setMood("sad"); });
    declineButton.addEventListener("mouseleave", function () { setMood("neutral"); });

    notice.addEventListener("mousemove", function (event) {
      var rect = face.getBoundingClientRect();
      var deltaX = event.clientX - (rect.left + rect.width / 2);
      var deltaY = event.clientY - (rect.top + rect.height / 2);
      var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 1;
      var travel = Math.min(6, distance * 0.08);
      face.style.setProperty("--eye-x", (deltaX / distance * travel).toFixed(2) + "px");
      face.style.setProperty("--eye-y", (deltaY / distance * travel).toFixed(2) + "px");
    });

    notice.addEventListener("mouseleave", function () {
      face.style.setProperty("--eye-x", "0px");
      face.style.setProperty("--eye-y", "0px");
      setMood("neutral");
    });

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
