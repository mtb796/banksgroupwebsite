/* Shared mobile/tablet nav — injects a hamburger + slide-down menu into the
   site header on every page. Desktop nav is unchanged (CSS hides it ≤940px). */
(function () {
  var header = document.querySelector("header");
  if (!header) return;
  var p = location.pathname;
  var home = p === "/" || p === "" || /index\.html$/.test(p);
  var pre = home ? "" : "index.html";
  var links = [
    ["Buyers", "buyers.html"],
    ["Sellers", "sellers.html"],
    ["Investors", "investors.html"],
    ["Calculators", "calculators.html"],
    ["Deal Analyzer", pre + "#analyzer"],
    ["About", pre + "#about"],
    ["Contact", pre + "#contact"]
  ];

  var burger = document.createElement("button");
  burger.className = "hamburger";
  burger.type = "button";
  burger.setAttribute("aria-label", "Open menu");
  burger.setAttribute("aria-expanded", "false");
  burger.innerHTML = "<span></span><span></span><span></span>";

  var menu = document.createElement("nav");
  menu.className = "mobile-menu";
  menu.innerHTML = links.map(function (l) { return '<a href="' + l[1] + '">' + l[0] + "</a>"; }).join("");

  header.appendChild(burger);
  header.appendChild(menu);

  function close() {
    menu.classList.remove("open");
    burger.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  }
  burger.addEventListener("click", function () {
    var open = menu.classList.toggle("open");
    burger.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
})();
