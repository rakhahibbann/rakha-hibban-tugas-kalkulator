/* ============================================================
   NEBULA — logika kalkulator
   ============================================================ */

(() => {
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const modeEl = document.getElementById('mode');
  const footnoteEl = document.getElementById('footnote');
  const modeKey = document.querySelector('[data-action="mode"]');

  let expression = '';   // apa yang ditampilkan ke pengguna
  let isDegree = true;   // mode sudut: derajat vs radian
  let justEvaluated = false;

  const FOOTNOTES = [
    'siap menghitung semesta',
    'setiap angka adalah bintang',
    'menyusun ulang konstelasi',
    'menghitung jarak antar galaksi',
    'π mengorbit tanpa henti',
  ];

  function randomFootnote() {
    return FOOTNOTES[Math.floor(Math.random() * FOOTNOTES.length)];
  }

  function updateDisplay(preview) {
    expressionEl.textContent = expression || '\u00A0';
    resultEl.textContent = preview !== undefined ? preview : (expression === '' ? '0' : expression);
  }

  function setError(msg) {
    resultEl.textContent = 'Error';
    footnoteEl.textContent = msg || 'ekspresi hilang ditelan lubang hitam';
    footnoteEl.classList.add('is-error');
  }

  function clearError() {
    footnoteEl.classList.remove('is-error');
    footnoteEl.textContent = randomFootnote();
  }

  // --- factorial helper ---
  function factorial(n) {
    if (n < 0 || !Number.isFinite(n)) return NaN;
    if (Math.floor(n) !== n) {
      // gamma approximation not needed for a calculator; restrict to integers
      return NaN;
    }
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  // --- convert user-facing expression into a safe evaluable JS expression ---
  function toEvaluable(expr) {
    let e = expr;

    // replace constants
    e = e.replace(/π/g, 'PI').replace(/\bpi\b/gi, 'PI');
    e = e.replace(/\be\b/g, 'E');

    // factorial: turn "5!" or "(3+2)!" into fact(5)
    // simple approach: repeatedly replace "<number or )>!" with fact(<number or group>)
    while (/(\d+(\.\d+)?|\))!/.test(e)) {
      e = e.replace(/(\d+(\.\d+)?)\!/, 'fact($1)');
      e = e.replace(/(\([^()]*\))\!/, 'fact($1)');
    }

    // caret power
    e = e.replace(/\^/g, '**');

    // sqrt
    e = e.replace(/√\(/g, 'sqrt(');

    // trig / log functions -> prefix with SCOPE.
    e = e.replace(/\b(sin|cos|tan|log|ln|sqrt)\(/g, 'SCOPE.$1(');

    // constants -> SCOPE
    e = e.replace(/\bPI\b/g, 'SCOPE.PI').replace(/\bE\b/g, 'SCOPE.E');

    // fact(...) -> SCOPE.fact(...)
    e = e.replace(/\bfact\(/g, 'SCOPE.fact(');

    return e;
  }

  function buildScope() {
    const toRad = (deg) => deg * Math.PI / 180;
    return {
      PI: Math.PI,
      E: Math.E,
      sin: (x) => Math.sin(isDegree ? toRad(x) : x),
      cos: (x) => Math.cos(isDegree ? toRad(x) : x),
      tan: (x) => Math.tan(isDegree ? toRad(x) : x),
      log: (x) => Math.log10(x),
      ln: (x) => Math.log(x),
      sqrt: (x) => Math.sqrt(x),
      fact: (x) => factorial(x),
    };
  }

  function evaluateExpression(expr) {
    if (!expr.trim()) return null;

    // whitelist check on the raw (pre-transform) expression to keep this safe:
    // digits, operators, parentheses, letters used by our own function names, dot, !, spaces, π
    const allowed = /^[0-9+\-*/().^!√πa-zA-Z\s]*$/;
    if (!allowed.test(expr)) {
      throw new Error('karakter tidak dikenal');
    }

    const evaluable = toEvaluable(expr);
    const scope = buildScope();

    // guard against stray letters that aren't part of our known function names
    const strippedOfKnown = evaluable
      .replace(/SCOPE\.(sin|cos|tan|log|ln|sqrt|fact|PI|E)/g, '');
    if (/[a-zA-Z]/.test(strippedOfKnown)) {
      throw new Error('fungsi tidak dikenal');
    }

    // eslint-disable-next-line no-new-func
    const fn = new Function('SCOPE', `"use strict"; return (${evaluable});`);
    const value = fn(scope);

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error('hasil di luar jangkauan semesta');
    }
    return value;
  }

  function formatNumber(n) {
    if (Number.isInteger(n)) return n.toString();
    // trim floating point noise, keep reasonable precision
    const fixed = parseFloat(n.toFixed(10));
    return fixed.toString();
  }

  // --- input handling ---

  function appendValue(val) {
    if (justEvaluated) {
      // start fresh unless the user is chaining an operator
      expression = '';
      justEvaluated = false;
    }
    expression += val;
    updateDisplay();
  }

  function appendOperator(op) {
    if (justEvaluated) {
      justEvaluated = false;
    }
    if (expression === '' && op !== '-') return; // don't start with an operator (allow leading minus)
    const last = expression.slice(-1);
    if ('+-*/^'.includes(last)) {
      expression = expression.slice(0, -1) + op; // replace trailing operator
    } else {
      expression += op;
    }
    updateDisplay();
  }

  function appendFunc(val) {
    if (justEvaluated) {
      expression = '';
      justEvaluated = false;
    }
    if (val === 'fact') {
      expression += '!';
    } else {
      expression += val;
    }
    updateDisplay();
  }

  function appendConst(name) {
    if (justEvaluated) {
      expression = '';
      justEvaluated = false;
    }
    expression += (name === 'pi') ? 'π' : 'e';
    updateDisplay();
  }

  function clearAll() {
    expression = '';
    justEvaluated = false;
    clearError();
    updateDisplay();
  }

  function backspace() {
    if (justEvaluated) {
      clearAll();
      return;
    }
    expression = expression.slice(0, -1);
    clearError();
    updateDisplay();
  }

  function equals() {
    try {
      const value = evaluateExpression(expression);
      if (value === null) return;
      clearError();
      resultEl.textContent = formatNumber(value);
      expressionEl.textContent = expression + ' =';
      expression = formatNumber(value);
      justEvaluated = true;
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleMode() {
    isDegree = !isDegree;
    modeEl.textContent = isDegree ? 'DEG' : 'RAD';
    modeKey.textContent = isDegree ? 'DEG' : 'RAD';
  }

  // --- wire up buttons ---

  document.querySelectorAll('.key').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const value = btn.dataset.value;

      switch (action) {
        case 'num': appendValue(value); break;
        case 'operator': appendOperator(value); break;
        case 'func':
          if (value === 'fact') appendFunc('fact');
          else appendFunc(value);
          break;
        case 'const': appendConst(value); break;
        case 'clear': clearAll(); break;
        case 'backspace': backspace(); break;
        case 'equals': equals(); break;
        case 'mode': toggleMode(); break;
      }
    });
  });

  // --- keyboard support ---

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (/[0-9.]/.test(k)) { appendValue(k); return; }
    if (['+', '-', '*', '/', '^'].includes(k)) { appendOperator(k); return; }
    if (k === '(' || k === ')') { appendValue(k); return; }
    if (k === 'Enter' || k === '=') { e.preventDefault(); equals(); return; }
    if (k === 'Backspace') { backspace(); return; }
    if (k === 'Escape') { clearAll(); return; }
  });

  clearError();
  updateDisplay();

  /* ============================================================
     starfield background — twinkling stars + slow drift comet
     ============================================================ */

  const canvas = document.getElementById('starfield');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (canvas && !reduceMotion) {
    const ctx = canvas.getContext('2d');
    let stars = [];
    let width, height;

    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      const count = Math.floor((width * height) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.3 + 0.2,
        baseAlpha: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
        hue: Math.random() > 0.85 ? 'comet' : 'ink',
      }));
    }

    function draw(t) {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const alpha = s.baseAlpha + Math.sin(t * s.twinkleSpeed + s.phase) * 0.25;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.hue === 'comet'
          ? `rgba(78, 225, 209, ${Math.max(0, alpha)})`
          : `rgba(232, 230, 255, ${Math.max(0, alpha)})`;
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(draw);
  }
})();
