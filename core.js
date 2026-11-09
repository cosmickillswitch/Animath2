/* Animath engine: builds scene objects into drawable primitives and renders any moment in time.
   Coordinates follow Manim: the frame is 8 units tall, the origin is the centre, y points up.
   Inside an object, primitives use local units with y pointing down (canvas style). */
(function () {
  'use strict';

  // ---------- colours and fonts ----------
  const PAL = {
    WHITE: '#FFFFFF', GREY: '#888888', BLUE: '#58C4DD', TEAL: '#5CD0B3', GREEN: '#83C167', YELLOW: '#FFFF00',
    GOLD: '#F0AC5F', ORANGE: '#FF862F', RED: '#FC6255', MAROON: '#C55F73', PURPLE: '#9A72AC', PINK: '#D147BD',
    BLUE_E: '#1C758A', GREEN_E: '#699C52', BLACK: '#000000', INK: '#1B1B1F'
  };
  const FALL = '"Latin Modern Roman","CMU Serif","Cambria Math","STIX Two Text","Times New Roman",serif';
  const FAM = {
    main: '"LM","LMMath",' + FALL, math: '"LM","LMMath",' + FALL, ams: '"LMMath",' + FALL, size1: '"LMMath","LM",' + FALL,
    cal: '"LMMath",' + FALL, sans: '"IBM Plex Sans",system-ui,sans-serif', mono: '"IBM Plex Mono",ui-monospace,monospace'
  };
  const fontCss = (st, px, fam) => (st || '') + ' ' + px + 'px ' + FAM[fam];
  function color(c) { if (!c) return c; return PAL[String(c).toUpperCase()] || c; }
  function hex2rgb(h) {
    h = color(h) || '#fff';
    if (h[0] !== '#') { const m = /(\d+)\D+(\d+)\D+(\d+)/.exec(h); return m ? [+m[1], +m[2], +m[3]] : [255, 255, 255]; }
    if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    const n = parseInt(h.slice(1, 7), 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function mixColor(a, b, t) {
    if (t <= 0) return color(a); if (t >= 1) return color(b);
    const A = hex2rgb(a), B = hex2rgb(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
  }

  // ---------- measuring ----------
  const mc = document.createElement('canvas').getContext('2d');
  let mcache = new Map();
  function meas(ch, fam, st) {
    const k = fam + '|' + (st || '') + '|' + ch;
    let m = mcache.get(k);
    if (m) return m;
    mc.font = fontCss(st, 100, fam);
    const r = mc.measureText(ch);
    m = { w: r.width / 100, a: (r.actualBoundingBoxAscent || 70) / 100, d: (r.actualBoundingBoxDescent || 0) / 100 };
    if (ch === ' ') { m.a = 0; m.d = 0; }
    mcache.set(k, m);
    return m;
  }

  // ---------- rate functions (Manim's smooth etc.) ----------
  const sig = x => 1 / (1 + Math.exp(-x));
  const RATE = {
    smooth: t => { const e = sig(-5); return Math.min(Math.max((sig(10 * (t - 0.5)) - e) / (1 - 2 * e), 0), 1); },
    linear: t => t,
    easeIn: t => t * t * t,
    easeOut: t => 1 - Math.pow(1 - t, 3),
    thereAndBack: t => { const u = t < 0.5 ? 2 * t : 2 * (1 - t); return RATE.smooth(u); }
  };
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;

  // ---------- TeX-like maths ----------
  const SYM = {};
  const def = (names, ch, cls, fam, st) => names.split(' ').forEach(n => { SYM[n] = { ch, cls, fam: fam || 'main', st: st || '' }; });
  'alpha α|beta β|gamma γ|delta δ|epsilon ϵ|varepsilon ε|zeta ζ|eta η|theta θ|vartheta ϑ|iota ι|kappa κ|lambda λ|mu μ|nu ν|xi ξ|pi π|varpi ϖ|rho ρ|varrho ϱ|sigma σ|tau τ|upsilon υ|phi ϕ|varphi φ|chi χ|psi ψ|omega ω'.split('|').forEach(p => { const [n, c] = p.split(' '); def(n, c, 'ord', 'math', 'italic'); });
  'Gamma Γ|Delta Δ|Theta Θ|Lambda Λ|Xi Ξ|Pi Π|Sigma Σ|Upsilon Υ|Phi Φ|Psi Ψ|Omega Ω'.split('|').forEach(p => { const [n, c] = p.split(' '); def(n, c, 'ord'); });
  [['leq le', '≤'], ['geq ge', '≥'], ['neq ne', '≠'], ['approx', '≈'], ['equiv', '≡'], ['sim', '∼'], ['simeq', '≃'], ['cong', '≅'], ['propto', '∝'],
    ['in', '∈'], ['notin', '∉'], ['ni', '∋'], ['subset', '⊂'], ['subseteq', '⊆'], ['supset', '⊃'], ['supseteq', '⊇'], ['to rightarrow', '→'], ['leftarrow gets', '←'],
    ['Rightarrow implies', '⇒'], ['Leftarrow impliedby', '⇐'], ['leftrightarrow', '↔'], ['Leftrightarrow iff', '⇔'], ['mapsto', '↦'], ['vdash', '⊢'], ['dashv', '⊣'],
    ['models vDash', '⊨'], ['parallel', '∥'], ['mid', '∣'], ['perp', '⊥'], ['ll', '≪'], ['gg', '≫'], ['coloneqq', '≔'], ['longrightarrow', '⟶'], ['uparrow', '↑'], ['downarrow', '↓']
  ].forEach(([n, c]) => def(n, c, 'rel'));
  [['times', '×'], ['cdot', '⋅'], ['div', '÷'], ['pm', '±'], ['mp', '∓'], ['cup', '∪'], ['cap', '∩'], ['setminus', '∖'], ['land wedge', '∧'], ['lor vee', '∨'],
    ['oplus', '⊕'], ['otimes', '⊗'], ['circ', '∘'], ['ast', '∗'], ['star', '⋆'], ['bullet', '∙'], ['triangle', '△']].forEach(([n, c]) => def(n, c, 'bin'));
  [['forall', '∀'], ['exists', '∃'], ['nexists', '∄'], ['neg lnot', '¬'], ['emptyset varnothing', '∅'], ['infty', '∞'], ['partial', '∂'], ['nabla', '∇'],
    ['top', '⊤'], ['bot', '⊥'], ['angle', '∠'], ['prime', '′'], ['ldots dots', '…'], ['cdots', '⋯'], ['hbar', 'ℏ'], ['ell', 'ℓ'], ['Box square', '□'], ['Diamond lozenge', '◇'],
    ['aleph', 'ℵ'], ['degree', '°'], ['checkmark', '✓'], ['therefore', '∴'], ['because', '∵'], ['%', '%'], ['#', '#'], ['&', '&'], ['_', '_'], ['$', '$'], ['|', '∥']
  ].forEach(([n, c]) => def(n, c, 'ord'));
  [['langle', '⟨', 'open'], ['rangle', '⟩', 'close'], ['lfloor', '⌊', 'open'], ['rfloor', '⌋', 'close'], ['lceil', '⌈', 'open'], ['rceil', '⌉', 'close'], ['{', '{', 'open'], ['}', '}', 'close']]
    .forEach(([n, c, k]) => def(n, c, k));
  const BIGOP = { sum: '∑', prod: '∏', coprod: '∐', bigcup: '⋃', bigcap: '⋂', bigvee: '⋁', bigwedge: '⋀', int: '∫', iint: '∬', oint: '∮' };
  const FNS = 'sin cos tan sec csc cot arcsin arccos arctan sinh cosh tanh log ln exp lim max min sup inf det gcd deg dim ker arg Pr mod'.split(' ');
  const SPACE = { ',': 3 / 18, ':': 4 / 18, '>': 4 / 18, ';': 5 / 18, '!': -3 / 18, ' ': 0.3, quad: 1, qquad: 2, enspace: 0.5 };
  const BB = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ', H: 'ℍ' };

  function parseTex(s) {
    let i = 0;
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    function readName() {
      i++; // backslash
      if (!/[A-Za-z]/.test(s[i] || '')) return s[i++] || '';
      let n = '';
      while (i < s.length && /[A-Za-z]/.test(s[i])) n += s[i++];
      return n;
    }
    function raw() {
      ws();
      if (s[i] !== '{') return s[i++] || '';
      let depth = 0, out = '';
      i++;
      while (i < s.length) {
        if (s[i] === '{') depth++;
        else if (s[i] === '}') { if (!depth) break; depth--; }
        out += s[i++];
      }
      i++;
      return out;
    }
    function arg() {
      ws();
      if (s[i] === '{') { i++; const l = list('}'); i++; return { t: 'grp', l }; }
      if (s[i] === '\\') { const n = []; one(n); return n[0] || { t: 'grp', l: [] }; }
      return sym(s[i++] || '');
    }
    function delim() {
      ws();
      if (s[i] === '\\') { const n = readName(); return n === '.' ? '' : (SYM[n] ? SYM[n].ch : n === '|' ? '‖' : n === '{' ? '{' : n === '}' ? '}' : ''); }
      const c = s[i++]; return c === '.' ? '' : c;
    }
    function sym(c) {
      if (/[A-Za-z]/.test(c)) return { t: 's', ch: c, fam: 'math', st: 'italic', cls: 'ord' };
      if (c === '-') return { t: 's', ch: '−', fam: 'main', cls: 'bin' };
      if ('+*'.includes(c)) return { t: 's', ch: c === '*' ? '∗' : c, fam: 'main', cls: 'bin' };
      if ('=<>'.includes(c)) return { t: 's', ch: c, fam: 'main', cls: 'rel' };
      if (',;'.includes(c)) return { t: 's', ch: c, fam: 'main', cls: 'punct' };
      if ('([' .includes(c)) return { t: 's', ch: c, fam: 'main', cls: 'open' };
      if (')]!'.includes(c)) return { t: 's', ch: c, fam: 'main', cls: 'close' };
      if (c === "'") return { t: 's', ch: '′', fam: 'main', cls: 'ord' };
      if (c === ':') return { t: 's', ch: ':', fam: 'main', cls: 'rel' };
      const rel = '≤≥≠≈≡∈∉⊂⊆⊃⊇→←⇒⇔↔⊢⊨', bin = '×⋅÷±∪∩∧∨⊕⊗∘';
      return { t: 's', ch: c, fam: 'main', cls: rel.includes(c) ? 'rel' : bin.includes(c) ? 'bin' : 'ord' };
    }
    function one(out) {
      const c = s[i];
      if (c === '\\') {
        const n = readName();
        if (n === 'frac' || n === 'dfrac' || n === 'tfrac') { out.push({ t: 'frac', n: arg(), d: arg() }); return; }
        if (n === 'binom') { out.push({ t: 'lr', l: '(', r: ')', b: [{ t: 'frac', n: arg(), d: arg(), nobar: true }] }); return; }
        if (n === 'sqrt') { out.push({ t: 'sqrt', b: arg() }); return; }
        if (n === 'text' || n === 'textrm' || n === 'mathrm' || n === 'operatorname' || n === 'textit' || n === 'textbf') { out.push({ t: 'txt', s: raw(), st: n === 'textit' ? 'italic' : n === 'textbf' ? 'bold' : '', op: n === 'operatorname' }); return; }
        if (n === 'mathbf' || n === 'boldsymbol') { out.push({ t: 'style', st: 'bold', b: arg() }); return; }
        if (n === 'mathit') { out.push({ t: 'style', st: 'italic', b: arg() }); return; }
        if (n === 'mathbb') { raw2bb(raw()).forEach(x => out.push(x)); return; }
        if (n === 'mathcal') { raw().split('').forEach(ch => out.push({ t: 's', ch, fam: 'cal', cls: 'ord' })); return; }
        if (n === 'color' || n === 'textcolor') { out.push({ t: 'col', c: raw(), b: arg() }); return; }
        if (n === 'overline' || n === 'bar') { out.push({ t: 'over', b: arg() }); return; }
        if (n === 'vec' || n === 'hat' || n === 'tilde' || n === 'dot') { out.push({ t: 'acc', a: { vec: '→', hat: '^', tilde: '~', dot: '˙' }[n], b: arg() }); return; }
        if (n === 'left') {
          const l = delim();
          const b = list(null, true);
          let r = '';
          if (s.startsWith('\\right', i)) { i += 6; r = delim(); }
          out.push({ t: 'lr', l, r, b });
          return;
        }
        if (n === 'right') return;
        if (n in SPACE) { out.push({ t: 'sp', w: SPACE[n] }); return; }
        if (BIGOP[n]) { out.push({ t: 'op', ch: BIGOP[n], int: n.includes('int') }); return; }
        if (FNS.includes(n)) { out.push({ t: 'txt', s: n, op: true }); return; }
        if (SYM[n]) { const d = SYM[n]; out.push({ t: 's', ch: d.ch, fam: d.fam, st: d.st, cls: d.cls }); return; }
        out.push({ t: 'txt', s: '\\' + n, bad: true });
        return;
      }
      if (c === '{') { i++; out.push({ t: 'grp', l: list('}') }); i++; return; }
      if (c === '^' || c === '_') {
        i++;
        let base = out.pop() || { t: 'grp', l: [] };
        if (base.t !== 'sc') base = { t: 'sc', base };
        base[c === '^' ? 'sup' : 'sub'] = arg();
        out.push(base);
        return;
      }
      if (/\s/.test(c)) { i++; return; }
      if (c === '~') { i++; out.push({ t: 'sp', w: 0.33 }); return; }
      i++;
      out.push(sym(c));
    }
    function raw2bb(t) { return t.split('').map(ch => ({ t: 's', ch: BB[ch] || ch, fam: 'main', cls: 'ord', bb: ch })); }
    function list(end, stopRight) {
      const out = [];
      while (i < s.length) {
        if (end && s[i] === end) break;
        if (stopRight && s.startsWith('\\right', i)) break;
        one(out);
      }
      return out;
    }
    return list(null);
  }

  // Boxes: {w, a, d, items} with items in local coords (x right, y down, baseline at y=0).
  const box = (w, a, d, items) => ({ w, a, d, items: items || [] });
  function shift(items, dx, dy) {
    return items.map(p => {
      if (p.k === 'g') return Object.assign({}, p, { x: p.x + dx, y: p.y + dy });
      if (p.k === 'p') return Object.assign({}, p, { pts: p.pts.map(q => [q[0] + dx, q[1] + dy]) });
      return p;
    });
  }
  function glyphBox(ch, fam, st, z, c, sy) {
    const m = meas(ch, fam, st);
    return box(m.w * z, m.a * z * (sy || 1), m.d * z * (sy || 1), [{ k: 'g', ch, fam, st: st || '', z, x: 0, y: 0, c, sy: sy || 1 }]);
  }
  function hcat(boxes) {
    let x = 0, a = 0, d = 0;
    const items = [];
    for (const b of boxes) { items.push(...shift(b.items, x, 0)); x += b.w; a = Math.max(a, b.a); d = Math.max(d, b.d); }
    return box(x, a, d, items);
  }
  const line = (x1, y1, x2, y2, sw, c) => ({ k: 'p', pts: [[x1, y1], [x2, y2]], sw, stroke: c, closed: false });
  const SPC = { med: 4 / 18, thick: 5 / 18, thin: 3 / 18 };
  function spacing(a, b, script) {
    if (!a) return 0;
    if (a === 'punct') return SPC.thin;
    if (script) return 0;
    if (a === 'bin' || b === 'bin') return (a === 'bin' && b === 'bin') ? 0 : SPC.med;
    if (a === 'rel' || b === 'rel') return (a === 'rel' && b === 'rel') ? 0 : SPC.thick;
    if (a === 'op' && (b === 'ord' || b === 'open')) return SPC.thin;
    if (b === 'op' && a === 'ord') return SPC.thin;
    return 0;
  }

  function layoutList(list, z, c, depth, st) {
    const parts = [];
    let prev = null;
    for (const n of list) {
      let b = layoutNode(n, z, c, depth, st);
      if (!b) continue;
      let cls = b.cls || 'ord';
      if (cls === 'bin' && (!prev || ['bin', 'rel', 'open', 'punct', 'op'].includes(prev))) cls = 'ord';
      const sp = spacing(prev, cls, depth > 0);
      if (sp) parts.push(box(sp * z, 0, 0));
      parts.push(b);
      prev = cls;
    }
    if (prev === 'bin' && parts.length) { /* trailing bin becomes ord: TeX removes the space before it */ }
    return hcat(parts);
  }

  function layoutNode(n, z, c, depth, st) {
    const AX = 0.25 * z;
    switch (n.t) {
      case 's': {
        let fam = n.fam, sst = n.st || '';
        if (st === 'bold') { sst = fam === 'math' ? 'italic bold' : 'bold'; if (fam === 'math' && /[A-Za-z]/.test(n.ch)) { /* bold italic letter */ } }
        if (st === 'italic' && fam === 'main') sst = 'italic';
                const b = glyphBox(n.ch, fam, sst, z, c);
        if (fam === 'math') b.w += 0.03 * z;
        b.cls = n.cls;
        return b;
      }
      case 'grp': { const b = layoutList(n.l, z, c, depth, st); b.cls = 'ord'; return b; }
      case 'style': return layoutNode(n.b, z, c, depth, n.st);
      case 'col': return layoutNode(n.b, z, color(n.c.trim()) || c, depth, st);
      case 'sp': return box(n.w * z, 0, 0);
      case 'txt': {
        const fam = 'main';
        const sts = st === 'bold' ? 'bold' : n.st || '';
        const b = hcat(n.s.split('').map(ch => glyphBox(ch, fam, sts, z, n.bad ? '#FC6255' : c)));
        b.cls = n.op ? 'op' : 'ord';
        return b;
      }
      case 'frac': {
        const f = depth > 0 ? 0.75 : 0.9;
        const nb = layoutNode(n.n, z * f, c, depth + 1, st), db = layoutNode(n.d, z * f, c, depth + 1, st);
        const th = n.nobar ? 0 : 0.045 * z, gap = 0.14 * z;
        const w = Math.max(nb.w, db.w) + 0.24 * z;
        const ny = -AX - th / 2 - gap - nb.d, dy = -AX + th / 2 + gap + db.a;
        const items = [...shift(nb.items, (w - nb.w) / 2, ny), ...shift(db.items, (w - db.w) / 2, dy)];
        if (!n.nobar) items.push(line(0.06 * z, -AX, w - 0.06 * z, -AX, th, c));
        const b = box(w, -ny + nb.a, dy + db.d, items);
        b.cls = 'ord';
        return b;
      }
      case 'sqrt': {
        const b = layoutNode(n.b, z, c, depth, st);
        const top = -(b.a + 0.16 * z), bot = b.d + 0.1 * z, sw = 0.045 * z;
        const lead = 0.55 * z;
        const pts = [[0, (top + bot) / 2 + 0.08 * z], [0.12 * z, (top + bot) / 2 - 0.02 * z], [0.3 * z, bot], [lead - 0.04 * z, top], [lead + b.w + 0.1 * z, top]];
        const r = box(lead + b.w + 0.14 * z, -top + sw, bot, [...shift(b.items, lead + 0.04 * z, 0), { k: 'p', pts, sw, stroke: c, closed: false }]);
        r.cls = 'ord';
        return r;
      }
      case 'over': {
        const b = layoutNode(n.b, z, c, depth, st);
        const y = -(b.a + 0.1 * z);
        const r = box(b.w, -y + 0.04 * z, b.d, [...b.items, line(0.02 * z, y, b.w - 0.02 * z, y, 0.04 * z, c)]);
        r.cls = 'ord';
        return r;
      }
      case 'acc': {
        const b = layoutNode(n.b, z, c, depth, st);
        const a = glyphBox(n.a, 'main', '', z * (n.a === '→' ? 0.7 : 1), c);
        const y = -(b.a + 0.06 * z) + (n.a === '→' ? 0 : 0.35 * z);
        const r = box(Math.max(b.w, a.w), Math.max(b.a, -y + a.a), b.d, [...b.items, ...shift(a.items, (b.w - a.w) / 2 + 0.04 * z, y)]);
        r.cls = 'ord';
        return r;
      }
      case 'op': {
        const big = n.int ? 1.7 : 1.45;
        const g = glyphBox(n.ch, 'size1', '', z * big, c);
        const mid = (g.a - g.d) / 2;
        const items = shift(g.items, 0, -(AX - mid) + 0);
        const gb = box(g.w, g.a - mid + AX, g.d + mid - AX, items);
        gb.cls = 'op';
        gb.limits = !n.int;
        return gb;
      }
      case 'sc': {
        const base = layoutNode(n.base, z, c, depth, st);
        const sf = 0.7;
        const sup = n.sup ? layoutNode(n.sup, z * sf, c, depth + 1, st) : null;
        const sub = n.sub ? layoutNode(n.sub, z * sf, c, depth + 1, st) : null;
        if (base.limits && depth === 0) {
          const w = Math.max(base.w, sup ? sup.w : 0, sub ? sub.w : 0);
          const items = shift(base.items, (w - base.w) / 2, 0);
          let a = base.a, d = base.d;
          if (sup) { const y = -base.a - 0.12 * z - sup.d; items.push(...shift(sup.items, (w - sup.w) / 2, y)); a = -y + sup.a; }
          if (sub) { const y = base.d + 0.12 * z + sub.a; items.push(...shift(sub.items, (w - sub.w) / 2, y)); d = y + sub.d; }
          const r = box(w, a, d, items); r.cls = 'op'; return r;
        }
        let upY = -Math.max(0.36 * z, base.a - 0.28 * z), dnY = Math.max(0.15 * z, base.d + 0.08 * z);
        if (sup && sub) { const gap = (dnY - sub.a) - (upY + sup.d); if (gap < 0.12 * z) { dnY += 0.12 * z - gap; } }
        const x = base.w + (base.cls === 'op' && !base.limits ? -0.05 * z : 0.02 * z);
        const items = [...base.items];
        let w = base.w, a = base.a, d = base.d;
        if (sup) { items.push(...shift(sup.items, x, upY)); w = Math.max(w, x + sup.w); a = Math.max(a, -upY + sup.a); }
        if (sub) { items.push(...shift(sub.items, x, dnY)); w = Math.max(w, x + sub.w); d = Math.max(d, dnY + sub.d); }
        const r = box(w + 0.03 * z, a, d, items);
        r.cls = base.cls === 'op' ? 'op' : 'ord';
        return r;
      }
      case 'lr': {
        const b = layoutList(n.b, z, c, depth, st);
        const h = Math.max(b.a + b.d, 0.9 * z);
        const mid = (b.a - b.d) / 2;
        const mk = ch => {
          if (!ch) return box(0.05 * z, 0, 0);
          const m = meas(ch, 'main', '');
          const gh = (m.a + m.d) * z || z;
          const sy = Math.max(1, (h + 0.2 * z) / gh);
          const g = glyphBox(ch, 'main', '', z, c, sy);
          const gmid = (g.a - g.d) / 2;
          return box(g.w, b.a + 0.1 * z, b.d + 0.1 * z, shift(g.items, 0, -(mid - gmid)));
        };
        const r = hcat([mk(n.l), box(0.06 * z, 0, 0), b, box(0.06 * z, 0, 0), mk(n.r)]);
        r.cls = 'ord';
        return r;
      }
    }
    return null;
  }
  function texBox(src, z, c) { return layoutList(parseTex(src), z, c, 0, ''); }

  // Text with inline $maths$, several lines.
  function textLines(src, z, c, fam, st, align) {
    const lines = String(src).split('\n');
    const boxes = lines.map(L => {
      const parts = [];
      const segs = L.split(/(?<!\\)\$/);
      segs.forEach((seg, k) => {
        if (k % 2) parts.push(texBox(seg, z, c));
        else if (seg) parts.push(hcat(seg.replace(/\\\$/g, '$').split('').map(ch => glyphBox(ch, fam, st, z, c))));
      });
      const b = hcat(parts);
      if (!b.items.length) { b.a = 0.7 * z; b.d = 0.2 * z; }
      return b;
    });
    return stack(boxes, z * 1.3, align);
  }
  function stack(boxes, lh, align) {
    const W = Math.max(0, ...boxes.map(b => b.w));
    const items = [];
    let y = 0, top = 0, bottom = 0;
    boxes.forEach((b, i) => {
      if (i) y += Math.max(lh, boxes[i - 1].d + b.a + 0.15 * lh);
      const x = align === 'left' ? 0 : align === 'right' ? W - b.w : (W - b.w) / 2;
      items.push(...shift(b.items, x, y));
      if (i === 0) top = -b.a;
      bottom = y + b.d;
    });
    return box(W, -top, bottom, items);
  }
  function mathLines(src, z, c) {
    const lines = String(src).split(/\\\\/).map(s => s.trim()).filter((s, i, a) => s || a.length === 1);
    if (lines.some(l => l.includes('&'))) {
      const rows = lines.map(l => { const [L, R = ''] = l.split('&'); return [texBox(L, z, c), texBox(R, z, c)]; });
      const lw = Math.max(...rows.map(r => r[0].w));
      const boxes = rows.map(([L, R]) => { const b = hcat([box(lw - L.w, 0, 0), L, R]); return b; });
      return stack(boxes, z * 1.5, 'left');
    }
    return stack(lines.map(l => texBox(l, z, c)), z * 1.5, 'center');
  }

  // ---------- geometry helpers ----------
  function sampleArc(cx, cy, r, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(a), cy - r * Math.sin(a)]); }
    return out;
  }
  function svgPath(d, s = 1, ox = 0, oy = 0) {
    const toks = d.match(/[MLHVCQZmlhvcqz]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    const paths = [];
    let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = '', i = 0;
    const num = () => parseFloat(toks[i++]);
    const P = (px, py) => [(px - ox) * s, (py - oy) * s];
    while (i < toks.length) {
      if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
      const rel = cmd === cmd.toLowerCase();
      switch (cmd.toUpperCase()) {
        case 'M': x = num() + (rel ? x : 0); y = num() + (rel ? y : 0); sx = x; sy = y; cur = { pts: [P(x, y)], closed: false }; paths.push(cur); cmd = rel ? 'l' : 'L'; break;
        case 'L': x = num() + (rel ? x : 0); y = num() + (rel ? y : 0); cur.pts.push(P(x, y)); break;
        case 'H': x = num() + (rel ? x : 0); cur.pts.push(P(x, y)); break;
        case 'V': y = num() + (rel ? y : 0); cur.pts.push(P(x, y)); break;
        case 'C': {
          const x1 = num() + (rel ? x : 0), y1 = num() + (rel ? y : 0), x2 = num() + (rel ? x : 0), y2 = num() + (rel ? y : 0), x3 = num() + (rel ? x : 0), y3 = num() + (rel ? y : 0);
          for (let k = 1; k <= 16; k++) { const t = k / 16, u = 1 - t; cur.pts.push(P(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3)); }
          x = x3; y = y3; break;
        }
        case 'Q': {
          const x1 = num() + (rel ? x : 0), y1 = num() + (rel ? y : 0), x2 = num() + (rel ? x : 0), y2 = num() + (rel ? y : 0);
          for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; cur.pts.push(P(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2)); }
          x = x2; y = y2; break;
        }
        case 'Z': if (cur) { cur.closed = true; } x = sx; y = sy; i += 0; cmd = ''; break;
        default: i++;
      }
      if (cmd === '' && i < toks.length && !/[A-Za-z]/.test(toks[i])) i++;
    }
    return paths;
  }
  function arrowTip(x1, y1, x2, y2, size, c) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = size, W = size * 0.55;
    const bx = x2 - Math.cos(a) * L, by = y2 - Math.sin(a) * L;
    return { k: 'p', pts: [[x2, y2], [bx - Math.sin(a) * W, by + Math.cos(a) * W], [bx + Math.sin(a) * W, by - Math.cos(a) * W]], closed: true, fill: c, fo: 1, stroke: c, sw: 0.01 };
  }
  const SW = v => (v == null ? 4 : v) * 0.0075;
  function niceStep(range) {
    const raw = range / 8, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function fmtNum(v) { const r = Math.round(v * 1000) / 1000; return String(r).replace('-', '−'); }

  // ---------- expression parsers ----------
  function compileFn(src) {
    if (!src || !String(src).trim()) return null;
    const ALLOWED = { sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, sinh: 1, cosh: 1, tanh: 1, exp: 1, log: 1, ln: 1, log10: 1, log2: 1, sqrt: 1, abs: 1, floor: 1, ceil: 1, round: 1, sign: 1, min: 1, max: 1, pow: 1, pi: 1, e: 1, x: 1, sec: 1, csc: 1, cot: 1 };
    const toks = String(src).replace(/π/g, 'pi').replace(/·|×/g, '*').replace(/−/g, '-').match(/\d*\.?\d+(?:e[+-]?\d+)?|[A-Za-z_]\w*|\*\*|[-+*/^(),]|\S/g) || [];
    let js = '', prev = '';
    for (const t of toks) {
      const isNum = /^\d|^\./.test(t), isId = /^[A-Za-z_]/.test(t);
      if (isId && !ALLOWED[t]) throw new Error('Unknown name “' + t + '”');
      if (!isNum && !isId && !'+-*/^(),'.includes(t) && t !== '**') throw new Error('Unexpected “' + t + '”');
      const prevVal = /^\d|^\.|^[A-Za-z_]|\)$/.test(prev) && !(prev && ALLOWED[prev] && !['x', 'pi', 'e'].includes(prev));
      if (prevVal && (isNum || isId || t === '(')) js += '*';
      if (isId) js += { pi: 'Math.PI', e: 'Math.E', x: 'x', ln: 'Math.log', log: 'Math.log10', sec: '1/Math.cos', csc: '1/Math.sin', cot: '1/Math.tan' }[t] || 'Math.' + t;
      else js += t === '^' ? '**' : t;
      prev = t;
    }
    // eslint-disable-next-line no-new-func
    const f = new Function('x', '"use strict";return (' + js + ');');
    f(0.5);
    return f;
  }

  function parseSet(src) {
    const s = String(src).replace(/\\cup|∪|\bunion\b|\|/g, ' ∪ ').replace(/\\cap|∩|\binter\b|&/g, ' ∩ ').replace(/\\setminus|∖|\\|−|-/g, ' ∖ ')
      .replace(/\^c|ᶜ|'/g, ' ᶜ ').replace(/Δ|\\triangle|⊕/g, ' Δ ').replace(/\\emptyset|∅/g, ' ∅ ');
    const toks = s.split(/\s+|(?=[()])|(?<=[()])/).filter(Boolean);
    let i = 0;
    function prim() {
      const t = toks[i++];
      let v;
      if (t === '(') { v = union(); i++; }
      else if (/^[A-Z]$/.test(t)) v = m => t === 'U' ? true : !!m[t];
      else if (t === '∅') v = () => false;
      else throw new Error('Unexpected ' + (t || 'end'));
      while (toks[i] === 'ᶜ') { const f = v; v = m => !f(m); i++; }
      return v;
    }
    function inter() { let v = prim(); while (toks[i] === '∩') { i++; const a = v, b = prim(); v = m => a(m) && b(m); } return v; }
    function union() {
      let v = inter();
      while (['∪', '∖', 'Δ'].includes(toks[i])) {
        const op = toks[i++], a = v, b = inter();
        v = op === '∪' ? m => a(m) || b(m) : op === '∖' ? m => a(m) && !b(m) : m => a(m) !== b(m);
      }
      return v;
    }
    if (!toks.length) return () => false;
    const f = union();
    if (i < toks.length) throw new Error('Unexpected ' + toks[i]);
    return f;
  }

  function parseLogic(src) {
    const s = String(src).replace(/<->|<=>|↔|\\leftrightarrow|\\iff|⇔|\biff\b/g, ' ↔ ').replace(/->|=>|→|\\to|\\rightarrow|⇒|\bimplies\b/g, ' → ')
      .replace(/&&|&|∧|\\land|\\wedge|\band\b/g, ' ∧ ').replace(/\|\||\||∨|\\lor|\\vee|\bor\b/g, ' ∨ ').replace(/~|!|¬|\\neg|\\lnot|\bnot\b/g, ' ¬ ')
      .replace(/⊕|\bxor\b/g, ' ⊕ ').replace(/⊤/g, ' T ').replace(/⊥/g, ' F ');
    const toks = s.split(/\s+|(?=[()])|(?<=[()])/).filter(Boolean);
    const letters = new Set();
    let i = 0;
    function atom() {
      const t = toks[i++];
      if (t === '¬') { const a = atom(); return { f: m => !a.f(m), s: '¬' + wrap(a, 9), p: 9 }; }
      if (t === '(') { const v = iff(); i++; return v; }
      if (t === 'T' || t === 'F') { const v = t === 'T'; return { f: () => v, s: v ? '⊤' : '⊥', p: 9 }; }
      if (/^[A-Z]$/.test(t)) { letters.add(t); return { f: m => m[t], s: t, p: 9 }; }
      throw new Error('Unexpected ' + (t || 'end'));
    }
    const wrap = (x, p) => x.p < p ? '(' + x.s + ')' : x.s;
    function bin(next, ops, p, right) {
      return function () {
        let a = next();
        while (ops.includes(toks[i])) {
          const op = toks[i++];
          const b = next();
          const A = a, B = b;
          const f = { '∧': m => A.f(m) && B.f(m), '∨': m => A.f(m) || B.f(m), '→': m => !A.f(m) || B.f(m), '↔': m => A.f(m) === B.f(m), '⊕': m => A.f(m) !== B.f(m) }[op];
          a = { f, s: wrap(A, p + 1) + ' ' + op + ' ' + wrap(B, right ? p : p + 1), p };
        }
        return a;
      };
    }
    const conj = bin(atom, ['∧'], 5), disj = bin(conj, ['∨', '⊕'], 4);
    function imp() { const a = disj(); if (toks[i] === '→') { i++; const b = imp(); return { f: m => !a.f(m) || b.f(m), s: wrap(a, 4) + ' → ' + b.s, p: 3 }; } return a; }
    function iff() { let a = imp(); while (toks[i] === '↔') { i++; const b = imp(); const A = a; a = { f: m => A.f(m) === b.f(m), s: wrap(A, 3) + ' ↔ ' + wrap(b, 3), p: 2 }; } return a; }
    const r = iff();
    if (i < toks.length) throw new Error('Unexpected ' + toks[i]);
    return { f: r.f, s: r.s, letters: [...letters].sort() };
  }

  // ---------- object types ----------
  const STICKERS = {
    star: null,
    heart: 'M50 86 C 22 66 6 48 14 30 C 22 13 43 14 50 31 C 57 14 78 13 86 30 C 94 48 78 66 50 86 Z',
    check: 'M13 53 L 29 37 L 43 51 L 73 21 L 89 37 L 43 83 Z',
    cross: 'M26 14 L50 38 L74 14 L86 26 L62 50 L86 74 L74 86 L50 62 L26 86 L14 74 L38 50 L14 26 Z',
    bulb: 'M50 8 C 27 8 16 27 21 44 C 24 56 36 62 37 73 L 63 73 C 64 62 76 56 79 44 C 84 27 73 8 50 8 Z M38 78 L62 78 L62 85 L38 85 Z M42 89 L58 89 L55 95 L45 95 Z',
    speech: 'M14 22 C14 15 19 10 26 10 L74 10 C81 10 86 15 86 22 L86 56 C86 63 81 68 74 68 L46 68 L27 88 L31 68 L26 68 C19 68 14 63 14 56 Z',
    thought: 'M30 62 C 14 62 10 46 22 40 C 16 26 32 16 42 24 C 48 10 70 12 72 26 C 88 24 94 44 80 50 C 88 64 68 72 60 64 C 54 72 36 72 30 62 Z M22 76 C 22 72 28 72 28 76 C 28 80 22 80 22 76 Z M12 88 C 12 86 16 86 16 88 C 16 90 12 90 12 88 Z',
    sparkle: 'M50 4 C 54 34 66 46 96 50 C 66 54 54 66 50 96 C 46 66 34 54 4 50 C 34 46 46 34 50 4 Z',
    arrow: 'M8 40 L58 40 L58 20 L94 50 L58 80 L58 60 L8 60 Z',
    question: null, exclaim: null, pin: 'M50 6 C 30 6 18 21 18 38 C 18 60 50 94 50 94 C 50 94 82 60 82 38 C 82 21 70 6 50 6 Z M50 26 C 43 26 38 31 38 38 C 38 45 43 50 50 50 C 57 50 62 45 62 38 C 62 31 57 26 50 26 Z',
    brain: 'M48 14 C 36 6 20 12 20 26 C 8 28 6 46 16 52 C 8 62 16 78 30 76 C 34 88 48 88 48 80 Z M52 14 C 64 6 80 12 80 26 C 92 28 94 46 84 52 C 92 62 84 78 70 76 C 66 88 52 88 52 80 Z'
  };
  const STICKER_COLORS = { star: '#F7C948', heart: '#FC6255', check: '#83C167', cross: '#FC6255', bulb: '#F7D96F', speech: '#FFFFFF', thought: '#FFFFFF', sparkle: '#F7D96F', arrow: '#58C4DD', question: '#9A72AC', exclaim: '#FF862F', pin: '#FC6255', brain: '#F4A6C6' };

  const TYPES = {
    text: {
      label: 'Text', icon: 'T',
      defaults: { text: 'Hello, $x^2$', size: 0.7, color: 'WHITE', font: 'main', style: '', align: 'center' },
      fields: [['text', 'Text ($…$ for maths)', 'textarea'], ['size', 'Size', 'num', 0.05], ['color', 'Colour', 'color'], ['font', 'Font', 'select', [['main', 'LaTeX serif'], ['sans', 'Sans'], ['mono', 'Mono']]],
        ['style', 'Style', 'select', [['', 'Regular'], ['bold', 'Bold'], ['italic', 'Italic']]], ['align', 'Align', 'select', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]]],
      build: p => textLines(p.text, p.size, color(p.color), p.font, p.style, p.align).items
    },
    math: {
      label: 'Maths', icon: '∑',
      defaults: { tex: 'e^{i\\pi} + 1 = 0', size: 0.9, color: 'WHITE' },
      fields: [['tex', 'LaTeX (\\\\ new line, & to align)', 'textarea'], ['size', 'Size', 'num', 0.05], ['color', 'Colour', 'color']],
      build: p => mathLines(p.tex, p.size, color(p.color)).items
    },
    title: {
      label: 'Title card', icon: 'H',
      defaults: { title: 'Blood–Brain Barrier', subtitle: 'An introduction', size: 1.1, color: 'WHITE', accent: 'BLUE', underline: true },
      fields: [['title', 'Title', 'textarea'], ['subtitle', 'Subtitle', 'textarea'], ['size', 'Size', 'num', 0.05], ['color', 'Colour', 'color'], ['accent', 'Accent', 'color'], ['underline', 'Underline', 'bool']],
      build: p => {
        const t = textLines(p.title, p.size, color(p.color), 'main', '', 'center');
        const items = [...t.items];
        let y = t.d + 0.3 * p.size;
        if (p.underline) { items.push({ k: 'p', pts: [[-0.05 * t.w, y], [t.w * 1.05, y]], sw: 0.035, stroke: color(p.accent), closed: false }); y += 0.25 * p.size; }
        if (p.subtitle) { const s = textLines(p.subtitle, p.size * 0.5, mixColor(color(p.color), '#888888', 0.25), 'main', 'italic', 'center'); items.push(...shift(s.items, (t.w - s.w) / 2, y + s.a)); }
        return items;
      }
    },
    shape: {
      label: 'Shape', icon: '◯',
      defaults: { shape: 'circle', r: 1, w: 2, h: 1.2, n: 6, len: 3, sweep: 270, color: 'BLUE', fill: 'BLUE', fo: 0, sw: 4 },
      fields: [['shape', 'Shape', 'select', [['circle', 'Circle'], ['square', 'Square'], ['rect', 'Rectangle'], ['polygon', 'Regular polygon'], ['star', 'Star'], ['line', 'Line'], ['arrow', 'Arrow'], ['darrow', 'Double arrow'], ['dot', 'Dot'], ['arc', 'Arc'], ['brace', 'Brace'], ['ellipse', 'Ellipse']]],
        ['r', 'Radius', 'num', 0.1, p => ['circle', 'polygon', 'star', 'arc', 'square'].includes(p.shape)], ['w', 'Width', 'num', 0.1, p => ['rect', 'brace', 'ellipse'].includes(p.shape)], ['h', 'Height', 'num', 0.1, p => ['rect', 'ellipse'].includes(p.shape)],
        ['n', 'Sides / points', 'num', 1, p => ['polygon', 'star'].includes(p.shape)], ['len', 'Length', 'num', 0.1, p => ['line', 'arrow', 'darrow'].includes(p.shape)], ['sweep', 'Sweep (°)', 'num', 5, p => p.shape === 'arc'],
        ['color', 'Stroke', 'color'], ['sw', 'Stroke width', 'num', 0.5], ['fill', 'Fill', 'color'], ['fo', 'Fill opacity', 'num', 0.05]],
      build: p => {
        const c = color(p.color), f = color(p.fill), sw = SW(p.sw);
        const P = (pts, closed) => ({ k: 'p', pts, closed, stroke: c, sw, fill: closed ? f : null, fo: closed ? p.fo : 0 });
        switch (p.shape) {
          case 'circle': return [P(sampleArc(0, 0, p.r, Math.PI / 2, Math.PI / 2 - Math.PI * 2, 96).slice(0, -1), true)];
          case 'ellipse': { const pts = []; for (let i = 0; i < 96; i++) { const a = Math.PI / 2 - i / 96 * Math.PI * 2; pts.push([p.w / 2 * Math.cos(a), -p.h / 2 * Math.sin(a)]); } return [P(pts, true)]; }
          case 'square': { const s = p.r; return [P([[-s, -s], [s, -s], [s, s], [-s, s]], true)]; }
          case 'rect': return [P([[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]], true)];
          case 'polygon': { const n = Math.max(3, Math.round(p.n)), pts = []; for (let i = 0; i < n; i++) { const a = Math.PI / 2 + i * 2 * Math.PI / n; pts.push([p.r * Math.cos(a), -p.r * Math.sin(a)]); } return [P(pts, true)]; }
          case 'star': { const n = Math.max(3, Math.round(p.n)), pts = []; for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + i * Math.PI / n, r = i % 2 ? p.r * 0.45 : p.r; pts.push([r * Math.cos(a), -r * Math.sin(a)]); } return [P(pts, true)]; }
          case 'line': return [P([[-p.len / 2, 0], [p.len / 2, 0]], false)];
          case 'arrow': return [P([[-p.len / 2, 0], [p.len / 2 - 0.2, 0]], false), arrowTip(-p.len / 2, 0, p.len / 2, 0, 0.3, c)];
          case 'darrow': return [P([[-p.len / 2 + 0.2, 0], [p.len / 2 - 0.2, 0]], false), arrowTip(-p.len / 2, 0, p.len / 2, 0, 0.3, c), arrowTip(p.len / 2, 0, -p.len / 2, 0, 0.3, c)];
          case 'dot': return [{ k: 'p', pts: sampleArc(0, 0, 0.08, 0, Math.PI * 2, 24).slice(0, -1), closed: true, stroke: c, sw: 0.01, fill: c, fo: 1 }];
          case 'arc': return [P(sampleArc(0, 0, p.r, 0, p.sweep * Math.PI / 180, 64), false)];
          case 'brace': {
            const w = p.w / 2, h = 0.22;
            const d = `M${-w} 0 C ${-w} ${h * 0.6} ${-w + 0.1} ${h * 0.5} ${-w * 0.5} ${h * 0.5} C ${-0.1} ${h * 0.5} 0 ${h * 0.6} 0 ${h} C 0 ${h * 0.6} 0.1 ${h * 0.5} ${w * 0.5} ${h * 0.5} C ${w - 0.1} ${h * 0.5} ${w} ${h * 0.6} ${w} 0`;
            return svgPath(d).map(q => ({ k: 'p', pts: q.pts, closed: false, stroke: c, sw: sw * 1.1 }));
          }
        }
        return [];
      }
    },
    geom: {
      label: 'Triangle', icon: '△',
      defaults: { pts: '-2,-1  2,-1  -1,1.6', labels: 'A B C', angles: true, degrees: false, sides: '', color: 'WHITE', fill: 'BLUE', fo: 0.25, accent: 'YELLOW', sw: 4 },
      fields: [['pts', 'Vertices (x,y …)', 'text'], ['labels', 'Vertex labels', 'text'], ['sides', 'Side labels (opposite each vertex)', 'text'], ['angles', 'Angle marks', 'bool'], ['degrees', 'Show degrees', 'bool'],
        ['color', 'Stroke', 'color'], ['fill', 'Fill', 'color'], ['fo', 'Fill opacity', 'num', 0.05], ['accent', 'Angle colour', 'color'], ['sw', 'Stroke width', 'num', 0.5]],
      build: p => {
        const V = String(p.pts).trim().split(/\s+/).map(s => s.split(',').map(Number)).filter(v => v.length === 2 && v.every(isFinite)).map(([x, y]) => [x, -y]);
        if (V.length < 2) return [];
        const items = [{ k: 'p', pts: V, closed: V.length > 2, stroke: color(p.color), sw: SW(p.sw), fill: color(p.fill), fo: p.fo }];
        const cx = V.reduce((s, v) => s + v[0], 0) / V.length, cy = V.reduce((s, v) => s + v[1], 0) / V.length;
        const labs = String(p.labels || '').trim().split(/\s+/).filter(Boolean);
        const sides = String(p.sides || '').trim().split(/\s+/).filter(Boolean);
        V.forEach((v, i) => {
          const a = V[(i + V.length - 1) % V.length], b = V[(i + 1) % V.length];
          const a1 = Math.atan2(-(a[1] - v[1]), a[0] - v[0]), a2 = Math.atan2(-(b[1] - v[1]), b[0] - v[0]);
          let d = a2 - a1; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI;
          const deg = Math.abs(d) * 180 / Math.PI;
          if (p.angles && V.length > 2) {
            if (Math.abs(deg - 90) < 0.5) {
              const s = 0.28, u = [Math.cos(a1), -Math.sin(a1)], w = [Math.cos(a2), -Math.sin(a2)];
              items.push({ k: 'p', pts: [[v[0] + u[0] * s, v[1] + u[1] * s], [v[0] + (u[0] + w[0]) * s, v[1] + (u[1] + w[1]) * s], [v[0] + w[0] * s, v[1] + w[1] * s]], closed: false, stroke: color(p.accent), sw: SW(3) });
            } else items.push({ k: 'p', pts: sampleArc(v[0], v[1], 0.38, a1, a1 + d, 24), closed: false, stroke: color(p.accent), sw: SW(3) });
            if (p.degrees) {
              const m = a1 + d / 2, g = texBox(Math.round(deg) + '^\\circ', 0.32, color(p.accent));
              items.push(...shift(g.items, v[0] + Math.cos(m) * 0.75 - g.w / 2, v[1] - Math.sin(m) * 0.75 + (g.a - g.d) / 2));
            }
          }
          if (labs[i]) {
            let dx = v[0] - cx, dy = v[1] - cy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
            const g = texBox(labs[i], 0.55, color(p.color));
            items.push(...shift(g.items, v[0] + dx * 0.38 - g.w / 2, v[1] + dy * 0.38 + (g.a - g.d) / 2));
          }
          if (sides[i] && V.length > 2) {
            const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            let dx = m[0] - cx, dy = m[1] - cy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
            const g = texBox(sides[i], 0.5, color(p.color));
            items.push(...shift(g.items, m[0] + dx * 0.32 - g.w / 2, m[1] + dy * 0.32 + (g.a - g.d) / 2));
          }
        });
        return items;
      }
    },
    graph: {
      label: 'Graph', icon: '∿',
      defaults: { f1: 'sin(x)', c1: 'BLUE', l1: '\\sin x', f2: '', c2: 'YELLOW', l2: '', xmin: -6.5, xmax: 6.5, ymin: -2, ymax: 2, w: 10, h: 4.5, grid: false, nums: true, xl: 'x', yl: 'y', axis: 'WHITE', area: false, a: 0, b: 3.14159, areac: 'BLUE', tracer: false },
      fields: [['f1', 'y = (curve 1)', 'text'], ['c1', 'Colour 1', 'color'], ['l1', 'Label 1 (LaTeX)', 'text'], ['f2', 'y = (curve 2)', 'text'], ['c2', 'Colour 2', 'color'], ['l2', 'Label 2 (LaTeX)', 'text'],
        ['xmin', 'x from', 'num', 0.5], ['xmax', 'x to', 'num', 0.5], ['ymin', 'y from', 'num', 0.5], ['ymax', 'y to', 'num', 0.5], ['w', 'Width', 'num', 0.5], ['h', 'Height', 'num', 0.5],
        ['grid', 'Grid', 'bool'], ['nums', 'Numbers on axes', 'bool'], ['xl', 'x-axis label', 'text'], ['yl', 'y-axis label', 'text'], ['axis', 'Axis colour', 'color'],
        ['area', 'Shade area under curve 1', 'bool'], ['a', 'Area from x =', 'num', 0.1, p => p.area], ['b', 'Area to x =', 'num', 0.1, p => p.area], ['areac', 'Area colour', 'color', null, p => p.area],
        ['tracer', 'Dot travels along curve 1', 'bool']],
      build: p => {
        const xr = p.xmax - p.xmin || 1, yr = p.ymax - p.ymin || 1;
        const X = x => (x - p.xmin) / xr * p.w - p.w / 2, Y = y => -((y - p.ymin) / yr * p.h - p.h / 2);
        const ac = color(p.axis), items = [];
        const x0 = clamp(0, p.xmin, p.xmax), y0 = clamp(0, p.ymin, p.ymax);
        const sx = niceStep(xr), sy = niceStep(yr * 8 / 5);
        if (p.grid) {
          for (let v = Math.ceil(p.xmin / sx) * sx; v <= p.xmax + 1e-9; v += sx) items.push(Object.assign(line(X(v), Y(p.ymin), X(v), Y(p.ymax), 0.012, '#58C4DD'), { alpha: 0.35 }));
          for (let v = Math.ceil(p.ymin / sy) * sy; v <= p.ymax + 1e-9; v += sy) items.push(Object.assign(line(X(p.xmin), Y(v), X(p.xmax), Y(v), 0.012, '#58C4DD'), { alpha: 0.35 }));
        }
        items.push(line(X(p.xmin), Y(y0), X(p.xmax) + 0.15, Y(y0), 0.025, ac), arrowTip(X(p.xmin), Y(y0), X(p.xmax) + 0.3, Y(y0), 0.22, ac));
        items.push(line(X(x0), Y(p.ymin), X(x0), Y(p.ymax) - 0.15, 0.025, ac), arrowTip(X(x0), Y(p.ymin), X(x0), Y(p.ymax) - 0.3, 0.22, ac));
        const tick = 0.08;
        for (let v = Math.ceil(p.xmin / sx) * sx; v <= p.xmax + 1e-9; v += sx) {
          if (Math.abs(v) < 1e-9) continue;
          items.push(line(X(v), Y(y0) - tick, X(v), Y(y0) + tick, 0.02, ac));
          if (p.nums) { const g = texBox(fmtNum(v), 0.3, ac); items.push(...shift(g.items, X(v) - g.w / 2, Y(y0) + tick + 0.1 + g.a)); }
        }
        for (let v = Math.ceil(p.ymin / sy) * sy; v <= p.ymax + 1e-9; v += sy) {
          if (Math.abs(v) < 1e-9) continue;
          items.push(line(X(x0) - tick, Y(v), X(x0) + tick, Y(v), 0.02, ac));
          if (p.nums) { const g = texBox(fmtNum(v), 0.3, ac); items.push(...shift(g.items, X(x0) - tick - 0.1 - g.w, Y(v) + (g.a - g.d) / 2)); }
        }
        if (p.xl) { const g = texBox(p.xl, 0.45, ac); items.push(...shift(g.items, X(p.xmax) + 0.35, Y(y0) + (g.a - g.d) / 2)); }
        if (p.yl) { const g = texBox(p.yl, 0.45, ac); items.push(...shift(g.items, X(x0) - g.w / 2, Y(p.ymax) - 0.35 - g.d)); }
        const curve = (src, col, lab) => {
          let f; try { f = compileFn(src); } catch (e) { return; }
          if (!f) return;
          const N = 400; let seg = [];
          const segs = [];
          let prevY = null;
          for (let i = 0; i <= N; i++) {
            const x = p.xmin + xr * i / N; let y;
            try { y = f(x); } catch (e) { y = NaN; }
            const ok = isFinite(y) && y >= p.ymin - yr * 0.02 && y <= p.ymax + yr * 0.02 && !(prevY != null && Math.abs(y - prevY) > yr * 1.5);
            if (ok) seg.push([X(x), Y(y)]); else if (seg.length) { segs.push(seg); seg = []; }
            prevY = isFinite(y) ? y : null;
          }
          if (seg.length) segs.push(seg);
          segs.filter(s => s.length > 1).forEach(s => items.push({ k: 'p', pts: s, closed: false, stroke: color(col), sw: SW(4) }));
          if (lab && segs.length) {
            const last = segs[segs.length - 1], e = last[last.length - 1];
            const g = texBox(lab, 0.42, color(col));
            items.push(...shift(g.items, Math.min(e[0] + 0.1, p.w / 2 - g.w), e[1] - 0.2));
          }
          return f;
        };
        const f1 = curve(p.f1, p.c1, p.l1);
        curve(p.f2, p.c2, p.l2);
        if (p.area && f1) {
          const a = Math.max(p.xmin, Math.min(p.a, p.b)), b = Math.min(p.xmax, Math.max(p.a, p.b));
          const pts = [[X(a), Y(y0)]];
          for (let i = 0; i <= 120; i++) { const x = a + (b - a) * i / 120; let y = f1(x); if (!isFinite(y)) y = 0; pts.push([X(x), Y(clamp(y, p.ymin, p.ymax))]); }
          pts.push([X(b), Y(y0)]);
          items.push({ k: 'p', pts, closed: true, stroke: null, sw: 0, fill: color(p.areac), fo: 0.45, ro: -1 });
        }
        if (p.tracer && f1) items.push({ k: 'tr', f: f1, X, Y, xmin: p.xmin, xmax: p.xmax, ymin: p.ymin, ymax: p.ymax, c: color(p.c1) });
        return items;
      }
    },
    venn: {
      label: 'Venn', icon: '◎',
      defaults: { n: 2, labels: 'A B C', shade: 'A ∩ B', color: 'WHITE', shadec: 'BLUE', universe: true, ulabel: 'U', caption: true },
      fields: [['n', 'Sets', 'select', [[2, '2 sets'], [3, '3 sets']]], ['labels', 'Set labels', 'text'], ['shade', 'Shade (e.g. A ∩ B, A ∪ B, A \\ B, (A ∪ B)′)', 'text'], ['shadec', 'Shade colour', 'color'],
        ['color', 'Line colour', 'color'], ['universe', 'Show universe', 'bool'], ['ulabel', 'Universe label', 'text'], ['caption', 'Write the expression underneath', 'bool']],
      build: p => {
        const n = +p.n === 3 ? 3 : 2, r = 1.35;
        const C = n === 2 ? [[-0.8, 0], [0.8, 0]] : [[-0.72, -0.42], [0.72, -0.42], [0, 0.82]];
        const circles = C.map(([x, y]) => [x, -y, r]);
        const U = n === 2 ? [-2.9, -2, 2.9, 2] : [-2.8, -2.55, 2.8, 2.15];
        const names = ['A', 'B', 'C'];
        const labs = String(p.labels || '').trim().split(/\s+/);
        const items = [];
        let f = null; try { f = parseSet(p.shade); } catch (e) { f = null; }
        const terms = [];
        if (f) for (let m = 0; m < (1 << n); m++) { const env = {}; names.slice(0, n).forEach((k, i) => { env[k] = !!(m >> i & 1); }); if (f(env)) terms.push(m); }
        items.push({ k: 'v', circles, U: p.universe || terms.includes(0) ? U : null, terms, n, c: color(p.shadec), fo: 0.55, ro: 99 });
        if (p.universe) items.push({ k: 'p', pts: [[U[0], U[1]], [U[2], U[1]], [U[2], U[3]], [U[0], U[3]]], closed: true, stroke: color(p.color), sw: SW(3) });
        circles.forEach(([x, y]) => items.push({ k: 'p', pts: sampleArc(x, y, r, Math.PI / 2, Math.PI / 2 - 2 * Math.PI, 96).slice(0, -1), closed: true, stroke: color(p.color), sw: SW(4) }));
        circles.forEach(([x, y], i) => {
          const g = texBox(labs[i] || names[i], 0.6, color(p.color));
          const dx = n === 2 ? (i ? 1 : -1) : x, dy = n === 2 ? -0.7 : y;
          const L = Math.hypot(dx, dy) || 1;
          items.push(...shift(g.items, x + dx / L * (r + 0.25) - g.w / 2, y + dy / L * (r + 0.25) + (g.a - g.d) / 2));
        });
        if (p.universe && p.ulabel) { const g = texBox(p.ulabel, 0.5, color(p.color)); items.push(...shift(g.items, U[0] + 0.15, U[1] + 0.15 + g.a)); }
        if (p.caption && p.shade) { const g = texBox(String(p.shade).replace(/\\(?!cup|cap|setminus|emptyset)/g, '\\setminus ').replace(/'/g, '^{c}'), 0.55, color(p.shadec)); items.push(...shift(g.items, -g.w / 2, U[3] + 0.3 + g.a)); }
        return items;
      }
    },
    truth: {
      label: 'Truth table', icon: '⊤',
      defaults: { formula: 'P -> Q', size: 0.5, color: 'WHITE', tcol: 'GREEN', fcol: 'RED', style: 'TF', colour: true },
      fields: [['formula', 'Formula (P, Q, R… with ¬ ∧ ∨ → ↔ or ~ & | -> <->)', 'text'], ['size', 'Size', 'num', 0.05], ['color', 'Colour', 'color'], ['style', 'Values', 'select', [['TF', 'T / F'], ['10', '1 / 0']]],
        ['colour', 'Colour the result column', 'bool'], ['tcol', 'True colour', 'color'], ['fcol', 'False colour', 'color']],
      build: p => {
        let L; try { L = parseLogic(p.formula); } catch (e) { return textLines('Can’t read: ' + e.message, 0.4, '#FC6255', 'main', '', 'center').items; }
        const z = p.size, c = color(p.color);
        const cols = [...L.letters, L.s];
        const heads = cols.map(s => texBox(s.replace(/¬/g, '\\neg ').replace(/∧/g, '\\land ').replace(/∨/g, '\\lor ').replace(/→/g, '\\to ').replace(/↔/g, '\\leftrightarrow ').replace(/⊕/g, '\\oplus ').replace(/⊤/g, '\\top ').replace(/⊥/g, '\\bot '), z, c));
        const pad = 0.5 * z;
        const widths = heads.map(h => Math.max(h.w, 0.8 * z) + 2 * pad);
        const rowH = 1.25 * z, n = L.letters.length, rows = 1 << n;
        const W = widths.reduce((a, b) => a + b, 0);
        const items = [];
        let x = 0;
        heads.forEach((h, i) => { items.push(...shift(h.items, x + (widths[i] - h.w) / 2, rowH * 0.7)); x += widths[i]; });
        items.push(line(0, rowH, W, rowH, 0.025, c));
        const vx = widths.slice(0, n).reduce((a, b) => a + b, 0);
        items.push(line(vx, 0, vx, rowH * (rows + 1), 0.025, c));
        for (let r = 0; r < rows; r++) {
          const m = {};
          L.letters.forEach((k, i) => { m[k] = !((r >> (n - 1 - i)) & 1); });
          const vals = [...L.letters.map(k => m[k]), L.f(m)];
          let xx = 0;
          vals.forEach((v, i) => {
            const s = p.style === '10' ? (v ? '1' : '0') : (v ? 'T' : 'F');
            const col = i === n && p.colour ? color(v ? p.tcol : p.fcol) : c;
            const g = textLines(s, z, col, 'main', '', 'center');
            items.push(...shift(g.items, xx + (widths[i] - g.w) / 2, rowH * (r + 1.7)));
            xx += widths[i];
          });
        }
        return items;
      }
    },
    sticker: {
      label: 'Sticker', icon: '★',
      defaults: { kind: 'star', size: 1.4, fill: '', color: 'WHITE', outline: true },
      fields: [['kind', 'Sticker', 'select', Object.keys(STICKERS).map(k => [k, k[0].toUpperCase() + k.slice(1)])], ['size', 'Size', 'num', 0.1], ['fill', 'Fill (blank = default)', 'color'], ['color', 'Outline', 'color'], ['outline', 'Sticker border', 'bool']],
      build: p => {
        const s = p.size / 100, fill = color(p.fill) || STICKER_COLORS[p.kind] || '#fff';
        const P = pts => ({ k: 'p', pts, closed: true, stroke: color(p.color), sw: p.outline ? 0.09 * p.size / 1.4 : SW(3), under: !!p.outline, fill, fo: 1 });
        if (p.kind === 'star') { const pts = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 19 : 46; pts.push([r * Math.cos(a) * s, -r * Math.sin(a) * s]); } return [P(pts)]; }
        if (p.kind === 'question' || p.kind === 'exclaim') {
          const g = glyphBox(p.kind === 'question' ? '?' : '!', 'main', 'bold', 62 * s, '#FFFFFF');
          return [P(sampleArc(0, 0, 44 * s, 0, Math.PI * 2, 64).slice(0, -1)), ...shift(g.items, -g.w / 2, (g.a - g.d) / 2)];
        }
        return svgPath(STICKERS[p.kind] || STICKERS.heart, s, 50, 50).map(q => P(q.pts));
      }
    }
  };

  // ---------- building with cache ----------
  const bcache = new Map();
  function build(obj) {
    const T = TYPES[obj.type];
    if (!T) return { prims: [], bb: [0, 0, 0, 0] };
    const key = obj.type + JSON.stringify(obj.props) + '|' + fontVer;
    let b = bcache.get(key);
    if (b) return b;
    let prims;
    try { prims = T.build(Object.assign({}, T.defaults, obj.props)); } catch (e) { console.warn(e); prims = []; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of prims) {
      if (q.k === 'p') for (const [x, y] of q.pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      else if (q.k === 'g') { const m = meas(q.ch, q.fam, q.st); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x + m.w * q.z); y0 = Math.min(y0, q.y - m.a * q.z * q.sy); y1 = Math.max(y1, q.y + m.d * q.z * q.sy); }
      else if (q.k === 'v') { for (const [x, y, r] of q.circles) { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); } }
    }
    if (!isFinite(x0)) { x0 = y0 = -0.5; x1 = y1 = 0.5; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    prims = shift(prims, -cx, -cy).map(q => {
      if (q.k === 'v') return Object.assign({}, q, { circles: q.circles.map(([x, y, r]) => [x - cx, y - cy, r]), U: q.U && [q.U[0] - cx, q.U[1] - cy, q.U[2] - cx, q.U[3] - cy] });
      if (q.k === 'tr') return Object.assign({}, q, { dx: -cx, dy: -cy });
      return q;
    });
    for (const q of prims) if (q.k === 'p') q.len = pathLen(q.pts, q.closed);
    b = { prims, bb: [x0 - cx, y0 - cy, x1 - cx, y1 - cy] };
    if (bcache.size > 400) bcache.clear();
    bcache.set(key, b);
    return b;
  }
  function pathLen(pts, closed) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (closed && pts.length > 1) L += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    return L;
  }

  // ---------- timing ----------
  const ANIM_IN = [['create', 'Create'], ['write', 'Write'], ['drawfill', 'Draw border then fill'], ['fadein', 'Fade in'], ['fadeup', 'Fade in from below'], ['grow', 'Grow from centre'], ['spin', 'Spin in'], ['appear', 'Appear (no animation)']];
  const ANIM_OUT = [['fadeout', 'Fade out'], ['fadedown', 'Fade out downward'], ['uncreate', 'Uncreate'], ['shrink', 'Shrink to centre'], ['transform', 'Transform into…'], ['none', 'Vanish (no animation)']];
  const EMPH = [['indicate', 'Indicate'], ['circumscribe', 'Circumscribe'], ['wiggle', 'Wiggle'], ['flash', 'Flash'], ['pulse', 'Pulse'], ['spin', 'Spin once'], ['underline', 'Underline']];
  const LOOPS = [['none', 'None'], ['bob', 'Bob'], ['pulse', 'Pulse'], ['spin', 'Spin'], ['wiggle', 'Wiggle'], ['float', 'Float']];
  const KEYABLE = ['x', 'y', 'scale', 'rotation', 'opacity'];

  function keyVal(obj, prop, t) {
    const k = obj.keys && obj.keys[prop];
    if (!k || !k.length) return obj[prop];
    if (t <= k[0].t) return k[0].v;
    if (t >= k[k.length - 1].t) return k[k.length - 1].v;
    for (let i = 1; i < k.length; i++) if (t <= k[i].t) {
      const a = k[i - 1], b = k[i];
      const u = (RATE[b.ease || 'smooth'] || RATE.smooth)((t - a.t) / (b.t - a.t || 1));
      return a.v + (b.v - a.v) * u;
    }
    return obj[prop];
  }
  function phases(o) {
    const len = Math.max(0.01, o.end - o.start);
    const inD = o.anIn && o.anIn.type !== 'appear' ? Math.min(o.anIn.dur, len) : 0;
    const outD = o.anOut && o.anOut.type !== 'none' ? Math.min(o.anOut.dur, Math.max(0, len - inD)) : 0;
    return { inD, outD };
  }
  function baseState(o, t) {
    const s = {};
    for (const p of KEYABLE) s[p] = keyVal(o, p, t);
    s.rotation = (s.rotation || 0) * Math.PI / 180;
    return s;
  }

  // ---------- drawing ----------
  function drawPartial(ctx, pts, closed, f) {
    if (f <= 0 || pts.length < 2) return;
    const all = closed ? pts.concat([pts[0]]) : pts;
    if (f >= 1) { ctx.beginPath(); ctx.moveTo(all[0][0], all[0][1]); for (let i = 1; i < all.length; i++) ctx.lineTo(all[i][0], all[i][1]); if (closed) ctx.closePath(); ctx.stroke(); return; }
    let L = 0; for (let i = 1; i < all.length; i++) L += Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]);
    let left = L * f;
    ctx.beginPath(); ctx.moveTo(all[0][0], all[0][1]);
    for (let i = 1; i < all.length; i++) {
      const d = Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]);
      if (d >= left) { const u = left / (d || 1); ctx.lineTo(all[i - 1][0] + (all[i][0] - all[i - 1][0]) * u, all[i - 1][1] + (all[i][1] - all[i - 1][1]) * u); break; }
      ctx.lineTo(all[i][0], all[i][1]); left -= d;
    }
    ctx.stroke();
  }
  function fillPath(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fill(); }

  // mode: 'full' | 'create' | 'write' | 'drawfill'; p in [0,1]
  function drawPrims(ctx, prims, mode, p, env) {
    const n = prims.length;
    const order = prims.map((q, i) => [q.ro != null ? q.ro : i, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    const rank = new Array(n); order.forEach((idx, r) => { rank[idx] = r; });
    const lag = n > 1 ? clamp(1.6 / n, 0.03, 0.35) : 0;
    const d = 1 / (1 + (n - 1) * lag);
    const tint = env.tint || 0, tintC = env.tintC || PAL.YELLOW;
    const col = c => tint ? mixColor(c, tintC, tint) : c;
    const scale = env.scale || 1;
    for (let i = 0; i < n; i++) {
      const q = prims[i];
      let pi = 1;
      if (mode !== 'full') pi = clamp((p - rank[i] * lag * d) / d);
      if (pi <= 0) continue;
      const a0 = ctx.globalAlpha;
      if (q.alpha != null) ctx.globalAlpha = a0 * q.alpha;
      if (q.k === 'p') {
        let sf = pi, ff = pi;
        if (mode === 'drawfill' || mode === 'write') { sf = clamp(pi * 2); ff = clamp(pi * 2 - 1); }
        else if (mode === 'create') { ff = clamp((pi - 0.3) / 0.7); }
        const doStroke = () => {
          if (!q.stroke || !q.sw) return;
          ctx.strokeStyle = col(q.stroke); ctx.lineWidth = q.under ? q.sw : q.sw / Math.max(scale, 0.05);
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          drawPartial(ctx, q.pts, q.closed, sf);
        };
        if (q.under) doStroke();
        if (q.fill && q.fo > 0 && ff > 0) { ctx.save(); ctx.globalAlpha *= q.fo * ff; ctx.fillStyle = col(q.fill); fillPath(ctx, q.pts); ctx.restore(); }
        if (!q.under) doStroke();
        else if (q.under && sf < 1 && ff <= 0) { /* outline still drawing */ }
      } else if (q.k === 'g') {
        ctx.save();
        ctx.translate(q.x, q.y); ctx.scale(0.01, 0.01 * (q.sy || 1));
        ctx.font = fontCss(q.st, Math.round(q.z * 100 * 100) / 100, q.fam);
        const c = col(q.c || '#fff');
        if (pi < 1) {
          const D = q.z * 100 * 5;
          ctx.setLineDash([D * clamp(pi * 1.6), D * 2]);
          ctx.lineWidth = q.z * 100 * 0.025; ctx.strokeStyle = c;
          ctx.strokeText(q.ch, 0, 0);
          ctx.setLineDash([]);
          const fa = clamp((pi - 0.45) / 0.55);
          if (fa > 0) { ctx.globalAlpha *= fa; ctx.fillStyle = c; ctx.fillText(q.ch, 0, 0); }
        } else { ctx.fillStyle = c; ctx.fillText(q.ch, 0, 0); }
        ctx.restore();
      } else if (q.k === 'v') {
        drawVenn(ctx, q, pi, col);
      } else if (q.k === 'tr' && env.u != null) {
        const x = q.xmin + (q.xmax - q.xmin) * clamp(env.u);
        let y; try { y = q.f(x); } catch (e) { y = NaN; }
        if (isFinite(y) && y >= q.ymin && y <= q.ymax) {
          const px = q.X(x) + q.dx, py = q.Y(y) + q.dy;
          ctx.save(); ctx.globalAlpha *= pi;
          ctx.strokeStyle = col(q.c); ctx.globalAlpha *= 0.5; ctx.setLineDash([0.06, 0.06]); ctx.lineWidth = 0.015;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, q.Y(clamp(0, q.ymin, q.ymax)) + q.dy); ctx.stroke(); ctx.setLineDash([]);
          ctx.globalAlpha /= 0.5;
          ctx.fillStyle = col('#FFFF00'); ctx.beginPath(); ctx.arc(px, py, 0.09, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }
      ctx.globalAlpha = a0;
    }
  }
  function drawVenn(ctx, q, pi, col) {
    const a = clamp(pi);
    if (!q.terms.length || a <= 0) return;
    const U = q.U || [-50, -50, 50, 50];
    ctx.save();
    ctx.globalAlpha *= q.fo * a;
    ctx.fillStyle = col(q.c);
    for (const m of q.terms) {
      ctx.save();
      ctx.beginPath(); ctx.rect(U[0], U[1], U[2] - U[0], U[3] - U[1]); ctx.clip();
      q.circles.forEach(([x, y, r], i) => {
        ctx.beginPath();
        if (m >> i & 1) { ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip(); }
        else { ctx.rect(U[0] - 1, U[1] - 1, U[2] - U[0] + 2, U[3] - U[1] + 2); ctx.arc(x, y, r, 0, Math.PI * 2, true); ctx.clip('evenodd'); }
      });
      ctx.fillRect(U[0], U[1], U[2] - U[0], U[3] - U[1]);
      ctx.restore();
    }
    ctx.restore();
  }

  // Transform (morph) helpers
  function toWorld(st, x, y) {
    const c = Math.cos(st.rotation), s = Math.sin(st.rotation);
    const lx = x * st.scale, ly = -y * st.scale;
    return [st.x + lx * c - ly * s, st.y + lx * s + ly * c];
  }
  function resample(pts, closed, N) {
    const all = closed ? pts.concat([pts[0]]) : pts;
    const cum = [0];
    for (let i = 1; i < all.length; i++) cum.push(cum[i - 1] + Math.hypot(all[i][0] - all[i - 1][0], all[i][1] - all[i - 1][1]));
    const L = cum[cum.length - 1] || 1, out = [];
    let j = 1;
    for (let k = 0; k < N; k++) {
      const d = L * k / (closed ? N : N - 1);
      while (j < all.length - 1 && cum[j] < d) j++;
      const seg = cum[j] - cum[j - 1] || 1, u = clamp((d - cum[j - 1]) / seg);
      out.push([all[j - 1][0] + (all[j][0] - all[j - 1][0]) * u, all[j - 1][1] + (all[j][1] - all[j - 1][1]) * u]);
    }
    return out;
  }
  function morphParts(obj, t) {
    const b = build(obj), st = baseState(obj, t);
    const paths = [], glyphs = [];
    for (const q of b.prims) {
      if (q.k === 'p') paths.push({ pts: resample(q.pts, q.closed, 80).map(([x, y]) => toWorld(st, x, y)), closed: q.closed, stroke: q.stroke, sw: q.sw, fill: q.fill, fo: q.fill ? q.fo : 0, alpha: (q.alpha == null ? 1 : q.alpha) });
      else if (q.k === 'g') { const [x, y] = toWorld(st, q.x, q.y); glyphs.push({ ch: q.ch, fam: q.fam, st: q.st, z: q.z * st.scale, x, y, c: q.c, sy: q.sy }); }
    }
    return { paths, glyphs, opacity: st.opacity };
  }
  function bestShift(A, B) {
    let best = 0, bd = Infinity;
    for (let s = 0; s < A.length; s += 4) { let d = 0; for (let i = 0; i < A.length; i += 8) { const b = B[(i + s) % B.length]; d += Math.hypot(A[i][0] - b[0], A[i][1] - b[1]); } if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function drawMorph(ctx, A, B, u, ppu, W, H) {
    const S = ([x, y]) => [W / 2 + x * ppu, H / 2 - y * ppu];
    const lerp = (a, b) => a + (b - a) * u;
    const cen = ps => { let x = 0, y = 0; ps.forEach(p => { x += p[0]; y += p[1]; }); return [x / ps.length, y / ps.length]; };
    const n = Math.max(A.paths.length, B.paths.length);
    const op = lerp(A.opacity, B.opacity);
    for (let i = 0; i < n; i++) {
      let a = A.paths[i], b = B.paths[i];
      if (!a) { const ref = A.paths[A.paths.length - 1]; a = ref ? Object.assign({}, b, { pts: b.pts.map(() => cen(ref.pts)), fo: 0, alpha: 0 }) : Object.assign({}, b, { alpha: 0 }); }
      if (!b) { const ref = B.paths[B.paths.length - 1]; b = ref ? Object.assign({}, a, { pts: a.pts.map(() => cen(ref.pts)), fo: 0, alpha: 0 }) : Object.assign({}, a, { alpha: 0 }); }
      let bp = b.pts;
      if (a.closed && b.closed) { const s = bestShift(a.pts, b.pts); bp = b.pts.map((_, k) => b.pts[(k + s) % b.pts.length]); }
      const pts = a.pts.map((p, k) => S([lerp(p[0], bp[k][0]), lerp(p[1], bp[k][1])]));
      ctx.save();
      ctx.globalAlpha = op * lerp(a.alpha, b.alpha);
      const fo = lerp(a.fill ? a.fo : 0, b.fill ? b.fo : 0);
      const closed = u < 0.5 ? a.closed : b.closed;
      if (fo > 0 && closed) { ctx.save(); ctx.globalAlpha *= fo; ctx.fillStyle = mixColor(a.fill || b.fill, b.fill || a.fill, u); fillPath(ctx, pts); ctx.restore(); }
      const sc = a.stroke || b.stroke;
      if (sc) { ctx.strokeStyle = mixColor(a.stroke || b.stroke, b.stroke || a.stroke, u); ctx.lineWidth = lerp(a.sw || 0, b.sw || 0) * ppu; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; drawPartial(ctx, pts, closed, 1); }
      ctx.restore();
    }
    const m = Math.max(A.glyphs.length, B.glyphs.length);
    const drawG = (g, x, y, z, c, alpha) => {
      if (alpha <= 0.002) return;
      const [sx, sy] = S([x, y]);
      ctx.save(); ctx.globalAlpha = op * alpha; ctx.translate(sx, sy); ctx.scale(ppu / 100, ppu / 100 * (g.sy || 1));
      ctx.font = fontCss(g.st, Math.round(z * 10000) / 100, g.fam); ctx.fillStyle = c; ctx.fillText(g.ch, 0, 0); ctx.restore();
    };
    for (let i = 0; i < m; i++) {
      const a = A.glyphs[i], b = B.glyphs[i];
      if (a && b) {
        const x = lerp(a.x, b.x), y = lerp(a.y, b.y), z = lerp(a.z, b.z), c = mixColor(a.c || '#fff', b.c || '#fff', u);
        if (a.ch === b.ch && a.fam === b.fam) drawG(a, x, y, z, c, 1);
        else { drawG(a, x, y, z, c, 1 - u); drawG(b, x, y, z, c, u); }
      } else if (a) drawG(a, a.x, a.y, a.z, a.c || '#fff', 1 - u);
      else drawG(b, b.x, b.y, b.z, b.c || '#fff', u);
    }
  }

  // Render one frame of the scene at time t onto ctx (W×H pixels).
  function render(ctx, scene, t, W, H, opt = {}) {
    const ppu = H / 8;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = scene.bg || '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    const objs = scene.objects;
    const byId = Object.fromEntries(objs.map(o => [o.id, o]));
    const hidden = new Set();
    for (const o of objs) if (o.anOut && o.anOut.type === 'transform' && byId[o.anOut.target] && t >= o.end - phases(o).outD && t < o.end) hidden.add(o.anOut.target);
    const atEnd = t >= scene.duration - 1e-6;
    for (const o of objs) {
      o._hit = null;
      if (o.hidden || hidden.has(o.id)) continue;
      if (t < o.start || (t >= o.end && !(atEnd && o.end >= scene.duration - 1e-6 && o.anOut.type === 'none'))) continue;
      const { inD, outD } = phases(o);
      const st = baseState(o, t);
      let mode = 'full', p = 1, env = { scale: st.scale };
      // in
      if (inD && t < o.start + inD) {
        const raw = (t - o.start) / inD, e = (RATE[o.anIn.rate] || RATE.smooth)(raw);
        switch (o.anIn.type) {
          case 'create': mode = 'create'; p = e; break;
          case 'write': mode = 'write'; p = (RATE[o.anIn.rate] || RATE.linear)(raw); break;
          case 'drawfill': mode = 'drawfill'; p = e; break;
          case 'fadein': st.opacity *= e; break;
          case 'fadeup': st.opacity *= e; st.y -= (1 - e) * 0.6; break;
          case 'grow': st.scale *= Math.max(e, 0.001); break;
          case 'spin': st.scale *= Math.max(e, 0.001); st.rotation += (1 - e) * Math.PI; break;
        }
      }
      // out
      let morph = null;
      if (outD && t >= o.end - outD) {
        const raw = (t - (o.end - outD)) / outD, e = (RATE[o.anOut.rate] || RATE.smooth)(raw);
        switch (o.anOut.type) {
          case 'fadeout': st.opacity *= 1 - e; break;
          case 'fadedown': st.opacity *= 1 - e; st.y -= e * 0.6; break;
          case 'uncreate': mode = 'create'; p = 1 - e; break;
          case 'shrink': st.scale *= Math.max(1 - e, 0.001); break;
          case 'transform': if (byId[o.anOut.target]) morph = { tgt: byId[o.anOut.target], e }; else st.opacity *= 1 - e; break;
        }
      }
      if (morph) {
        const A = morphParts(o, t), B = morphParts(morph.tgt, morph.tgt.start);
        drawMorph(ctx, A, B, morph.e, ppu, W, H);
        continue;
      }
      // emphasis
      const extras = [];
      for (const em of o.emph || []) {
        if (t < em.t || t > em.t + em.dur) continue;
        const e = clamp((t - em.t) / em.dur), b = RATE.thereAndBack(e);
        switch (em.type) {
          case 'indicate': st.scale *= 1 + 0.2 * b; env.tint = b; env.tintC = color(em.color) || PAL.YELLOW; break;
          case 'wiggle': st.rotation += 0.12 * Math.sin(e * 6 * Math.PI) * b; st.scale *= 1 + 0.1 * b; break;
          case 'pulse': st.scale *= 1 + 0.12 * Math.abs(Math.sin(e * 2 * Math.PI)); break;
          case 'spin': st.rotation += 2 * Math.PI * RATE.smooth(e); break;
          case 'circumscribe': case 'flash': case 'underline': extras.push([em, e]); break;
        }
      }
      // idle loop
      const lt = t - o.start;
      switch (o.loop) {
        case 'bob': st.y += 0.12 * Math.sin(lt * 2 * Math.PI / 1.6); break;
        case 'pulse': st.scale *= 1 + 0.06 * Math.sin(lt * 2 * Math.PI / 1.2); break;
        case 'spin': st.rotation -= lt * 0.9; break;
        case 'wiggle': st.rotation += 0.1 * Math.sin(lt * 2 * Math.PI * 1.3); break;
        case 'float': st.y += 0.08 * Math.sin(lt * 1.7); st.rotation += 0.05 * Math.sin(lt * 1.1); break;
      }
      if (st.opacity <= 0.001) continue;
      const b = build(o);
      env.scale = st.scale;
      const mid = o.start + inD, endMove = o.end - outD;
      env.u = endMove > mid ? (t - mid) / (endMove - mid) : 1;
      ctx.save();
      ctx.translate(W / 2 + st.x * ppu, H / 2 - st.y * ppu);
      ctx.rotate(-st.rotation);
      ctx.scale(st.scale * ppu, st.scale * ppu);
      ctx.globalAlpha = clamp(st.opacity);
      drawPrims(ctx, b.prims, mode, p, env);
      for (const [em, e] of extras) drawExtra(ctx, em, e, b.bb, st.scale);
      ctx.restore();
      o._hit = { st, bb: b.bb };
    }
    ctx.restore();
  }
  function drawExtra(ctx, em, e, bb, scale) {
    const c = color(em.color) || PAL.YELLOW;
    const [x0, y0, x1, y1] = bb, pad = 0.15 / scale;
    ctx.save();
    ctx.strokeStyle = c; ctx.lineWidth = 0.035 / scale; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (em.type === 'circumscribe') {
      const pts = [[x0 - pad, y0 - pad], [x1 + pad, y0 - pad], [x1 + pad, y1 + pad], [x0 - pad, y1 + pad]];
      if (e < 0.5) drawPartial(ctx, pts, true, e * 2);
      else { const r = resample(pts, true, 160); const k = Math.floor((e - 0.5) * 2 * 160); drawPartial(ctx, r.slice(k).concat(k < 160 ? [] : []), false, 1); }
    } else if (em.type === 'underline') {
      const y = y1 + pad;
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * clamp(e * 1.6), y); ctx.globalAlpha *= e > 0.75 ? 1 - (e - 0.75) / 0.25 : 1; ctx.stroke();
    } else if (em.type === 'flash') {
      const R = Math.max(x1 - x0, y1 - y0) / 2 + pad;
      const r1 = R + e * 0.9 / scale, r0 = R + Math.max(0, e - 0.35) * 1.2 / scale;
      ctx.globalAlpha *= 1 - e * 0.6;
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
    }
    ctx.restore();
  }

  // Hit test in scene units (y up). Returns the topmost object.
  function hitTest(scene, ux, uy) {
    for (let i = scene.objects.length - 1; i >= 0; i--) {
      const o = scene.objects[i], h = o._hit;
      if (!h) continue;
      const { st, bb } = h;
      const dx = ux - st.x, dy = uy - st.y, c = Math.cos(-st.rotation), s = Math.sin(-st.rotation);
      const lx = (dx * c - dy * s) / st.scale, ly = -(dx * s + dy * c) / st.scale;
      const pad = 0.15 / st.scale;
      if (lx >= bb[0] - pad && lx <= bb[2] + pad && ly >= bb[1] - pad && ly <= bb[3] + pad) return o;
    }
    return null;
  }

  function fontsChanged() { mcache = new Map(); bcache.clear(); fontVer++; }
  let fontVer = 0;

  window.Animath = { PAL, TYPES, ANIM_IN, ANIM_OUT, EMPH, LOOPS, KEYABLE, RATE, render, hitTest, build, phases, keyVal, color, fontsChanged, compileFn, parseSet, parseLogic, parseTex, texBox };
})();
