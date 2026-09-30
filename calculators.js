/* The Banks Group — calculators page.
   Six independent calculators, each with its own state, inputs and results card.
   Fix & flip, new construction and DSCR use the same math as the home-page
   Deal Analyzer (site.js) so the two never disagree. */
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

  function num(key, label, prefix, suffix, step) {
    return { kind: "number", key: key, label: label, prefix: prefix || "", suffix: suffix || "", step: step || 1 };
  }
  function toggle(key, label) { return { kind: "toggle", key: key, label: label }; }
  function dropdown(key, label, options) { return { kind: "select", key: key, label: label, options: options }; }

  /* ------------------------------- CALCULATORS ------------------------------- */
  var CALCS = {};

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
          { title: "ACQUISITION", fields: [ num("purchase", "Purchase price", "$"), num("rehab", "Rehab budget", "$"), num("arv", "After-repair value (ARV)", "$"), num("closingBuyPct", "Purchase closing costs", "", "%", 0.25) ] },
          { title: "FINANCING", fields: [ num("ltc", "Loan-to-cost", "", "%"), num("rate", "Interest rate", "", "%", 0.125), num("points", "Lender points", "", "pts", 0.25) ] },
          { title: "HOLDING & EXIT", fields: [ num("months", "Hold time", "", "mo"), num("holdMo", "Holding costs / month", "$"), num("commissionPct", "Sale commission", "", "%", 0.25), num("sellClosePct", "Seller closing costs", "", "%", 0.25) ] }
        ],
        heroLabel: "PROJECTED NET PROFIT", heroValue: fmt$(profit),
        verdict: profit <= 0 ? "UNDERWATER — RENEGOTIATE" : (good ? "STRONG FLIP CANDIDATE" : "THIN MARGIN — PROCEED CAREFULLY"),
        verdictColor: profit <= 0 ? BAD : (good ? GOOD : WARN),
        outputs: [
          ["All-in project cost", fmt$(total)],
          ["Loan amount (" + ff.ltc + "% LTC)", fmt$(loan)],
          ["Cash required", fmt$(cash)],
          ["Interest + points", fmt$(interest + points)],
          ["Selling costs", fmt$(sellCosts)],
          ["ROI on project cost", fmtPct(roi)],
          ["Cash-on-cash (project)", fmtPct(coc)],
          ["Cash-on-cash (annualized)", fmtPct(cocAnnual)],
          ["70%-rule max offer", fmt$(ff.arv * 0.7 - ff.rehab)]
        ],
        note: "Our bar for a strong flip: 8%+ ROI on project cost and 30%+ cash-on-cash."
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

      var subFields = [ toggle("subdivide", "Subdividing the property?") ];
      if (sub) subFields.push(num("lots", "Number of lots / units", "", "lots"), num("subCosts", "Subdivision & entitlement costs", "$", "", 1000), num("siteWorkPerLot", "Site work & utilities per lot", "$", "", 1000), num("pricePerUnit", "Sale price per unit", "$", "", 5000));
      var outputs = [
        ["Hard costs (land + build)", fmt$(nc.land + build)],
        ["Soft costs", fmt$(soft)],
        ["All-in project cost", fmt$(total)],
        ["Loan amount (" + nc.ltc + "% LTC)", fmt$(loan)],
        ["Cash required", fmt$(cash)],
        ["Interest + points (avg draw)", fmt$(interest + points)],
        ["Profit margin on sale", fmtPct(margin)],
        ["Cash-on-cash (project / annualized)", fmtPct(roi) + " / " + fmtPct(annual)]
      ];
      if (sub) {
        outputs.splice(2, 0, ["Subdivision + site work (" + units + " lots)", fmt$(subCosts)]);
        outputs.splice(6, 0, ["Gross sales (" + units + " units)", fmt$(gross)], ["Profit per unit", fmt$(profit / units)]);
      }
      var good = margin > 0.15;
      return {
        groups: [
          { title: "SUBDIVISION", fields: subFields },
          { title: "LAND & BUILD", fields: [ num("land", "Land / lot cost", "$"), num("sqft", sub ? "Finished area per unit" : "Finished area", "", "sqft", 50), num("costSqft", "Build cost / sqft", "$"), num("softPct", "Soft costs (design, permits)", "", "%", 0.5), num("closingBuyPct", "Land closing costs", "", "%", 0.25) ] },
          { title: "FINANCING", fields: [ num("ltc", "Construction loan LTC", "", "%"), num("rate", "Interest rate", "", "%", 0.125), num("points", "Lender points", "", "pts", 0.25) ] },
          { title: "TIMELINE & EXIT", fields: [ num("months", "Build + sale timeline", "", "mo"), num("holdMo", "Carrying costs / month", "$") ].concat(sub ? [] : [ num("salePrice", "Projected sale price", "$") ]).concat([ num("commissionPct", "Sale commission", "", "%", 0.25), num("sellClosePct", "Seller closing costs", "", "%", 0.25) ]) }
        ],
        heroLabel: "PROJECTED DEVELOPMENT PROFIT", heroValue: fmt$(profit),
        verdict: profit <= 0 ? "UNDERWATER — REWORK THE BUDGET" : (good ? "HEALTHY DEVELOPMENT MARGIN" : "BELOW 15% MARGIN — TIGHT"),
        verdictColor: profit <= 0 ? BAD : (good ? GOOD : WARN),
        outputs: outputs,
        note: "Interest assumes an average of ~60% of the loan drawn over the build."
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
      var opex = d.taxes + d.insurance + d.hoa * 12 + egi * (d.mgmtPct + d.maintPct + d.capexPct) / 100;
      var noi = egi - opex;
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
          { title: "ACQUISITION", fields: [ num("purchase", "Purchase price", "$"), num("rehab", "Initial rehab (optional)", "$"), num("closing", "Closing costs", "$") ] },
          { title: "DSCR LOAN", fields: [ num("downPct", "Down payment", "", "%"), num("rate", "Interest rate", "", "%", 0.125), num("term", "Amortization", "", "yrs"), num("targetDscr", "Lender's minimum DSCR", "", "×", 0.05) ] },
          { title: "INCOME", fields: [ num("rent", "Monthly rent", "$", "/mo", 50), num("otherInc", "Other income", "$", "/mo", 25), num("vacancyPct", "Vacancy allowance", "", "%", 0.5) ] },
          { title: "OPERATING EXPENSES", fields: [ num("taxes", "Property taxes", "$", "/yr", 100), num("insurance", "Insurance", "$", "/yr", 50), num("hoa", "HOA / condo fee", "$", "/mo", 10), num("mgmtPct", "Management", "", "%", 0.5), num("maintPct", "Maintenance", "", "%", 0.5), num("capexPct", "CapEx reserve", "", "%", 0.5) ] }
        ],
        heroLabel: "DEBT SERVICE COVERAGE RATIO", heroValue: isFinite(dscr) ? dscr.toFixed(2) + "×" : "—",
        verdict: !isFinite(dscr) ? "—" : (dscr >= d.targetDscr ? "MEETS LENDER MINIMUM (≥" + d.targetDscr.toFixed(2) + ")" : (dscr >= 1.0 ? "BELOW " + d.targetDscr.toFixed(2) + " — EXPECT PRICING ADJUSTMENTS" : "NEGATIVE COVERAGE — WON'T QUALIFY")),
        verdictColor: !isFinite(dscr) ? WARN : (dscr >= d.targetDscr ? GOOD : (dscr >= 1.0 ? WARN : BAD)),
        outputs: [
          ["Loan amount", fmt$(loan)],
          ["Monthly principal & interest", fmt$(pi)],
          ["Net operating income (yr)", fmt$(noi)],
          ["Annual debt service", fmt$(ads)],
          ["Monthly cash flow", fmt$((noi - ads) / 12)],
          ["Cap rate", fmtPct(cap)],
          ["Cash required", fmt$(cash)],
          ["Cash-on-cash return", fmtPct(coc)],
          ["Max loan at " + d.targetDscr.toFixed(2) + "× DSCR", fmt$(maxLoan)]
        ],
        note: "Many DSCR lenders qualify on rent ÷ PITIA rather than NOI — ask which method yours uses."
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
      var cashOutNet = s.cashOut - (s.roll ? 0 : costs);
      var verdict, color;
      if (s.cashOut > 0 && ltv > 0.8) { verdict = "ABOVE 80% LTV — MOST CASH-OUT PROGRAMS CAP HERE"; color = BAD; }
      else if (s.cashOut > 0) { verdict = "CASH-OUT WITHIN 80% LTV"; color = GOOD; }
      else if (!(savings > 0)) { verdict = "NO MONTHLY SAVINGS — HOLD YOUR RATE"; color = BAD; }
      else if (breakeven <= 36) { verdict = "BREAKS EVEN IN ≤ 3 YEARS — WORTH A LOOK"; color = GOOD; }
      else if (breakeven <= 60) { verdict = "3–5 YEAR BREAK-EVEN — ONLY IF YOU'RE STAYING"; color = WARN; }
      else { verdict = "LONG BREAK-EVEN — LIKELY NOT WORTH IT"; color = BAD; }
      var outputs = [
        ["Current principal & interest", fmt$(curPI)],
        ["New principal & interest", fmt$(newPI)],
        ["New loan amount", fmt$(newLoan)],
        ["Loan-to-value", fmtPct(ltv)],
        ["Closing costs + points", fmt$(costs)],
        ["Cash due at closing", fmt$(s.roll ? 0 : costs)],
        ["Break-even on costs", s.cashOut > 0 && !(savings > 0) ? "n/a (cash-out)" : fmtMo(breakeven)],
        ["Remaining interest — current loan", fmt$(curInterest)],
        ["Total interest — new loan", fmt$(newInterest)],
        ["Lifetime interest change", fmt$(newInterest - curInterest)]
      ];
      if (s.cashOut > 0) outputs.splice(3, 0, ["Net cash in hand", fmt$(cashOutNet)]);
      return {
        groups: [
          { title: "YOUR CURRENT LOAN", fields: [ num("value", "Home value today", "$", "", 5000), num("balance", "Current loan balance", "$", "", 1000), num("curRate", "Current interest rate", "", "%", 0.125), num("yearsLeft", "Years remaining", "", "yrs") ] },
          { title: "THE NEW LOAN", fields: [ num("newRate", "New interest rate", "", "%", 0.125), num("newTerm", "New loan term", "", "yrs"), num("cashOut", "Cash out (optional)", "$", "", 1000) ] },
          { title: "COSTS", fields: [ num("closing", "Closing costs", "$", "", 250), num("points", "Discount points", "", "pts", 0.25), toggle("roll", "Roll costs into the loan?") ] }
        ],
        heroLabel: savings >= 0 ? "MONTHLY SAVINGS" : "MONTHLY PAYMENT INCREASE", heroValue: fmt$(Math.abs(savings)),
        verdict: verdict, verdictColor: color, outputs: outputs,
        note: "Resetting to a new 30-year term can lower the payment but raise lifetime interest — compare both lines above."
      };
    }
  };

  // ---------- Home-loan programs shared by Affordability & Max Mortgage ----------
  // Buyers pick a loan type; the program's rules (down payment options,
  // mortgage insurance, funding fee, DTI limits, loan limit) are built in.
  var LOAN_LIMIT = 1249125;          // 2026 one-unit conforming & FHA limit across the DC metro
  var TAX_RATE = 1.0;                // est. property tax, % of price per year (DMV average)
  var INS_RATE = 0.35;               // est. homeowners insurance, % of price per year
  var CLOSING_PCT = 2.5;             // est. buyer closing costs, % of price
  var RATE_DROP_PER_POINT = 0.25;    // common rule of thumb; lenders price daily
  var COMFORT = { front: 28, back: 36 }; // classic "comfortable" budget ratios

  var PROGRAMS = {
    conv: { name: "Conventional", maxFront: Infinity, maxBack: 45, limit: LOAN_LIMIT,
      downs: [[3, "3% (first-time buyers)"], [5, "5%"], [10, "10%"], [15, "15%"], [20, "20% (no PMI)"], [25, "25%"]] },
    fha: { name: "FHA", maxFront: 31, maxBack: 43, limit: LOAN_LIMIT,
      downs: [[3.5, "3.5% (minimum)"], [5, "5%"], [10, "10%"], [20, "20%"]] },
    va: { name: "VA", maxFront: Infinity, maxBack: 41, limit: Infinity,
      downs: [[0, "0% (no down payment)"], [5, "5%"], [10, "10%"]] }
  };
  var TYPE_OPTIONS = [["conv", "Conventional"], ["fha", "FHA"], ["va", "VA"]];
  var TERM_OPTIONS = [[30, "30 years"], [20, "20 years"], [15, "15 years"]];
  var POINT_OPTIONS = [[0, "None"], [0.5, "0.5 point"], [1, "1 point"], [1.5, "1.5 points"], [2, "2 points"]];

  // Conventional PMI, annual % of the loan, by down payment (typical for good credit).
  function convPmi(down) { return down >= 20 ? 0 : down >= 15 ? 0.25 : down >= 10 ? 0.4 : down >= 5 ? 0.55 : 0.7; }
  // FHA annual MIP (30-year terms; 15-year and shorter loans price lower).
  function fhaMip(base, down, term) {
    if (term <= 15) return down >= 10 ? 0.15 : base > 726200 ? 0.4 : 0.15;
    return base > 726200 ? (down >= 5 ? 0.7 : 0.75) : (down >= 5 ? 0.5 : 0.55);
  }
  // VA funding fee, % of the loan, by down payment and first vs. later use.
  function vaFee(down, subsequent) { return down >= 10 ? 1.25 : down >= 5 ? 1.5 : (subsequent ? 3.3 : 2.15); }

  // Monthly cost of owning at a given price under a program.
  function homeCost(s, price, down, rate) {
    var base = price * (1 - down / 100), upfront = 0, annualMi = 0;
    if (s.type === "conv") annualMi = convPmi(down);
    if (s.type === "fha") { upfront = 1.75; annualMi = fhaMip(base, down, s.term); }
    if (s.type === "va") upfront = s.vaExempt ? 0 : vaFee(down, s.vaSubsequent);
    var loan = base * (1 + upfront / 100);
    var pi = pmt(loan, rate, s.term), mi = base * annualMi / 100 / 12;
    var taxIns = price * (TAX_RATE + INS_RATE) / 100 / 12;
    return { base: base, loan: loan, fee: loan - base, upfront: upfront, pi: pi, mi: mi, taxIns: taxIns, total: pi + mi + taxIns + s.hoa };
  }

  // Highest price whose payment fits the DTI limits, capped by the loan limit.
  function qualify(s, down, rate, front, back) {
    var p = PROGRAMS[s.type], monthly = s.income / 12;
    var budget = Math.min(monthly * front / 100, monthly * back / 100 - s.debts);
    var incomePrice = solveMax(function (x) { return homeCost(s, x, down, rate).total; }, budget, 0, 2e7);
    var ok = isFinite(incomePrice) && incomePrice > 1000;
    var capped = ok && incomePrice * (1 - down / 100) > p.limit;
    var price = !ok ? 0 : capped ? p.limit / (1 - down / 100) : incomePrice;
    return { ok: ok, capped: capped, price: price, incomePrice: incomePrice, budget: budget, cost: homeCost(s, price, down, rate) };
  }

  // Switching loan type starts from that program's usual down payment.
  var DEFAULT_DOWN = { conv: 5, fha: 3.5, va: 0 };
  function fixDown(s) {
    if (s.lastType !== s.type) { s.down = DEFAULT_DOWN[s.type]; s.lastType = s.type; }
  }

  function loanQuestions(s, maxMode) {
    if (s.type === "va") return [ toggle("vaSubsequent", "Used a VA loan before?"), toggle("vaExempt", "VA disability? (no funding fee)") ];
    if (s.type === "conv" && maxMode) return [ toggle("firstTime", "First-time homebuyer? (allows 3% down)") ];
    return [];
  }

  function feeRow(s, c) {
    if (s.type === "va") return ["VA funding fee (financed)", c.upfront ? fmt$(c.fee) : "Waived"];
    if (s.type === "fha") return ["Upfront MIP (1.75%, financed)", fmt$(c.fee)];
    return null;
  }
  function miLabel(s) { return s.type === "fha" ? "Monthly FHA insurance (MIP)" : s.type === "va" ? "Mortgage insurance (none on VA)" : "Mortgage insurance (PMI)"; }

  var ASSUMPTIONS = "Estimates property taxes at 1% and homeowners insurance at 0.35% of the price per year, and uses the 2026 DMV loan limit of $1,249,125 (St. Mary's County is lower).";

  // ---------- Affordability (with discount points) ----------
  CALCS.affordability = {
    state: { type: "conv", lastType: "conv", income: 165000, debts: 650, down: 5, rate: 6.5, term: 30, points: 0, hoa: 0, vaSubsequent: false, vaExempt: false },
    compute: function (s) {
      fixDown(s);
      var p = PROGRAMS[s.type];
      var effRate = Math.max(0, s.rate - s.points * RATE_DROP_PER_POINT);
      var q = qualify(s, s.down, effRate, COMFORT.front, COMFORT.back);
      var noPts = qualify(s, s.down, s.rate, COMFORT.front, COMFORT.back);
      var c = q.cost;
      var pointsCost = c.loan * s.points / 100;
      var ptSavings = pmt(c.loan, s.rate, s.term) - c.pi;
      var outputs = [
        ["Loan amount", fmt$(c.loan)],
        ["Down payment (" + s.down + "%)", fmt$(q.price * s.down / 100)],
        ["Principal & interest", fmt$(c.pi)],
        [miLabel(s), fmt$(c.mi)],
        ["Est. taxes & insurance", fmt$(c.taxIns)],
        ["Total monthly payment", fmt$(c.total)]
      ];
      var fee = feeRow(s, c); if (fee) outputs.splice(1, 0, fee);
      if (s.hoa > 0) outputs.splice(outputs.length - 1, 0, ["HOA / condo fee", fmt$(s.hoa)]);
      if (s.points > 0) outputs.push(
        ["Rate after points", fmtRate(effRate)],
        ["Cost of points", fmt$(pointsCost)],
        ["Points pay for themselves in", fmtMo(ptSavings > 0 ? pointsCost / ptSavings : NaN)],
        ["Extra buying power from points", noPts.ok ? fmt$(q.price - noPts.price) : "—"]
      );
      outputs.push(["Est. cash to close", fmt$(q.price * s.down / 100 + pointsCost + q.price * CLOSING_PCT / 100)]);
      var verdict, color;
      if (!q.ok) { verdict = "MONTHLY DEBTS ARE TOO HIGH FOR THIS INCOME"; color = BAD; }
      else if (q.capped && s.type === "conv") { verdict = "ABOVE THE CONFORMING LIMIT — JUMBO TERRITORY"; color = WARN; }
      else if (q.capped) { verdict = "CAPPED BY THE FHA LOAN LIMIT"; color = WARN; }
      else { verdict = "PAYMENT ≈ 28% OF INCOME · DEBTS ≤ 36%"; color = GOOD; }
      return {
        groups: [
          { title: "YOUR LOAN", fields: [ dropdown("type", "Loan type", TYPE_OPTIONS), dropdown("down", "Down payment", p.downs), num("rate", "Interest rate", "", "%", 0.125), dropdown("term", "Loan term", TERM_OPTIONS) ].concat(loanQuestions(s, false)) },
          { title: "YOUR FINANCES", fields: [ num("income", "Household income (before taxes)", "$", "/yr", 1000), num("debts", "Monthly debt payments", "$", "/mo", 25), num("hoa", "HOA / condo fee (if any)", "$", "/mo", 10) ] },
          { title: "DISCOUNT POINTS", fields: [ dropdown("points", "Buy down your rate?", POINT_OPTIONS) ] }
        ],
        heroLabel: "HOME PRICE YOU CAN COMFORTABLY AFFORD", heroValue: q.ok ? fmt$(q.price) : "—",
        verdict: verdict, verdictColor: color, outputs: outputs,
        note: "Uses the classic comfortable budget: housing ≈ 28% of gross income, all debts ≤ 36%. Each point lowers the rate about 0.25%. " + ASSUMPTIONS
      };
    }
  };

  // ---------- Maximum mortgage by loan type ----------
  CALCS.maxloan = {
    state: { type: "conv", income: 165000, debts: 650, rate: 6.5, term: 30, hoa: 0, firstTime: false, vaSubsequent: false, vaExempt: false },
    compute: function (s) {
      var p = PROGRAMS[s.type];
      var down = s.type === "va" ? 0 : s.type === "fha" ? 3.5 : (s.firstTime ? 3 : 5);
      var q = qualify(s, down, s.rate, p.maxFront, p.maxBack);
      var c = q.cost;
      var dtiText = (isFinite(p.maxFront) ? p.maxFront + "% housing / " : "") + p.maxBack + "% total debts";
      var outputs = [
        ["Maximum purchase price", q.ok ? fmt$(q.price) : "—"],
        ["Minimum down payment (" + down + "%)", fmt$(q.price * down / 100)],
        ["Principal & interest", fmt$(c.pi)],
        [miLabel(s), fmt$(c.mi)],
        ["Est. taxes & insurance", fmt$(c.taxIns)],
        ["Total monthly payment", fmt$(c.total)],
        [p.name + " debt-to-income limit", dtiText],
        ["Loan limit", isFinite(p.limit) ? fmt$(p.limit) : "None with full entitlement"]
      ];
      var fee = feeRow(s, c); if (fee) outputs.splice(2, 0, fee);
      if (s.hoa > 0) outputs.splice(outputs.indexOf(outputs.filter(function (o) { return o[0] === "Total monthly payment"; })[0]), 0, ["HOA / condo fee", fmt$(s.hoa)]);
      if (q.capped && s.type === "conv") outputs.push(["Your income supports (jumbo)", fmt$(q.incomePrice)]);
      var verdict, color;
      if (!q.ok) { verdict = "MONTHLY DEBTS EXCEED THE " + p.name.toUpperCase() + " LIMIT"; color = BAD; }
      else if (q.capped && s.type === "conv") { verdict = "INCOME SUPPORTS MORE — ABOVE THIS IS JUMBO"; color = WARN; }
      else if (q.capped) { verdict = "CAPPED BY THE FHA LOAN LIMIT"; color = WARN; }
      else { verdict = "MAXIMUM " + p.name.toUpperCase() + " APPROVAL ESTIMATE"; color = GOOD; }
      var notes = {
        conv: "Conventional loans allow up to 45% of income for all debts, and automated approvals can go higher. PMI drops off once you reach 22% equity.",
        fha: "FHA allows 31% of income for housing and 43% for all debts, and automated approvals often go higher. FHA insurance stays for the life of the loan with under 10% down.",
        va: "VA uses 41% of income as a guideline and also checks your residual income, the money left each month after all bills. There's no down payment and no monthly mortgage insurance."
      };
      return {
        groups: [
          { title: "YOUR LOAN", fields: [ dropdown("type", "Loan type", TYPE_OPTIONS), num("rate", "Interest rate", "", "%", 0.125), dropdown("term", "Loan term", TERM_OPTIONS) ].concat(loanQuestions(s, true)) },
          { title: "YOUR FINANCES", fields: [ num("income", "Household income (before taxes)", "$", "/yr", 1000), num("debts", "Monthly debt payments", "$", "/mo", 25), num("hoa", "HOA / condo fee (if any)", "$", "/mo", 10) ] }
        ],
        heroLabel: "MAXIMUM " + p.name.toUpperCase() + " LOAN", heroValue: q.ok ? fmt$(c.loan) : "—",
        verdict: verdict, verdictColor: color, outputs: outputs,
        note: notes[s.type] + " " + ASSUMPTIONS
      };
    }
  };

  /* --------------------------------- RENDER ---------------------------------- */
  var LABEL = "display:block;font-family:'Jost',sans-serif;font-weight:400;font-size:12px;letter-spacing:.08em;color:rgba(242,237,225,.65);margin-bottom:7px;";
  var BTN = "padding:11px 8px;cursor:pointer;font-family:'Jost',sans-serif;font-weight:500;font-size:12px;letter-spacing:.14em;";
  var ACT = "background:#c4a56b;color:#062e44;border:1px solid #c4a56b;";
  var IDLE = "background:transparent;color:rgba(242,237,225,.7);border:1px solid rgba(242,237,225,.3);";

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
    return '<label style="display:block;"><span style="' + LABEL + '">' + f.label + '</span>' +
      '<span style="display:flex;align-items:center;border:1px solid rgba(242,237,225,.25);background:rgba(242,237,225,.05);padding:0 12px;">' +
      (f.prefix ? '<span style="font-family:\'Jost\',sans-serif;font-size:14px;color:#c4a56b;">' + f.prefix + '</span>' : '') +
      '<input type="number" inputmode="decimal" data-field="' + f.key + '" value="' + st[f.key] + '" step="' + f.step + '" style="flex:1;min-width:0;background:transparent;border:none;color:#f2ede1;font-size:15.5px;font-weight:400;padding:12px 6px;">' +
      (f.suffix ? '<span style="font-family:\'Jost\',sans-serif;font-size:12.5px;color:rgba(242,237,225,.5);white-space:nowrap;">' + esc(f.suffix) + '</span>' : '') +
      '</span></label>';
  }

  function mount(root) {
    var calc = CALCS[root.getAttribute("data-calc")];
    if (!calc) return;
    var st = calc.state;
    var inputs = root.querySelector(".c-inputs");

    function renderInputs() {
      var r = calc.compute(st), html = "";
      r.groups.forEach(function (g) {
        html += '<div><div style="font-family:\'Jost\',sans-serif;font-weight:500;font-size:12px;letter-spacing:.26em;color:#c4a56b;border-bottom:1px solid rgba(196,165,107,.3);padding-bottom:12px;margin-bottom:20px;">' + g.title + '</div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px;">' + g.fields.map(function (f) { return fieldHtml(f, st); }).join("") + '</div></div>';
      });
      inputs.innerHTML = html;
      renderOutputs(r);
    }

    function renderOutputs(r) {
      r = r || calc.compute(st);
      root.querySelector(".c-hero-label").textContent = r.heroLabel;
      root.querySelector(".c-hero-value").textContent = r.heroValue;
      var v = root.querySelector(".c-verdict");
      v.textContent = r.verdict; v.style.color = r.verdictColor; v.style.borderColor = r.verdictColor;
      root.querySelector(".c-outputs").innerHTML = r.outputs.map(function (o) {
        return '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px;padding:13px 0;border-bottom:1px solid rgba(6,46,68,.12);">' +
          '<span style="font-family:\'Jost\',sans-serif;font-weight:300;font-size:14px;color:#3d4d59;">' + o[0] + '</span>' +
          '<span style="font-family:\'Jost\',sans-serif;font-weight:500;font-size:15.5px;color:#062e44;white-space:nowrap;">' + o[1] + '</span></div>';
      }).join("");
      root.querySelector(".c-note").textContent = r.note || "";
    }

    // Number inputs update results only (keeps focus); buttons can change the
    // field set, so they re-render the inputs too.
    inputs.addEventListener("input", function (e) {
      var k = e.target.getAttribute("data-field");
      if (!k) return;
      var v = parseFloat(e.target.value);
      st[k] = isNaN(v) ? 0 : v;
      renderOutputs();
    });
    // Dropdowns can change which fields apply (e.g. loan type), so re-render.
    inputs.addEventListener("change", function (e) {
      var k = e.target.getAttribute("data-select");
      if (!k) return;
      var v = e.target.value;
      st[k] = v !== "" && !isNaN(+v) ? +v : v;
      renderInputs();
      var again = inputs.querySelector('[data-select="' + k + '"]');
      if (again) again.focus();
    });
    inputs.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-set]");
      if (!b) return;
      var k = b.getAttribute("data-set");
      st[k] = b.hasAttribute("data-str") ? b.getAttribute("data-str") : b.getAttribute("data-val") === "1";
      renderInputs();
    });
    var reset = root.querySelector(".c-reset");
    if (reset) {
      var defaults = JSON.stringify(st);
      reset.addEventListener("click", function () {
        var d = JSON.parse(defaults);
        Object.keys(d).forEach(function (k) { st[k] = d[k]; });
        renderInputs();
      });
    }
    renderInputs();
  }

  // Show one calculator at a time, chosen from the picker; the URL hash
  // (e.g. calculators.html#refinance) makes each one linkable.
  function select(id, scroll, keepHash) {
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
      b.addEventListener("click", function () { select(b.getAttribute("data-pick"), true); });
      b.addEventListener("keydown", function (e) {
        var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        var next = picks[(i + d + picks.length) % picks.length];
        next.focus(); select(next.getAttribute("data-pick"), false);
      });
    });
    if (!select(location.hash.slice(1), false)) select(picks[0].getAttribute("data-pick"), false, true);
    window.addEventListener("hashchange", function () { select(location.hash.slice(1), true); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
