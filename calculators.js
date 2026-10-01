/* The Banks Group — calculators page.
   Seven independent calculators, one shown at a time. Each has a few key
   inputs up front (with sliders), the rest under "Advanced", and a results
   card with a breakdown chart. Fix & flip, new construction and DSCR use the
   same math as the home-page Deal Analyzer (site.js) so the two never disagree. */
(function () {
  "use strict";

  /* --------------------------------- HELPERS --------------------------------- */
  function fmt$(n) {
    if (!isFinite(n)) return "—";
    var neg = n < 0;
    return (neg ? "-$" : "$") + Math.round(Math.abs(n)).toLocaleString("en-US");
  }
  function fmtPct(n, dp) { return isFinite(n) ? (n * 100).toFixed(dp == null ? 1 : dp) + "%" : "—"; }
  function fmtRate(n) { return isFinite(n) ? n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + "%" : "—"; }
  function fmtMo(n) {
    if (!isFinite(n) || n <= 0) return "—";
    var m = Math.ceil(n), y = Math.floor(m / 12), r = m % 12;
    return m + " mo" + (y ? " (" + y + " yr" + (y > 1 ? "s" : "") + (r ? " " + r + " mo" : "") + ")" : "");
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // Monthly principal & interest on a fully amortizing loan.
  function pmt(loan, ratePct, years) {
    var r = ratePct / 100 / 12, n = years * 12;
    if (loan <= 0 || n <= 0) return 0;
    return r > 0 ? loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : loan / n;
  }
  // Largest x in [lo, hi] with f(x) <= target, for f increasing in x.
  function solveMax(f, target, lo, hi) {
    if (f(lo) > target) return NaN;
    for (var i = 0; i < 80; i++) {
      var mid = (lo + hi) / 2;
      if (f(mid) <= target) lo = mid; else hi = mid;
    }
    return lo;
  }

  var GOOD = "#2e6b46", WARN = "#8a7345", BAD = "#a33b2e";
  // Chart palette, tuned to the site's navy / gold / cream.
  var C = { navy: "#0a3a55", gold: "#c4a56b", teal: "#4f7d8c", rust: "#b5654a", sage: "#7d9a7a", stone: "#a9a08c", green: "#2e6b46" };

  /* Field builders. opts: { slider: [min, max, step] } */
  function num(key, label, prefix, suffix, step, opts) {
    return Object.assign({ kind: "number", key: key, label: label, prefix: prefix || "", suffix: suffix || "", step: step || 1 }, opts || {});
  }
  function toggle(key, label) { return { kind: "toggle", key: key, label: label }; }
  function dropdown(key, label, options) { return { kind: "select", key: key, label: label, options: options }; }
  // A dollar amount and its % of a base value (e.g. down payment of price), edited either way; state holds the %.
  function moneyPct(key, label, base, opts) { return Object.assign({ kind: "moneypct", key: key, label: label, base: base }, opts || {}); }

  /* ------------------------- HOME-LOAN PROGRAM RULES -------------------------- */
  var LOAN_LIMIT = 1249125;          // 2026 one-unit conforming & FHA limit across the DC metro
  var TAX_RATE = 1.0;                // est. property tax, % of price per year (DMV average)
  var INS_RATE = 0.35;               // est. homeowners insurance, % of price per year
  var CLOSING_PCT = 2.5;             // est. buyer closing costs, % of price
  var RATE_DROP_PER_POINT = 0.25;    // common rule of thumb; lenders price daily
  var COMFORT = { front: 28, back: 36 }; // classic "comfortable" budget ratios

  var PROGRAMS = {
    conv: { name: "Conventional", minDown: 3, maxFront: Infinity, maxBack: 45, limit: LOAN_LIMIT },
    fha: { name: "FHA", minDown: 3.5, maxFront: 31, maxBack: 43, limit: LOAN_LIMIT },
    va: { name: "VA", minDown: 0, maxFront: Infinity, maxBack: 41, limit: Infinity }
  };
  var TYPE_OPTIONS = [["conv", "Conventional"], ["fha", "FHA"], ["va", "VA"]];
  var TERM_OPTIONS = [[30, "30-year fixed"], [20, "20-year fixed"], [15, "15-year fixed"]];
  var POINT_OPTIONS = [[0, "None"], [0.5, "0.5 point"], [1, "1 point"], [1.5, "1.5 points"], [2, "2 points"]];

  // Conventional PMI, annual % of the loan, by down payment (typical for good credit).
  function convPmi(down) { return down >= 20 ? 0 : down >= 15 ? 0.25 : down >= 10 ? 0.4 : down >= 5 ? 0.55 : 0.7; }
  // FHA annual MIP (HUD schedule; 15-year and shorter loans price lower).
  function fhaMip(base, down, term) {
    if (term <= 15) return down >= 10 ? 0.15 : base > 726200 ? 0.4 : 0.15;
    return base > 726200 ? (down >= 5 ? 0.7 : 0.75) : (down >= 5 ? 0.5 : 0.55);
  }
  // VA funding fee, % of the loan, by down payment and first vs. later use.
  function vaFee(down, subsequent) { return down >= 10 ? 1.25 : down >= 5 ? 1.5 : (subsequent ? 3.3 : 2.15); }

  // Monthly cost of owning at a price. taxMo / insMo default to DMV estimates.
  function homeCost(s, price, down, rate, taxMo, insMo) {
    down = clamp(down, 0, 100);
    var base = price * (1 - down / 100), upfront = 0, annualMi = 0;
    if (s.type === "conv") annualMi = convPmi(down);
    if (s.type === "fha") { upfront = 1.75; annualMi = fhaMip(base, down, s.term); }
    if (s.type === "va") upfront = s.vaExempt ? 0 : vaFee(down, s.vaSubsequent);
    var loan = base * (1 + upfront / 100);
    var pi = pmt(loan, rate, s.term), mi = base * annualMi / 100 / 12;
    var tax = taxMo != null ? taxMo : price * TAX_RATE / 100 / 12;
    var ins = insMo != null ? insMo : price * INS_RATE / 100 / 12;
    var hoa = s.hoa || 0;
    return { base: base, loan: loan, fee: loan - base, upfront: upfront, pi: pi, mi: mi, tax: tax, ins: ins, hoa: hoa, total: pi + mi + tax + ins + hoa };
  }

  function miLabel(type) { return type === "fha" ? "FHA insurance (MIP)" : type === "va" ? "Mortgage insurance" : "PMI"; }
  function paymentChart(type, c) {
    return { segments: [["Principal & interest", c.pi, C.navy], [miLabel(type), c.mi, C.rust], ["Property taxes", c.tax, C.gold], ["Home insurance", c.ins, C.teal], ["HOA", c.hoa, C.sage]] };
  }
  function feeRow(s, c) {
    if (s.type === "va") return ["VA funding fee (financed)", c.upfront ? fmt$(c.fee) : "Waived"];
    if (s.type === "fha") return ["Upfront MIP (1.75%, financed)", fmt$(c.fee)];
    return null;
  }
  function vaQuestions(s) {
    return s.type === "va" ? [ toggle("vaSubsequent", "Used a VA loan before?"), toggle("vaExempt", "VA disability? (no funding fee)") ] : [];
  }
  var ASSUMPTIONS = "Property taxes are estimated at 1% and homeowners insurance at 0.35% of the price per year. Loan limit: $1,249,125 across the DC metro in 2026 (St. Mary's County is lower).";

  /* ------------------------------- CALCULATORS ------------------------------- */
  var CALCS = {};

  // ---------- Mortgage payment ----------
  CALCS.payment = {
    state: { price: 500000, down: 10, type: "conv", term: 30, rate: 6.5, taxPct: 1.0, insYr: 1750, hoa: 0, vaSubsequent: false, vaExempt: false },
    compute: function (s) {
      var p = PROGRAMS[s.type];
      var c = homeCost(s, s.price, s.down, s.rate, s.price * s.taxPct / 100 / 12, s.insYr / 12);
      var interest = c.pi * s.term * 12 - c.loan;
      var verdict, color;
      if (s.down < p.minDown) { verdict = p.name.toUpperCase() + " NEEDS AT LEAST " + p.minDown + "% DOWN"; color = BAD; }
      else if (c.base > p.limit && s.type === "conv") { verdict = "ABOVE THE CONFORMING LIMIT — JUMBO LOAN"; color = WARN; }
      else if (c.base > p.limit) { verdict = "ABOVE THE FHA LOAN LIMIT"; color = BAD; }
      else if (s.type === "conv" && s.down < 20) { verdict = "PMI UNTIL YOU REACH 20% EQUITY"; color = WARN; }
      else { verdict = p.name.toUpperCase() + " · " + s.term + "-YEAR FIXED"; color = GOOD; }
      var outputs = [
        ["Loan amount", fmt$(c.loan)],
        ["Down payment (" + +s.down.toFixed(2) + "%)", fmt$(s.price * s.down / 100)],
        ["Total interest over " + s.term + " years", fmt$(interest)],
        ["Est. cash to close", fmt$(s.price * s.down / 100 + s.price * CLOSING_PCT / 100)]
      ];
      var fee = feeRow(s, c); if (fee) outputs.splice(1, 0, fee);
      return {
        groups: [
          { fields: [ num("price", "Home price", "$", "", 5000, { slider: [100000, 2000000, 5000] }), moneyPct("down", "Down payment", "price", { slider: [0, 40, 0.5] }), dropdown("type", "Loan type", TYPE_OPTIONS), num("rate", "Interest rate", "", "%", 0.125, { slider: [3, 10, 0.125] }) ].concat(vaQuestions(s)) },
          { adv: true, fields: [ dropdown("term", "Loan term", TERM_OPTIONS), moneyPct("taxPct", "Property tax (per year)", "price"), num("insYr", "Home insurance", "$", "/yr", 50), num("hoa", "HOA dues", "$", "/mo", 10) ] }
        ],
        heroLabel: "YOUR MONTHLY PAYMENT", heroValue: fmt$(c.total),
        verdict: verdict, verdictColor: color, chart: paymentChart(s.type, c), outputs: outputs,
        note: "Mortgage insurance is added automatically for your loan type and down payment. Closing costs are estimated at 2.5% of the price."
      };
    }
  };

  // ---------- Affordability (sliding scale) ----------
  // Highest price a budget allows with a fixed cash down payment.
  function affordAt(s, rate, front, back) {
    var p = PROGRAMS[s.type], monthly = s.income / 12;
    var budget = Math.min(monthly * front / 100, monthly * back / 100 - s.debts);
    var cost = function (price) { return homeCost(s, price, price > 0 ? s.down / price * 100 : 100, rate).total; };
    var byIncome = solveMax(cost, budget, 1000, 2e7);
    var byDown = p.minDown > 0 ? s.down / (p.minDown / 100) : Infinity;
    var byLimit = p.limit + s.down;
    var price = Math.min(byIncome, byDown, byLimit);
    var limitedBy = !isFinite(byIncome) ? "debts" : price === byDown && byDown < byIncome ? "down" : price === byLimit && byLimit < byIncome ? "limit" : "income";
    return { price: isFinite(byIncome) ? price : NaN, limitedBy: limitedBy };
  }
  CALCS.affordability = {
    state: { type: "conv", income: 120000, debts: 500, down: 40000, rate: 6.5, term: 30, points: 0, hoa: 0, vaSubsequent: false, vaExempt: false, pick: 0, picked: false },
    onInput: function (s) { s.picked = false; },
    compute: function (s) {
      var p = PROGRAMS[s.type];
      var rate = Math.max(0, s.rate - s.points * RATE_DROP_PER_POINT);
      var comfy = affordAt(s, rate, COMFORT.front, COMFORT.back);
      var stretch = affordAt(s, rate, p.maxFront, p.maxBack);
      var ok = isFinite(comfy.price);
      var hi = Math.max(isFinite(stretch.price) ? stretch.price * 1.15 : 0, ok ? comfy.price * 1.3 : 0, 150000);
      hi = Math.ceil(hi / 10000) * 10000;
      if (!s.picked) s.pick = ok ? Math.round(comfy.price / 1000) * 1000 : 0;
      s.pick = clamp(s.pick, 0, hi);
      var P = s.pick, downPct = P > 0 ? s.down / P * 100 : 100;
      var c = homeCost(s, P, downPct, rate);
      var monthly = s.income / 12;
      var backDti = monthly > 0 ? (c.total + s.debts) / monthly : NaN;
      var tooLittleDown = downPct < p.minDown;
      var zone = P <= (ok ? comfy.price : 0) + 1 ? "comfy" : isFinite(stretch.price) && P <= stretch.price + 1 ? "stretch" : "over";
      var verdict, color;
      if (!ok) { verdict = "MONTHLY DEBTS ARE TOO HIGH FOR THIS INCOME"; color = BAD; }
      else if (tooLittleDown) { verdict = "NEEDS MORE DOWN — " + p.name.toUpperCase() + " MINIMUM IS " + p.minDown + "%"; color = BAD; }
      else if (zone === "comfy") { verdict = "COMFORTABLE — FITS YOUR BUDGET"; color = GOOD; }
      else if (zone === "stretch") { verdict = "A STRETCH — WITHIN " + p.name.toUpperCase() + " LIMITS"; color = WARN; }
      else { verdict = "ABOVE WHAT LENDERS WILL APPROVE"; color = BAD; }
      var outputs = [
        ["Down payment", fmt$(s.down) + " (" + (isFinite(downPct) ? +downPct.toFixed(1) : 0) + "%)"],
        ["Loan amount", fmt$(c.loan)],
        ["Debt-to-income at this price", fmtPct(backDti)],
        ["Est. cash to close", fmt$(s.down + c.loan * s.points / 100 + P * CLOSING_PCT / 100)]
      ];
      var fee = feeRow(s, c); if (fee) outputs.splice(2, 0, fee);
      if (s.points > 0) {
        var ptSave = pmt(c.loan, s.rate, s.term) - c.pi, ptCost = c.loan * s.points / 100;
        outputs.push(["Rate after points", fmtRate(rate)], ["Cost of points", fmt$(ptCost)], ["Points pay for themselves in", fmtMo(ptSave > 0 ? ptCost / ptSave : NaN)]);
      }
      if (ok && comfy.limitedBy === "down") outputs.push(["Note", "Your down payment caps the price"]);
      if (ok && comfy.limitedBy === "limit") outputs.push(["Note", "Capped by the loan limit"]);
      return {
        groups: [
          { fields: [ num("income", "Annual income (before taxes)", "$", "/yr", 1000, { slider: [30000, 500000, 1000] }), num("debts", "Monthly debts", "$", "/mo", 25, { slider: [0, 5000, 25] }), num("down", "Down payment", "$", "", 1000, { slider: [0, 300000, 1000] }), dropdown("type", "Loan type", TYPE_OPTIONS) ].concat(vaQuestions(s)) },
          { adv: true, fields: [ num("rate", "Interest rate", "", "%", 0.125, { slider: [3, 10, 0.125] }), dropdown("term", "Loan term", TERM_OPTIONS), dropdown("points", "Discount points", POINT_OPTIONS), num("hoa", "HOA dues", "$", "/mo", 10) ] }
        ],
        heroLabel: "YOU CAN COMFORTABLY AFFORD UP TO", heroValue: ok ? fmt$(comfy.price) : "—",
        verdict: verdict, verdictColor: color,
        scale: {
          key: "pick", min: 0, max: hi, step: 1000, value: P, label: "Drag to try a price: " + fmt$(P) + " · " + fmt$(c.total) + "/mo",
          zones: [[ok ? comfy.price : 0, GOOD], [isFinite(stretch.price) ? stretch.price : 0, C.gold], [hi, BAD]],
          legend: [["Comfortable", GOOD], ["Stretch", C.gold], ["Over limit", BAD]]
        },
        chart: paymentChart(s.type, c),
        outputs: outputs,
        note: "Comfortable means your house payment is about 28% of income and all debts stay under 36%. Stretch goes up to the loan program's own limit. " + ASSUMPTIONS
      };
    }
  };

  // ---------- Maximum mortgage by loan type ----------
  CALCS.maxloan = {
    state: { type: "conv", income: 120000, debts: 500, rate: 6.5, term: 30, hoa: 0, firstTime: false, vaSubsequent: false, vaExempt: false },
    compute: function (s) {
      var p = PROGRAMS[s.type];
      var down = s.type === "va" ? 0 : s.type === "fha" ? 3.5 : (s.firstTime ? 3 : 5);
      var monthly = s.income / 12;
      var budget = Math.min(monthly * p.maxFront / 100, monthly * p.maxBack / 100 - s.debts);
      var incomePrice = solveMax(function (x) { return homeCost(s, x, down, s.rate).total; }, budget, 0, 2e7);
      var ok = isFinite(incomePrice) && incomePrice > 1000;
      var capped = ok && incomePrice * (1 - down / 100) > p.limit;
      var price = !ok ? 0 : capped ? p.limit / (1 - down / 100) : incomePrice;
      var c = homeCost(s, price, down, s.rate);
      var outputs = [
        ["Maximum purchase price", ok ? fmt$(price) : "—"],
        ["Minimum down payment (" + down + "%)", fmt$(price * down / 100)],
        ["Debt-to-income limit", (isFinite(p.maxFront) ? p.maxFront + "% housing / " : "") + p.maxBack + "% total"],
        ["Loan limit", isFinite(p.limit) ? fmt$(p.limit) : "None (full entitlement)"]
      ];
      var fee = feeRow(s, c); if (fee) outputs.splice(2, 0, fee);
      if (capped && s.type === "conv") outputs.push(["Your income supports (jumbo)", fmt$(incomePrice)]);
      var verdict, color;
      if (!ok) { verdict = "MONTHLY DEBTS EXCEED THE " + p.name.toUpperCase() + " LIMIT"; color = BAD; }
      else if (capped && s.type === "conv") { verdict = "INCOME SUPPORTS MORE — ABOVE THIS IS JUMBO"; color = WARN; }
      else if (capped) { verdict = "CAPPED BY THE FHA LOAN LIMIT"; color = WARN; }
      else { verdict = "MAXIMUM " + p.name.toUpperCase() + " APPROVAL ESTIMATE"; color = GOOD; }
      var notes = {
        conv: "Conventional loans allow up to 45% of income for all debts, and automated approvals can go higher. PMI drops off once you reach 22% equity.",
        fha: "FHA allows 31% of income for housing and 43% for all debts, and automated approvals often go higher. FHA insurance stays for the life of the loan with under 10% down.",
        va: "VA uses 41% of income as a guideline and also checks your residual income, the money left each month after all bills. There's no down payment and no monthly mortgage insurance."
      };
      return {
        groups: [
          { fields: [ dropdown("type", "Loan type", TYPE_OPTIONS), num("income", "Annual income (before taxes)", "$", "/yr", 1000, { slider: [30000, 500000, 1000] }), num("debts", "Monthly debts", "$", "/mo", 25, { slider: [0, 5000, 25] }), num("rate", "Interest rate", "", "%", 0.125, { slider: [3, 10, 0.125] }) ].concat(s.type === "conv" ? [ toggle("firstTime", "First-time homebuyer? (3% down)") ] : vaQuestions(s)) },
          { adv: true, fields: [ dropdown("term", "Loan term", TERM_OPTIONS), num("hoa", "HOA dues", "$", "/mo", 10) ] }
        ],
        heroLabel: "MAXIMUM " + p.name.toUpperCase() + " LOAN", heroValue: ok ? fmt$(c.loan) : "—",
        verdict: verdict, verdictColor: color, chart: paymentChart(s.type, c), outputs: outputs,
        chartTitle: "PAYMENT AT THE MAXIMUM",
        note: notes[s.type] + " " + ASSUMPTIONS
      };
    }
  };

  // ---------- Refinance ----------
  CALCS.refinance = {
    state: { value: 650000, balance: 420000, curRate: 7.25, yearsLeft: 28, newRate: 6.25, newTerm: 30, cashOut: 0, closing: 7500, points: 0, roll: false },
    compute: function (s) {
      var curPI = pmt(s.balance, s.curRate, s.yearsLeft);
      var base = s.balance + s.cashOut;
      // Points are a % of the final loan, so rolling them in grows the loan they're charged on.
      var newLoan = s.roll ? (base + s.closing) / (1 - s.points / 100) : base;
      var pointsCost = newLoan * s.points / 100;
      var costs = s.closing + pointsCost;
      var newPI = pmt(newLoan, s.newRate, s.newTerm);
      var savings = curPI - newPI;
      var breakeven = savings > 0 ? costs / savings : NaN;
      var ltv = s.value > 0 ? newLoan / s.value : NaN;
      var curInterest = curPI * s.yearsLeft * 12 - s.balance;
      var newInterest = newPI * s.newTerm * 12 - newLoan;
      var verdict, color;
      if (s.cashOut > 0 && ltv > 0.8) { verdict = "ABOVE 80% LTV — MOST CASH-OUT PROGRAMS CAP HERE"; color = BAD; }
      else if (s.cashOut > 0) { verdict = "CASH-OUT WITHIN 80% LTV"; color = GOOD; }
      else if (!(savings > 0)) { verdict = "NO MONTHLY SAVINGS — HOLD YOUR RATE"; color = BAD; }
      else if (breakeven <= 36) { verdict = "BREAKS EVEN IN ≤ 3 YEARS — WORTH A LOOK"; color = GOOD; }
      else if (breakeven <= 60) { verdict = "3–5 YEAR BREAK-EVEN — ONLY IF YOU'RE STAYING"; color = WARN; }
      else { verdict = "LONG BREAK-EVEN — LIKELY NOT WORTH IT"; color = BAD; }
      var outputs = [
        ["New loan amount", fmt$(newLoan)],
        ["Loan-to-value", fmtPct(ltv)],
        ["Closing costs + points", fmt$(costs)],
        ["Cash due at closing", fmt$(s.roll ? 0 : costs)],
        ["Break-even on costs", s.cashOut > 0 && !(savings > 0) ? "n/a (cash-out)" : fmtMo(breakeven)],
        ["Lifetime interest change", fmt$(newInterest - curInterest)]
      ];
      if (s.cashOut > 0) outputs.splice(1, 0, ["Net cash in hand", fmt$(s.cashOut - (s.roll ? 0 : costs))]);
      return {
        groups: [
          { fields: [ num("value", "Home value today", "$", "", 5000, { slider: [100000, 2000000, 5000] }), num("balance", "Current loan balance", "$", "", 1000, { slider: [0, 1500000, 1000] }), num("curRate", "Current interest rate", "", "%", 0.125, { slider: [2, 10, 0.125] }), num("newRate", "New interest rate", "", "%", 0.125, { slider: [2, 10, 0.125] }) ] },
          { adv: true, fields: [ num("yearsLeft", "Years left on current loan", "", "yrs", 1), dropdown("newTerm", "New loan term", [[30, "30 years"], [20, "20 years"], [15, "15 years"], [10, "10 years"]]), num("cashOut", "Cash out (optional)", "$", "", 1000), num("closing", "Closing costs", "$", "", 250), num("points", "Discount points", "", "pts", 0.25), toggle("roll", "Roll costs into the loan?") ] }
        ],
        heroLabel: savings >= 0 ? "MONTHLY SAVINGS" : "MONTHLY PAYMENT INCREASE", heroValue: fmt$(Math.abs(savings)),
        verdict: verdict, verdictColor: color,
        bars: { title: "PRINCIPAL & INTEREST", rows: [["Current", curPI, C.stone], ["New", newPI, savings >= 0 ? C.green : C.rust]] },
        outputs: outputs,
        note: "Resetting to a new 30-year term can lower the payment but raise lifetime interest — check the last line above."
      };
    }
  };

  // ---------- Fix & Flip ----------
  CALCS.fixflip = {
    state: { purchase: 450000, closingBuyPct: 2, rehab: 85000, arv: 650000, months: 6, holdMo: 850, ltc: 85, rate: 10.5, points: 2, commissionPct: 5, sellClosePct: 1.5 },
    compute: function (ff) {
      var loanBase = ff.purchase + ff.rehab;
      var loan = loanBase * ff.ltc / 100;
      var points = loan * ff.points / 100;
      var interest = loan * (ff.rate / 100) * (ff.months / 12);
      var closingBuy = ff.purchase * ff.closingBuyPct / 100;
      var holding = ff.holdMo * ff.months;
      var sellCosts = ff.arv * (ff.commissionPct + ff.sellClosePct) / 100;
      var total = ff.purchase + ff.rehab + closingBuy + holding + interest + points + sellCosts;
      var profit = ff.arv - total;
      var cash = (loanBase - loan) + closingBuy + points + holding + interest;
      var roi = total > 0 ? profit / total : NaN;
      var coc = cash > 0 ? profit / cash : NaN;
      var cocAnnual = ff.months > 0 ? coc * 12 / ff.months : NaN;
      var good = profit > 0 && roi >= 0.08 && coc >= 0.30;
      return {
        groups: [
          { fields: [ num("purchase", "Purchase price", "$", "", 5000, { slider: [50000, 1500000, 5000] }), num("rehab", "Rehab budget", "$", "", 1000, { slider: [0, 400000, 1000] }), num("arv", "After-repair value (ARV)", "$", "", 5000, { slider: [50000, 2500000, 5000] }), num("months", "Hold time", "", "mo", 1, { slider: [1, 18, 1] }) ] },
          { adv: true, fields: [ num("ltc", "Loan-to-cost", "", "%"), num("rate", "Interest rate", "", "%", 0.125), num("points", "Lender points", "", "pts", 0.25), num("closingBuyPct", "Purchase closing costs", "", "%", 0.25), num("holdMo", "Holding costs / month", "$"), num("commissionPct", "Sale commission", "", "%", 0.25), num("sellClosePct", "Seller closing costs", "", "%", 0.25) ] }
        ],
        heroLabel: "PROJECTED NET PROFIT", heroValue: fmt$(profit),
        verdict: profit <= 0 ? "UNDERWATER — RENEGOTIATE" : (good ? "STRONG FLIP CANDIDATE" : "THIN MARGIN — PROCEED CAREFULLY"),
        verdictColor: profit <= 0 ? BAD : (good ? GOOD : WARN),
        chartTitle: "WHERE THE SALE PRICE GOES",
        chart: { segments: [["Purchase + rehab", ff.purchase + ff.rehab, C.navy], ["Interest + points", interest + points, C.rust], ["Closing + holding", closingBuy + holding, C.teal], ["Selling costs", sellCosts, C.stone], ["Profit", profit, C.green]] },
        outputs: [
          ["Cash required", fmt$(cash)],
          ["Loan amount (" + ff.ltc + "% LTC)", fmt$(loan)],
          ["ROI on project cost", fmtPct(roi)],
          ["Cash-on-cash (project / annualized)", fmtPct(coc) + " / " + fmtPct(cocAnnual)],
          ["70%-rule max offer", fmt$(ff.arv * 0.7 - ff.rehab)]
        ],
        note: "Our bar for a strong flip: 8%+ ROI on project cost and 30%+ cash-on-cash. Financing defaults to 85% loan-to-cost at 10.5% with 2 points — adjust under Advanced."
      };
    }
  };

  // ---------- New Construction ----------
  CALCS.construction = {
    state: { land: 220000, sqft: 2800, costSqft: 185, softPct: 12, closingBuyPct: 2, months: 12, holdMo: 600, ltc: 80, rate: 11, points: 2, salePrice: 1050000, commissionPct: 5, sellClosePct: 1.5, subdivide: false, lots: 2, subCosts: 45000, siteWorkPerLot: 35000, pricePerUnit: 950000 },
    compute: function (nc) {
      var sub = !!nc.subdivide;
      var units = sub ? Math.max(1, Math.round(nc.lots)) : 1;
      var build = nc.sqft * nc.costSqft * units;
      var subCosts = sub ? nc.subCosts + nc.siteWorkPerLot * units : 0;
      var gross = sub ? nc.pricePerUnit * units : nc.salePrice;
      var soft = build * nc.softPct / 100;
      var closingBuy = nc.land * nc.closingBuyPct / 100;
      var holding = nc.holdMo * nc.months;
      var loan = (nc.land + build) * nc.ltc / 100;
      var points = loan * nc.points / 100;
      var interest = loan * (nc.rate / 100) * (nc.months / 12) * 0.6; // ~60% average balance across draws
      var sellCosts = gross * (nc.commissionPct + nc.sellClosePct) / 100;
      var total = nc.land + build + soft + subCosts + closingBuy + holding + interest + points + sellCosts;
      var profit = gross - total;
      var margin = gross > 0 ? profit / gross : NaN;
      var cash = (nc.land + build - loan) + soft + subCosts + closingBuy + points + holding + interest;
      var roi = cash > 0 ? profit / cash : NaN;
      var annual = nc.months > 0 ? roi * 12 / nc.months : NaN;
      var outputs = [
        ["All-in project cost", fmt$(total)],
        ["Cash required", fmt$(cash)],
        ["Loan amount (" + nc.ltc + "% LTC)", fmt$(loan)],
        ["Profit margin on sale", fmtPct(margin)],
        ["Cash-on-cash (project / annualized)", fmtPct(roi) + " / " + fmtPct(annual)]
      ];
      if (sub) outputs.push(["Gross sales (" + units + " units)", fmt$(gross)], ["Profit per unit", fmt$(profit / units)]);
      var good = margin > 0.15;
      var main = [ num("land", "Land / lot cost", "$", "", 5000, { slider: [0, 1500000, 5000] }), num("sqft", sub ? "Finished area per unit" : "Finished area", "", "sqft", 50, { slider: [800, 8000, 50] }), num("costSqft", "Build cost / sqft", "$", "", 5, { slider: [100, 600, 5] }) ];
      main.push(sub ? num("pricePerUnit", "Sale price per unit", "$", "", 5000, { slider: [200000, 3000000, 5000] }) : num("salePrice", "Projected sale price", "$", "", 5000, { slider: [200000, 4000000, 5000] }));
      var adv = [ num("months", "Build + sale timeline", "", "mo"), toggle("subdivide", "Subdividing the property?") ];
      if (sub) adv.push(num("lots", "Number of lots / units", "", "lots"), num("subCosts", "Subdivision & entitlement costs", "$", "", 1000), num("siteWorkPerLot", "Site work & utilities per lot", "$", "", 1000));
      adv.push(num("softPct", "Soft costs (design, permits)", "", "%", 0.5), num("closingBuyPct", "Land closing costs", "", "%", 0.25), num("ltc", "Construction loan LTC", "", "%"), num("rate", "Interest rate", "", "%", 0.125), num("points", "Lender points", "", "pts", 0.25), num("holdMo", "Carrying costs / month", "$"), num("commissionPct", "Sale commission", "", "%", 0.25), num("sellClosePct", "Seller closing costs", "", "%", 0.25));
      return {
        groups: [ { fields: main }, { adv: true, fields: adv } ],
        heroLabel: "PROJECTED DEVELOPMENT PROFIT", heroValue: fmt$(profit),
        verdict: profit <= 0 ? "UNDERWATER — REWORK THE BUDGET" : (good ? "HEALTHY DEVELOPMENT MARGIN" : "BELOW 15% MARGIN — TIGHT"),
        verdictColor: profit <= 0 ? BAD : (good ? GOOD : WARN),
        chartTitle: "WHERE THE SALE PRICE GOES",
        chart: { segments: [["Land + build", nc.land + build, C.navy], ["Soft + site costs", soft + subCosts, C.gold], ["Interest + points", interest + points, C.rust], ["Closing + carrying", closingBuy + holding, C.teal], ["Selling costs", sellCosts, C.stone], ["Profit", profit, C.green]] },
        outputs: outputs,
        note: "Interest assumes an average of ~60% of the loan drawn over the build. Timeline, financing, soft costs and subdivision are under Advanced."
      };
    }
  };

  // ---------- DSCR Rental ----------
  CALCS.dscr = {
    state: { purchase: 400000, closing: 12000, rehab: 0, downPct: 20, rate: 7.25, term: 30, rent: 4000, otherInc: 0, vacancyPct: 5, taxes: 4200, insurance: 1400, hoa: 0, mgmtPct: 8, maintPct: 5, capexPct: 5, targetDscr: 1.2 },
    compute: function (d) {
      var loan = d.purchase * (1 - d.downPct / 100);
      var pi = pmt(loan, d.rate, d.term);
      var egi = (d.rent + d.otherInc) * 12 * (1 - d.vacancyPct / 100);
      var reserves = egi * (d.mgmtPct + d.maintPct + d.capexPct) / 100;
      var fixed = d.taxes + d.insurance + d.hoa * 12;
      var noi = egi - fixed - reserves;
      var ads = pi * 12;
      var dscr = ads > 0 ? noi / ads : NaN;
      var cap = (d.purchase + d.rehab) > 0 ? noi / (d.purchase + d.rehab) : NaN;
      var cash = d.purchase * d.downPct / 100 + d.closing + d.rehab;
      var coc = cash > 0 ? (noi - ads) / cash : NaN;
      // Largest loan the rent supports at the target DSCR.
      var perDollar = pmt(1, d.rate, d.term) * 12;
      var maxLoan = d.targetDscr > 0 && perDollar > 0 && noi > 0 ? noi / d.targetDscr / perDollar : 0;
      return {
        groups: [
          { fields: [ num("purchase", "Purchase price", "$", "", 5000, { slider: [50000, 2000000, 5000] }), num("rent", "Monthly rent", "$", "/mo", 50, { slider: [500, 15000, 50] }), num("downPct", "Down payment", "", "%", 1, { slider: [15, 40, 1] }), num("rate", "Interest rate", "", "%", 0.125, { slider: [4, 12, 0.125] }) ] },
          { adv: true, fields: [ num("taxes", "Property taxes", "$", "/yr", 100), num("insurance", "Insurance", "$", "/yr", 50), num("hoa", "HOA / condo fee", "$", "/mo", 10), num("vacancyPct", "Vacancy allowance", "", "%", 0.5), num("mgmtPct", "Management", "", "%", 0.5), num("maintPct", "Maintenance", "", "%", 0.5), num("capexPct", "CapEx reserve", "", "%", 0.5), num("otherInc", "Other income", "$", "/mo", 25), num("rehab", "Initial rehab", "$"), num("closing", "Closing costs", "$"), num("term", "Amortization", "", "yrs"), num("targetDscr", "Lender's minimum DSCR", "", "×", 0.05) ] }
        ],
        heroLabel: "DEBT SERVICE COVERAGE RATIO", heroValue: isFinite(dscr) ? dscr.toFixed(2) + "×" : "—",
        verdict: !isFinite(dscr) ? "—" : (dscr >= d.targetDscr ? "MEETS LENDER MINIMUM (≥" + d.targetDscr.toFixed(2) + ")" : (dscr >= 1.0 ? "BELOW " + d.targetDscr.toFixed(2) + " — EXPECT PRICING ADJUSTMENTS" : "NEGATIVE COVERAGE — WON'T QUALIFY")),
        verdictColor: !isFinite(dscr) ? WARN : (dscr >= d.targetDscr ? GOOD : (dscr >= 1.0 ? WARN : BAD)),
        chartTitle: "WHERE THE RENT GOES (MONTHLY)",
        chart: { segments: [["Mortgage (P&I)", pi, C.navy], ["Taxes, insurance, HOA", fixed / 12, C.gold], ["Mgmt, repairs, reserves", reserves / 12, C.teal], ["Cash flow", (noi - ads) / 12, C.green]] },
        outputs: [
          ["Monthly cash flow", fmt$((noi - ads) / 12)],
          ["Net operating income (yr)", fmt$(noi)],
          ["Cap rate", fmtPct(cap)],
          ["Cash required", fmt$(cash)],
          ["Cash-on-cash return", fmtPct(coc)],
          ["Max loan at " + d.targetDscr.toFixed(2) + "× DSCR", fmt$(maxLoan)]
        ],
        note: "Taxes, insurance, vacancy and reserves are under Advanced. Many DSCR lenders qualify on rent ÷ PITIA rather than NOI — ask which method yours uses."
      };
    }
  };

  /* --------------------------------- RENDER ---------------------------------- */
  var LABEL = "display:block;font-family:'Jost',sans-serif;font-weight:400;font-size:12px;letter-spacing:.08em;color:rgba(242,237,225,.65);margin-bottom:7px;";
  var BTN = "padding:11px 8px;cursor:pointer;font-family:'Jost',sans-serif;font-weight:500;font-size:12px;letter-spacing:.14em;";
  var ACT = "background:#c4a56b;color:#062e44;border:1px solid #c4a56b;";
  var IDLE = "background:transparent;color:rgba(242,237,225,.7);border:1px solid rgba(242,237,225,.3);";
  var BOX = "display:flex;align-items:center;border:1px solid rgba(242,237,225,.25);background:rgba(242,237,225,.05);padding:0 12px;";
  var INPUT = "flex:1;min-width:0;background:transparent;border:none;color:#f2ede1;font-size:15.5px;font-weight:400;padding:12px 6px;";
  var AFFIX = "font-family:'Jost',sans-serif;font-size:12.5px;color:rgba(242,237,225,.5);white-space:nowrap;";

  // Dollar inputs show thousands separators; everything else is plain.
  function shown(v, money) {
    if (!isFinite(v)) return "";
    return money ? Math.round(v).toLocaleString("en-US") : String(+(+v).toFixed(3));
  }
  function parse(str) { var v = parseFloat(String(str).replace(/[^0-9.\-]/g, "")); return isNaN(v) ? 0 : v; }
  function sliderHtml(key, sl, value, label) {
    return '<input type="range" class="calc-range" data-range="' + key + '" min="' + sl[0] + '" max="' + sl[1] + '" step="' + sl[2] + '" value="' + value + '" aria-label="' + esc(label) + '">';
  }
  function fillRange(r) {
    var pct = (parse(r.value) - parse(r.min)) / (parse(r.max) - parse(r.min)) * 100;
    r.style.setProperty("--fill", clamp(pct, 0, 100) + "%");
  }

  function fieldHtml(f, st) {
    if (f.kind === "toggle") {
      var on = !!st[f.key];
      return '<div><span style="' + LABEL + '">' + f.label + '</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        '<button type="button" data-set="' + f.key + '" data-val="1" aria-pressed="' + on + '" style="' + BTN + (on ? ACT : IDLE) + '">YES</button>' +
        '<button type="button" data-set="' + f.key + '" data-val="0" aria-pressed="' + !on + '" style="' + BTN + (on ? IDLE : ACT) + '">NO</button></div></div>';
    }
    if (f.kind === "select") {
      return '<label style="display:block;"><span style="' + LABEL + '">' + f.label + '</span>' +
        '<select data-select="' + f.key + '" class="calc-select">' +
        f.options.map(function (o) { return '<option value="' + o[0] + '"' + (st[f.key] === o[0] ? " selected" : "") + '>' + esc(o[1]) + '</option>'; }).join("") +
        '</select></label>';
    }
    if (f.kind === "moneypct") {
      var base = st[f.base], pct = st[f.key];
      return '<div class="calc-wide"><span style="' + LABEL + '">' + f.label + '</span>' +
        '<div style="display:grid;grid-template-columns:1fr 112px;gap:8px;">' +
        '<span style="' + BOX + '"><span style="font-family:\'Jost\',sans-serif;font-size:14px;color:#c4a56b;">$</span><input type="text" inputmode="decimal" aria-label="' + esc(f.label) + ' in dollars" data-money="' + f.key + '" data-base="' + f.base + '" value="' + shown(base * pct / 100, true) + '" style="' + INPUT + '"></span>' +
        '<span style="' + BOX + '"><input type="text" inputmode="decimal" aria-label="' + esc(f.label) + ' percent" data-field="' + f.key + '" value="' + shown(pct) + '" style="' + INPUT + '"><span style="' + AFFIX + '">%</span></span>' +
        '</div>' + (f.slider ? sliderHtml(f.key, f.slider, pct, f.label) : '') + '</div>';
    }
    var money = f.prefix === "$";
    return '<div' + (f.slider ? ' class="calc-wide"' : '') + '><label style="display:block;"><span style="' + LABEL + '">' + f.label + '</span>' +
      '<span style="' + BOX + '">' +
      (f.prefix ? '<span style="font-family:\'Jost\',sans-serif;font-size:14px;color:#c4a56b;">' + f.prefix + '</span>' : '') +
      '<input type="text" inputmode="decimal" data-field="' + f.key + '"' + (money ? ' data-fmt="money"' : '') + ' value="' + shown(st[f.key], money) + '" style="' + INPUT + '">' +
      (f.suffix ? '<span style="' + AFFIX + '">' + esc(f.suffix) + '</span>' : '') +
      '</span></label>' + (f.slider ? sliderHtml(f.key, f.slider, st[f.key], f.label) : '') + '</div>';
  }

  // Donut chart of the positive segments, with a legend that also lists a negative profit / cash flow.
  function donutHtml(chart, title) {
    var segs = chart.segments.filter(function (s) { return s[1] > 0.5; });
    var total = segs.reduce(function (a, s) { return a + s[1]; }, 0);
    var R = 46, CIRC = 2 * Math.PI * R, off = 0, arcs = "";
    segs.forEach(function (s) {
      var len = total > 0 ? s[1] / total * CIRC : 0;
      arcs += '<circle r="' + R + '" cx="60" cy="60" fill="none" stroke="' + s[2] + '" stroke-width="16" stroke-dasharray="' + Math.max(0, len - 1.5) + ' ' + CIRC + '" stroke-dashoffset="' + -off + '"></circle>';
      off += len;
    });
    var legend = chart.segments.filter(function (s) { return Math.abs(s[1]) > 0.5 || s[0] === "Profit" || s[0] === "Cash flow"; }).map(function (s) {
      return '<div class="calc-leg"><span class="dot" style="background:' + s[2] + ';"></span><span class="lbl">' + s[0] + '</span><span class="val">' + fmt$(s[1]) + '</span></div>';
    }).join("");
    return '<div class="calc-ctitle">' + title + '</div>' +
      '<div class="calc-donut"><svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true"><g transform="rotate(-90 60 60)"><circle r="' + R + '" cx="60" cy="60" fill="none" stroke="rgba(6,46,68,.08)" stroke-width="16"></circle>' + arcs + '</g></svg><div class="calc-legend">' + legend + '</div></div>';
  }
  function barsHtml(bars) {
    var max = Math.max.apply(null, bars.rows.map(function (r) { return r[1]; })) || 1;
    return '<div class="calc-ctitle">' + bars.title + '</div><div class="calc-bars">' + bars.rows.map(function (r) {
      return '<div class="calc-bar"><span class="lbl">' + r[0] + '</span><span class="track"><span style="width:' + (r[1] / max * 100) + '%;background:' + r[2] + ';"></span></span><span class="val">' + fmt$(r[1]) + '/mo</span></div>';
    }).join("") + '</div>';
  }

  function mount(root) {
    var calc = CALCS[root.getAttribute("data-calc")];
    if (!calc) return;
    var st = calc.state;
    var defaults = JSON.stringify(st);
    var inputs = root.querySelector(".c-inputs");
    var card = root.querySelector(".c-card");
    var outs = root.querySelector(".c-outputs");
    var showAdv = false;
    // Result-card slots for the price scale and the chart, created once.
    var scaleEl = document.createElement("div"); scaleEl.className = "calc-scale";
    var chartEl = document.createElement("div"); chartEl.className = "calc-chart";
    card.insertBefore(scaleEl, outs); card.insertBefore(chartEl, outs);

    function renderInputs() {
      var r = calc.compute(st);
      function groupHtml(g) {
        return '<div class="calc-grid">' + g.fields.map(function (f) { return fieldHtml(f, st); }).join("") + '</div>';
      }
      var html = r.groups.filter(function (g) { return !g.adv; }).map(groupHtml).join("");
      var adv = r.groups.filter(function (g) { return g.adv; });
      if (adv.length) {
        html += '<div><button type="button" class="calc-adv" aria-expanded="' + showAdv + '">' + (showAdv ? "− HIDE ADVANCED" : "+ ADVANCED") + '</button>' +
          (showAdv ? '<div style="margin-top:22px;">' + adv.map(groupHtml).join("") + '</div>' : '') + '</div>';
      }
      inputs.innerHTML = html;
      Array.prototype.forEach.call(inputs.querySelectorAll(".calc-range"), fillRange);
      renderOutputs(r);
    }

    function renderOutputs(r) {
      r = r || calc.compute(st);
      root.querySelector(".c-hero-label").textContent = r.heroLabel;
      root.querySelector(".c-hero-value").textContent = r.heroValue;
      var v = root.querySelector(".c-verdict");
      v.textContent = r.verdict; v.style.color = r.verdictColor; v.style.borderColor = r.verdictColor;
      renderScale(r.scale);
      chartEl.innerHTML = r.chart ? donutHtml(r.chart, r.chartTitle || "MONTHLY PAYMENT BREAKDOWN") : r.bars ? barsHtml(r.bars) : "";
      outs.innerHTML = r.outputs.map(function (o) {
        return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:12px 0;border-bottom:1px solid rgba(6,46,68,.12);">' +
          '<span style="font-family:\'Jost\',sans-serif;font-weight:300;font-size:14px;color:#3d4d59;">' + o[0] + '</span>' +
          '<span style="font-family:\'Jost\',sans-serif;font-weight:500;font-size:15px;color:#062e44;white-space:nowrap;">' + o[1] + '</span></div>';
      }).join("");
      root.querySelector(".c-note").textContent = r.note || "";
    }

    // The affordability scale lives in the result card and is updated in place,
    // so it keeps working while it's being dragged.
    function renderScale(sc) {
      if (!sc) { scaleEl.hidden = true; return; }
      scaleEl.hidden = false;
      var range = scaleEl.querySelector("input");
      if (!range) {
        scaleEl.innerHTML = '<div class="calc-scale-label"></div><input type="range" class="calc-zone" data-scale="' + sc.key + '" aria-label="Try a home price"><div class="calc-scale-legend">' +
          sc.legend.map(function (l) { return '<span><i style="background:' + l[1] + ';"></i>' + l[0] + '</span>'; }).join("") + '</div>';
        range = scaleEl.querySelector("input");
      }
      range.min = sc.min; range.max = sc.max; range.step = sc.step;
      range.value = sc.value;
      var stops = [], prev = 0;
      sc.zones.forEach(function (z) {
        var to = clamp(z[0] / sc.max * 100, prev, 100);
        stops.push(z[1] + " " + prev + "%", z[1] + " " + to + "%"); prev = to;
      });
      range.style.background = "linear-gradient(to right, " + stops.join(", ") + ")";
      scaleEl.querySelector(".calc-scale-label").textContent = sc.label;
    }

    // Keep dollar/percent pairs and sliders in step with the state.
    function sync(skip) {
      Array.prototype.forEach.call(inputs.querySelectorAll("[data-money]"), function (m) {
        if (m !== skip) m.value = shown(st[m.getAttribute("data-base")] * st[m.getAttribute("data-money")] / 100, true);
      });
      Array.prototype.forEach.call(inputs.querySelectorAll("[data-field]"), function (b) {
        if (b !== skip) b.value = shown(st[b.getAttribute("data-field")], b.getAttribute("data-fmt") === "money");
      });
      Array.prototype.forEach.call(inputs.querySelectorAll("[data-range]"), function (r) {
        if (r !== skip) r.value = st[r.getAttribute("data-range")];
        fillRange(r);
      });
    }

    inputs.addEventListener("input", function (e) {
      var t = e.target, k;
      if ((k = t.getAttribute("data-range"))) st[k] = parse(t.value);
      else if ((k = t.getAttribute("data-money"))) { var base = st[t.getAttribute("data-base")]; st[k] = base > 0 ? parse(t.value) / base * 100 : 0; }
      else if ((k = t.getAttribute("data-field"))) st[k] = parse(t.value);
      else return;
      if (calc.onInput) calc.onInput(st);
      sync(t);
      renderOutputs();
    });
    // Tidy number formatting when a box loses focus.
    inputs.addEventListener("focusout", function (e) {
      if (e.target.matches("input[type=text]")) sync(null);
    });
    // Dropdowns can change which fields apply (e.g. loan type), so re-render.
    inputs.addEventListener("change", function (e) {
      var k = e.target.getAttribute("data-select");
      if (!k) return;
      var v = e.target.value;
      st[k] = v !== "" && !isNaN(+v) ? +v : v;
      if (calc.onInput) calc.onInput(st);
      renderInputs();
      var again = inputs.querySelector('[data-select="' + k + '"]');
      if (again) again.focus();
    });
    inputs.addEventListener("click", function (e) {
      if (e.target.closest(".calc-adv")) { showAdv = !showAdv; renderInputs(); return; }
      var b = e.target.closest("button[data-set]");
      if (!b) return;
      st[b.getAttribute("data-set")] = b.getAttribute("data-val") === "1";
      if (calc.onInput) calc.onInput(st);
      renderInputs();
    });
    scaleEl.addEventListener("input", function (e) {
      var k = e.target.getAttribute("data-scale");
      if (!k) return;
      st[k] = parse(e.target.value); st.picked = true;
      renderOutputs();
    });
    var reset = root.querySelector(".c-reset");
    if (reset) reset.addEventListener("click", function () {
      var d = JSON.parse(defaults);
      Object.keys(d).forEach(function (k) { st[k] = d[k]; });
      renderInputs();
    });
    renderInputs();
  }

  // Show one calculator at a time, chosen from the picker; the URL hash
  // (e.g. calculators.html#refinance) makes each one linkable.
  function showCalc(id, scroll, keepHash) {
    var panel = document.getElementById(id);
    if (!panel || !panel.hasAttribute("data-calc")) return false;
    Array.prototype.forEach.call(document.querySelectorAll("section[data-calc]"), function (s) { s.hidden = s !== panel; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-pick]"), function (b) {
      var on = b.getAttribute("data-pick") === id;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    if (!keepHash && history.replaceState) history.replaceState(null, "", "#" + id);
    // On phones the picker is tall — bring the calculator into view.
    if (scroll && panel.getBoundingClientRect().top > window.innerHeight * 0.85) panel.scrollIntoView({ behavior: "smooth" });
    return true;
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-calc]"), mount);
    var picks = Array.prototype.slice.call(document.querySelectorAll("[data-pick]"));
    picks.forEach(function (b, i) {
      b.addEventListener("click", function () { showCalc(b.getAttribute("data-pick"), true); });
      b.addEventListener("keydown", function (e) {
        var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        var next = picks[(i + d + picks.length) % picks.length];
        next.focus(); showCalc(next.getAttribute("data-pick"), false);
      });
    });
    if (!showCalc(location.hash.slice(1), false)) showCalc(picks[0].getAttribute("data-pick"), false, true);
    window.addEventListener("hashchange", function () { showCalc(location.hash.slice(1), true); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
