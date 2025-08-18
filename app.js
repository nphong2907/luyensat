(function () {
  // ---------- DOM ----------
  const categoryScreen = document.getElementById('categoryScreen');
  const categoryList   = document.getElementById('categoryList');
  const homeBtn        = document.getElementById('homeBtn');
  const restartBtn     = document.getElementById('restartBtn');

  const quizCard       = document.getElementById('quizCard');
  const crumbs         = document.getElementById('crumbs');
  const qIndex         = document.getElementById('qIndex');
  const contextBox     = document.getElementById('contextBox');
  const promptBox      = document.getElementById('promptBox');
  const answersWrap    = document.getElementById('answers');
  const feedback       = document.getElementById('feedback');
  const prevBtn        = document.getElementById('prevBtn');
  const nextBtn        = document.getElementById('nextBtn');
  const exitBtn        = document.getElementById('exitBtn');

  const pFill          = document.getElementById('pFill');
  const pText          = document.getElementById('pText');

  const resultCard     = document.getElementById('resultCard');
  const statCorrect    = document.getElementById('statCorrect');
  const statWrong      = document.getElementById('statWrong');
  const statAccuracy   = document.getElementById('statAccuracy');

  const userChip       = document.getElementById('userChip');
  const switchUserBtn  = document.getElementById('switchUserBtn');

  // Random test & points
  const randomTestBtn  = document.getElementById('randomTestBtn');
  const scoreChip      = document.getElementById('scoreChip');

  // Random result overlay
  const randomOverlay  = document.getElementById('randomOverlay');
  const randomModal    = document.getElementById('randomModal');
  const randomClose    = document.getElementById('randomClose');
  const randomMessage  = document.getElementById('randomMessage');
  const randomActions  = document.getElementById('randomActions');

  // Resume modal
  const modalOverlay   = document.getElementById('modalOverlay');
  const modal          = document.getElementById('resumeModal');
  const modalTitle     = document.getElementById('modalTitle');
  const modalDesc      = document.getElementById('modalDesc');
  const modalContinue  = document.getElementById('modalContinue');
  const modalReview    = document.getElementById('modalReview');
  const modalReset     = document.getElementById('modalReset');
  const modalCancel    = document.getElementById('modalCancel');
  const modalClose     = document.getElementById('modalClose');

  const explainBox     = document.getElementById('explainBox');

  // Hide modal on load
  modalOverlay?.classList.add('hidden'); modalOverlay?.classList.remove('show');
  modal?.classList.add('hidden');        modal?.classList.remove('show');

  // ---------- STATE ----------
  const AUTO_DELAY_MS  = 800;
  const DEFAULT_CAT    = 'Word in Context - Part 1';
  const STORAGE_NS     = 'quizProgress_v6';

  let bank = [];
  let baseBank = [];
  let currentSet = [];
  let currentSetIdxs = [];
  let currentCatName = '';
  let idx = 0;
  let correctCount = 0;
  let locked = false;
  let answered = new Map();
  let reviewMode = false;
  let randomMode = false;

  // ---------- USER ----------
  let USER_ID  = localStorage.getItem('quizUserId') || '';
  let USER_KEY = (USER_ID || 'Khách').trim().toLowerCase();

  function setActiveUser(name){
    USER_ID  = name;
    USER_KEY = (name || 'Khách').trim().toLowerCase();
    localStorage.setItem('quizUserId', USER_ID);
    userChip && (userChip.textContent = `👤 ${USER_ID}`);
    updateScoreChip();
  }
  function ensureUser(){
    USER_ID  = localStorage.getItem('quizUserId') || USER_ID || '';
    USER_KEY = (USER_ID || 'Khách').trim().toLowerCase();
    if (!USER_ID){
      openUserModal('Khách', (name)=> setActiveUser(name));
    } else {
      userChip && (userChip.textContent = `👤 ${USER_ID}`);
      updateScoreChip();
    }
  }
  switchUserBtn?.addEventListener('click', ()=> openUserModal(USER_ID || 'Khách', (name)=> setActiveUser(name)));

  // ---------- POINTS ----------
  const POINTS_NS = 'quizPoints_v1';
  const pointsKey = () => `${POINTS_NS}:${USER_ID || 'Khách'}`;
  function getPoints(){ try{ return parseInt(localStorage.getItem(pointsKey()) || '0', 10) || 0; }catch{ return 0; } }
  function setPoints(v){ try{ localStorage.setItem(pointsKey(), String(v)); }catch{} updateScoreChip(v); }
  function addPoints(delta){ setPoints(getPoints() + delta); }
  function updateScoreChip(v=getPoints()){ if(scoreChip) scoreChip.textContent = `⭐ ${v}`; }

  // ---------- STORAGE ----------
  const catKey = (cat) => `${STORAGE_NS}:${USER_ID}:${cat}`;
  function saveCategoryProgress(){
    if(!currentSetIdxs.length || !currentCatName) return;
    const payload = { user:USER_ID, timestamp:Date.now(), catName:currentCatName, idx, correctCount,
      answered:Array.from(answered.entries()), setIdxs:currentSetIdxs };
    try{ localStorage.setItem(catKey(currentCatName), JSON.stringify(payload)); }catch{}
  }
  function loadCategoryProgress(catName){ try{ return JSON.parse(localStorage.getItem(catKey(catName)) || 'null'); }catch{ return null; } }
  function clearCategoryProgress(catName){ try{ localStorage.removeItem(catKey(catName)); }catch{} }

  // ---------- UTILS ----------
  const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
  const letterFromIndex = (i)=>['A','B','C','D'][i]||'';
  const show = (el)=>el&&el.classList.remove('hidden');
  const hide = (el)=>el&&el.classList.add('hidden');
  function escapeHTML(str){
    return String((str==null?'':String(str))).replace(/[&<>"']/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[s]));
  }
  // Render with underline: converts [ ... ] or __...__ to <u>...</u>
  function renderWithUnderline(raw=''){
    const s = String(raw);
    let out = '', last = 0;
    const re = /\[([^\[\]]+)\]|__([^_]+)__/g;
    s.replace(re, (m,br,us,idx)=>{
      out += escapeHTML(s.slice(last, idx));
      out += `<u class="uline">${escapeHTML(br || us || '')}</u>`;
      last = idx + m.length;
      return m;
    });
    out += escapeHTML(s.slice(last));
    return out.replace(/\n/g,'<br>');
  }


  // ===== Explain helpers =====
  
  function parseExp(text){
    let t = String(text || '').trim();

    // Synonyms (multi-line, stop before next label)
    let syn = '';
    t = t.replace(
      /(^|\n)\s*Từ\s+đồng\s+nghĩa[^:]*:\s*([\s\S]*?)(?=\s*(?:Nghĩa(?:\s*Tiếng?\s*Việt)?|Vì\s*sao\s*sai|Lý\s*do|Phù\s*hợp|Không\s*phù\s*hợp|Từ\s*này\s*phù\s*hợp\s*vì|Vì\s*sao\s*đúng)\s*:|$)/i,
      (_m,_p1,p2)=>{ syn = (p2 || '').trim(); return '\n'; }
    );
    syn = syn.replace(/\s*(?:Nghĩa(?:\s*Tiếng?\s*Việt)?|Vì\s*sao\s*sai|Lý\s*do|Phù\s*hợp|Không\s*phù\s*hợp|Từ\s*này\s*phù\s*hợp\s*vì|Vì\s*sao\s*đúng)\s*:\s*[\s\S]*$/i,'').trim();

    // Vietnamese meaning (multi-line)
    let vi = '';
    t = t.replace(
      /(^|\n)\s*Nghĩa(?:\s*Tiếng?\s*Việt)?\s*:\s*([\s\S]*?)(?=\s*(?:Từ\s+đồng\s+nghĩa|Vì\s*sao\s*sai|Lý\s*do|Phù\s*hợp|Không\s*phù\s*hợp|Từ\s*này\s*phù\s*hợp\s*vì|Vì\s*sao\s*đúng)\s*:|$)/i,
      (_m,_p1,p2)=>{ vi = (p2 || '').trim(); return '\n'; }
    );

    // Why (multi-line, supports many labels)
    let why = '';
    t = t.replace(
      /(^|\n)\s*(Vì\s*sao\s*sai|Lý\s*do|Phù\s*hợp|Không\s*phù\s*hợp|Từ\s*này\s*phù\s*hợp\s*vì|Vì\s*sao\s*đúng)\s*:\s*([\s\S]*?)(?=\s*(?:Nghĩa(?:\s*Tiếng?\s*Việt)?|Từ\s+đồng\s+nghĩa|Vì\s*sao\s*sai|Lý\s*do|Phù\s*hợp|Không\s*phù\s*hợp|Từ\s*này\s*phù\s*hợp\s*vì|Vì\s*sao\s*đúng)\s*:|$)/i,
      (_m,_p1,_lbl,content)=>{ why = (content || '').trim(); return '\n'; }
    );

    const extra = t.trim();
    return { vi, why, syn, extra };
  }


  // ===== PROGRESS BAR =====
  function setProgress(){
    const total = currentSet.length;
    const done = clamp(idx+1,0,total);
    pText.textContent = `${done}/${total}`;
    pFill.style.width = (total ? (done/total)*100 : 0) + '%';
    qIndex.textContent = `${done}/${total}`;
  }

  // ===== NORMALIZE DATA =====
  function splitQuestionText(qstr=''){
    const marker=/Which choice completes the text with the most logical and precise word or phrase\?/i;
    const parts=String(qstr).split(marker);
    return { context:(parts[0]||'').trim(),
             prompt:'Which choice completes the text with the most logical and precise word or phrase?' };
  }
  const ensureCategory=(items)=>items.map(q=>q?({...q,category:q.category||DEFAULT_CAT}):q).filter(Boolean);

  function makeSig(q){
    const base=(q.context||q.question||'').trim().toLowerCase();
    const pr=(q.prompt||'').trim().toLowerCase();
    const opts=(q.options||[]).map(s=>String(s).trim().toLowerCase()).join('|');
    return `${base}|${pr}|${opts}`;
  }
  function dedupeBank(list){
    const seen=new Set(); const out=[];
    for(const q of list){ const sig=makeSig(q); if(!seen.has(sig)){ seen.add(sig); out.push(q); } }
    return out;
  }

  function normalizeCorrect(correct, options=[]){
    if(typeof correct==='number') return clamp((correct>=1&&correct<=4?correct-1:correct),0,3);
    const s = (correct==null)?'':String(correct).trim();
    const map={A:0,B:1,C:2,D:3};
    if(s.toUpperCase() in map) return map[s.toUpperCase()];
    const i=options.findIndex(opt=>String(opt).trim().toLowerCase()===s.toLowerCase());
    return i>=0?i:0;
  }

  // >>> Giữ thêm các trường mới từ JSON <<<
  function normalizeRow(obj){
    if(!obj) return null;
    const q  = String(obj.question || obj.Question || '').trim();
    const context = obj.context ?? obj.Context ?? '';
    const prompt  = obj.prompt  ?? obj.Prompt  ?? 'Which choice completes the text with the most logical and precise word or phrase?';

    const A = obj.A ?? obj.a ?? obj.options?.[0];
    const B = obj.B ?? obj.b ?? obj.options?.[1];
    const C = obj.C ?? obj.c ?? obj.options?.[2];
    const D = obj.D ?? obj.d ?? obj.options?.[3];
    const options = [A,B,C,D].map(v => v === undefined ? '' : String(v));
    if (options.filter(Boolean).length < 2) return null;

    const rawCorrect = obj.correct ?? obj.Correct ?? obj.answer ?? obj.Answer;
    const correct = normalizeCorrect(rawCorrect, options);

    let explanations = obj.explanations || obj.Explanations || obj.explain || obj.Explain;
    if (Array.isArray(explanations)) explanations = {A:explanations[0],B:explanations[1],C:explanations[2],D:explanations[3]};
    const exA = obj.exA ?? obj.expA ?? obj.ExA ?? obj.ExpA;
    const exB = obj.exB ?? obj.expB ?? obj.ExB ?? obj.ExpB;
    const exC = obj.exC ?? obj.expC ?? obj.ExC ?? obj.ExpC;
    const exD = obj.exD ?? obj.expD ?? obj.ExD ?? obj.ExpD;
    if (!explanations && (exA||exB||exC||exD)) explanations = {A:exA,B:exB,C:exC,D:exD};

    // giữ các trường nâng cao để UI mới dùng
    const cx  = obj.context_explain || null;
    const cxs = cx && cx.signals ? cx.signals : {};
    const contextSummary = obj.contextSummary || (cx && cx.summary) || '';
    const contextLogic   = obj.contextLogic   || cxs.quick_reasoning || cxs.quick_tip || cxs.connectors || '';
    const choices        = obj.choices || null;
    const answerLine     = obj.answerLine || '';
    const answerKey      = obj.answerKey || null;
    const answerText     = obj.answerText || null;

    return {
      question:q, context, prompt, options, correct, explanations,
      category: obj.category || obj.Category || DEFAULT_CAT,
      // fields mới:
      context_explain: cx,
      contextSummary, contextLogic,
      choices, answerLine, answerKey, answerText
    };
  }

  // Helper lấy giải thích theo index
  function getExplanation(q, index){
    if(!q || !q.explanations) return '';
    const k = ['A','B','C','D'][index] ?? '';
    return (q.explanations[k] || '').toString().trim();
  }

  // ===== RENDER EXPLANATION (đẹp – đúng xanh / sai đỏ) =====
  function renderExplanation(q, chosenIndex, correctIndex, mode='do'){
    if (!q || !explainBox) return;

    const L = ['A','B','C','D'];
    explainBox.classList.add('hidden');
    explainBox.innerHTML = '';

    const li = (label, val, fallback='') => {
      const text = (val && String(val).trim()) || fallback;
      return text ? `<li><b>${escapeHTML(label)}</b> ${escapeHTML(text).replace(/\n/g,'<br>')}</li>` : '';
    };

    const right  = parseExp(getExplanation(q, correctIndex));
    const chosen = chosenIndex != null ? parseExp(getExplanation(q, chosenIndex)) : null;

    if (chosenIndex == null) {
      const html = `
        <div class="ex-title">Đáp án đúng (${L[correctIndex]})</div>
        <ul class="ex-list">
          ${li('Nghĩa tiếng Việt:', right.vi)}
          ${li('Lý do:', right.why)}
          ${li('Từ đồng nghĩa:', right.syn)}
        </ul>`;
      explainBox.className = 'explain ok';
      explainBox.innerHTML = html;
      explainBox.classList.remove('hidden');
      return;
    }

    const isCorrect = (chosenIndex === correctIndex);

    if (isCorrect) {
      const html = `
        <div class="ex-title">Chính xác!</div>
        <ul class="ex-list">
          ${li('Nghĩa tiếng Việt:', right.vi)}
          ${li('Lý do phù hợp:', right.why, 'Khớp chính xác với ý nghĩa và logic của câu.')}
          ${li('Từ đồng nghĩa:', right.syn)}
        </ul>`;
      explainBox.className = 'explain ok';
      explainBox.innerHTML = html;
    } else {
      const html = `
        <div class="ex-title">Chưa đúng.</div>
        <ul class="ex-list">
          ${li('Nghĩa Tiếng Việt:', chosen?.vi)}
          ${li('Vì sao sai:', chosen?.why, 'Lệch nghĩa hoặc mâu thuẫn với ý muốn diễn đạt.')}
          ${li('Từ đồng nghĩa:', chosen?.syn)}
        </ul>

        <div class="ex-sep"></div>

        <div class="ex-title">Đáp án đúng: ${L[correctIndex]}</div>
        <ul class="ex-list">
          ${li('Nghĩa Tiếng Việt:', right.vi)}
          ${li('Từ đồng nghĩa:', right.syn)}
          ${li('Từ này phù hợp vì:', right.why, 'Khớp chính xác với ý nghĩa và logic của câu.')}
        </ul>`;
      explainBox.className = 'explain bad';
      explainBox.innerHTML = html;
    }

    explainBox.classList.remove('hidden');
    try { explainBox.scrollIntoView({ behavior:'smooth', block:'nearest' }); } catch {}
  }

  // ===== SEARCH helpers =====
  const norm=(s='')=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const getHaystack=(q)=>[q.context||'',q.question||'',q.prompt||'',...(q.options||[])].join(' ');
  function highlight(text, terms){
    let out = escapeHTML(text);
    terms.forEach(t=>{
      if(!t) return;
      const re = new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'ig');
      out = out.replace(re,'<mark>$1</mark>');
    });
    return out;
  }

  // bật overlay khi xong random
  function maybeFinishRandomNow({ isLast } = {}){
    if(!randomMode) return;
    if(isLast){ setTimeout(()=>{ showResult(); },300); return; }
    const total=currentSet.length;
    if(answered.size>=total){ setTimeout(()=>{ showResult(); },300); }
  }

  // ---------- START / RENDER ----------
  function buildCategories(){
    const groups=new Map();
    bank.forEach((q,i)=>{ const cat=q.category||DEFAULT_CAT; if(!groups.has(cat)) groups.set(cat,[]); groups.get(cat).push(i); });
    renderCategoryList(groups);
  }
  function renderCategoryList(groups){
    categoryList.innerHTML='';
    const arr = Array.from(groups.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
    arr.forEach(([name, indexes])=>{
      const btn=document.createElement('button');
      btn.className='category btn';

      const saved=loadCategoryProgress(name);
      const total=indexes.length;

      let answeredCount=0, pct=0, completed=false;
      if(saved && Array.isArray(saved.answered)){
        answeredCount=saved.answered.length;
        const correct=saved.correctCount||0;
        pct = total ? Math.round((correct/total)*100) : 0;
        completed = answeredCount >= total;
      }

      const rightHtml = saved
        ? `<span class="meta">${answeredCount}/${total} câu</span><span class="meta">(${pct}%)</span>`
        : `<span class="count">${total} câu</span>`;

      btn.innerHTML = `<div class="cat-name">${escapeHTML(name)}</div><div class="cat-meta">${rightHtml}</div>`;

      if (saved){
        if (completed) btn.classList.add(pct>=80?'cat-done-good':'cat-done-bad');
        else btn.classList.add('cat-inprogress');
      }

      btn.addEventListener('click', ()=>{
        if(saved && Array.isArray(saved.setIdxs) && saved.setIdxs.length) openResumeModal(name, indexes, saved);
        else startSet(name, indexes, {mode:'fresh'});
      });

      categoryList.appendChild(btn);
    });
  }

  function openResumeModal(catName, idxs, saved){
    __pendingCat = catName; __pendingIdxs = idxs; __pendingSaved = saved;
    modalTitle && (modalTitle.textContent = 'Tiếp tục danh mục?');
    modalDesc  && (modalDesc.textContent  = `Danh mục "${catName}" đã có tiến độ. Chọn một thao tác:`);
    modalOverlay.classList.remove('hidden'); modal.classList.remove('hidden');
    modalOverlay.classList.add('show');      modal.classList.add('show');
    setTimeout(()=> modalContinue?.focus(), 30);
  }
  function closeResumeModal(){
    modalOverlay.classList.remove('show'); modal.classList.remove('show');
    setTimeout(()=>{ modalOverlay.classList.add('hidden'); modal.classList.add('hidden'); }, 160);
  }
  let __pendingCat=null, __pendingIdxs=null, __pendingSaved=null;
  modalContinue?.addEventListener('click', ()=>{ closeResumeModal(); if(__pendingCat) startSet(__pendingCat, __pendingIdxs, {mode:'continue', saved:__pendingSaved}); });
  modalReview  ?.addEventListener('click', ()=>{ closeResumeModal(); if(__pendingCat) startSet(__pendingCat, __pendingIdxs, {mode:'review',   saved:__pendingSaved}); });
  modalReset   ?.addEventListener('click', ()=>{ if(__pendingCat) clearCategoryProgress(__pendingCat); closeResumeModal(); if(__pendingCat) startSet(__pendingCat, __pendingIdxs, {mode:'fresh'}); });
  modalCancel  ?.addEventListener('click', closeResumeModal);
  modalClose   ?.addEventListener('click', closeResumeModal);
  modalOverlay ?.addEventListener('click', (e)=>{ if(e.target===modalOverlay) closeResumeModal(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && !modal.classList.contains('hidden')) closeResumeModal(); });

  function startSet(catName, idxs, opts={}){
    currentCatName = catName;
    currentSetIdxs = (idxs||[]).slice();
    currentSet     = currentSetIdxs.map(i=>bank[i]).filter(Boolean);

    reviewMode=false; idx=0; correctCount=0; answered=new Map(); locked=false;

    if(opts.mode==='continue' && opts.saved){
      const s=opts.saved;
      idx = clamp(s.idx||0, 0, Math.max(0,currentSet.length-1));
      correctCount = s.correctCount || 0;
      answered = new Map(s.answered || []);
    } else if (opts.mode==='review' && opts.saved){
      const s=opts.saved;
      reviewMode=true; idx=0; correctCount=0; answered=new Map();
      currentSetIdxs = (s.setIdxs || []).slice();
      currentSet     = currentSetIdxs.map(i=>bank[i]).filter(Boolean);
    }

    crumbs.textContent = `Danh mục: ${catName}${reviewMode?' • Review':''}`;
    show(quizCard); hide(categoryScreen); hide(resultCard);
    restartBtn.disabled=false; show(restartBtn);
    renderQuestion();
    saveCategoryProgress();
    adminSyncProgress('autosave');
  }

  /* ========= Context Explain: JSON-first with legacy fallback ========= */
  const CTX_BTN_ID  = 'ctxExplainBtn';
  const CTX_WRAP_ID = 'ctxExplainWrap';

  function ensureContextExplainUI() {
    if (!document.getElementById(CTX_BTN_ID)) {
      const tools = document.createElement('div');
      tools.className = 'ctx-tools';
      tools.innerHTML = `
        <button id="${CTX_BTN_ID}" class="btn small ghost ctx-btn" type="button">🧠 Giải thích context</button>
      `;
      contextBox.parentNode.insertBefore(tools, contextBox.nextSibling);
    }
    if (!document.getElementById(CTX_WRAP_ID)) {
      const wrap = document.createElement('div');
      wrap.id = CTX_WRAP_ID;
      wrap.className = 'ctx-explain hidden';
      const tools = contextBox.nextElementSibling;
      tools.parentNode.insertBefore(wrap, tools.nextSibling);
    }
    document.getElementById(CTX_BTN_ID).onclick = () => {
      const p = document.getElementById(CTX_WRAP_ID);
      p.classList.toggle('hidden');
      if (!p.classList.contains('hidden')) {
        try { p.scrollIntoView({ behavior:'smooth', block:'nearest' }); } catch {}
      }
    };
  }

  function summarizeText(txt) {
    const s = String(txt || '').replace(/\s+/g,' ').trim();
    const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
    return (parts[0] || s).slice(0, 260);
  }
  function detectCues(ctx) {
    const s = String(ctx || '').toLowerCase();
    const list = [
      { words: ['however','but ','yet ','nevertheless','nonetheless','in contrast','on the other hand','whereas','while '], label: 'đối lập/đổi hướng' },
      { words: ['although','though','even though','despite','in spite of','even if'], label: 'nhượng bộ' },
      { words: ['because','since ','as ','due to','owing to'], label: 'nguyên nhân' },
      { words: ['therefore','thus','hence','consequently','as a result','so '], label: 'kết quả/kết luận' },
      { words: ['moreover','furthermore','in addition','additionally','also','besides'], label: 'bổ sung' },
    ];
    const out = [];
    list.forEach(g => g.words.forEach(w => s.includes(w) && out.push({word:w.trim(), type:g.label})));
    const seen = new Set(); return out.filter(x => (seen.has(x.word)?false:(seen.add(x.word),true)));
  }

  function buildContextExplainHTMLFromData(q){
    const ec = q.context_explain || {};
    const summary = q.contextSummary || ec.summary || summarizeText(q.context || '');
    const connectors =
      (ec.signals && (ec.signals.connectors || ec.signals['từ nối'] || ec.signals['connectors'])) || '';
    const quick =
      (ec.signals && (ec.signals.quick_reasoning || ec.signals.quick_tip)) ||
      q.contextLogic || '';

    const logicList = [
      connectors ? `<li><b>Từ nối quan trọng:</b> ${escapeHTML(connectors)}</li>` : '',
      quick ? `<li><b>Cách suy luận nhanh:</b> ${escapeHTML(quick)}</li>` : ''
    ].join('') || '<li>Không có tín hiệu đặc biệt — tập trung vào mạch ý và từ vựng quanh chỗ trống.</li>';

    return `
      <div class="ctx-title">Giải thích logic của context</div>
      <div class="ctx-block">
        <div class="ctx-h">Tóm tắt</div>
        <p class="ctx-p">${escapeHTML(summary)}</p>
      </div>
      <div class="ctx-block">
        <div class="ctx-h">Tín hiệu lập luận</div>
        <ul class="ctx-list">${logicList}</ul>
      </div>
      ${q.prompt ? `<div class="ctx-block"><div class="ctx-h">Câu hỏi</div><p class="ctx-p">${escapeHTML(q.prompt)}</p></div>` : ''}
    `;
  }
  function buildContextExplainHTMLLegacy(ctx, prompt){
    const summary = summarizeText(ctx);
    const cues = detectCues(ctx);
    const cueLine = cues.length
      ? cues.map(c => `"<mark>${escapeHTML(c.word)}</mark>" (${c.type})`).join(', ')
      : 'Không có tín hiệu từ nối đặc biệt — tập trung đọc mạch ý và từ vựng quanh chỗ trống.';
    let strategy = '';
    const hasContrast = cues.some(c => /đối lập|nhượng bộ/.test(c.type));
    const hasCause    = cues.some(c => /nguyên nhân/.test(c.type));
    const hasResult   = cues.some(c => /kết quả/.test(c.type));
    if (hasContrast) strategy += '• Có tín hiệu đối lập/nhượng bộ → chọn nghĩa theo vế sau.\n';
    if (hasCause)    strategy += '• Có tín hiệu nguyên nhân → ưu tiên từ diễn tả lý do.\n';
    if (hasResult)   strategy += '• Có tín hiệu kết quả → ưu tiên từ diễn tả hệ quả/kết luận.\n';
    if (!strategy)   strategy = '• Đọc lại cụm quanh chỗ trống, bắt tone và collocation để chọn từ.';
    return `
      <div class="ctx-title">Giải thích logic của context</div>
      <div class="ctx-block">
        <div class="ctx-h">Tóm tắt</div>
        <p class="ctx-p">${escapeHTML(summary)}</p>
      </div>
      <div class="ctx-block">
        <div class="ctx-h">Tín hiệu lập luận</div>
        <ul class="ctx-list">
          <li><b>Từ nối quan trọng:</b> ${cueLine}</li>
          <li><b>Cách suy luận nhanh:</b><br>${escapeHTML(strategy).replace(/\n/g,'<br>')}</li>
        </ul>
      </div>
      ${prompt ? `<div class="ctx-block"><div class="ctx-h">Câu hỏi</div><p class="ctx-p">${escapeHTML(prompt)}</p></div>` : ''}
    `;
  }
  function buildContextExplainHTML(ctx, prompt){
    return buildContextExplainHTMLLegacy(ctx, prompt);
  }
  function updateContextExplain(arg1, prompt){
    ensureContextExplainUI();
    const panel = document.getElementById(CTX_WRAP_ID);
    let html = '';
    if (typeof arg1 === 'object' && arg1 !== null) {
      html = buildContextExplainHTMLFromData(arg1);
    } else {
      html = buildContextExplainHTMLLegacy(arg1 || '', prompt || '');
    }
    panel.innerHTML = html;
    panel.classList.add('hidden');
  }

  function renderQuestion(){
    if(idx >= currentSet.length) return showResult();
    const q=currentSet[idx];

    if(q.context || q.prompt){
      contextBox.innerHTML = renderWithUnderline((q.context||'').trim());
      promptBox.innerHTML  = renderWithUnderline((q.prompt || 'Which choice completes the text with the most logical and precise word or phrase?').trim());
    } else {
      const {context,prompt} = splitQuestionText(q.question || '');
      contextBox.innerHTML = renderWithUnderline(context);
      promptBox.innerHTML  = renderWithUnderline(prompt);
    }

    // >>> đọc context-explain từ JSON (ưu tiên), fallback legacy khi thiếu
    updateContextExplain(q);

    answersWrap.innerHTML='';
    explainBox && (explainBox.innerHTML='');

    const opts=(q.options || [q.A,q.B,q.C,q.D].filter(v=>v!==undefined)).slice(0,4);
    opts.forEach((opt,i)=>{
      const btn=document.createElement('button');
      btn.className='answer';
      btn.setAttribute('data-index', i);
      btn.setAttribute('aria-label', `Đáp án ${letterFromIndex(i)}`);
      btn.innerHTML=`<span class="pill">${letterFromIndex(i)}</span> <span>${escapeHTML(String(opt))}</span>`;
      btn.addEventListener('click', ()=>{
  const correctIndex = (typeof q.correct==='number')
    ? clamp(q.correct,0,3)
    : normalizeCorrect(q.correct, q.options||[]);

  if (reviewMode) {
    // Xem đáp án trong REVIEW
    answersWrap.querySelectorAll('.answer.blue').forEach(el=>el.classList.remove('blue'));
    if (i !== correctIndex) btn.classList.add('blue'); else btn.classList.remove('blue');
    renderExplanation(q, i, correctIndex, 'review');
    return;
  }

  if (!answered.has(idx)) {
    // Lần chọn đầu: chấm điểm + xóa mọi highlight preview cũ (nếu có)
    answersWrap.querySelectorAll('.answer.blue').forEach(el=>el.classList.remove('blue'));
    handleAnswer(i, btn);
    return;
  }

  // ĐÃ trả lời rồi: cho phép xem vì sao sai/đúng ngay ở màn hiện tại (không vào review)
  answersWrap.querySelectorAll('.answer.blue').forEach(el=>el.classList.remove('blue'));
  if (i !== correctIndex) btn.classList.add('blue'); else btn.classList.remove('blue');
  renderExplanation(q, i, correctIndex, 'preview');
});
      answersWrap.appendChild(btn);
    });

    if(reviewMode){
      const correctIndex=(typeof q.correct==='number')?clamp(q.correct,0,3):normalizeCorrect(q.correct,q.options||[]);
      const prev=answered.get(idx);
      const correctBtn=answersWrap.querySelector(`[data-index="${correctIndex}"]`);
      if(correctBtn) correctBtn.classList.add('correct');
      if(prev && prev.choice!=null && prev.choice!==correctIndex){
        const wrongBtn=answersWrap.querySelector(`[data-index="${prev.choice}"]`);
        if(wrongBtn) wrongBtn.classList.add('wrong');
      }
      [...answersWrap.querySelectorAll('.answer')].forEach(b=>{ b.classList.remove('locked'); b.removeAttribute('aria-disabled'); b.removeAttribute('disabled'); });
      renderExplanation(q, prev?.choice ?? null, correctIndex, 'review');
    } else {
      const prev=answered.get(idx);
      if(prev){
        const correctIndex=(typeof q.correct==='number')?clamp(q.correct,0,3):normalizeCorrect(q.correct,q.options||[]);
        const btn=answersWrap.querySelector(`[data-index="${prev.choice}"]`);
        if(btn){
          if(prev.choice===correctIndex) btn.classList.add('correct');
          else { btn.classList.add('wrong'); const c=answersWrap.querySelector(`[data-index="${correctIndex}"]`); if(c) c.classList.add('correct'); }
          [...answersWrap.querySelectorAll('.answer')].forEach(b=> b.disabled=true);
        }
        renderExplanation(q, prev.choice, correctIndex, 'restore');
      }
    }

    setProgress();
    prevBtn.disabled = idx<=0;
    nextBtn.disabled = idx>=currentSet.length-1;
  }

  function flash(type,msg){
    feedback.textContent = msg;
    feedback.className = `feedback show ${type}`;
    clearTimeout(flash._t); flash._t=setTimeout(()=> feedback.className='feedback', 900);
  }

  function handleAnswer(choiceIndex, btn){
    const q=currentSet[idx];
    const correctIndex=(typeof q.correct==='number')?clamp(q.correct,0,3):normalizeCorrect(q.correct,q.options||[]);
    if(reviewMode){ renderExplanation(q, choiceIndex, correctIndex, 'preview'); return; }
    if(answered.has(idx)){ renderExplanation(q, choiceIndex, correctIndex, 'preview'); return; }
    if(locked) return; locked=true;

    const ok=(choiceIndex===correctIndex);
    if(ok){ btn.classList.add('correct'); correctCount++; flash('ok','✅ Chính xác!'); }
    else   { btn.classList.add('wrong'); const c=answersWrap.querySelector(`[data-index="${correctIndex}"]`); c&&c.classList.add('correct'); flash('bad','❌ Chưa đúng'); }

    answered.set(idx, {choice:choiceIndex, correct:ok});
    renderExplanation(q, choiceIndex, correctIndex, 'do');

    saveCategoryProgress();
    setTimeout(()=>{ locked=false; }, AUTO_DELAY_MS/2);

    const isLast=(idx===currentSet.length-1);
    maybeFinishRandomNow({ isLast });
  }

  function showResult(){
    if(randomMode){
      hide(quizCard); hide(resultCard);
      const total=currentSet.length;
      const pass=(correctCount>=8);
      const msg = pass ? 'Giỏi quá, nhớ bài lâu đấy' : 'Làm lại đê, chưa đạt aim đâu';
      if(pass) addPoints(10);

      randomMessage && (randomMessage.textContent = msg);
      if(randomActions){
        if(pass){ randomActions.innerHTML=''; }
        else{
          randomActions.innerHTML = `
            <button id="randomRetry" class="btn primary">Phục thù ngay</button>
            <button id="randomLater" class="btn ghost">Sẽ phục thù sau</button>`;
          document.getElementById('randomRetry')?.addEventListener('click', ()=>{ closeRandomOverlay(); startRandomTest(); });
          document.getElementById('randomLater')?.addEventListener('click', ()=>{ closeRandomOverlay(); show(categoryScreen); hide(quizCard); hide(resultCard); buildCategories(); hide(restartBtn); randomMode=false; });
        }
      }
      openRandomOverlay();
      saveCategoryProgress();
      adminSyncProgress('finish',{random:true, accuracy: total?Math.round((correctCount/total)*100):0});
      buildCategories();
      return;
    }

    hide(quizCard); show(resultCard);
    const total=currentSet.length, wrong=total-correctCount, acc= total?Math.round((correctCount/total)*100):0;
    statCorrect.textContent=correctCount; statWrong.textContent=wrong; statAccuracy.textContent=acc+'%';
    saveCategoryProgress(); adminSyncProgress('finish'); buildCategories();
  }

  // ---------- Search ----------
  function performSearch(){
    if (searchContainer?.classList.contains('hidden')) searchContainer.classList.remove('hidden');
    const q=(searchInput?.value||'').trim(); const box=searchResults; if(!box) return;
    if(!q){ box.classList.add('hidden'); box.innerHTML=''; return; }

    const terms=norm(q).split(/\s+/).filter(Boolean);
    const matches=[];
    bank.forEach((item,i)=>{ const hay=norm(getHaystack(item)); if(terms.every(t=>hay.includes(t))) matches.push(i); });

    const total=matches.length;
    const headRight = total ? `<button id="searchStartAll" class="btn small primary">Làm tất cả (${total})</button>` : '';
    let html = `
      <div class="search-head">
        <div>Kết quả: <b>${total}</b></div>
        <div>${headRight}</div>
      </div>
      <div class="search-list">`;
    matches.slice(0,100).forEach((i)=>{
      const item=bank[i]; const cat=item.category||DEFAULT_CAT;
      const raw=(item.context||item.question||'').trim().replace(/\s+/g,' ');
      const snip=raw.length>180?raw.slice(0,180)+'…':raw;
      html += `
        <div class="search-item" data-idx="${i}">
          <div>
            <div class="s-cat">${escapeHTML(cat)}</div>
            <div class="s-text">${highlight(snip,(searchInput.value||'').split(/\s+/).filter(Boolean))}</div>
          </div>
          <div class="s-actions">
            <button class="btn small openThis">Mở câu này</button>
          </div>
        </div>`;
    });
    html += `</div>`;
    box.innerHTML=html; box.classList.remove('hidden');

    document.getElementById('searchStartAll')?.addEventListener('click', ()=>{
      const name=`Tìm kiếm: "${q}"`; startSet(name, matches, {mode:'fresh', fromSearch:true});
    });
    [...box.querySelectorAll('.search-item .openThis')].forEach((btn)=>{
      btn.addEventListener('click', ()=>{
        const q=currentSet[idx];
        const correctIndex=(typeof q.correct==='number')?clamp(q.correct,0,3):normalizeCorrect(q.correct,q.options||[]);
        if(reviewMode){ renderExplanation(q, i, correctIndex, 'preview'); return; }
        if(!answered.has(idx)){ handleAnswer(i, btn); }
        else{ renderExplanation(q, i, correctIndex, 'preview'); }
      });
    });
  }

  function pickRandomIdxs(n){
    const total=bank.length||0;
    const idxs=Array.from({length:total},(_,i)=>i);
    for(let i=idxs.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [idxs[i],idxs[j]]=[idxs[j],idxs[i]]; }
    return idxs.slice(0, Math.min(n,total));
  }

  function startRandomTest(){
    if(!bank || !bank.length){ alert('Chưa có dữ liệu câu hỏi.'); return; }
    randomMode=true;
    const idxs=pickRandomIdxs(10);
    startSet('Random Test', idxs, {mode:'fresh'});
  }
  randomTestBtn?.addEventListener('click', startRandomTest);

  // Random overlay helpers
  function openRandomOverlay(){
    randomOverlay?.classList.remove('hidden'); randomModal?.classList.remove('hidden');
    randomOverlay?.classList.add('show');     randomModal?.classList.add('show');
  }
  function closeRandomOverlay(){
    randomOverlay?.classList.remove('show');  randomModal?.classList.remove('show');
    setTimeout(()=>{ randomOverlay?.classList.add('hidden'); randomModal?.classList.add('hidden'); }, 220);
    show(categoryScreen); hide(quizCard); hide(resultCard); hide(restartBtn); randomMode=false;
  }
  randomClose  ?.addEventListener('click', closeRandomOverlay);
  randomOverlay?.addEventListener('click', (e)=>{ if(e.target===randomOverlay) closeRandomOverlay(); });
  document.addEventListener('keydown', (e)=>{ if(!randomModal || randomModal.classList.contains('hidden')) return; if(e.key==='Escape') closeRandomOverlay(); });

  // Search UI toggle
  toggleSearchBtn?.addEventListener('click', ()=>{
    if(!searchContainer) return;
    const willShow = searchContainer.classList.contains('hidden');
    searchContainer.classList.toggle('hidden');
    if(willShow) setTimeout(()=> searchInput?.focus(), 20);
  });

  // ---------- NAV & SHORTCUTS ----------
  prevBtn?.addEventListener('click', ()=>{ idx=Math.max(0,idx-1); renderQuestion(); });
  nextBtn?.addEventListener('click', ()=>{ if(idx<currentSet.length-1){ idx++; renderQuestion(); } else { showResult(); } });
  exitBtn?.addEventListener('click', ()=>{ saveCategoryProgress(); hide(quizCard); hide(resultCard); show(categoryScreen); buildCategories(); });
  homeBtn?.addEventListener('click', ()=>{ saveCategoryProgress(); hide(quizCard); hide(resultCard); show(categoryScreen); buildCategories(); });
  exitBtn?.addEventListener('click', ()=>{ hide(restartBtn); });
  homeBtn?.addEventListener('click', ()=>{ hide(restartBtn); });

  restartBtn?.addEventListener('click', ()=>{
    if(!quizCard.classList.contains('hidden') && currentCatName){
      if(confirm('Xóa toàn bộ tiến độ danh mục hiện tại và làm lại từ đầu?')){
        clearCategoryProgress(currentCatName);
        startSet(currentCatName, currentSetIdxs, {mode:'fresh'});
      }
    } else {
      alert('Chọn danh mục để bắt đầu.');
    }
  });

  // Search events
  searchBtn?.addEventListener('click', performSearch);
  searchInput?.addEventListener('keydown', (e)=>{ if(e.key==='Enter') performSearch(); });
  searchClear?.addEventListener('click', ()=>{ searchInput.value=''; searchResults.classList.add('hidden'); searchResults.innerHTML=''; });

  // Close-inline (khi mở từ search)
  closeInlineBtn?.addEventListener('click', ()=>{
    hide(quizCard); hide(resultCard); show(categoryScreen);
    searchContainer && searchContainer.classList.remove('hidden');
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (ev)=>{
    const ae=document.activeElement; const tag=ae&&ae.tagName?ae.tagName.toLowerCase():'';
    if(tag==='input' || tag==='textarea' || (ae && ae.isContentEditable)) return;

    const k=(ev && typeof ev.key==='string') ? ev.key : '';
    if(!k) return;

    const inQuiz=!quizCard.classList.contains('hidden');
    const upper=(k.length===1) ? k.toUpperCase() : k;

    if(inQuiz && ['A','B','C','D'].includes(upper)){
      const map={A:0,B:1,C:2,D:3}; const i=map[upper];
      const q=currentSet[idx];
      const correctIndex=(typeof q.correct==='number')?clamp(q.correct,0,3):normalizeCorrect(q.correct,q.options||[]);
      if(!answered.has(idx)){ answersWrap.querySelector(`[data-index="${i}"]`)?.click(); }
      else { renderExplanation(q, i, correctIndex, 'preview'); }
      return;
    }

    if(inQuiz && k==='ArrowLeft'){ prevBtn?.click(); return; }
    if(inQuiz && k==='ArrowRight'){ nextBtn?.click(); return; }
    if(inQuiz && k==='Escape'){ exitBtn?.click(); return; }
  });

  // ---------- INIT ----------
  
  async function init(){
    try{
      // base exam
      const res = await fetch('./exam.json', { cache:'no-store' });
      const base = res.ok ? await res.json() : [];
      
      // optional extra files (do not break if missing)
      const candidates = [
        './review_31.json',
        './wic_part2_full.json',
        './review_37_38_40_43.labeled.json',
        './review_37_38_40_43.explanations.json',
        './review_37_38_40_43.optimized.json',
        './review_37_38_40_43.json'
      ];
      let extras = [];
      for (const f of candidates){
        try{
          const r = await fetch(f, { cache:'no-store' });
          if (r.ok){
            const arr = await r.json();
            if (Array.isArray(arr) && arr.length){
              extras = extras.concat(arr);
            }
          }
        }catch{}
      }

      // local override via LocalStorage (if any)
      try{
        const local = JSON.parse(localStorage.getItem('quizFixedBank')||'[]');
        if(Array.isArray(local)) extras = extras.concat(local);
      }catch{}

      // normalize + dedupe
      bank = dedupeBank( base.map(normalizeRow).filter(Boolean).concat( extras.map(normalizeRow).filter(Boolean) ) );
      
      show(categoryScreen);
      buildCategories();
    }catch(e){
      console.error(e);
    }
  }


  // ===== User modal (change name) =====
  (function initUserModal(){
    if(window.__userModalReady) return; window.__userModalReady = true;

    const uOverlay=document.getElementById('userOverlay');
    const uModal  =document.getElementById('userModal');
    const uInput  =document.getElementById('userInput');
    const uSave   =document.getElementById('userSave');
    const uCancel =document.getElementById('userCancel');
    const uClose  =document.getElementById('userClose');

    uOverlay?.classList.add('hidden'); uOverlay?.classList.remove('show');
    uModal  ?.classList.add('hidden'); uModal  ?.classList.remove('show');

    let __onUserDone=null;
    window.openUserModal=function(initialName='Khách', onDone){
      __onUserDone=onDone||null;
      if(uInput) uInput.value=initialName||'';
      uOverlay?.classList.remove('hidden'); uModal?.classList.remove('hidden');
      uOverlay?.classList.add('show');      uModal?.classList.add('show');
      setTimeout(()=> uInput?.focus(), 30);
    };
    window.closeUserModal=function(){
      uOverlay?.classList.remove('show'); uModal?.classList.remove('show');
      setTimeout(()=>{ uOverlay?.classList.add('hidden'); uModal?.classList.add('hidden'); }, 140);
    };

    uSave  ?.addEventListener('click', ()=>{ const name=(uInput?.value||'').trim(); if(!name){ uInput?.focus(); return; } window.closeUserModal(); __onUserDone && __onUserDone(name); });
    uCancel?.addEventListener('click', window.closeUserModal);
    uClose ?.addEventListener('click', window.closeUserModal);
    uOverlay?.addEventListener('click', (e)=>{ if(e.target===uOverlay) window.closeUserModal(); });

    document.addEventListener('keydown', (e)=>{ if(uModal?.classList.contains('hidden')) return; if(e.key==='Enter') uSave?.click(); if(e.key==='Escape') window.closeUserModal(); });
  })();

  // ===== Gate modal =====
  const gateOverlay=document.getElementById('gateOverlay');
  const gateModal  =document.getElementById('gateModal');
  const gateInput  =document.getElementById('gateInput');
  const gateEnter  =document.getElementById('gateEnter');
  const gateCancel =document.getElementById('gateCancel');
  const gateClose  =document.getElementById('gateClose');
  const gateError  =document.getElementById('gateError');
  const GATE_PASS='roadto1550+';

  gateOverlay?.classList.add('hidden'); gateOverlay?.classList.remove('show');
  gateModal  ?.classList.add('hidden'); gateModal  ?.classList.remove('show');

  let __onGateOk=null;
  function openGateModal(onOk){
    __onGateOk=onOk||null;
    if(gateInput) gateInput.value='';
    gateError?.classList.add('hidden');
    gateOverlay?.classList.remove('hidden'); gateModal?.classList.remove('hidden');
    gateOverlay?.classList.add('show');      gateModal?.classList.add('show');
    setTimeout(()=> gateInput?.focus(), 30);
  }
  function closeGateModal(){
    gateOverlay?.classList.remove('show'); gateModal?.classList.remove('show');
    setTimeout(()=>{ gateOverlay?.classList.add('hidden'); gateModal?.classList.add('hidden'); }, 140);
  }
  function tryEnterGate(){
    const val=(gateInput?.value||'').trim();
    if(val===GATE_PASS){ gateError?.classList.add('hidden'); closeGateModal(); __onGateOk && __onGateOk(true); }
    else{ gateError?.classList.remove('hidden'); gateInput?.focus(); gateInput?.select?.(); }
  }
  gateEnter?.addEventListener('click', tryEnterGate);
  gateCancel?.addEventListener('click', closeGateModal);
  gateClose ?.addEventListener('click', closeGateModal);
  gateOverlay?.addEventListener('click', (e)=>{ if(e.target===gateOverlay) closeGateModal(); });
  document.addEventListener('keydown', (e)=>{ if(!gateModal || gateModal.classList.contains('hidden')) return; if(e.key==='Enter') tryEnterGate(); if(e.key==='Escape') closeGateModal(); });

  async function runApp(){ await init(); }
  (function startWithGate(){
    const ok = sessionStorage.getItem('quizGateOk')==='1';
    if(ok){ ensureUser(); runApp(); return; }
    openGateModal(()=>{ sessionStorage.setItem('quizGateOk','1'); ensureUser(); runApp(); });
  })();
})();

// ===== Admin Sync (optional) =====
const ADMIN_ENDPOINT = 'PASTE_APPS_SCRIPT_WEB_APP_URL_HERE';
const ADMIN_TOKEN    = 'roadto1550plus-admin';
const SESSION_ID     = Math.random().toString(36).slice(2);

async function adminSyncProgress(evt, extra={}){
  try{
    if(typeof currentCatName==='undefined') return;
    const payload={
      token:ADMIN_TOKEN, event:evt,
      userId:localStorage.getItem('quizUserId') || 'Khách',
      userKey:(localStorage.getItem('quizUserId')||'Khách').toLowerCase(),
      category:(typeof currentCatName!=='undefined')?currentCatName:'',
      idx:(typeof idx!=='undefined')?idx:0,
      correctCount:(typeof correctCount!=='undefined')?correctCount:0,
      total:(typeof currentSet!=='undefined' && currentSet)?currentSet.length:0,
      accuracy:(typeof currentSet!=='undefined' && currentSet && currentSet.length)
        ? Math.round((correctCount/currentSet.length)*100) : 0,
      answeredCount:(typeof answered!=='undefined' && answered && answered.size)?answered.size:0,
      sessionId:SESSION_ID, extra
    };
    if(!ADMIN_ENDPOINT || ADMIN_ENDPOINT.includes('PASTE_APPS_SCRIPT_WEB_APP_URL_HERE')) return;
    await fetch(ADMIN_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  }catch{}
}
