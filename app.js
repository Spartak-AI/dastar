(() => {
  window.DASTAR_OK = true;
  const S = window.SITE || {};
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const celular = matchMedia("(max-width: 760px)").matches;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const tenge = (v) => Math.round(v).toLocaleString("ru-RU").replace(/,/g, " ") + " ₸";

  /* ── Цепочка: прокрутка → кадр ролика, с кадрами покоя ──────────── */
  const cine = document.querySelector(".cine");
  const canvas = cine && cine.querySelector(".cine-canvas");
  if (cine && canvas && S.frames && S.frames.total) {
    const ctx = canvas.getContext("2d");
    const total = S.frames.total;
    const paradas = S.frames.paradas || [0, total - 1];
    const padrao = celular ? S.frames.mobile : S.frames.desktop;
    const src = (i) => padrao.replace("{n}", String(i + 1).padStart(4, "0"));
    const quadros = new Array(total);
    const etapas = [...cine.querySelectorAll(".etapa")];
    const barra = cine.querySelector(".cine-barra i");
    let atual = 0, desenhado = -1;

    // Доля прокрутки: стоянка на каждой главе (HOLD) и переход между ними,
    // переход получает место пропорционально своей длине в кадрах — скорость ровная.
    const HOLD = 0.08, n = paradas.length;
    const resto = 1 - HOLD * n;
    const comp = paradas.slice(1).map((p, k) => p - paradas[k]);
    const soma = comp.reduce((a, b) => a + b, 0);
    const TRANS = comp.map((c) => (resto * c) / soma);
    const progressoParaQuadro = (p) => {
      let t = 0;
      for (let k = 0; k < n; k++) {
        if (p <= t + HOLD) return { f: paradas[k], cap: k };
        t += HOLD;
        if (k === n - 1) break;
        if (p <= t + TRANS[k]) {
          const u = (p - t) / TRANS[k];
          return { f: paradas[k] + (paradas[k + 1] - paradas[k]) * u, cap: u < 0.5 ? k : k + 1 };
        }
        t += TRANS[k];
      }
      return { f: paradas[n - 1], cap: n - 1 };
    };

    const carregar = (i) => {
      if (quadros[i]) return quadros[i];
      const img = new Image();
      img.decoding = "async";
      img.src = src(i);
      img.onload = () => { if (Math.round(atual) === i || desenhado === -1) desenhar(i, true); };
      return (quadros[i] = img);
    };

    // Сначала кадры покоя, потом весь ролик проходами (через 8, 4, 2, 1)
    paradas.forEach(carregar);
    if (!reduzir) {
      const fila = [];
      for (const passo of [8, 4, 2, 1]) for (let i = 0; i < total; i += passo) if (!fila.includes(i)) fila.push(i);
      let k = 0;
      const lote = () => { for (let m = 0; m < 6 && k < fila.length; m++) carregar(fila[k++]); if (k < fila.length) setTimeout(lote, 40); };
      lote();
    }

    const pronto = (i) => quadros[i] && quadros[i].complete && quadros[i].naturalWidth;
    const maisProximo = (i) => {
      for (let d = 0; d < total; d++) {
        if (pronto(i - d)) return i - d;
        if (pronto(i + d)) return i + d;
      }
      return -1;
    };

    function desenhar(i, forcar) {
      const j = maisProximo(i);
      if (j < 0 || (j === desenhado && !forcar)) return;
      const img = quadros[j];
      const cw = canvas.width, ch = canvas.height;
      const escala = Math.max(cw / img.naturalWidth, ch / img.naturalHeight); // "cover"
      const w = img.naturalWidth * escala, h = img.naturalHeight * escala;
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      desenhado = j;
    }

    const ajustar = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      desenhado = -1;
      desenhar(Math.round(atual), true);
    };

    const progresso = () => {
      const r = cine.getBoundingClientRect();
      const curso = cine.offsetHeight - innerHeight;
      return Math.min(1, Math.max(0, -r.top / (curso || 1)));
    };

    let capAtivo = -1;
    const atualizarTexto = (p, cap) => {
      if (cap !== capAtivo) {
        etapas.forEach((e, k) => e.classList.toggle("ativo", k === cap));
        capAtivo = cap;
      }
      cine.classList.toggle("fim", p > 0.97);
      if (barra) barra.style.transform = `scaleX(${p.toFixed(4)})`;
    };

    const quadro = () => {
      const p = progresso();
      const { f, cap } = progressoParaQuadro(p);
      atual += (f - atual) * 0.2; // мягко догоняет: ощущение фильма, а не слайдов
      if (Math.abs(f - atual) < 0.05) atual = f;
      desenhar(Math.round(atual));
      atualizarTexto(p, cap);
      requestAnimationFrame(quadro);
    };

    // Без анимаций: только кадры покоя, по главе
    const semMovimento = () => {
      const p = progresso();
      const { cap } = progressoParaQuadro(p);
      atual = paradas[cap];
      desenhar(atual, true);
      atualizarTexto(p, cap);
    };

    addEventListener("resize", ajustar);
    ajustar();
    if (reduzir) { addEventListener("scroll", semMovimento, { passive: true }); semMovimento(); }
    else requestAnimationFrame(quadro);
  }

  /* ── Шапка, кнопка WhatsApp, появление секций ─────────────────────── */
  const topo = document.querySelector(".topo");
  const whatsBtn = document.querySelector(".whats");
  const formsVisiveis = new Set(); // плавающая кнопка прячется, чтобы не закрывать «Отправить»
  const aoRolar = () => {
    topo && topo.classList.toggle("rolou", cine ? cine.getBoundingClientRect().bottom < 120 : scrollY > 40);
    const depoisDoFilme = cine ? cine.getBoundingClientRect().bottom < innerHeight * 0.9 : scrollY > innerHeight * 0.6;
    whatsBtn && whatsBtn.classList.toggle("visivel", depoisDoFilme && formsVisiveis.size === 0);
  };
  const ioForm = new IntersectionObserver((es) => {
    es.forEach((e) => (e.isIntersecting ? formsVisiveis.add(e.target) : formsVisiveis.delete(e.target)));
    aoRolar();
  }, { rootMargin: "0px 0px -35% 0px" });
  if (celular) document.querySelectorAll(".js-form, .calc-envio").forEach((f) => ioForm.observe(f));
  addEventListener("scroll", aoRolar, { passive: true });
  aoRolar();

  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visto"); io.unobserve(e.target); }
  }), { threshold: 0.08 });
  document.querySelectorAll(".revelar").forEach((el) => io.observe(el));
  document.querySelectorAll("[data-ano]").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ── WhatsApp: все кнопки ведут на номер из config.js ────────────── */
  const num = String((S.whatsapp && S.whatsapp.numero) || "").replace(/\D/g, "");
  const msg = (S.whatsapp && S.whatsapp.mensagem) || "";
  const wa = (texto) => `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
  document.querySelectorAll(".js-whats").forEach((a) => {
    a.href = wa(a.dataset.texto ? `${msg}\n\n${a.dataset.texto}` : msg);
    a.target = "_blank";
    a.rel = "noopener";
  });

  const telOk = (v) => v.replace(/\D/g, "").length >= 10;
  const validar = (raiz) => {
    let ok = true;
    raiz.querySelectorAll("[required]").forEach((c) => {
      const valido = c.type === "tel" ? telOk(c.value) : c.value.trim().length > 1;
      c.closest(".campo").classList.toggle("erro", !valido);
      if (!valido) ok = false;
    });
    return ok;
  };

  /* ── Формы (каталог, консультация) → WhatsApp ─────────────────────── */
  const ASSUNTO = {
    catalogo: "Пришлите, пожалуйста, каталог кухонь 2026",
    contato: "Хочу бесплатную консультацию по кухне",
  };
  document.querySelectorAll(".js-form").forEach((f) => {
    const status = f.querySelector(".form-status");
    f.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!validar(f)) { status.textContent = "Проверьте номер телефона."; return; }
      const d = Object.fromEntries(new FormData(f));
      const linhas = [ASSUNTO[f.dataset.tipo] || ""];
      if (d.nome) linhas.push(`Имя: ${d.nome}`);
      linhas.push(`Телефон: ${d.tel}`);
      window.open(wa(`${msg}\n\n${linhas.join("\n")}`), "_blank", "noopener");
      status.textContent = "Открываем WhatsApp — отправьте сообщение там.";
    });
  });

  /* ── Окно: закрыть по фону и крестику ─────────────────────────────── */
  document.querySelectorAll("dialog.modal").forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-fechar]")) d.close(); });
  });

  /* ── Проекты: карточки → окно с фото, материалами и ценой ─────────── */
  const P = window.PROJETOS || [];
  const VISIVEIS = 6;
  const grade = document.querySelector(".projetos");
  const dlg = document.getElementById("projeto");
  if (grade && dlg) {
    grade.innerHTML = P.map((p, i) => `
      <figure class="pcard${i >= VISIVEIS ? " oculto" : ""}" tabindex="0" role="button" data-i="${i}" aria-label="Проект «${esc(p.nome)}»">
        <img src="assets/img/${p.id}_m.webp" alt="Кухня «${esc(p.nome)}»: ${esc(p.forma.toLowerCase())}, ${esc(p.fasad.toLowerCase())}" loading="lazy" width="700" height="387">
        <span class="pcard-area">${p.area} м²</span>
        <figcaption><div><b>${esc(p.nome)}</b><small>${esc(p.forma)}</small></div><span class="pcard-preco">от ${tenge(p.preco)}</span></figcaption>
      </figure>`).join("");

    const q = (s) => dlg.querySelector(s);
    const abrirProjeto = (i) => {
      const p = P[i];
      if (!p) return;
      q(".pj-foto").src = `assets/img/${p.id}.webp`;
      q(".pj-foto").alt = `Кухня «${p.nome}»`;
      q(".pj-bairro").textContent = `Алматы · ${p.bairro}`;
      q("#pj-nome").textContent = p.nome;
      q(".pj-texto").textContent = p.texto;
      q(".pj-dados").innerHTML = [
        ["Форма", p.forma], ["Площадь кухни", `${p.area} м²`], ["Фасады", p.fasad], ["Столешница", p.tampo],
      ].map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")
        + `<div class="preco" style="grid-column:1/-1"><dt>Стоимость</dt><dd>от ${tenge(p.preco)}</dd></div>`;
      q(".pj-whats").href = wa(`${msg}\n\nХочу похожую кухню, как «${p.nome}» (${p.forma.toLowerCase()}, ${p.area} м²).`);
      dlg.showModal();
      dlg.scrollTop = 0;
    };
    const abrir = (el) => el && abrirProjeto(+el.dataset.i);
    grade.addEventListener("click", (e) => abrir(e.target.closest(".pcard")));
    grade.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); abrir(e.target.closest(".pcard")); }
    });
    // Наведение — заранее грузим большое фото
    grade.addEventListener("pointerover", (e) => {
      const c = e.target.closest(".pcard");
      if (c && !c._pre) { c._pre = 1; const im = new Image(); im.src = `assets/img/${P[+c.dataset.i].id}.webp`; }
    });

    const todos = document.querySelector(".js-todos");
    if (todos) todos.addEventListener("click", () => {
      grade.querySelectorAll(".oculto").forEach((c) => c.classList.remove("oculto"));
      todos.closest(".todos").hidden = true;
    });
    if (P.length <= VISIVEIS) document.querySelector(".todos").hidden = true;
  }

  /* ── Калькулятор ──────────────────────────────────────────────────── */
  const calc = document.querySelector(".calc-form");
  if (calc) {
    const BASE = 210000;      // ₸ за погонный метр нижних модулей, ЛДСП (демо)
    const ILHA = 290000;      // ₸ за погонный метр острова, ЛДСП (демо)
    const LADOS = { "Прямая": ["a"], "Угловая": ["a", "b"], "П-образная": ["a", "b", "c"], "С островом": ["a", "i"] };
    const NOME_LADO = { a: "А", b: "Б", c: "В", i: "остров" };
    const precoEl = calc.querySelector(".calc-preco");
    const metrosEl = calc.querySelector(".calc-metros");
    const status = calc.querySelector(".form-status");
    const val = (nome) => {
      const el = calc.elements[nome];
      const v = parseFloat(String(el.value).replace(",", "."));
      return isFinite(v) && v > 0 ? Math.min(v, +el.max || 99) : 0;
    };
    const estado = () => {
      const forma = calc.elements.forma.value;
      const lados = LADOS[forma];
      const fas = calc.querySelector('input[name="fasad"]:checked');
      const tam = calc.querySelector('input[name="tampo"]:checked');
      const k = +fas.dataset.k, m = +tam.dataset.m;
      const topoOn = calc.elements.topo.checked;
      const parede = lados.filter((l) => l !== "i").reduce((s, l) => s + val(l), 0);
      const ilha = lados.includes("i") ? val("i") : 0;
      const total = parede * (BASE * k * (topoOn ? 1.55 : 1) + m) + ilha * (ILHA * k + m * 1.4);
      return { forma, lados, parede, ilha, total, fasad: fas.value, tampo: tam.value, topoOn };
    };
    const atualizar = () => {
      const e = estado();
      calc.querySelectorAll("[data-lado]").forEach((c) => (c.hidden = !e.lados.includes(c.dataset.lado)));
      metrosEl.textContent = `${(e.parede + e.ilha).toFixed(1).replace(".", ",")} м`;
      if (!e.total) { precoEl.textContent = "—"; return; }
      const de = Math.round(e.total / 10000) * 10000;
      const ate = Math.round((e.total * 1.15) / 10000) * 10000;
      precoEl.textContent = `${tenge(de)} – ${tenge(ate)}`;
    };
    calc.addEventListener("input", atualizar);
    calc.addEventListener("change", atualizar);
    calc.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!validar(calc.querySelector(".calc-envio"))) { status.textContent = "Укажите номер телефона, чтобы получить расчёт."; return; }
      const e = estado();
      const medidas = e.lados.map((l) => `${NOME_LADO[l]} ${val(l)} м`).join(", ");
      const linhas = [
        "Расчёт кухни с сайта:",
        `Форма: ${e.forma}`, `Размеры: ${medidas}`, `Фасады: ${e.fasad}`, `Столешница: ${e.tampo}`,
        `Верхние шкафы: ${e.topoOn ? "да" : "нет"}`, `Предварительно: ${precoEl.textContent}`,
        `Телефон: ${calc.elements.tel.value}`,
      ];
      window.open(wa(`${msg}\n\n${linhas.join("\n")}`), "_blank", "noopener");
      status.textContent = "Открываем WhatsApp — отправьте расчёт там.";
    });
    atualizar();
  }

  /* ── Материалы: вкладки и точки на фото ──────────────────────────── */
  const mat = document.querySelector(".mat");
  if (mat) {
    const fotos = [...mat.querySelectorAll(".mat-foto")];
    const titulo = mat.querySelector(".mat-titulo");
    const texto = mat.querySelector(".mat-texto");
    const tags = mat.querySelector(".mat-tags");
    const marcarPonto = (b) => {
      mat.querySelectorAll(".ponto").forEach((x) => x.classList.toggle("ativo", x === b));
      if (b) texto.textContent = b.dataset.info;
    };
    const abrirTab = (k) => {
      mat.querySelectorAll(".mat-tabs button").forEach((b) => b.setAttribute("aria-selected", String(+b.dataset.tab === k)));
      fotos.forEach((f) => f.classList.toggle("ativo", +f.dataset.tab === k));
      const f = fotos[k];
      titulo.textContent = f.dataset.titulo;
      tags.innerHTML = f.dataset.tags.split("|").map((t) => `<span>${esc(t)}</span>`).join("");
      marcarPonto(f.querySelector(".ponto"));
    };
    mat.querySelector(".mat-tabs").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (b) abrirTab(+b.dataset.tab);
    });
    mat.addEventListener("click", (e) => { const b = e.target.closest(".ponto"); if (b) marcarPonto(b); });
    mat.querySelectorAll(".ponto").forEach((b) => b.addEventListener("mouseenter", () => marcarPonto(b)));
    abrirTab(0);
  }

  /* ── Этапы ↔ телефон со статусом заказа ──────────────────────────── */
  const passos = document.querySelector(".passos");
  const fone = document.querySelector(".fone");
  if (passos && fone) {
    const itens = [...passos.querySelectorAll("li")];
    const STATUS = ["Заявка принята", "Замер назначен", "3D-проект готов", "Договор подписан", "Монтаж завершён"];
    const MSG = [
      "Дизайнер Арман: «Получили заявку, перезвоню в течение 15 минут».",
      "Замерщик Данияр: «Буду завтра в 11:00, возьму образцы фасадов».",
      "Дизайнер Арман: «Отправил 3D-проект и смету, посмотрите варианты».",
      "Менеджер: «Договор подписан, кухня в производстве, срок — 28 дней».",
      "Монтажники: «Кухня собрана, упаковку забрали. Приятного ужина!»",
    ];
    let at = 0, timer = null;
    const ir = (k) => {
      at = (k + itens.length) % itens.length;
      itens.forEach((li, j) => li.classList.toggle("ativo", j === at));
      fone.querySelector(".fone-etapa").textContent = STATUS[at];
      fone.querySelector(".fone-barra i").style.width = `${((at + 1) / itens.length) * 100}%`;
      fone.querySelectorAll(".fone-lista li").forEach((li, j) => li.classList.toggle("feito", j <= at));
      fone.querySelector(".fone-msg").textContent = MSG[at];
    };
    const ciclo = () => { clearInterval(timer); if (!reduzir) timer = setInterval(() => ir(at + 1), 2600); };
    passos.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) { ir(+li.dataset.p); ciclo(); } });
    new IntersectionObserver(([e]) => { if (e.isIntersecting) ciclo(); else clearInterval(timer); }, { threshold: 0.3 }).observe(passos);
    ir(0);
  }

  /* ── Квиз «Рассчитать кухню» во всплывающем окне ─────────────────── */
  const dlgQuiz = document.getElementById("quiz");
  const quiz = dlgQuiz && dlgQuiz.querySelector(".quiz");
  if (quiz) {
    const passos = [...quiz.querySelectorAll(".quiz-q")];
    const voltar = quiz.querySelector(".quiz-voltar");
    const seguir = quiz.querySelector(".quiz-seguir");
    const barra = quiz.querySelector(".quiz-barra i");
    const numero = quiz.querySelector(".quiz-passo b");
    const status = quiz.querySelector(".form-status");
    let at = 0;
    const respondido = (k) => !passos[k].querySelector('input[type="radio"]') || !!passos[k].querySelector("input:checked");
    const ir = (k) => {
      at = Math.max(0, Math.min(passos.length - 1, k));
      passos.forEach((p, j) => p.classList.toggle("ativo", j === at));
      numero.textContent = at + 1;
      barra.style.width = `${((at + 1) / passos.length) * 100}%`;
      voltar.disabled = at === 0;
      seguir.disabled = !respondido(at);
      quiz.classList.toggle("no-fim", at === passos.length - 1);
    };
    quiz.addEventListener("change", (e) => {
      if (e.target.type !== "radio") return;
      seguir.disabled = false;
      const passo = at;
      setTimeout(() => { if (at === passo) ir(at + 1); }, 320); // ответ выбран — сразу дальше
    });
    voltar.addEventListener("click", () => ir(at - 1));
    seguir.addEventListener("click", () => ir(at + 1));
    quiz.addEventListener("submit", (ev) => {
      ev.preventDefault();
      if (!validar(passos[passos.length - 1])) { status.textContent = "Укажите номер телефона."; return; }
      const linhas = ["Расчёт кухни (квиз на сайте):"];
      passos.forEach((p) => { const r = p.querySelector("input:checked"); if (r) linhas.push(`${r.name}: ${r.value}`); });
      const d = Object.fromEntries(new FormData(quiz));
      if (d.nome) linhas.push(`Имя: ${d.nome}`);
      linhas.push(`Телефон: ${d.tel}`);
      window.open(wa(`${msg}\n\n${linhas.join("\n")}`), "_blank", "noopener");
      status.textContent = "Открываем WhatsApp — отправьте сообщение там.";
    });
    document.querySelectorAll("[data-quiz]").forEach((b) => b.addEventListener("click", (e) => {
      e.preventDefault();
      ir(0);
      dlgQuiz.showModal();
    }));
  }

  /* ── До и после: ползунок + выбор работы ─────────────────────────── */
  const ad = document.querySelector(".antes-depois");
  if (ad) {
    const palco = ad.querySelector(".ad-palco");
    const range = ad.querySelector(".ad-range");
    const antes = ad.querySelector(".ad-antes");
    const depois = ad.querySelector(".ad-depois");
    const pos = (v) => palco.style.setProperty("--pos", `${v}%`);
    range.addEventListener("input", () => pos(range.value));
    ad.querySelector(".ad-lista").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      ad.querySelectorAll(".ad-lista button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      const nome = b.querySelector("b").textContent;
      depois.src = `assets/img/${b.dataset.id}.webp`;
      antes.src = `assets/img/${b.dataset.id}_antes.webp`;
      depois.alt = `После: кухня «${nome}»`;
      antes.alt = `До: та же комната без кухни`;
      range.value = 50; pos(50);
    });
    // Подсказка движением: один раз «проводим» ползунок, когда блок появился
    if (!reduzir) new IntersectionObserver(([e], obs) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      const t0 = performance.now();
      const anim = (t) => {
        const k = Math.min(1, (t - t0) / 1600);
        const v = 50 + 30 * Math.sin(k * Math.PI * 2) * (1 - k);
        pos(v); range.value = v;
        if (k < 1) requestAnimationFrame(anim);
      };
      requestAnimationFrame(anim);
    }, { threshold: 0.5 }).observe(palco);
  }
})();
