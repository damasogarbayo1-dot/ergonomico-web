/* Ergonomi&Co — main.js. Capa JS sobre window.__DB__ (lib/db.js, generado).
   El HTML ya funciona sin JS; aquí solo se ENRIQUECE: % de ajuste personal,
   filtros de catálogo, bandeja y página de comparador, reveals. */
(function () {
  "use strict";

  var DB = window.__DB__ || { productos: [], scoreAxes: {} };
  var AMZ_TAG = DB.amazonTag ? "?tag=" + encodeURIComponent(DB.amazonTag) : "";
  var I18N = DB.i18n || {};
  var APX = DB.assetPrefix || "";
  function t(s) { return I18N[s] || s; }
  function tf(s, vars) {
    var out = t(s);
    Object.keys(vars || {}).forEach(function (k) { out = out.replace("{" + k + "}", vars[k]); });
    return out;
  }
  var $ = function (sel, scope) { return (scope || document).querySelector(sel); };
  var $$ = function (sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); };
  var escHTML = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  function safe(fn, name) { try { fn(); } catch (e) { console.warn("[" + name + "]", e); } }
  var SCOL = ["var(--s1)", "var(--s2)", "var(--s3)"];
  var LR = { no: 0, fija: 1, regulable: 2, activa: 3 };
  var BR = { fijos: 0, plegables: 1, "2D": 1, "3D": 2, "4D": 3, "5D": 4 };

  function byId(id) {
    for (var i = 0; i < DB.productos.length; i++) if (DB.productos[i].id === id) return DB.productos[i];
    return null;
  }

  /* ---------- medidas del usuario (sinergia ErgoCheck / finders) ---------- */
  function medidas() {
    try {
      var m = JSON.parse(localStorage.getItem("ergonomiq-medidas") || "null");
      if (m && (m.h || m.mano)) return m;
    } catch (e) {}
    return null;
  }
  function tallaMano(cm) { return cm < 17 ? "S" : (cm <= 19 ? "M" : "L"); }

  /* ---------- motor de ajuste personal (mismas reglas que los finders) ---------- */
  function evaluarSilla(p, m) {
    var pop = Math.round((m.h || 175) * 0.25);
    var peso = m.peso || 75, horas = m.horas || 8;
    var checks = [], score = 0;
    var dentro = p.rango_asiento_min_cm <= pop && pop <= p.rango_asiento_max_cm;
    var dist = dentro ? 0 : Math.min(Math.abs(pop - p.rango_asiento_min_cm), Math.abs(pop - p.rango_asiento_max_cm));
    score += Math.max(0, 40 - dist * 6);
    checks.push({ ok: dentro, txt: dentro ? tf("Cubre tu altura de asiento ({n} cm)", { n: pop }) : tf("Tu asiento ideal ({n} cm) queda fuera de su rango", { n: pop }) });
    var pesoOK = peso <= p.peso_max_kg;
    score += pesoOK ? 20 : 0;
    checks.push({ ok: pesoOK, txt: pesoOK ? tf("Soporta tu peso (máx. {n} kg)", { n: p.peso_max_kg }) : tf("Peso máximo {n} kg — insuficiente", { n: p.peso_max_kg }) });
    score += LR[p.lumbar] * (horas >= 6 ? 1 : 0.6) * 6.66;
    checks.push({ ok: p.lumbar === "activa" || p.lumbar === "regulable", txt: tf("Lumbar {x}", { x: p.lumbar }) + (horas >= 6 && p.lumbar === "fija" ? tf(" — corto para {n} h/día", { n: horas }) : "") });
    score += Math.min(10, p.garantia_anos || 2) + (p.en1335 ? 5 : 0) + (p.profundidad_regulable ? 5 : 0);
    return { score: Math.round(Math.min(100, score)), checks: checks };
  }
  function evaluarPeri(p, m) {
    var t = m.mano ? tallaMano(m.mano) : null;
    var zurdo = m.lado === "zurda";
    var checks = [], score = 0;
    var tallaOK = !t || p.tipo === "teclado" || (p.tallas_mano || []).indexOf(t) >= 0;
    score += tallaOK ? 45 : 10;
    if (t && p.tipo !== "teclado") checks.push({ ok: tallaOK, txt: tallaOK ? tf("Talla {x} compatible", { x: t }) : tf("No recomendado para talla {x}", { x: t }) });
    var zurdoOK = !zurdo || p.apto_zurdos;
    score += zurdoOK ? 20 : 0;
    if (zurdo) checks.push({ ok: zurdoOK, txt: zurdoOK ? I18N["Apto para zurdos"] || "Apto para zurdos" : I18N["Solo diestros"] || "Solo diestros" });
    score += p.inalambrico ? 10 : 5;
    if ((p.angulo_vertical_grados || 0) >= 57) checks.push({ ok: true, txt: tf("Ángulo vertical {n}° — antebrazo neutro", { n: p.angulo_vertical_grados }) });
    score += 25;
    return { score: Math.min(100, score), checks: checks };
  }
  /* Escritorios: mismas reglas que tenia el finder de escritorios. Sentado = 43 %
     de la estatura, de pie = 62 %. Un convertidor se mide SOBRE la mesa. */
  function evaluarEscritorio(p, m) {
    var h = m.h || 175, sentado = Math.round(h * 0.43), pie = Math.round(h * 0.62);
    var checks = [], score = 0, pieOK;
    if (p.altura_referencia === "sobre_mesa") {
      var mesa = m.mesa || 75, alcanza = mesa + (p.altura_max_cm || 0);
      pieOK = alcanza >= pie;
      score += pieOK ? 45 : Math.max(0, 45 - (pie - alcanza) * 5);
      checks.push({ ok: pieOK, txt: pieOK
        ? tf("Sobre tu mesa de {m} cm llega a {a} cm: cubre tu altura de pie ({p} cm)", { m: mesa, a: Math.round(alcanza), p: pie })
        : tf("Sobre tu mesa de {m} cm se queda en {a} cm, y necesitas {p} cm", { m: mesa, a: Math.round(alcanza), p: pie }) });
      var mesaOK = Math.abs(mesa - sentado) <= 3;
      score += mesaOK ? 20 : 8;
      checks.push({ ok: mesaOK, txt: mesaOK
        ? tf("Tu mesa ({m} cm) ya está a tu altura sentado", { m: mesa })
        : tf("Sentado seguirás a {m} cm cuando lo tuyo son {s} cm: un convertidor no corrige eso", { m: mesa, s: sentado }) });
      score += p.carga_max_kg ? 15 : 8;
      score += 20;
      return { score: Math.round(Math.min(100, score)), checks: checks };
    }
    var sentOK = p.altura_min_cm <= sentado && sentado <= p.altura_max_cm;
    score += sentOK ? 30 : Math.max(0, 30 - Math.abs(sentado - p.altura_min_cm) * 4);
    checks.push({ ok: sentOK, txt: sentOK
      ? tf("Cubre tu altura sentado ({n} cm)", { n: sentado })
      : tf("Tu altura sentado ({n} cm) queda fuera de su rango {a}-{b}", { n: sentado, a: p.altura_min_cm, b: p.altura_max_cm }) });
    pieOK = p.altura_max_cm >= pie;
    score += pieOK ? 30 : Math.max(0, 30 - (pie - p.altura_max_cm) * 5);
    checks.push({ ok: pieOK, txt: pieOK
      ? tf("Llega a tu altura de pie ({n} cm)", { n: pie })
      : tf("Se queda en {a} cm: te faltan {n} cm para trabajar de pie", { a: p.altura_max_cm, n: pie - p.altura_max_cm }) });
    score += p.carga_max_kg ? 15 : 8;
    score += ({ doble: 4, simple: 3, manivela: 1, gas: 1 }[p.motor] || 0) * 2.5;
    if (m.cambios && p.memorias >= 2) {
      score += 10;
      checks.push({ ok: true, txt: tf("{n} memorias: clave si cambias de postura a menudo", { n: p.memorias }) });
    } else if (m.cambios && !p.memorias) {
      checks.push({ ok: false, txt: t("Sin memorias: ajustar a mano cada vez desanima a usarlo") });
    } else { score += 5; }
    score += Math.min(5, (p.garantia_anos || 0) / 2);
    return { score: Math.round(Math.min(100, score)), checks: checks };
  }
  function fitFor(p, m) {
    if (!m) return null;
    if (p.nicho === "silla") { if (!m.h) return null; return evaluarSilla(p, m); }
    if (p.nicho === "escritorio") { if (!m.h) return null; return evaluarEscritorio(p, m); }
    if (p.nicho !== "periferico" || !m.mano) return null;
    return evaluarPeri(p, m);
  }

  /* ---------- badges de ajuste en tarjetas y fichas ---------- */
  function mountFitBadges() {
    var m = medidas();
    if (!m) return;
    $$(".fit-badge[data-fit]").forEach(function (el) {
      var p = byId(el.getAttribute("data-fit"));
      var r = p && fitFor(p, m);
      if (!r) return;
      el.hidden = false;
      el.textContent = r.score + " " + t("% de ajuste a ti");
      el.className = "fit-badge" + (r.score >= 75 ? "" : (r.score >= 55 ? " warn" : " bad"));
      el.closest(".pcard") && el.closest(".pcard").setAttribute("data-fit-score", r.score);
    });
    var cta = $("#fitCta");
    if (cta) cta.innerHTML = "📏 <b>" + t("Medidas cargadas de tu ErgoCheck.") + "</b> " + t("El % de cada tarjeta es tu ajuste personal.");
    $$(".fit-panel[data-fit-panel]").forEach(function (el) {
      var p = byId(el.getAttribute("data-fit-panel"));
      var r = p && fitFor(p, m);
      if (!r) return;
      el.hidden = false;
      el.className = "fit-panel" + (r.score >= 75 ? "" : (r.score >= 55 ? " warn" : " bad"));
      el.innerHTML = "<b>" + r.score + " % de ajuste a tus medidas.</b> " +
        r.checks.map(function (c) { return (c.ok ? "✓ " : "✗ ") + escHTML(c.txt); }).join(" · ");
    });
  }

  /* ---------- scrollspy del sub-nav de secciones ---------- */
  function mountScrollspy() {
    var links = $$(".subnav a[data-spy]");
    if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("data-spy")] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("on"); });
        var a = map[en.target.id];
        if (a) a.classList.add("on");
      });
    }, { rootMargin: "-25% 0px -65% 0px" });
    Object.keys(map).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
  }

  /* ---------- contadores animados del hero ---------- */
  function mountCountUp() {
    var els = $$("[data-count-to]");
    if (!els.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function anima(el) {
      var to = parseInt(el.getAttribute("data-count-to"), 10) || 0;
      var t0 = null;
      function paso(t) {
        if (!t0) t0 = t;
        var k = Math.min(1, (t - t0) / 900);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(paso);
      }
      requestAnimationFrame(paso);
    }
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { anima(en.target); io.unobserve(en.target); }
      });
    }, { threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- bandeja de comparación (persistente entre páginas) ---------- */
  function getSel() {
    try { return JSON.parse(localStorage.getItem("ergonomico-cmp") || "[]"); } catch (e) { return []; }
  }
  function setSel(ids) {
    try { localStorage.setItem("ergonomico-cmp", JSON.stringify(ids)); } catch (e) {}
    /* la bandeja de abajo y los botones «Comparar» se repintan solos */
    document.dispatchEvent(new CustomEvent("cmp:cambio"));
  }
  function mountCmpButtons() {
    function pinta() {
      var sel = getSel();
      $$(".btn-cmp[data-cmp]").forEach(function (b) {
        var on = sel.indexOf(b.getAttribute("data-cmp")) >= 0;
        b.classList.toggle("on", on);
        // El icono es un <svg>: solo se toca la etiqueta, nunca el contenido
        // entero del boton (eso borraba el icono y devolvia el emoji).
        var lab = b.querySelector(".btn-cmp-txt");
        if (lab) lab.textContent = on ? t("En comparativa") : (lab.getAttribute("data-base") || t("Comparar"));
      });
      var tray = $("#cmpTray");
      if (tray) {
        tray.hidden = sel.length === 0;
        var nombres = sel.map(function (id) { var p = byId(id); return p ? p.name : id; });
        var txt = $("#cmpTrayTxt");
        if (txt) txt.innerHTML = sel.length >= 2 ? "<b>" + nombres.map(escHTML).join("</b> vs <b>") + "</b>"
          : "<b>" + escHTML(nombres[0] || "") + "</b> — " + t("marca al menos otro para comparar");
        var btn = $("#cmpTrayBtn");
        if (btn) btn.style.display = sel.length >= 2 ? "" : "none";
      }
    }
    document.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest(".btn-cmp[data-cmp]");
      if (!b) return;
      var id = b.getAttribute("data-cmp");
      var p = byId(id);
      var sel = getSel();
      var i = sel.indexOf(id);
      if (i >= 0) sel.splice(i, 1);
      else {
        if (p) sel = sel.filter(function (x) { var q = byId(x); return q && q.nicho === p.nicho; });
        if (sel.length >= 3) return;
        sel.push(id);
      }
      setSel(sel);
      pinta();
    });
    var clear = $("#cmpTrayClear");
    if (clear) clear.addEventListener("click", function () { setSel([]); pinta(); });
    document.addEventListener("cmp:cambio", pinta);
    pinta();
  }

  /* ---------- página comparador ---------- */
  function catsDe(p, m, minPrecio) {
    var cats = [];
    var r = fitFor(p, m);
    if (r) cats.push([t("Ajuste a ti"), r.score]);
    var axes = DB.scoreAxes[p.nicho] || [];
    axes.forEach(function (ax) {
      var v = (p.scores && p.scores[ax[0]]) || 0;
      cats.push([ax[1], Math.round(v * 10)]);
    });
    cats.push([t("Precio"), Math.round(minPrecio / p.retailPrice * 100)]);
    return cats;
  }
  function glifoJS(p) {
    var g = {
      silla: '<path d="M8 4 q-2 8 0 11 h7 M15 15 v4 M11 19 h8 M8 8 h6"/><path d="M15 19 v2 M13 21 h4"/>',
      vertical: '<path d="M9 20 q-3 -6 1 -12 q3 -4 6 -1 q3 3 0 8 q-2 4 -7 5 Z M13 9 l2 2"/>',
      ergo: '<ellipse cx="12" cy="13" rx="7" ry="9"/><path d="M12 4 v6 M9 6 q3 -2 6 0"/>',
      trackball: '<ellipse cx="12" cy="15" rx="9" ry="6"/><circle cx="12" cy="10" r="4"/>',
      teclado: '<rect x="3" y="9" width="18" height="9" rx="2"/><path d="M6 12 h2 M10 12 h2 M14 12 h2 M18 12 h0.5 M7 15 h10"/>'
    };
    var k = p.nicho === "silla" ? "silla" : (p.tipo || "ergo");
    return '<svg viewBox="0 0 24 24" class="glifo">' + (g[k] || g.ergo) + "</svg>";
  }
  function planoDe(p) {
    // El comparador carga lib/planos.js: mismo dibujo acotado que las fichas.
    var P = window.__PLANOS__;
    return (P && P[p.id]) || glifoJS(p);
  }
  function anillo(v, color, size) {
    size = size || 52;
    var r = size / 2 - 5, cc = 2 * Math.PI * r, dash = cc * v / 100;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="4"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="4" stroke-linecap="round" stroke-dasharray="' + dash + " " + cc + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>' +
      '<text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle" style="font:800 ' + size * 0.28 + 'px var(--fuente);fill:var(--ink)">' + v + "</text></svg>";
  }
  function radar(cats) {
    var n = cats[0].length, R = 92, cx = 170, cy = 128;
    var ang = function (i) { return -Math.PI / 2 + i * 2 * Math.PI / n; };
    var pt = function (i, r) { return (cx + r * Math.cos(ang(i))).toFixed(1) + "," + (cy + r * Math.sin(ang(i))).toFixed(1); };
    var s = '<svg width="340" height="256" viewBox="0 0 340 256" role="img" aria-label="Comparativa por categorías">';
    [0.5, 1].forEach(function (f) {
      s += '<polygon points="' + Array.apply(null, Array(n)).map(function (_, i) { return pt(i, R * f); }).join(" ") + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
    });
    for (var i = 0; i < n; i++) s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + pt(i, R).split(",")[0] + '" y2="' + pt(i, R).split(",")[1] + '" stroke="var(--line)" stroke-width="1"/>';
    cats.forEach(function (c, pi) {
      var pts = Array.apply(null, Array(n)).map(function (_, i) { return pt(i, R * c[i][1] / 100); }).join(" ");
      s += '<polygon points="' + pts + '" fill="' + SCOL[pi] + '" fill-opacity=".16" stroke="' + SCOL[pi] + '" stroke-width="2"/>';
      for (var j = 0; j < n; j++) {
        var p2 = pt(j, R * c[j][1] / 100).split(",");
        s += '<circle cx="' + p2[0] + '" cy="' + p2[1] + '" r="3" fill="' + SCOL[pi] + '" stroke="var(--panel)" stroke-width="1.5"/>';
      }
    });
    cats[0].forEach(function (c, i) {
      var p3 = pt(i, R + 16).split(",");
      s += '<text x="' + p3[0] + '" y="' + p3[1] + '" text-anchor="middle" style="font:600 10px var(--fuente);fill:var(--muted)">' + escHTML(c[0]) + "</text>";
    });
    return s + "</svg>";
  }
  var SCOL_OSCURO = ["#ffffff", "#d99b8c", "#e8d087"];
  function veredicto(pp, cats, conMedidas) {
    var winner = cats[0][0][1] >= cats[1][0][1] ? 0 : 1, loser = 1 - winner;
    var wins = [], losses = [];
    cats[0].forEach(function (c, ci) {
      var d = cats[winner][ci][1] - cats[loser][ci][1];
      if (d > 0) wins.push({ n: c[0], d: d, ci: ci });
      else if (d < 0) losses.push({ n: c[0], d: -d, ci: ci });
    });
    wins.sort(function (a, b) { return b.d - a.d; });
    losses.sort(function (a, b) { return b.d - a.d; });
    var chip = function (w) { return '<span class="vchip" data-cat="' + w.ci + '">' + escHTML(w.n) + "<sup>+" + w.d + "</sup></span>"; };
    // El veredicto va sobre banda negra: la serie 1 es negra y ahí no se veía.
    // SCOL_OSCURO mantiene la identificación por color, pero legible en negativo.
    var f = t("Tu elección:") + ' <b style="color:' + SCOL_OSCURO[winner] + '">' +
      escHTML(pp[winner].name) + "</b>";
    f += wins.length ? t(" — por delante en ") + wins.map(chip).join(", ") : t(" — empate técnico");
    f += losses.length ? t(" — salvo que ") + chip(losses[0]) + t(" decida por ti.") : ".";
    return '<div class="veredicto"><div class="vtit">' + t("El veredicto") + (conMedidas ? t(" — con tus medidas") : "") + "</div>" +
      '<div class="frase">' + f + "</div>" +
      '<div class="hint">' + t("Toca una categoría para ver la prueba en las barras") + "</div></div>";
  }
  function filasDe(nicho) {
    if (nicho === "silla") return [
      [t("Rango de asiento"), function (p) { return p.rango_asiento_min_cm + "-" + p.rango_asiento_max_cm + " cm"; }, null],
      [t("Profundidad regulable"), function (p) { return p.profundidad_regulable ? t("Sí") : t("No"); }, function (p) { return p.profundidad_regulable ? 1 : 0; }],
      [t("Soporte lumbar"), function (p) { return p.lumbar; }, function (p) { return LR[p.lumbar]; }],
      [t("Reposabrazos"), function (p) { return p.reposabrazos; }, function (p) { return BR[p.reposabrazos]; }],
      [t("Peso máximo"), function (p) { return p.peso_max_kg + " kg"; }, function (p) { return p.peso_max_kg; }],
      ["EN 1335", function (p) { return p.en1335 ? t("Sí") : t("No"); }, function (p) { return p.en1335 ? 1 : 0; }],
      [t("Garantía"), function (p) { return p.garantia_anos ? tf("{n} años", { n: p.garantia_anos }) : "—"; }, function (p) { return p.garantia_anos || 0; }],
    ].concat(window.SIN_PRECIOS ? [] : [[t("Precio orientativo"), function (p) { return p.precio_rango || "—"; }, function (p) { return -p.retailPrice; }]]);
    return [
      [t("Tipo"), function (p) { return p.tipo; }, null],
      [t("Tallas de mano"), function (p) { return (p.tallas_mano || []).join("/") || "—"; }, function (p) { return (p.tallas_mano || []).length; }],
      [t("Apto zurdos"), function (p) { return p.apto_zurdos ? t("Sí") : t("No"); }, function (p) { return p.apto_zurdos ? 1 : 0; }],
      [t("Ángulo vertical"), function (p) { return p.angulo_vertical_grados ? p.angulo_vertical_grados + "°" : "—"; }, function (p) { return p.angulo_vertical_grados || 0; }],
      [t("Conexión"), function (p) { return p.inalambrico ? t("Inalámbrica") : t("Cable"); }, function (p) { return p.inalambrico ? 1 : 0; }],
    ].concat(window.SIN_PRECIOS ? [] : [[t("Precio orientativo"), function (p) { return p.precio_rango || "—"; }, function (p) { return -p.retailPrice; }]]);
  }
  function renderVersus(ids) {
    var out = $("#cmpResultado");
    if (!out) return;
    var pp = ids.map(byId).filter(Boolean);
    if (pp.length < 2) { out.innerHTML = ""; return; }
    var m = medidas();
    var minP = Math.min.apply(null, pp.map(function (p) { return p.retailPrice; }));
    var cats = pp.map(function (p) { return catsDe(p, m, minP); });
    var h = '<div class="vs-secc" style="margin-top:26px">' + (m ? t("Decidido con tus medidas") : t("Cara a cara")) + "</div>";
    h += '<div class="vs-cab' + (pp.length === 3 ? " tres" : "") + '">';
    pp.forEach(function (p, i) {
      if (i === 1 && pp.length === 2) h += '<div class="vs-mid">VS</div>';
      // El dibujo del producto ya esta en las ranuras del selector, justo encima:
      // repetirlo aqui solo alargaba la pagina.
      h += '<div class="vs-prod"><div class="nom">' + escHTML(p.name) + "</div>" +
        '<div class="fila">' + anillo(cats[i][0][1], SCOL[i]) + '<span class="precio-chip">' + escHTML(p.precio_rango || "") + "</span></div>" +
        '<div class="fila" style="margin-top:10px"><a class="btn-ficha" href="' + p.id + '.html">' + t("Ver ficha") + "</a></div></div>";
    });
    h += "</div>";
    if (pp.length === 2) h += veredicto(pp, cats, !!m);
    h += '<div class="vs-secc">' + t("De un vistazo") + '</div><div class="radar-wrap">' + radar(cats) + "</div>";
    h += '<div class="vs-leyenda">' + pp.map(function (p, i) {
      return '<span class="chipc"><span class="dot" style="background:' + SCOL[i] + '"></span>' + escHTML(p.name) + "</span>";
    }).join("") + "</div>";
    h += '<div class="vs-secc">' + t("Las pruebas") + "</div>";
    cats[0].forEach(function (cat, ci) {
      h += '<div class="vs-cat" id="vscat' + ci + '"><div class="cat-lbl">' + escHTML(cat[0]) + "</div>" + pp.map(function (p, i) {
        var v = cats[i][ci][1];
        return '<div class="vs-bar"><div class="track"><div class="fill" style="width:' + v + "%;background:" + SCOL[i] + '"></div></div><span class="val">' + v + "</span></div>";
      }).join("") + "</div>";
    });
    var filas = filasDe(pp[0].nicho);
    h += '<div class="vs-secc">' + t("Spec a spec") + '</div><div class="scrollx"><table class="tablacmp"><tr><th></th>' +
      pp.map(function (p) { return "<th>" + escHTML(p.name) + "</th>"; }).join("") + "</tr>" +
      filas.map(function (f) {
        var vals = f[2] ? pp.map(f[2]) : null;
        var max = vals ? Math.max.apply(null, vals) : null;
        var empate = vals && vals.every(function (v) { return v === max; });
        return "<tr><th>" + escHTML(f[0]) + "</th>" + pp.map(function (p, i) {
          return '<td class="' + (vals && !empate && vals[i] === max ? "mejor" : "") + '">' + escHTML(f[1](p)) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</table></div>";
    h += '<p class="metodo-nota">' + t("Puntuaciones calculadas de specs oficiales con el mismo método para todos los productos") +
      ' (<a href="como-elegimos.html">' + t("publicado aquí") + "</a>). " + t("En Precio, 100 = el más barato del duelo.") +
      (m ? " " + t("«Ajuste a ti» usa tus medidas guardadas en este navegador.")
         : " <a href='" + APX + "ergocheck.html'>" + t("Pasa por ErgoCheck para añadir el eje «Ajuste a ti».") + "</a>") + "</p>";
    out.innerHTML = h;
    $$(".vchip", out).forEach(function (ch) {
      ch.addEventListener("click", function () {
        var el = $("#vscat" + ch.getAttribute("data-cat"));
        if (!el) return;
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("flash");
        setTimeout(function () { el.classList.remove("flash"); }, 1200);
      });
    });
  }
  function mountComparador() {
    var slots = $("#cmpSlots");
    if (!slots) return;
    var panel = $("#cmpPanel"), busca = $("#cmpBusca"), opts = $("#cmpOpciones");
    var tabs = $$("#cmpTabs .dtab");
    var ranura = [null, null, null];   // el duelo son ranuras, no una lista
    var target = 0;                    // ranura que se esta rellenando
    var tres = false;
    var nicho = tabs.length ? tabs[0].getAttribute("data-nicho") : "silla";
    var tipoTab = tabs.length ? (tabs[0].getAttribute("data-tipo") || "") : "";   // "raton" | "teclado" | ""
    function grupoDe(p) { return p.nicho === "periferico" ? (p.tipo === "teclado" ? "teclado" : "raton") : ""; }
    function enGrupo(p) { return p.nicho === nicho && (!tipoTab || grupoDe(p) === tipoTab); }
    var lista = slots.getAttribute("data-ids");
    var soloIds = lista ? lista.split(",") : null;

    function sel() {
      return ranura.filter(Boolean);
    }
    function marcaTab() {
      tabs.forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-nicho") === nicho && (b.getAttribute("data-tipo") || "") === tipoTab);
      });
    }
    function slotHTML(i, p) {
      if (!p) {
        return '<div class="slot" data-slot="' + i + '"><button class="slot-btn" type="button">' +
          '<span class="mas">+</span><span class="txt">' + escHTML(tf("Elige el producto {n}", { n: i + 1 })) +
          "</span></button></div>";
      }
      return '<div class="slot lleno" data-slot="' + i + '"><button class="slot-btn" type="button">' +
        '<span class="plano-slot">' + planoDe(p) + "</span>" +
        '<span class="s-nom">' + escHTML(p.name) + "</span>" +
        '<span class="s-meta">' + escHTML(p.marca) + (p.precio_rango ? " · " + escHTML(p.precio_rango) : "") + "</span>" +
        '<span class="s-cambiar">' + t("Cambiar") + "</span></button></div>";
    }
    function pintaSlots() {
      var n = (tres || ranura[2]) ? 3 : 2;
      var h = "";
      for (var i = 0; i < n; i++) {
        if (i) h += '<div class="duelo-vs">VS</div>';
        h += slotHTML(i, byId(ranura[i]));
      }
      slots.className = "duelo-slots" + (n === 3 ? " tres" : "");
      slots.innerHTML = h;
      var btnMas = $("#cmpTercero");
      if (btnMas) btnMas.textContent = n === 3 ? ("− " + t("Quitar el tercero")) : ("+ " + t("Añadir un tercero"));
      $$(".slot-btn", slots).forEach(function (b) {
        b.addEventListener("click", function () {
          target = +b.parentNode.getAttribute("data-slot");
          abrePanel();
        });
      });
    }
    function pintaOpts() {
      if (!opts) return;
      var q = ((busca && busca.value) || "").toLowerCase();
      var puestos = sel();
      var items = DB.productos.filter(function (p) {
        // En una pagina de categoria el comparador se limita a esos productos.
        if (soloIds && soloIds.indexOf(p.id) < 0) return false;
        return enGrupo(p) && (!q || (p.name + " " + p.marca).toLowerCase().indexOf(q) >= 0);
      });
      opts.innerHTML = items.map(function (p) {
        return '<button class="opt-prod' + (puestos.indexOf(p.id) >= 0 ? " on" : "") +
          '" type="button" data-id="' + p.id + '"><span>' + escHTML(p.name) +
          '</span><span class="p">' + escHTML(p.precio_rango || "") + "</span></button>";
      }).join("") || '<div class="duelo-vacio">' + t("Ningún producto coincide con tu búsqueda.") + "</div>";
      $$(".opt-prod", opts).forEach(function (b) {
        b.addEventListener("click", function () { elige(b.getAttribute("data-id")); });
      });
    }
    function abrePanel() {
      if (!panel) return;
      panel.hidden = false;
      pintaOpts();
      if (busca) busca.focus();
    }
    function elige(id) {
      var p = byId(id);
      if (!p) return;
      for (var i = 0; i < 3; i++) if (ranura[i] === id) ranura[i] = null;  // sin duplicados
      ranura[target] = id;
      if (panel) panel.hidden = true;
      aplica();
    }
    function aplica() {
      var s2 = sel();
      setSel(s2);
      try { location.hash = s2.length ? "ids=" + s2.join(",") : ""; } catch (e) {}
      pintaSlots();
      renderVersus(s2);
    }

    tabs.forEach(function (b) {
      b.addEventListener("click", function () {
        nicho = b.getAttribute("data-nicho");
        tipoTab = b.getAttribute("data-tipo") || "";
        var s2 = sel(), p0 = s2.length ? byId(s2[0]) : null;
        marcaTab();
        if (p0 && !enGrupo(p0)) { ranura = [null, null, null]; aplica(); }
        if (panel && !panel.hidden) pintaOpts();
      });
    });
    if (busca) busca.addEventListener("input", pintaOpts);
    var mas = $("#cmpTercero");
    /* Añadir un tercero ↔ quitar el tercero: el mismo botón vuelve a la comparativa de dos */
    if (mas) mas.addEventListener("click", function () {
      if (tres || ranura[2]) { ranura[2] = null; tres = false; aplica(); }
      else { tres = true; pintaSlots(); }
    });
    var vaciar = $("#cmpVaciar");
    if (vaciar) vaciar.addEventListener("click", function () {
      ranura = [null, null, null]; tres = false; aplica();
    });

    // Estado inicial: primero el enlace compartido, si no lo que haya en la bandeja
    var hash = (location.hash.match(/ids=([\w,-]+)/) || [])[1];
    var ids = hash ? hash.split(",").filter(byId) : getSel();
    // En una página de categoría solo entran productos de esa categoría: la
    // bandeja global puede traer sillas a la página de ratones (bug visto el 2026-09-14).
    if (soloIds) {
      var antes = ids.length;
      ids = ids.filter(function (id) { return soloIds.indexOf(id) >= 0; });
      if (ids.length !== antes) setSel(ids);   /* la bandeja pasa a reflejar esta categoría */
    }
    ids.slice(0, 3).forEach(function (id, i) { ranura[i] = id; });
    var pr = byId(ranura[0]);
    if (pr && !soloIds) { nicho = pr.nicho; tipoTab = tabs.length ? grupoDe(pr) : ""; }
    if (ranura[2]) tres = true;
    marcaTab();
    pintaSlots();
    renderVersus(sel());
  }

  /* ---------- reveals suaves ---------- */
  function mountReveals() {
    var els = $$(".pcard, .cat-card, .trust");
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    els.forEach(function (el) { el.classList.add("reveal"); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("vis"); io.unobserve(en.target); }
      });
    }, { threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () { els.forEach(function (el) { el.classList.add("vis"); }); }, 2500);
  }

  /* ---------- catalogo: chips, buscador, tramo y orden ----------
     La rejilla esta partida en dos (la escena del puesto va en medio), asi que
     al filtrar u ordenar hay que REPARTIR las tarjetas entre las dos mitades,
     no solo esconderlas. El HTML ya viene partido para que funcione sin JS. */
  function mountFiltroCatalogo() {
    var barra = $("#filtros"), ga = $("#pgrid-a"), gb = $("#pgrid-b");
    if (!barra || !ga || !gb) return;
    var pista = $("#filtro-finder"), cuenta = $("#cuenta"), sinRes = $("#sin-res");
    var q = $("#q"), selTramo = $("#tramo"), selOrden = $("#orden");
    var todas = $$(".pcard:not(.pcard-quiz)", ga).concat($$(".pcard:not(.pcard-quiz)", gb));
    var quiz = $(".pcard-quiz");
    var orig = todas.slice();               // el orden "recomendado" es el de origen
    var estado = { grupo: "todos", texto: [], tramo: "todos", orden: "recomendado" };

    function limpia(s) {
      return String(s || "").toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    function num(c, attr) { return parseFloat(c.getAttribute(attr)) || 0; }

    function pinta() {
      var vis = orig.filter(function (c) {
        if (estado.grupo !== "todos" && c.getAttribute("data-grupo") !== estado.grupo) return false;
        if (estado.tramo !== "todos" && c.getAttribute("data-tramo") !== estado.tramo) return false;
        if (estado.texto.length) {
          var heno = limpia(c.getAttribute("data-buscar"));
          // Todas las palabras tienen que aparecer: «raton logitech» busca las dos.
          for (var i = 0; i < estado.texto.length; i++) {
            if (heno.indexOf(estado.texto[i]) < 0) return false;
          }
        }
        return true;
      });

      if (estado.orden === "precio-asc") vis.sort(function (a, b) { return num(a, "data-precio") - num(b, "data-precio"); });
      else if (estado.orden === "precio-desc") vis.sort(function (a, b) { return num(b, "data-precio") - num(a, "data-precio"); });
      else if (estado.orden === "nota") vis.sort(function (a, b) { return num(b, "data-nota") - num(a, "data-nota"); });

      todas.forEach(function (c) { c.hidden = true; });
      var corte = Math.min(quiz ? 11 : 12, vis.length);   // 8 + banda + 4 (la tarjeta «Mide tu puesto» ocupa un hueco)
      vis.forEach(function (c, i) {
        c.hidden = false;
        var destino = i < corte ? ga : gb;
        if (c.parentNode !== destino) destino.appendChild(c);
      });
      // Reordena dentro de cada mitad sin sacar los nodos de su sitio.
      vis.forEach(function (c) { c.parentNode.appendChild(c); });

      // Las bandas promocionales vuelven a su hueco (cada 8 tarjetas). Con un
      // filtro puesto se esconden: ahi el listado ya es corto y colocarlas
      // dejaria huecos raros.
      var limpio = estado.grupo === "todos" && !estado.texto.length && estado.tramo === "todos";
      [ga, gb].forEach(function (g) {
        var bandas = $$(".promo", g);
        if (!bandas.length) return;
        if (!limpio) { bandas.forEach(function (b) { b.hidden = true; }); return; }
        var enGrid = $$(".pcard:not([hidden])", g);
        bandas.forEach(function (b, i) {
          b.hidden = false;
          var pos = parseInt(b.getAttribute("data-tras"), 10) || 8;
          var ancla = enGrid[pos * (i + 1) - 1];
          if (ancla && ancla.nextSibling !== b) g.insertBefore(b, ancla.nextSibling);
          else if (!ancla) b.hidden = true;
        });
      });

      // La tarjeta «Mide tu puesto» va tras la 5.ª visible; con filtros o busqueda se esconde.
      if (quiz) {
        var enA = $$(".pcard:not(.pcard-quiz):not([hidden])", ga);
        if (limpio && enA.length >= 5) { quiz.hidden = false; ga.insertBefore(quiz, enA[4].nextSibling); }
        else quiz.hidden = true;
      }
      gb.parentNode.hidden = vis.length < 2;
      if (sinRes) sinRes.hidden = vis.length > 0;
      if (cuenta) {
        cuenta.textContent = vis.length === orig.length
          ? tf("{n} modelos", { n: orig.length })
          : tf("{n} de {t}", { n: vis.length, t: orig.length });
      }
    }

    function marcaChips() {
      $$(".fchip", barra).forEach(function (b) {
        var on = b.getAttribute("data-filtro") === estado.grupo;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
        if (!on || !pista) return;
        var href = b.getAttribute("data-finder");
        if (!href) { pista.hidden = true; return; }
        pista.innerHTML = "";
        var a = document.createElement("a");
        a.className = "btn-ghost";
        a.style.padding = "8px 14px";
        a.href = href;
        a.textContent = b.getAttribute("data-finder-txt") || "";
        pista.appendChild(a);
        pista.hidden = false;
      });
    }

    barra.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".fchip") : null;
      if (!b) return;
      estado.grupo = b.getAttribute("data-filtro");
      marcaChips();
      pinta();
      if (history.replaceState) {
        history.replaceState(null, "", estado.grupo === "todos" ? location.pathname : "#" + estado.grupo);
      }
    });

    if (q) {
      var temp = null;
      q.addEventListener("input", function () {
        clearTimeout(temp);
        temp = setTimeout(function () {
          estado.texto = limpia(q.value).split(/\s+/).filter(Boolean);
          pinta();
        }, 120);
      });
    }
    if (selTramo) selTramo.addEventListener("change", function () { estado.tramo = selTramo.value; pinta(); });
    if (selOrden) selOrden.addEventListener("change", function () { estado.orden = selOrden.value; pinta(); });

    // Las anclas viejas (#sillas, #teclados...) siguen valiendo: activan filtro.
    var hash = (location.hash || "").slice(1);
    if (hash && barra.querySelector('.fchip[data-filtro="' + hash + '"]')) estado.grupo = hash;
    marcaChips();
    pinta();
  }

  /* ---------- boton de ayuda: ErgoBot (/api/bot) y Javier (/api/contacto) ---------- */
  function mountAyuda() {
    var raiz = $("#ayuda");
    if (!raiz) return;
    var panel = $("#ayudaPanel"), btn = $("#ayudaBtn"), chat = $("#ayudaChat"), chips = $("#ayudaChips");
    var vistas = $$(".ayuda-vista", panel), historial = [];
    var idioma = document.documentElement.lang === "en" ? "en" : "es";
    var api = (location.protocol === "http:" && /^(127\.0\.0\.1|localhost)/.test(location.host)) ? "http://127.0.0.1:8787"
      : (/(^|\.)ergonomico\.es$/.test(location.hostname) ? "https://api.ergonomico.es" : "");   // la web va por GitHub Pages; la API, por el Worker
    // Algunas redes (Movistar, 2026-09-16) no llegan a la IP del Worker y la conexión se
    // queda colgada sin error. Con un tiempo máximo, la persona ve enseguida la alternativa.
    function fetchT(url, opts, ms) {
      if (!window.AbortController) return fetch(url, opts);
      var ctl = new AbortController(), id = setTimeout(function () { ctl.abort(); }, ms);
      opts.signal = ctl.signal;
      return fetch(url, opts).then(function (r) { clearTimeout(id); return r; },
                                   function (e) { clearTimeout(id); throw e; });
    }
    function contexto() {
      var c = { pagina: location.pathname, idioma: idioma };
      if (document.body.getAttribute("data-producto")) { c.producto = document.body.getAttribute("data-producto"); c.nombre = document.body.getAttribute("data-nombre"); }
      try { var m = JSON.parse(localStorage.getItem("ergonomiq-medidas") || "null"); if (m) c.medidas = m; } catch (e) {}
      return c;
    }
    function ir(v) {
      vistas.forEach(function (x) { x.hidden = x.getAttribute("data-vista") !== v; });
      $("#ayudaTit").textContent = v === "bot" ? "ErgoBot" : (v === "javier" ? t("Escribir a Javier") : t("Habla con Ergonomi&Co"));
      $("#ayudaSub").textContent = v === "bot" ? t("IA · responde al instante") : (v === "javier" ? t("Persona real · lunes a viernes, 9 a 18 h") : t("Elige con quién quieres hablar"));
      if (v === "bot") { pintaChips(); setTimeout(function () { $("#ayudaTexto").focus(); }, 50); }
    }
    // Sondeo al abrir: si esta conexión no llega al servidor de la API, no hacemos esperar a
    // nadie. El bot se marca como no disponible y Javier pasa directamente al correo.
    var apiOk = null;
    function sondear() {
      if (apiOk !== null || !api) return;
      apiOk = "probando";
      fetchT(api + "/favicon.ico?sonda=" + Date.now(), { mode: "no-cors", cache: "no-store" }, 5000)
        .then(function () { apiOk = true; }, function () { apiOk = false; sinApi(); });
    }
    function sinApi() {
      var opBot = $(".ayuda-op[data-ir='bot']", panel);
      if (opBot) {
        opBot.disabled = true; opBot.classList.add("off");
        var d = $(".ayuda-op-d", opBot);
        if (d) d.textContent = t("No disponible desde tu conexión ahora mismo. Escríbenos por email y te respondemos en persona.");
      }
      form.hidden = true; ok.hidden = true; fallo.hidden = false;
      $("#ayudaMailto").href = mailto({ nombre: "", mensaje: "", contexto: contexto() });
      $("b", fallo).textContent = t("Desde tu conexión no podemos enviar el formulario.");
    }
    function abrir(si) { panel.hidden = !si; btn.setAttribute("aria-expanded", si ? "true" : "false"); if (si) { ir("menu"); sondear(); } }
    btn.addEventListener("click", function () { abrir(panel.hidden); });
    $("#ayudaCerrar").addEventListener("click", function () { abrir(false); });
    raiz.addEventListener("click", function (e) {
      var a = e.target.closest("[data-ir]");
      if (a) { e.preventDefault(); ir(a.getAttribute("data-ir")); }
    });
    // el bot puede enlazar «#javier» para pasar a la persona
    chat.addEventListener("click", function (e) { var a = e.target.closest("a[href='#javier']"); if (a) { e.preventDefault(); ir("javier"); } });

    function pintaChips() {
      var c = contexto(), lista = [];
      if (c.nombre) lista.push(tf("¿Me encaja {n}?", { n: c.nombre }));
      if (c.medidas) lista.push(t("Explícame mi resultado de ErgoCheck"));
      lista = lista.concat([t("¿Qué silla me encaja si mido 1,80?"), t("Compara dos productos"), t("Lumbar activo o regulable, ¿qué diferencia hay?"), t("¿Qué mesa necesito para trabajar de pie?")]);
      chips.innerHTML = "";
      lista.slice(0, 5).forEach(function (txt) {
        var b = document.createElement("button"); b.type = "button"; b.className = "ayuda-chip"; b.textContent = txt;
        b.addEventListener("click", function () { preguntar(txt); });
        chips.appendChild(b);
      });
    }
    function burbuja(texto, quien) {
      var d = document.createElement("div"); d.className = "ayuda-msg " + quien;
      if (quien === "bot") d.innerHTML = enlaces(texto); else d.textContent = texto;
      chat.appendChild(d); chat.scrollTop = chat.scrollHeight; return d;
    }
    function enlaces(txt) {
      var s = txt.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      s = s.replace(/\[([^\]]+)\]\((#javier|[a-z0-9\-]+\.html(?:#[a-z0-9\-]+)?)\)/gi, function (m, t2, u) {
        var pref = u.charAt(0) === "#" ? "" : (document.documentElement.lang === "en" ? "" : "");
        return '<a href="' + pref + u + '">' + t2 + "</a>";
      });
      return s.replace(/\n/g, "<br>");
    }
    function preguntar(texto) {
      texto = (texto || "").trim();
      if (!texto) return;
      chips.hidden = true;
      burbuja(texto, "yo");
      historial.push({ role: "user", content: texto });
      var espera = burbuja("…", "bot"); espera.classList.add("espera");
      fetchT(api + "/api/bot", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mensajes: historial.slice(-12), contexto: contexto() }) }, 25000)
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          espera.remove();
          if (x.ok && x.j.texto) { historial.push({ role: "assistant", content: x.j.texto }); burbuja(x.j.texto, "bot"); }
          else { burbuja((x.j && x.j.error) || t("No he podido responder. Prueba de nuevo o escribe a Javier."), "bot error"); }
        })
        .catch(function () { espera.remove(); burbuja(t("Sin conexión con ErgoBot ahora mismo. Puedes escribir a Javier."), "bot error"); });
    }
    $("#ayudaFormBot").addEventListener("submit", function (e) {
      e.preventDefault(); var i = $("#ayudaTexto"); preguntar(i.value); i.value = "";
    });

    var form = $("#ayudaFormJavier"), ok = $("#ayudaOk"), fallo = $("#ayudaFallo");
    var email = raiz.getAttribute("data-email");
    function mailto(datos) {
      var asunto = "[Web] " + (datos.nombre || "") + (datos.contexto && datos.contexto.nombre ? " · " + datos.contexto.nombre : "");
      var cuerpo = (datos.mensaje || "") + "\n\n" + (datos.contexto && datos.contexto.pagina ? "Página: " + datos.contexto.pagina : "");
      return "mailto:" + email + "?subject=" + encodeURIComponent(asunto) + "&body=" + encodeURIComponent(cuerpo);
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form), datos = { nombre: fd.get("nombre"), email: fd.get("email"), mensaje: fd.get("mensaje"), web: fd.get("web") };
      if (fd.get("contexto")) datos.contexto = contexto();
      var b = form.querySelector("button[type=submit]"); b.disabled = true;
      fetchT(api + "/api/contacto", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(datos) }, 10000)
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          b.disabled = false;
          if (x.ok) { form.hidden = true; ok.hidden = false; return; }
          if (x.j && x.j.codigo) { form.hidden = true; fallo.hidden = false; $("#ayudaMailto").href = mailto(datos); }
          else alert((x.j && x.j.error) || t("No se ha podido enviar."));
        })
        .catch(function () { b.disabled = false; form.hidden = true; fallo.hidden = false; $("#ayudaMailto").href = mailto(datos); });
    });
    $("#ayudaCopiar").addEventListener("click", function () {
      try { navigator.clipboard.writeText(email); this.textContent = t("Copiado"); } catch (e) {}
    });
  }

  /* ---------- galeria de la ficha (miniaturas, flechas, teclado y deslizar) ---------- */
  function mountGaleria() {
    var g = $(".pdp-gal");
    if (!g) return;
    var slides = $$(".pdp-slide", g), thumbs = $$(".pdp-thumb[data-i]"), i = 0;
    function ir(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.hidden = k !== i; });
      thumbs.forEach(function (t, k) { t.classList.toggle("on", k === i); });
    }
    thumbs.forEach(function (t) { t.addEventListener("click", function () { ir(+t.getAttribute("data-i")); }); });
    $(".pdp-nav.prev", g).addEventListener("click", function () { ir(i - 1); });
    $(".pdp-nav.next", g).addEventListener("click", function () { ir(i + 1); });
    document.addEventListener("keydown", function (e) {
      if (e.target.closest && e.target.closest("input,select,textarea")) return;
      if (e.key === "ArrowLeft") ir(i - 1);
      if (e.key === "ArrowRight") ir(i + 1);
    });
    var x0 = null;
    g.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    g.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) ir(dx < 0 ? i + 1 : i - 1);
      x0 = null;
    });
  }

  /* ---------- escena con puntos calientes (movil: pulsar abre) ---------- */
  function mountHotspots() {
    var puntos = $$(".hs");
    if (!puntos.length) return;
    puntos.forEach(function (hs) {
      var btn = $(".hs-punto", hs);
      if (!btn) return;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        var abierto = hs.classList.contains("on");
        puntos.forEach(function (o) { o.classList.remove("on"); });
        if (!abierto) hs.classList.add("on");
        btn.blur();   /* si conserva el foco, la tarjeta se queda pegada */
      });
      /* con ratón: al entrar en otro punto se cierra el que estuviera abierto (el de la silla
         sale abierto al cargar); al salir se cierra aunque se haya pulsado */
      hs.addEventListener("mouseenter", function () { puntos.forEach(function (o) { if (o !== hs) o.classList.remove("on"); }); });
      hs.addEventListener("mouseleave", function () { hs.classList.remove("on"); });
    });
    document.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest(".hs")) return;
      puntos.forEach(function (o) { o.classList.remove("on"); });
    });
  }

  /* ================= CESTA =================
     Maqueta final del flujo de compra, pensada para portarse a Shopify.
     Se guarda en el navegador ({id: unidades}) y cada canal tiene su salida:
       propio -> checkout nuestro (Shopify)   ·  espera a DB.tiendaUrl
       amazon -> enlace add-to-cart de Amazon con todos los ASIN y el tag
       marca  -> web del fabricante, producto a producto
     Sin tag ni ASIN (hoy: 7 de 43) la salida de Amazon cae a enlace por
     producto, que es lo que ya hace la ficha. */
  var CESTA_KEY = "ergonomico-cesta";

  function getCesta() {
    try {
      var c = JSON.parse(localStorage.getItem(CESTA_KEY) || "{}");
      return (c && typeof c === "object") ? c : {};
    } catch (e) { return {}; }
  }
  function setCesta(c) {
    try { localStorage.setItem(CESTA_KEY, JSON.stringify(c)); } catch (e) {}
    pintaCuenta();
    document.dispatchEvent(new CustomEvent("cesta:cambio"));
  }
  function unidades(c) {
    return Object.keys(c).reduce(function (n, k) { return n + (c[k] || 0); }, 0);
  }
  function pintaCuenta() {
    var el = $("#cestaCuenta");
    if (!el) return;
    var n = unidades(getCesta());
    el.textContent = n;
    el.hidden = n === 0;
  }
  function eur(n) {
    return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 }).format(n) + " €";
  }

  var _avisoT = null;
  function avisoCesta(nombre, uds) {
    var caja = $("#avisoCesta");
    if (!caja) {
      caja = document.createElement("div");
      caja.id = "avisoCesta";
      caja.className = "aviso-cesta";
      caja.setAttribute("role", "status");
      document.body.appendChild(caja);
    }
    caja.innerHTML =
      '<span class="ac-ok">&#10003;</span>' +
      "<span><b>" + escHTML(nombre) + "</b>" +
      "<span>" + tf("En tu cesta: {n}", { n: uds }) + "</span></span>" +
      '<a class="ac-ver" href="cesta.html">' + t("Ver cesta") + "</a>";
    caja.classList.add("vis");
    clearTimeout(_avisoT);
    _avisoT = setTimeout(function () { caja.classList.remove("vis"); }, 3200);
  }

  function mountCesta() {
    pintaCuenta();
    document.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-add]") : null;
      if (!b) return;
      e.preventDefault();
      var id = b.getAttribute("data-add");
      var c = getCesta();
      c[id] = (c[id] || 0) + 1;
      setCesta(c);
      b.classList.add("puesto");
      setTimeout(function () { b.classList.remove("puesto"); }, 1200);
      miniCesta(true);   /* el popup sustituye al aviso de la esquina */
    });
    document.addEventListener("click", function (e) {
      var l = e.target.closest ? e.target.closest(".cesta-link") : null;
      var mc = $("#miniCesta");
      /* La pastilla «Cesta» siempre lleva a cesta.html (usuario, 2026-09-14); el popup
         solo se abre al añadir un producto. */
      if (l) return;
      if (e.target.closest && e.target.closest("[data-add]")) return;   /* ese clic es el que lo abre */
      if (mc && mc.classList.contains("vis") && !e.target.closest("#miniCesta")) miniCesta(false);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") miniCesta(false); });
    /* Hover sobre la pastilla «Cesta»: se abre el popup si hay algo dentro y se
       cierra al salir del conjunto pastilla + popup (usuario, 2026-09-14). */
    var link = $(".cesta-link");
    if (link && window.matchMedia("(hover: hover)").matches) {
      var cierreT = null;
      function abreHover() { clearTimeout(cierreT); if (unidades(getCesta()) > 0) miniCesta(true, true); }
      function cierraHover() { clearTimeout(cierreT); cierreT = setTimeout(function () { miniCesta(false); }, 250); }
      link.addEventListener("mouseenter", abreHover);
      link.addEventListener("mouseleave", cierraHover);
      document.addEventListener("mouseover", function (e) {
        var mc = $("#miniCesta");
        if (mc && e.target.closest && e.target.closest("#miniCesta")) clearTimeout(cierreT);
      });
      document.addEventListener("mouseout", function (e) {
        var mc = $("#miniCesta");
        if (mc && e.target.closest && e.target.closest("#miniCesta") && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest("#miniCesta, .cesta-link"))) cierraHover();
      });
    }
  }

  /* ---------- popup de la cesta (pedido por el usuario 2026-09-13) ----------
     Al añadir un producto se abre bajo el icono de la cesta con lo que hay
     dentro, el total y «Comprar ya». Se cierra con la X, Escape o clic fuera. */
  var _miniT = null;
  function miniCesta(abrir, porHover) {
    var link = $(".cesta-link");
    var mc = $("#miniCesta");
    if (!mc) {
      mc = document.createElement("div");
      mc.id = "miniCesta";
      mc.className = "mini-cesta";
      mc.setAttribute("role", "dialog");
      mc.setAttribute("aria-label", t("Tu cesta"));
      (link && link.parentNode ? link.parentNode : document.body).appendChild(mc);
    }
    if (!abrir) { mc.classList.remove("vis"); clearTimeout(_miniT); return; }
    var c = getCesta(), filas = "", total = 0, n = 0;
    Object.keys(c).forEach(function (id) {
      var p = byId(id); if (!p || !c[id]) return;
      var precio = p.discountedPrice || p.retailPrice || 0;
      total += precio * c[id]; n += c[id];
      filas += '<div class="mc-fila">' +
        '<a class="mc-nom" href="' + APX + id + '.html">' + escHTML(p.name) + '</a>' +
        '<span class="mc-uds">&times;' + c[id] + '</span>' +
        (window.SIN_PRECIOS ? '' : '<span class="mc-precio">' + eur(precio * c[id]) + '</span>') +
        '<button type="button" class="mc-quitar" data-quitar="' + id + '" aria-label="' + t("Quitar") + '">&times;</button></div>';
    });
    mc.innerHTML =
      '<div class="mc-head"><b>' + t("Tu cesta") + '</b><span>' + tf("{n} uds.", { n: n }) + '</span>' +
      '<button type="button" class="mc-cerrar" aria-label="' + t("Cerrar") + '">&times;</button></div>' +
      '<div class="mc-lista">' + filas + '</div>' +
      (window.SIN_PRECIOS ? '' : '<div class="mc-total"><span>' + t("Total") + '</span><b>' + eur(total) + '</b></div>') +
      '<a class="btn-buy mc-comprar" href="cesta.html">' + t("Comprar ya") + '</a>' +
      '<button type="button" class="mc-seguir">' + t("Seguir mirando") + '</button>';
    mc.classList.add("vis");
    mc.querySelector(".mc-cerrar").onclick = function () { miniCesta(false); };
    mc.querySelector(".mc-seguir").onclick = function () { miniCesta(false); };
    Array.prototype.forEach.call(mc.querySelectorAll("[data-quitar]"), function (b) {
      b.onclick = function () {
        var cc = getCesta(); delete cc[b.getAttribute("data-quitar")]; setCesta(cc);
        if (unidades(cc) === 0) miniCesta(false); else miniCesta(true);
      };
    });
    clearTimeout(_miniT);
    if (!porHover) _miniT = setTimeout(function () { if (!mc.matches(":hover")) miniCesta(false); }, 6000);
  }

  /* ---------- pagina de la cesta ---------- */
  function mountPaginaCesta() {
    var cols = $("#cestaCols"), lineas = $("#cestaLineas"), vacia = $("#cestaVacia");
    if (!cols || !lineas) return;

    function pinta() {
      var c = getCesta();
      var items = Object.keys(c).map(function (id) {
        var p = byId(id);
        return p ? { p: p, uds: c[id] } : null;
      }).filter(Boolean);

      vacia.hidden = items.length > 0;
      cols.hidden = items.length === 0;
      lineas.innerHTML = "";          // vaciar SIEMPRE, tambien al quedarse a cero
      if (!items.length) return;

      var total = 0, uds = 0;
      items.forEach(function (it) {
        var precio = it.p.precio || it.p.retailPrice || 0;
        total += precio * it.uds;
        uds += it.uds;
        var fila = document.createElement("div");
        fila.className = "cesta-linea";
        var plano = (window.__PLANOS__ || {})[it.p.id] || "";
        fila.innerHTML =
          '<a class="cl-foto" href="' + it.p.id + '.html" aria-hidden="true" tabindex="-1">' +
            plano + "</a>" +
          '<a class="cl-nom" href="' + it.p.id + '.html">' + escHTML(it.p.name) + "</a>" +
          '<span class="cl-marca">' + escHTML(it.p.marca) + " · " + escHTML(canalTxt(it.p)) + "</span>" +
          '<span class="cl-uds">' +
            '<button class="cl-btn" data-menos="' + it.p.id + '" aria-label="' + t("Quitar una unidad") + '">-</button>' +
            "<b>" + it.uds + "</b>" +
            '<button class="cl-btn" data-mas="' + it.p.id + '" aria-label="' + t("Añadir una unidad") + '">+</button>' +
          "</span>" +
          '<span class="cl-precio">' + eur(precio * it.uds) + "</span>" +
          (it.p.canal === "propio" ? "" :
            '<a class="cl-comprar" href="' + (it.p.affiliate_url || (it.p.canal === "amazon" && it.p.asin ? "https://www.amazon.es/dp/" + it.p.asin + AMZ_TAG : "") || it.p.marca_url ||
              ("https://www.amazon.es/s?k=" + encodeURIComponent(it.p.name) + AMZ_TAG.replace("?", "&"))) +
              '" target="_blank" rel="sponsored nofollow noopener">' +
              (it.p.canal === "amazon" ? tf("Comprar en {donde}", { donde: "Amazon" })
                                       : tf("Comprar en {donde}", { donde: it.p.marca })) + "</a>") +
          '<button class="cl-quitar" data-quitar="' + it.p.id + '">' + t("Quitar") + "</button>";
        lineas.appendChild(fila);
      });
      $("#cestaUds").textContent = uds;
      if ($("#cestaTotal")) $("#cestaTotal").textContent = eur(total);
      pintaSalidas(items);
    }

    function canalTxt(p) {
      if (p.canal === "propio") return t("Vendido por Ergonomi&Co");
      if (p.canal === "amazon") return t("Se compra en Amazon");
      return t("Se compra en la web de la marca");
    }

    function pintaSalidas(items) {
      var caja = $("#cestaSalidas");
      caja.innerHTML = "";
      var tag = DB.amazonTag || "";
      var tienda = DB.tiendaUrl || "";

      var propios = items.filter(function (i) { return i.p.canal === "propio"; });
      var amazon = items.filter(function (i) { return i.p.canal === "amazon"; });
      var marca = items.filter(function (i) { return i.p.canal !== "propio" && i.p.canal !== "amazon"; });

      if (propios.length) {
        var a = document.createElement("a");
        a.className = "btn-buy grande";
        if (tienda) {
          a.href = tienda;
          a.textContent = t("Tramitar pedido") + " (" + propios.length + ")";
        } else {
          a.href = "#";
          a.className += " off";
          a.setAttribute("aria-disabled", "true");
          a.textContent = t("Tienda propia todavía no abierta");
        }
        caja.appendChild(a);
      }

      if (amazon.length) {
        var conAsin = amazon.filter(function (i) { return i.p.asin; });
        if (conAsin.length === amazon.length && tag) {
          var url = "https://www.amazon.es/gp/aws/cart/add.html?AssociateTag=" + encodeURIComponent(tag);
          conAsin.forEach(function (i, k) {
            url += "&ASIN." + (k + 1) + "=" + encodeURIComponent(i.p.asin) +
                   "&Quantity." + (k + 1) + "=" + i.uds;
          });
          caja.appendChild(salida(url, t("Comprar en Amazon") + " (" + amazon.length + ")", "btn-buy grande"));
        } else {
          var aviso = document.createElement("p");
          aviso.className = "cesta-aviso";
          aviso.textContent = t("Estos se compran en Amazon, uno a uno (aún no tenemos el enlace de cesta conjunta):");
          caja.appendChild(aviso);
          amazon.forEach(function (i) {
            caja.appendChild(salida(i.p.affiliate_url || (i.p.asin ? "https://www.amazon.es/dp/" + i.p.asin + AMZ_TAG : "https://www.amazon.es/s?k=" + encodeURIComponent(i.p.name) + AMZ_TAG.replace("?", "&")),
                                    tf("Comprar en {donde}", { donde: "Amazon" }), "btn-ghost fila"));
          });
        }
      }

      marca.forEach(function (i) {
        caja.appendChild(salida(i.p.marca_url || ("https://www.amazon.es/s?k=" + encodeURIComponent(i.p.name) + AMZ_TAG.replace("?", "&")),
                                tf("Comprar en {donde}", { donde: i.p.marca }), "btn-ghost fila"));
      });
    }

    function salida(href, txt, clase) {
      var a = document.createElement("a");
      a.className = clase;
      a.href = href;
      a.target = "_blank";
      a.rel = "sponsored nofollow noopener";
      a.textContent = txt;
      return a;
    }

    lineas.addEventListener("click", function (e) {
      var el = e.target.closest ? e.target.closest("[data-mas],[data-menos],[data-quitar]") : null;
      if (!el) return;
      var c = getCesta();
      var mas = el.getAttribute("data-mas"), menos = el.getAttribute("data-menos"),
          quitar = el.getAttribute("data-quitar");
      if (mas) c[mas] = (c[mas] || 0) + 1;
      if (menos) { c[menos] = (c[menos] || 0) - 1; if (c[menos] < 1) delete c[menos]; }
      if (quitar) delete c[quitar];
      setCesta(c);
      pinta();
    });

    document.addEventListener("cesta:cambio", pintaCuenta);
    pinta();
  }

  /* ---------- panel de filtros de las paginas de categoria ----------
     Los antiguos finders, como panel lateral: medidas de la categoria + orden +
     precio + marca. Filtra y reordena las tarjetas ya pintadas por el generador. */
  function mountFiltrosCategoria() {
    var panel = $("[data-cat-filtros]"), grid = $("#pgrid-cat"), grid2 = $("#pgrid-cat-2");
    if (!panel || !grid) return;
    var clave = panel.getAttribute("data-cat-filtros");
    var cards = $$(".pcard", grid).concat(grid2 ? $$(".pcard", grid2) : []);
    var res = $("#cfResultados"), pill = $("#cfPill"), busca = $("#cfMarcaBusca");

    function num(sel) {
      var el = $(sel);
      if (!el) return null;
      var v = parseFloat(String(el.value).replace(",", "."));
      return isNaN(v) ? null : v;
    }
    function val(sel) { var el = $(sel); return el ? el.value : ""; }

    function leerMedidas() {
      var m = medidas() || {};
      if (num("#cfH")) m.h = num("#cfH");
      if (num("#cfP")) m.peso = num("#cfP");
      if (num("#cfHoras")) m.horas = num("#cfHoras");
      if (num("#cfMesa")) m.mesa = num("#cfMesa");
      if ($("#cfCambios")) m.cambios = val("#cfCambios") === "si";
      if (num("#cfMano")) m.mano = num("#cfMano");
      if ($("#cfLado")) m.lado = val("#cfLado");
      if (m.h || m.mano) { try { localStorage.setItem("ergonomiq-medidas", JSON.stringify(m)); } catch (e) {} }
      return m;
    }
    function pintarPill(m) {
      if (!pill) return;
      var txt = "";
      if (clave === "silla" && m.h) txt = tf("Tu asiento ideal: {n} cm", { n: Math.round(m.h * 0.25) });
      else if (clave === "escritorio" && m.h) txt = tf("Sentado {a} cm · de pie {b} cm", { a: Math.round(m.h * 0.43), b: Math.round(m.h * 0.62) });
      else if (clave === "convertidor" && m.h) {
        var pie = Math.round(m.h * 0.62), mesa = m.mesa || 75;
        txt = tf("Necesitas subir {n} cm sobre tu mesa de {m} cm", { n: Math.max(0, pie - mesa), m: mesa });
      } else if (clave === "raton" && m.mano) txt = tf("Tu talla de mano: {t} ({n} cm)", { t: tallaMano(m.mano), n: m.mano });
      pill.textContent = txt;
      pill.hidden = !txt;
    }
    function aplicar() {
      var m = leerMedidas();
      pintarPill(m);
      safe(mountFitBadges, "fitBadges");
      var pmin = num("#cfMin"), pmax = num("#cfMax");
      var marcas = $$("input[name=cfMarca]:checked", panel).map(function (i) { return i.value; });
      var tipo = val("#cfTipo"), inal = val("#cfInal"), motor = val("#cfMotor");
      function marcado(sel) { var el = $(sel); return !!(el && el.checked); }
      var soloOferta = marcado("#cfOferta"), soloAmazon = marcado("#cfAmazon"), lumbarReg = marcado("#cfLumbarReg");
      var en1335 = marcado("#cfEN1335"), conMemorias = marcado("#cfMemorias"), zurdos = marcado("#cfZurdos");
      var garantiaMin = num("#cfGarantia") || 0;
      var orden = val("#cfOrden") || "ajuste";
      var vis = [], ocultas = [];
      cards.forEach(function (c) {
        var precio = parseFloat(c.getAttribute("data-precio")) || 0, ok = true;
        if (pmin !== null && precio < pmin) ok = false;
        if (pmax !== null && precio > pmax) ok = false;
        if (marcas.length && marcas.indexOf(c.getAttribute("data-marca")) < 0) ok = false;
        if (tipo && c.getAttribute("data-tipo") !== tipo) ok = false;
        if (inal && c.getAttribute("data-inal") !== inal) ok = false;
        if (motor && c.getAttribute("data-motor") !== motor) ok = false;
        if (soloOferta && c.getAttribute("data-oferta") !== "1") ok = false;
        if (soloAmazon && c.getAttribute("data-canal") !== "amazon") ok = false;
        if (lumbarReg && ["regulable", "activa"].indexOf(c.getAttribute("data-lumbar")) < 0) ok = false;
        if (en1335 && c.getAttribute("data-en1335") !== "1") ok = false;
        if (conMemorias && !(parseInt(c.getAttribute("data-memorias"), 10) > 0)) ok = false;
        if (zurdos && c.getAttribute("data-zurdos") !== "1") ok = false;
        if (garantiaMin && (parseFloat(c.getAttribute("data-garantia")) || 0) < garantiaMin) ok = false;
        c.hidden = !ok;
        (ok ? vis : ocultas).push(c);
      });
      function clave_orden(c) {
        var fit = parseFloat(c.getAttribute("data-fit-score"));
        var nota = parseFloat(c.getAttribute("data-nota")) || 0;
        var precio = parseFloat(c.getAttribute("data-precio")) || 0;
        if (orden === "precio-asc") return precio;
        if (orden === "precio-desc") return -precio;
        if (orden === "nota") return -nota;
        return isNaN(fit) ? -nota : -(fit * 1000 + nota);
      }
      vis.sort(function (a, b) { return clave_orden(a) - clave_orden(b); });
      vis.forEach(function (c, i) { ((i < 8 || !grid2) ? grid : grid2).appendChild(c); });
      ocultas.forEach(function (c) { (grid2 || grid).appendChild(c); });
      if (res) res.textContent = vis.length
        ? tf("Resultados — {n} modelos con tus filtros", { n: vis.length })
        : t("Ningún producto encuentra eso. Prueba con menos filtros.");
    }

    var m0 = medidas() || {};
    [["#cfH", "h"], ["#cfP", "peso"], ["#cfHoras", "horas"], ["#cfMesa", "mesa"], ["#cfMano", "mano"], ["#cfLado", "lado"]]
      .forEach(function (par) { var el = $(par[0]); if (el && m0[par[1]]) el.value = m0[par[1]]; });
    if ($("#cfCambios") && m0.cambios) $("#cfCambios").value = "si";
    if (busca) busca.addEventListener("input", function () {
      var q = busca.value.toLowerCase();
      $$(".cf-marca", panel).forEach(function (l) { l.hidden = !!q && l.textContent.toLowerCase().indexOf(q) < 0; });
    });
    panel.addEventListener("input", function (e) { if (e.target !== busca) aplicar(); });
    panel.addEventListener("change", function (e) { if (e.target !== busca) aplicar(); });
    aplicar();
  }

  function boot() {
    safe(mountFiltrosCategoria, "filtrosCategoria");
    safe(mountCesta, "cesta");
    safe(mountPaginaCesta, "paginaCesta");
    safe(mountFitBadges, "fitBadges");
    safe(mountFiltroCatalogo, "filtroCatalogo");
    safe(mountHotspots, "hotspots");
    safe(mountGaleria, "galeria");
    safe(mountAyuda, "ayuda");
    safe(mountScrollspy, "scrollspy");
    safe(mountCountUp, "countUp");
    safe(mountCmpButtons, "cmpButtons");
    safe(mountComparador, "comparador");
    safe(mountReveals, "reveals");
    document.documentElement.classList.add("is-ready");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

/* Carrusel del hero («Lo más vendido»): un producto por vista, flechas junto al
   precio, paso automático cada data-auto ms (pausa al pasar el ratón o tocar). */
(function(){
  var carruseles = document.querySelectorAll("[data-carrusel]");
  Array.prototype.forEach.call(carruseles, function(c){
    var t = c.querySelector(".hc-track"), slides = t.querySelectorAll(".hc-slide"), pos = c.querySelector("[data-pos]");
    var n = slides.length, i = 0, timer = null, auto = parseInt(c.getAttribute("data-auto") || "0", 10);
    if(n < 2) return;
    function ir(k){
      i = (k + n) % n;
      t.scrollTo({left: slides[i].offsetLeft - t.offsetLeft, behavior: "smooth"});
      if(pos) pos.textContent = (i + 1) + " / " + n;
    }
    function arranca(){ if(auto > 0 && !timer) timer = setInterval(function(){ ir(i + 1); }, auto); }
    function para(){ if(timer){ clearInterval(timer); timer = null; } }
    c.addEventListener("click", function(e){
      var b = e.target.closest ? e.target.closest("[data-carr]") : null;
      if(!b) return;
      e.preventDefault(); para(); ir(i + parseInt(b.getAttribute("data-carr"), 10)); arranca();
    });
    c.addEventListener("mouseenter", para); c.addEventListener("mouseleave", arranca);
    c.addEventListener("touchstart", para, {passive:true}); c.addEventListener("touchend", arranca, {passive:true});
    t.addEventListener("scroll", function(){
      var k = Math.round(t.scrollLeft / (slides[0].getBoundingClientRect().width + 12));
      if(k !== i && k >= 0 && k < n){ i = k; if(pos) pos.textContent = (i + 1) + " / " + n; }
    }, {passive:true});
    arranca();
  });
})();
