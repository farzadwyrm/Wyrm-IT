/* Wyrm AI website chat widget. Usage on a business's site:
 *   <script src="https://wyrm-portal.vercel.app/widget.js" data-agent="AGENT_ID" async></script>
 * Shows a chat button; the chat itself runs in a frame served by the Wyrm portal. No cookies,
 * no tracking, nothing read from the host page. */
(() => {
  var script = document.currentScript;
  if (!script) return;
  var agent = script.getAttribute("data-agent") || "";
  if (!/^[0-9a-f-]{36}$/.test(agent) || window.__wyrmWidget) return;
  window.__wyrmWidget = true;
  var base = new URL(script.src).origin;

  fetch(`${base}/api/widget/${agent}`, { credentials: "omit" })
    .then((r) => (r.ok ? r.json() : null))
    .then((cfg) => {
      if (!cfg?.enabled) return;
      var open = false;
      var frame = null;
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = cfg.label;
      button.setAttribute("aria-expanded", "false");
      button.style.cssText =
        "position:fixed;right:20px;bottom:20px;z-index:2147483000;border:0;border-radius:999px;" +
        "padding:12px 18px;font:600 15px/1.2 system-ui,sans-serif;color:#fff;cursor:pointer;" +
        "box-shadow:0 6px 20px rgba(0,0,0,.25);background:" +
        cfg.color;
      button.addEventListener("click", () => {
        open = !open;
        button.setAttribute("aria-expanded", String(open));
        button.textContent = open ? "Close chat" : cfg.label;
        if (open && !frame) {
          frame = document.createElement("iframe");
          frame.title = cfg.label;
          frame.src = `${base}/chat/${agent}?embed=1&site=${encodeURIComponent(location.origin)}`;
          frame.style.cssText =
            "position:fixed;z-index:2147483000;border:0;border-radius:" +
            (window.innerWidth < 480 ? "0" : "16px") +
            ";" +
            "box-shadow:0 10px 40px rgba(0,0,0,.3);background:#fff;" +
            (window.innerWidth < 480
              ? "inset:0;width:100%;height:calc(100% - 70px);"
              : "right:20px;bottom:76px;width:380px;height:560px;");
          document.body.appendChild(frame);
        }
        if (frame) frame.style.display = open ? "block" : "none";
      });
      document.body.appendChild(button);
    })
    .catch(() => {});
})();
