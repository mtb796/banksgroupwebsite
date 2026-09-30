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
  function choice(key, label, options) { return { kind: "choice", key: key, label: label, options: options }; }

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
      var pointsCost = base * s.points / 100;
      var costs = s.closing + pointsCost;
      var newLoan = base + (s.roll ? costs : 0);
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

  // ---------- Affordability (with discount points) ----------
  function affordPrice(s, rate) {
    var income = s.income / 12;
    var budget = Math.min(income * s.frontDti / 100, income * s.backDti / 100 - s.debts);
    var payment = function (price) {
      var loan = Math.max(0, price - s.down);
      var mi = price > 0 && loan / price > 0.8 ? loan * s.pmiRate / 100 / 12 : 0;
      return pmt(loan, rate, s.term) + price * s.taxRate / 100 / 12 + s.insurance / 12 + s.hoa + mi;
    };
    var price = solveMax(payment, budget, s.down, s.down + 2e7);
    return { price: price, budget: budget, payment: payment };
  }
  CALCS.affordability = {
    state: { income: 165000, debts: 650, down: 60000, rate: 6.5, term: 30, points: 1, perPoint: 0.25, taxRate: 1.0, insurance: 1500, hoa: 0, pmiRate: 0.5, frontDti: 33, backDti: 43, closingPct: 2.5 },
    compute: function (s) {
      var effRate = Math.max(0, s.rate - s.points * s.perPoint);
      var withPts = affordPrice(s, effRate);
      var noPts = affordPrice(s, s.rate);
      var price = withPts.price;
      var ok = isFinite(price);
      var loan = ok ? Math.max(0, price - s.down) : 0;
      var pi = pmt(loan, effRate, s.term);
      var taxes = ok ? price * s.taxRate / 100 / 12 : 0;
      var mi = ok && price > 0 && loan / price > 0.8 ? loan * s.pmiRate / 100 / 12 : 0;
      var total = pi + taxes + s.insurance / 12 + s.hoa + mi;
      var pointsCost = loan * s.points / 100;
      var ptSavings = pmt(loan, s.rate, s.term) - pi;
      var breakeven = ptSavings > 0 ? pointsCost / ptSavings : NaN;
      var cashToClose = s.down + pointsCost + (ok ? price * s.closingPct / 100 : 0);
      var backUsed = s.income > 0 ? (total + s.debts) / (s.income / 12) : NaN;
      var verdict, color;
      if (!ok) { verdict = "DEBTS EXCEED THE DTI LIMIT — PAY DOWN OR ADJUST"; color = BAD; }
      else if (s.points <= 0) { verdict = "NO POINTS — ADD SOME TO SEE THE TRADE-OFF"; color = WARN; }
      else if (breakeven <= 60) { verdict = "POINTS PAY BACK IN " + Math.ceil(breakeven) + " MONTHS"; color = GOOD; }
      else { verdict = "POINTS TAKE " + Math.ceil(breakeven) + "+ MONTHS TO PAY BACK"; color = WARN; }
      return {
        groups: [
          { title: "INCOME & DEBTS", fields: [ num("income", "Gross household income", "$", "/yr", 1000), num("debts", "Monthly debt payments", "$", "/mo", 25), num("frontDti", "Max housing ratio", "", "%", 0.5), num("backDti", "Max total DTI", "", "%", 0.5) ] },
          { title: "LOAN & DISCOUNT POINTS", fields: [ num("down", "Down payment", "$", "", 1000), num("rate", "Interest rate (no points)", "", "%", 0.125), num("term", "Loan term", "", "yrs"), num("points", "Discount points bought", "", "pts", 0.25), num("perPoint", "Rate drop per point", "", "%", 0.05) ] },
          { title: "HOUSING COSTS", fields: [ num("taxRate", "Property tax rate", "", "%/yr", 0.05), num("insurance", "Homeowners insurance", "$", "/yr", 50), num("hoa", "HOA / condo fee", "$", "/mo", 10), num("pmiRate", "PMI (if < 20% down)", "", "%/yr", 0.05), num("closingPct", "Other closing costs", "", "%", 0.25) ] }
        ],
        heroLabel: "HOME PRICE YOU CAN AFFORD", heroValue: ok ? fmt$(price) : "—",
        verdict: verdict, verdictColor: color,
        outputs: [
          ["Loan amount", fmt$(loan)],
          ["Rate after points", fmtRate(effRate)],
          ["Principal & interest", fmt$(pi)],
          ["Taxes + insurance + HOA", fmt$(taxes + s.insurance / 12 + s.hoa)],
          ["Mortgage insurance", fmt$(mi)],
          ["Total monthly payment", fmt$(total)],
          ["Total DTI used", fmtPct(backUsed)],
          ["Cost of points", fmt$(pointsCost)],
          ["Monthly savings from points", fmt$(ptSavings)],
          ["Points break-even", fmtMo(breakeven)],
          ["Buying power added by points", isFinite(noPts.price) && ok ? fmt$(price - noPts.price) : "—"],
          ["Estimated cash to close", fmt$(cashToClose)]
        ],
        note: "Rate drop per point varies by lender and by day — 0.25% per point is a common rule of thumb. Get it in writing on a Loan Estimate."
      };
    }
  };

  // ---------- Maximum mortgage by loan type ----------
  var LOAN_TYPES = [["conv", "CONVENTIONAL"], ["fha", "FHA"], ["va", "VA"], ["hard", "HARD MONEY"], ["construction", "NEW CONSTRUCTION"]];
  // VA funding fee, first use / subsequent use, by down payment tier.
  function vaFee(downPct, subsequent) {
    if (downPct >= 10) return 1.25;
    if (downPct >= 5) return 1.5;
    return subsequent ? 3.3 : 2.15;
  }
  CALCS.maxloan = {
    state: {
      type: "conv",
      income: 165000, debts: 650, rate: 6.5, term: 30, taxRate: 1.0, insurance: 1500, hoa: 0,
      convDown: 5, convDti: 45, convPmi: 0.5, convLimit: 1249125,
      fhaDown: 3.5, fhaFront: 31, fhaBack: 43, fhaMip: 0.55, fhaUfmip: 1.75, fhaLimit: 1249125,
      vaDown: 0, vaDti: 41, vaSubsequent: false, vaExempt: false,
      hmPurchase: 400000, hmRehab: 90000, hmArv: 660000, hmPurchPct: 90, hmRehabPct: 100, hmArvPct: 70, hmRate: 11, hmPoints: 2,
      ncLand: 250000, ncBuild: 520000, ncValue: 1050000, ncLtc: 85, ncLtv: 75, ncOwnLand: false, ncRate: 9.5, ncPoints: 1.5
    },
    compute: function (s) {
      var typeField = choice("type", "Loan type", LOAN_TYPES);
      if (s.type === "hard" || s.type === "construction") return s.type === "hard" ? hardMoney(s, typeField) : construction(s, typeField);
      return residential(s, typeField);
    }
  };

  function residential(s, typeField) {
    var t = s.type, down, front, back, upfront, annualMi, limit, fields;
    if (t === "conv") {
      down = s.convDown; front = Infinity; back = s.convDti; upfront = 0; limit = s.convLimit;
      annualMi = down < 20 ? s.convPmi : 0;
      fields = [ num("convDown", "Down payment", "", "%", 0.5), num("convDti", "Max total DTI", "", "%", 0.5), num("convPmi", "PMI (if < 20% down)", "", "%/yr", 0.05), num("convLimit", "Conforming limit (county)", "$", "", 1000) ];
    } else if (t === "fha") {
      down = Math.max(3.5, s.fhaDown); front = s.fhaFront; back = s.fhaBack; upfront = s.fhaUfmip; annualMi = s.fhaMip; limit = s.fhaLimit;
      fields = [ num("fhaDown", "Down payment (3.5% min)", "", "%", 0.5), num("fhaFront", "Max housing ratio", "", "%", 0.5), num("fhaBack", "Max total DTI", "", "%", 0.5), num("fhaUfmip", "Upfront MIP (financed)", "", "%", 0.05), num("fhaMip", "Annual MIP", "", "%/yr", 0.05), num("fhaLimit", "FHA limit (county)", "$", "", 1000) ];
    } else {
      down = s.vaDown; front = Infinity; back = s.vaDti; annualMi = 0; limit = Infinity;
      upfront = s.vaExempt ? 0 : vaFee(down, s.vaSubsequent);
      fields = [ num("vaDown", "Down payment", "", "%", 0.5), num("vaDti", "Target total DTI", "", "%", 0.5), toggle("vaSubsequent", "Used VA entitlement before?"), toggle("vaExempt", "Funding-fee exempt (disability)?") ];
    }
    var d = down / 100;
    var income = s.income / 12;
    var budget = Math.min(income * front / 100, income * back / 100 - s.debts);
    var payment = function (price) {
      var base = price * (1 - d);
      return pmt(base * (1 + upfront / 100), s.rate, s.term) + base * annualMi / 100 / 12 + price * s.taxRate / 100 / 12 + s.insurance / 12 + s.hoa;
    };
    var incomePrice = solveMax(payment, budget, 0, 2e7);
    var ok = isFinite(incomePrice) && incomePrice > 0;
    var capped = ok && d < 1 && incomePrice * (1 - d) > limit;
    var price = capped ? limit / (1 - d) : incomePrice;
    var base = ok ? price * (1 - d) : 0;
    var total = base * (1 + upfront / 100);
    var pay = ok ? payment(price) : 0;
    var labels = { conv: "CONVENTIONAL", fha: "FHA", va: "VA" };
    var verdict, color;
    if (!ok) { verdict = "DEBTS EXCEED THE DTI LIMIT"; color = BAD; }
    else if (capped && t === "conv") { verdict = "INCOME SUPPORTS MORE — ABOVE THIS IS JUMBO"; color = WARN; }
    else if (capped) { verdict = "CAPPED BY THE COUNTY FHA LIMIT"; color = WARN; }
    else { verdict = "INCOME-QUALIFIED " + labels[t] + " MAXIMUM"; color = GOOD; }
    var outputs = [
      ["Maximum purchase price", ok ? fmt$(price) : "—"],
      ["Down payment (" + down + "%)", fmt$(ok ? price * d : 0)]
    ];
    if (upfront > 0) outputs.push([t === "va" ? "Funding fee (" + upfront + "%, financed)" : "Upfront MIP (" + upfront + "%, financed)", fmt$(total - base)]);
    outputs.push(
      ["Principal & interest", fmt$(pmt(total, s.rate, s.term))],
      [t === "fha" ? "Monthly MIP" : "Mortgage insurance", fmt$(base * annualMi / 100 / 12)],
      ["Taxes + insurance + HOA", fmt$(ok ? price * s.taxRate / 100 / 12 + s.insurance / 12 + s.hoa : 0)],
      ["Total monthly payment", fmt$(pay)],
      ["Max payment your income allows", fmt$(budget)]
    );
    if (capped && t === "conv") outputs.push(["Income-supported price (jumbo)", fmt$(incomePrice)]);
    if (t === "va") outputs.push(["Loan limit (full entitlement)", "None"]);
    var notes = {
      conv: "Conventional allows as little as 3% down for first-time buyers; PMI drops off at 78% of the original value.",
      fha: "Annual MIP is 0.55% up to a $726,200 base loan (0.75% above) and stays for the life of the loan with under 10% down. Automated approvals often go well above 43% DTI.",
      va: "VA lenders also check residual income — money left each month after all obligations — which can matter more than DTI."
    };
    return {
      groups: [
        { title: "LOAN TYPE", fields: [ typeField ] },
        { title: "INCOME & DEBTS", fields: [ num("income", "Gross household income", "$", "/yr", 1000), num("debts", "Monthly debt payments", "$", "/mo", 25), num("rate", "Interest rate", "", "%", 0.125), num("term", "Loan term", "", "yrs") ] },
        { title: labels[t] + " GUIDELINES", fields: fields },
        { title: "HOUSING COSTS", fields: [ num("taxRate", "Property tax rate", "", "%/yr", 0.05), num("insurance", "Homeowners insurance", "$", "/yr", 50), num("hoa", "HOA / condo fee", "$", "/mo", 10) ] }
      ],
      heroLabel: "MAXIMUM " + labels[t] + " LOAN", heroValue: ok ? fmt$(total) : "—",
      verdict: verdict, verdictColor: color, outputs: outputs, note: notes[t]
    };
  }

  function hardMoney(s, typeField) {
    var byCost = s.hmPurchase * s.hmPurchPct / 100 + s.hmRehab * s.hmRehabPct / 100;
    var byArv = s.hmArv * s.hmArvPct / 100;
    var loan = Math.max(0, Math.min(byCost, byArv));
    var project = s.hmPurchase + s.hmRehab;
    var points = loan * s.hmPoints / 100;
    var arvLimited = byArv < byCost;
    return {
      groups: [
        { title: "LOAN TYPE", fields: [ typeField ] },
        { title: "THE DEAL", fields: [ num("hmPurchase", "Purchase price", "$", "", 1000), num("hmRehab", "Rehab budget", "$", "", 1000), num("hmArv", "After-repair value (ARV)", "$", "", 5000) ] },
        { title: "LENDER TERMS", fields: [ num("hmPurchPct", "% of purchase funded", "", "%", 0.5), num("hmRehabPct", "% of rehab funded", "", "%", 0.5), num("hmArvPct", "Max loan-to-ARV", "", "%", 0.5), num("hmRate", "Interest rate", "", "%", 0.125), num("hmPoints", "Lender points", "", "pts", 0.25) ] }
      ],
      heroLabel: "MAXIMUM HARD MONEY LOAN", heroValue: fmt$(loan),
      verdict: arvLimited ? "CAPPED BY ARV — EXPECT MORE CASH IN" : "FULLY FUNDED TO LENDER'S LTC",
      verdictColor: arvLimited ? WARN : GOOD,
      outputs: [
        ["Loan by cost (purchase + rehab)", fmt$(byCost)],
        ["Loan cap by ARV (" + s.hmArvPct + "%)", fmt$(byArv)],
        ["Loan-to-cost", fmtPct(project > 0 ? loan / project : NaN)],
        ["Cash for purchase + rehab", fmt$(project - loan)],
        ["Points at closing", fmt$(points)],
        ["Interest-only payment (fully drawn)", fmt$(loan * s.hmRate / 100 / 12)]
      ],
      note: "Hard money is asset-based: the deal qualifies more than your income does. Rehab funds are usually reimbursed in draws after inspection."
    };
  }

  function construction(s, typeField) {
    var cost = s.ncLand + s.ncBuild;
    var byCost = cost * s.ncLtc / 100;
    var byValue = s.ncValue * s.ncLtv / 100;
    var loan = Math.max(0, Math.min(byCost, byValue));
    var cashIn = Math.max(0, cost - loan - (s.ncOwnLand ? s.ncLand : 0));
    var valueLimited = byValue < byCost;
    return {
      groups: [
        { title: "LOAN TYPE", fields: [ typeField ] },
        { title: "THE PROJECT", fields: [ num("ncLand", "Land value / cost", "$", "", 1000), num("ncBuild", "Total build budget", "$", "", 1000), num("ncValue", "As-completed value", "$", "", 5000), toggle("ncOwnLand", "Already own the land?") ] },
        { title: "LENDER TERMS", fields: [ num("ncLtc", "Max loan-to-cost", "", "%", 0.5), num("ncLtv", "Max loan-to-completed-value", "", "%", 0.5), num("ncRate", "Interest rate", "", "%", 0.125), num("ncPoints", "Lender points", "", "pts", 0.25) ] }
      ],
      heroLabel: "MAXIMUM CONSTRUCTION LOAN", heroValue: fmt$(loan),
      verdict: valueLimited ? "LIMITED BY AS-COMPLETED VALUE" : "FUNDED TO LENDER'S MAX LTC",
      verdictColor: valueLimited ? WARN : GOOD,
      outputs: [
        ["Loan by cost (" + s.ncLtc + "% LTC)", fmt$(byCost)],
        ["Loan cap by value (" + s.ncLtv + "% LTV)", fmt$(byValue)],
        ["Total project cost", fmt$(cost)],
        [s.ncOwnLand ? "Cash needed (land equity credited)" : "Cash needed", fmt$(cashIn)],
        ["Points at closing", fmt$(loan * s.ncPoints / 100)],
        ["Interest-only payment (fully drawn)", fmt$(loan * s.ncRate / 100 / 12)],
        ["Interest-only payment (avg ~60% drawn)", fmt$(loan * 0.6 * s.ncRate / 100 / 12)]
      ],
      note: "Owner-occupants can often use a one-time-close construction-to-permanent loan (conventional, FHA or VA) that converts to a regular mortgage at completion."
    };
  }

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
    if (f.kind === "choice") {
      return '<div style="grid-column:1/-1;"><div class="calc-choice" role="group" aria-label="' + esc(f.label) + '">' +
        f.options.map(function (o) {
          var on = st[f.key] === o[0];
          return '<button type="button" data-set="' + f.key + '" data-str="' + o[0] + '" aria-pressed="' + on + '" style="' + BTN + (on ? ACT : IDLE) + '">' + o[1] + '</button>';
        }).join("") + '</div></div>';
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
