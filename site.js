/* The Banks Group — home page interactions.
   Ported 1:1 from the design handoff (Deal Analyzer math, carousel, forms, intro). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // Where lead-form submissions are emailed. Interim: routed to Malik's Gmail via
  // FormSubmit (no backend). First submission triggers a one-time confirmation
  // email from FormSubmit that must be clicked to activate forwarding.
  // TODO: switch to the banksgroupdmv.com mailbox once it's set up.
  var LEAD_EMAIL = "malik.banks710@gmail.com";

  /* ---------------------------------- STATE ---------------------------------- */
  var state = {
    tab: "fixflip",
    audience: "buyer",
    slotIdx: 0,
    snap: false,
    ff: { purchase: 450000, closingBuyPct: 2, rehab: 85000, arv: 650000, months: 6, holdMo: 850, ltc: 85, rate: 10.5, points: 2, commissionPct: 5, sellClosePct: 1.5 },
    nc: { land: 220000, sqft: 2800, costSqft: 185, softPct: 12, closingBuyPct: 2, months: 12, holdMo: 600, ltc: 80, rate: 11, points: 2, salePrice: 1050000, commissionPct: 5, sellClosePct: 1.5, subdivide: false, lots: 2, subCosts: 45000, siteWorkPerLot: 35000, pricePerUnit: 950000 },
    dscr: { purchase: 400000, closing: 12000, rehab: 0, downPct: 20, rate: 7.25, term: 30, rent: 4000, otherInc: 0, vacancyPct: 5, taxes: 4200, insurance: 1400, hoa: 0, mgmtPct: 8, maintPct: 5, capexPct: 5 }
  };

  function fmt$(n) {
    var neg = n < 0;
    var v = Math.round(Math.abs(n)).toLocaleString("en-US");
    return (neg ? "-$" : "$") + v;
  }
  function fmtPct(n) { return (isFinite(n) ? (n * 100).toFixed(1) : "—") + "%"; }

  /* ------------------------------ DEAL ANALYZER ------------------------------ */
  function mk(calc, key, label, prefix, suffix, step) {
    return { kind: "number", calc: calc, key: key, label: label, prefix: prefix || "", suffix: suffix || "", step: step || 1 };
  }
  function mkToggle(calc, key, label) { return { kind: "toggle", calc: calc, key: key, label: label }; }

  function compute() {
    var s = state, tab = s.tab;

    // ---------- Fix & Flip ----------
    var ff = s.ff;
    var ffLoanBase = ff.purchase + ff.rehab;
    var ffLoan = ffLoanBase * ff.ltc / 100;
    var ffPoints = ffLoan * ff.points / 100;
    var ffInterest = ffLoan * (ff.rate / 100) * (ff.months / 12);
    var ffClosingBuy = ff.purchase * ff.closingBuyPct / 100;
    var ffHolding = ff.holdMo * ff.months;
    var ffSellCosts = ff.arv * (ff.commissionPct + ff.sellClosePct) / 100;
    var ffTotalCost = ff.purchase + ff.rehab + ffClosingBuy + ffHolding + ffInterest + ffPoints + ffSellCosts;
    var ffProfit = ff.arv - ffTotalCost;
    var ffCash = (ffLoanBase - ffLoan) + ffClosingBuy + ffPoints + ffHolding + ffInterest;
    var ffROI = ffTotalCost > 0 ? ffProfit / ffTotalCost : NaN;
    var ffCoC = ffCash > 0 ? ffProfit / ffCash : NaN;
    var ffCoCAnnual = ff.months > 0 ? ffCoC * 12 / ff.months : NaN;
    var ffMaxOffer = ff.arv * 0.7 - ff.rehab;

    // ---------- New Construction ----------
    var nc = s.nc;
    var ncSub = !!nc.subdivide;
    var ncUnits = ncSub ? Math.max(1, Math.round(nc.lots)) : 1;
    var ncBuild = nc.sqft * nc.costSqft * ncUnits;
    var ncSubCosts = ncSub ? nc.subCosts + nc.siteWorkPerLot * ncUnits : 0;
    var ncGross = ncSub ? nc.pricePerUnit * ncUnits : nc.salePrice;
    var ncSoft = ncBuild * nc.softPct / 100;
    var ncClosingBuy = nc.land * nc.closingBuyPct / 100;
    var ncHolding = nc.holdMo * nc.months;
    var ncLoan = (nc.land + ncBuild) * nc.ltc / 100;
    var ncPoints = ncLoan * nc.points / 100;
    var ncInterest = ncLoan * (nc.rate / 100) * (nc.months / 12) * 0.6;
    var ncSellCosts = ncGross * (nc.commissionPct + nc.sellClosePct) / 100;
    var ncTotalCost = nc.land + ncBuild + ncSoft + ncSubCosts + ncClosingBuy + ncHolding + ncInterest + ncPoints + ncSellCosts;
    var ncProfit = ncGross - ncTotalCost;
    var ncMargin = ncGross > 0 ? ncProfit / ncGross : NaN;
    var ncCash = (nc.land + ncBuild - ncLoan) + ncSoft + ncSubCosts + ncClosingBuy + ncPoints + ncHolding + ncInterest;
    var ncROI = ncCash > 0 ? ncProfit / ncCash : NaN;
    var ncAnnual = nc.months > 0 ? ncROI * 12 / nc.months : NaN;

    // ---------- DSCR ----------
    var d = s.dscr;
    var dLoan = d.purchase * (1 - d.downPct / 100);
    var r = d.rate / 100 / 12, n = d.term * 12;
    var dPI = r > 0 ? dLoan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : (n > 0 ? dLoan / n : 0);
    var dGross = (d.rent + d.otherInc) * 12;
    var dEGI = dGross * (1 - d.vacancyPct / 100);
    var dOpex = d.taxes + d.insurance + d.hoa * 12 + dEGI * (d.mgmtPct + d.maintPct + d.capexPct) / 100;
    var dNOI = dEGI - dOpex;
    var dADS = dPI * 12;
    var dDSCR = dADS > 0 ? dNOI / dADS : NaN;
    var dCF = (dNOI - dADS) / 12;
    var dCap = (d.purchase + d.rehab) > 0 ? dNOI / (d.purchase + d.rehab) : NaN;
    var dCash = d.purchase * d.downPct / 100 + d.closing + d.rehab;
    var dCoC = dCash > 0 ? (dNOI - dADS) / dCash : NaN;

    var groups, outputs, heroLabel, heroValue, verdict, verdictColor;
    if (tab === "fixflip") {
      groups = [
        { title: "ACQUISITION", fields: [ mk("ff","purchase","Purchase price","$"), mk("ff","rehab","Rehab budget","$"), mk("ff","arv","After-repair value (ARV)","$"), mk("ff","closingBuyPct","Purchase closing costs","","%",0.25) ] },
        { title: "FINANCING", fields: [ mk("ff","ltc","Loan-to-cost","","%"), mk("ff","rate","Interest rate","","%",0.125), mk("ff","points","Lender points","","pts",0.25) ] },
        { title: "HOLDING & EXIT", fields: [ mk("ff","months","Hold time","","mo"), mk("ff","holdMo","Holding costs / month","$"), mk("ff","commissionPct","Sale commission","","%",0.25), mk("ff","sellClosePct","Seller closing costs","","%",0.25) ] }
      ];
      heroLabel = "PROJECTED NET PROFIT"; heroValue = fmt$(ffProfit);
      outputs = [
        { label: "All-in project cost", value: fmt$(ffTotalCost) },
        { label: "Loan amount (" + ff.ltc + "% LTC)", value: fmt$(ffLoan) },
        { label: "Cash required", value: fmt$(ffCash) },
        { label: "Interest + points", value: fmt$(ffInterest + ffPoints) },
        { label: "Selling costs", value: fmt$(ffSellCosts) },
        { label: "ROI on project cost", value: fmtPct(ffROI) },
        { label: "Cash-on-cash (project)", value: fmtPct(ffCoC) },
        { label: "Cash-on-cash (annualized)", value: fmtPct(ffCoCAnnual) },
        { label: "70%-rule max offer", value: fmt$(ffMaxOffer) }
      ];
      var good = ffProfit > 0 && ffROI >= 0.08 && ffCoC >= 0.30;
      verdict = ffProfit <= 0 ? "UNDERWATER — RENEGOTIATE" : (good ? "STRONG FLIP CANDIDATE" : "THIN MARGIN — PROCEED CAREFULLY");
      verdictColor = ffProfit <= 0 ? "#a33b2e" : (good ? "#2e6b46" : "#8a7345");
    } else if (tab === "construction") {
      var subFields = [ mkToggle("nc","subdivide","Subdividing the property?") ];
      if (ncSub) {
        subFields.push( mk("nc","lots","Number of lots / units","","lots"), mk("nc","subCosts","Subdivision & entitlement costs","$","",1000), mk("nc","siteWorkPerLot","Site work & utilities per lot","$","",1000), mk("nc","pricePerUnit","Sale price per unit","$","",5000) );
      }
      groups = [
        { title: "SUBDIVISION", fields: subFields },
        { title: "LAND & BUILD", fields: [ mk("nc","land","Land / lot cost","$"), mk("nc","sqft", ncSub ? "Finished area per unit" : "Finished area","","sqft",50), mk("nc","costSqft","Build cost / sqft","$"), mk("nc","softPct","Soft costs (design, permits)","","%",0.5), mk("nc","closingBuyPct","Land closing costs","","%",0.25) ] },
        { title: "FINANCING", fields: [ mk("nc","ltc","Construction loan LTC","","%"), mk("nc","rate","Interest rate","","%",0.125), mk("nc","points","Lender points","","pts",0.25) ] },
        { title: "TIMELINE & EXIT", fields: [ mk("nc","months","Build + sale timeline","","mo"), mk("nc","holdMo","Carrying costs / month","$") ].concat(ncSub ? [] : [ mk("nc","salePrice","Projected sale price","$") ]).concat([ mk("nc","commissionPct","Sale commission","","%",0.25), mk("nc","sellClosePct","Seller closing costs","","%",0.25) ]) }
      ];
      heroLabel = "PROJECTED DEVELOPMENT PROFIT"; heroValue = fmt$(ncProfit);
      outputs = [
        { label: "Hard costs (land + build)", value: fmt$(nc.land + ncBuild) },
        { label: "Soft costs", value: fmt$(ncSoft) },
        { label: "All-in project cost", value: fmt$(ncTotalCost) },
        { label: "Loan amount (" + nc.ltc + "% LTC)", value: fmt$(ncLoan) },
        { label: "Cash required", value: fmt$(ncCash) },
        { label: "Interest + points (avg draw)", value: fmt$(ncInterest + ncPoints) },
        { label: "Profit margin on sale", value: fmtPct(ncMargin) },
        { label: "Cash-on-cash (project / annualized)", value: fmtPct(ncROI) + " / " + fmtPct(ncAnnual) }
      ];
      if (ncSub) {
        outputs.splice(2, 0, { label: "Subdivision + site work (" + ncUnits + " lots)", value: fmt$(ncSubCosts) });
        outputs.splice(6, 0, { label: "Gross sales (" + ncUnits + " units)", value: fmt$(ncGross) }, { label: "Profit per unit", value: fmt$(ncProfit / ncUnits) });
      }
      var goodN = ncMargin > 0.15;
      verdict = ncProfit <= 0 ? "UNDERWATER — REWORK THE BUDGET" : (goodN ? "HEALTHY DEVELOPMENT MARGIN" : "BELOW 15% MARGIN — TIGHT");
      verdictColor = ncProfit <= 0 ? "#a33b2e" : (goodN ? "#2e6b46" : "#8a7345");
    } else {
      groups = [
        { title: "ACQUISITION", fields: [ mk("dscr","purchase","Purchase price","$"), mk("dscr","rehab","Initial rehab (optional)","$"), mk("dscr","closing","Closing costs","$") ] },
        { title: "DSCR LOAN", fields: [ mk("dscr","downPct","Down payment","","%"), mk("dscr","rate","Interest rate","","%",0.125), mk("dscr","term","Amortization","","yrs") ] },
        { title: "INCOME", fields: [ mk("dscr","rent","Monthly rent","$","/mo",50), mk("dscr","otherInc","Other income","$","/mo",25), mk("dscr","vacancyPct","Vacancy allowance","","%",0.5) ] },
        { title: "OPERATING EXPENSES", fields: [ mk("dscr","taxes","Property taxes","$","/yr",100), mk("dscr","insurance","Insurance","$","/yr",50), mk("dscr","hoa","HOA / condo fee","$","/mo",10), mk("dscr","mgmtPct","Management","","%",0.5), mk("dscr","maintPct","Maintenance","","%",0.5), mk("dscr","capexPct","CapEx reserve","","%",0.5) ] }
      ];
      heroLabel = "DEBT SERVICE COVERAGE RATIO"; heroValue = isFinite(dDSCR) ? dDSCR.toFixed(2) + "×" : "—";
      outputs = [
        { label: "Loan amount", value: fmt$(dLoan) },
        { label: "Monthly principal & interest", value: fmt$(dPI) },
        { label: "Net operating income (yr)", value: fmt$(dNOI) },
        { label: "Annual debt service", value: fmt$(dADS) },
        { label: "Monthly cash flow", value: fmt$(dCF) },
        { label: "Cap rate", value: fmtPct(dCap) },
        { label: "Cash required", value: fmt$(dCash) },
        { label: "Cash-on-cash return", value: fmtPct(dCoC) }
      ];
      verdict = !isFinite(dDSCR) ? "—" : (dDSCR >= 1.2 ? "MEETS TYPICAL LENDER MINIMUM (≥1.20)" : (dDSCR >= 1.0 ? "BELOW 1.20 — EXPECT PRICING ADJUSTMENTS" : "NEGATIVE COVERAGE — WON'T QUALIFY"));
      verdictColor = !isFinite(dDSCR) ? "#8a7345" : (dDSCR >= 1.2 ? "#2e6b46" : (dDSCR >= 1.0 ? "#8a7345" : "#a33b2e"));
    }
    return { groups: groups, outputs: outputs, heroLabel: heroLabel, heroValue: heroValue, verdict: verdict, verdictColor: verdictColor };
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  function renderInputs() {
    var r = compute(), host = $("#an-inputs");
    var html = "";
    r.groups.forEach(function (g) {
      html += '<div><div style="font-family:\'Jost\',sans-serif;font-weight:500;font-size:12px;letter-spacing:.26em;color:#c4a56b;border-bottom:1px solid rgba(196,165,107,.3);padding-bottom:12px;margin-bottom:20px;">' + g.title + '</div>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px;">';
      g.fields.forEach(function (f) {
        if (f.kind === "toggle") {
          var on = !!state[f.calc][f.key];
          var act = "background:#c4a56b;color:#062e44;border:1px solid #c4a56b;";
          var idle = "background:transparent;color:rgba(242,237,225,.7);border:1px solid rgba(242,237,225,.3);";
          html += '<div><span style="display:block;font-family:\'Jost\',sans-serif;font-weight:400;font-size:12px;letter-spacing:.08em;color:rgba(242,237,225,.65);margin-bottom:7px;">' + f.label + '</span>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
            '<button type="button" data-toggle="' + f.calc + '.' + f.key + '" data-val="1" style="padding:11px 0;cursor:pointer;font-family:\'Jost\',sans-serif;font-weight:500;font-size:12px;letter-spacing:.14em;' + (on ? act : idle) + '">YES</button>' +
            '<button type="button" data-toggle="' + f.calc + '.' + f.key + '" data-val="0" style="padding:11px 0;cursor:pointer;font-family:\'Jost\',sans-serif;font-weight:500;font-size:12px;letter-spacing:.14em;' + (on ? idle : act) + '">NO</button>' +
            '</div></div>';
        } else {
          var val = state[f.calc][f.key];
          html += '<label style="display:block;"><span style="display:block;font-family:\'Jost\',sans-serif;font-weight:400;font-size:12px;letter-spacing:.08em;color:rgba(242,237,225,.65);margin-bottom:7px;">' + f.label + '</span>' +
            '<span style="display:flex;align-items:center;border:1px solid rgba(242,237,225,.25);background:rgba(242,237,225,.05);padding:0 12px;">' +
            (f.prefix ? '<span style="font-family:\'Jost\',sans-serif;font-size:14px;color:#c4a56b;">' + f.prefix + '</span>' : '') +
            '<input type="number" data-field="' + f.calc + '.' + f.key + '" value="' + val + '" step="' + f.step + '" style="flex:1;min-width:0;background:transparent;border:none;color:#f2ede1;font-size:15.5px;font-weight:400;padding:12px 6px;">' +
            (f.suffix ? '<span style="font-family:\'Jost\',sans-serif;font-size:12.5px;color:rgba(242,237,225,.5);">' + esc(f.suffix) + '</span>' : '') +
            '</span></label>';
        }
      });
      html += '</div></div>';
    });
    host.innerHTML = html;
    // wire number inputs — update state + outputs only (keep focus)
    Array.prototype.forEach.call(host.querySelectorAll("input[data-field]"), function (inp) {
      inp.addEventListener("input", function () {
        var p = inp.getAttribute("data-field").split(".");
        var v = parseFloat(inp.value);
        state[p[0]][p[1]] = isNaN(v) ? 0 : v;
        renderOutputs();
      });
    });
    // wire toggles — re-render inputs (structure changes) + outputs
    Array.prototype.forEach.call(host.querySelectorAll("button[data-toggle]"), function (btn) {
      btn.addEventListener("click", function () {
        var p = btn.getAttribute("data-toggle").split(".");
        state[p[0]][p[1]] = btn.getAttribute("data-val") === "1";
        renderInputs(); renderOutputs();
      });
    });
  }

  function renderOutputs() {
    var r = compute();
    $("#an-hero-label").textContent = r.heroLabel;
    $("#an-hero-value").textContent = r.heroValue;
    var v = $("#an-verdict");
    v.textContent = r.verdict; v.style.color = r.verdictColor; v.style.borderColor = r.verdictColor;
    var out = "";
    r.outputs.forEach(function (o) {
      out += '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:13px 0;border-bottom:1px solid rgba(6,46,68,.12);">' +
        '<span style="font-family:\'Jost\',sans-serif;font-weight:300;font-size:14px;color:#3d4d59;">' + o.label + '</span>' +
        '<span style="font-family:\'Jost\',sans-serif;font-weight:500;font-size:15.5px;color:#062e44;white-space:nowrap;">' + o.value + '</span></div>';
    });
    $("#an-outputs").innerHTML = out;
    // tab styling
    Array.prototype.forEach.call(document.querySelectorAll(".an-tab"), function (t) {
      var on = t.getAttribute("data-tab") === state.tab;
      t.style.color = on ? "#c4a56b" : "rgba(242,237,225,.55)";
      t.style.borderBottom = "2px solid " + (on ? "#c4a56b" : "transparent");
    });
  }

  /* -------------------------------- CAROUSEL --------------------------------- */
  var STRIPS = {
    buyers: { ring: "rgba(6,46,68,.2)", bg: "repeating-linear-gradient(45deg, rgba(6,46,68,.045) 0 14px, transparent 14px 28px), #ece5d4", pc: "#062e44", cap: "#8a97a1",
      items: ["The buyer consult: what to expect", "Touring homes the TBG way", "Winning the offer without overpaying", "From contract to keys"] },
    sellers: { ring: "rgba(242,237,225,.22)", bg: "repeating-linear-gradient(45deg, rgba(242,237,225,.05) 0 14px, transparent 14px 28px), #0a3752", pc: "#f2ede1", cap: "rgba(242,237,225,.45)",
      items: ["Preparing your home to list", "Marketing that moves homes", "Pricing strategy, explained", "Closing day stories"] },
    investors: { ring: "rgba(6,46,68,.2)", bg: "repeating-linear-gradient(45deg, rgba(6,46,68,.045) 0 14px, transparent 14px 28px), #ece5d4", pc: "#062e44", cap: "#8a97a1",
      items: ["Fix & flip walkthrough", "New construction site update", "A DSCR rental, underwritten live", "How we source off-market"] }
  };
  var tracks = {};
  function buildStrip(name) {
    var cfg = STRIPS[name], track = $("#track-" + name), cards = [];
    var all = cfg.items.concat(cfg.items).concat(cfg.items); // ×3
    var html = "";
    all.forEach(function (title) {
      html += '<div class="tbg-card" style="flex:0 0 260px;aspect-ratio:9/16;transform-origin:left center;border:1px solid ' + cfg.ring + ';background:' + cfg.bg + ';display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;position:relative;transition:transform .72s cubic-bezier(.4,0,.2,1),box-shadow .72s ease,opacity .72s ease,border-color .72s ease;opacity:.72;">' +
        '<div style="width:62px;height:62px;border:1px solid #c4a56b;border-radius:50%;display:grid;place-items:center;"><div style="width:0;height:0;border-left:15px solid ' + cfg.pc + ';border-top:9px solid transparent;border-bottom:9px solid transparent;margin-left:4px;"></div></div>' +
        '<div style="font-family:\'Cormorant Garamond\',serif;font-weight:500;font-size:22px;color:' + cfg.pc + ';text-align:center;padding:0 24px;text-wrap:balance;">' + title + '</div>' +
        '<div style="position:absolute;bottom:18px;font-family:monospace;font-size:10.5px;letter-spacing:.12em;color:' + cfg.cap + ';">VIDEO PLACEHOLDER · MP4 · 9:16</div></div>';
    });
    track.innerHTML = html;
    tracks[name] = { track: track, cards: track.querySelectorAll(".tbg-card"), ring: cfg.ring };
  }
  function paintCarousel() {
    Object.keys(tracks).forEach(function (name) {
      var t = tracks[name];
      t.track.style.transition = state.snap ? "none" : "transform .72s cubic-bezier(.4,0,.2,1)";
      t.track.style.transform = "translateX(" + (40 - state.slotIdx * 280) + "px)";
      Array.prototype.forEach.call(t.cards, function (card, j) {
        if (j === state.slotIdx) {
          card.style.transform = "scale(1.14)"; card.style.borderColor = "#c4a56b";
          card.style.boxShadow = "0 24px 60px rgba(6,46,68,.30)"; card.style.opacity = "1"; card.style.zIndex = "2";
        } else {
          card.style.transform = "none"; card.style.borderColor = t.ring;
          card.style.boxShadow = "none"; card.style.opacity = ".72"; card.style.zIndex = "1";
        }
      });
    });
  }
  function startCarousel() {
    ["buyers", "sellers", "investors"].forEach(buildStrip);
    paintCarousel();
    setInterval(function () {
      var next = state.slotIdx + 1;
      state.slotIdx = next; state.snap = false; paintCarousel();
      if (next >= 4) {
        setTimeout(function () { state.slotIdx = 0; state.snap = true; paintCarousel(); }, 760);
      }
    }, 2600);
  }

  /* ---------------------------------- FORM ----------------------------------- */
  var SUBMIT_LABELS = { buyer: "REQUEST BUYER CONSULT", seller: "REQUEST LISTING CONSULT", investor: "JOIN THE INVESTOR LIST" };
  function paintForm() {
    var aud = state.audience;
    Array.prototype.forEach.call(document.querySelectorAll(".aud-btn"), function (b) {
      var on = b.getAttribute("data-aud") === aud;
      b.style.background = on ? "#062e44" : "transparent";
      b.style.color = on ? "#f2ede1" : "#062e44";
      b.style.borderColor = on ? "#062e44" : "rgba(6,46,68,.3)";
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-cond]"), function (el) {
      var show = el.getAttribute("data-cond") === aud;
      el.style.display = show ? "" : "none";
      el.disabled = !show; // so hidden required fields don't block submit
    });
    $("#submit-btn").textContent = SUBMIT_LABELS[aud];
  }

  /* --------------------------------- INTRO ----------------------------------- */
  function initIntro() {
    var intro = $("#intro");
    if (!intro) return;
    try {
      if (sessionStorage.getItem("tbg_seen")) { intro.parentNode.removeChild(intro); return; }
      sessionStorage.setItem("tbg_seen", "1");
    } catch (e) { /* private mode */ }
    setTimeout(function () { if (intro && intro.parentNode) intro.parentNode.removeChild(intro); }, 4600);
  }

  /* ------------------------------ SCROLL REVEAL ------------------------------ */
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { Array.prototype.forEach.call(els, function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    Array.prototype.forEach.call(els, function (e) { io.observe(e); });
  }

  /* ---------------------------------- BOOT ----------------------------------- */
  function boot() {
    initIntro();
    initReveal();
    renderInputs(); renderOutputs();
    startCarousel();
    paintForm();

    Array.prototype.forEach.call(document.querySelectorAll(".an-tab"), function (t) {
      t.addEventListener("click", function () { state.tab = t.getAttribute("data-tab"); renderInputs(); renderOutputs(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll(".aud-btn"), function (b) {
      b.addEventListener("click", function () { state.audience = b.getAttribute("data-aud"); paintForm(); });
    });
    var form = $("#lead-form");
    if (form) form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $("#submit-btn"), orig = btn.textContent;
      btn.disabled = true; btn.textContent = "SENDING…";
      var data = { _subject: "New " + state.audience + " lead — The Banks Group", audience: state.audience };
      Array.prototype.forEach.call(form.elements, function (el) { if (el.name && !el.disabled && el.value) data[el.name] = el.value; });
      var done = function () { $("#form-pending").style.display = "none"; $("#form-done").style.display = "block"; btn.disabled = false; btn.textContent = orig; };
      fetch("https://formsubmit.co/ajax/" + encodeURIComponent(LEAD_EMAIL), {
        method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(data)
      }).then(done).catch(done);
    });
    var reset = $("#reset-form");
    if (reset) reset.addEventListener("click", function () {
      $("#form-done").style.display = "none";
      $("#form-pending").style.display = "block";
      if (form) form.reset();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
