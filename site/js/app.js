/**
 * 彰基內分泌健康迷思群島 - 主應用程式邏輯
 * 核心樞紐：彰基內分泌新陳代謝醫療中心 · 杜思德主治醫師
 * 七大主題島嶼：糖尿病、健康減重、骨質疏鬆、肌少症、代謝症候群、牙周共病、甲狀腺疾病
 */

import { IslandScene } from './scene.js';
import confetti from 'canvas-confetti';

class IslandApp {
  constructor() {
    this.content = null;
    this.scene = null;

    // App State (Saved to localStorage)
    this.state = {
      theme: 'mint',
      dayNight: 'day',
      reducedMotion: false,
      soundEnabled: false,
      visitedIslands: [],
      readMyths: [],
      unlockedCards: ['badge-welcome'],
      quizScores: {},
      dailyKeys: 3,
      lastKeyDate: new Date().toDateString(),
      userName: '健康守護者'
    };

    this.audioCtx = null;
    this.bgmTimer = null;
    this.bgmAudio = null;
  }

  async init() {
    this.loadState();
    await this.loadContent();

    this.initScene();
    this.setupUI();
    this.setupClock();
    this.updateProgressUI();
    this.checkDailyKeys();

    // Hide loading screen once ready
    const loader = document.getElementById('app-loader');
    if (loader) {
      setTimeout(() => {
        loader.classList.add('fade-out');
        setTimeout(() => loader.remove(), 600);
      }, 400);
    }
  }

  // --- State Persistence ---
  loadState() {
    try {
      const saved = localStorage.getItem('cch_myth_archipelago_state');
      if (saved) {
        this.state = { ...this.state, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
  }

  saveState() {
    try {
      localStorage.setItem('cch_myth_archipelago_state', JSON.stringify(this.state));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  async loadContent() {
    try {
      const isSubpath = window.location.pathname.includes('/site');
      let res = await fetch(isSubpath ? 'data/content.json' : 'site/data/content.json').catch(() => null);
      if (!res || !res.ok) {
        res = await fetch('data/content.json').catch(() => null);
      }
      if (!res || !res.ok) {
        res = await fetch('site/data/content.json');
      }
      this.content = await res.json();
    } catch (err) {
      console.error('Failed to load content.json', err);
      alert('載入島嶼衛教內容時發生錯誤，請重新整理網頁。');
    }
  }

  // --- 3D Scene Integration ---
  initScene() {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    try {
      this.scene = new IslandScene(container, {
        currentTheme: this.state.theme,
        dayNightMode: this.state.dayNight,
        reducedMotion: this.state.reducedMotion,
        onSelectIsland: (islandId) => this.openIslandDrawer(islandId),
        onRenderFrame: () => this.updateFloatingLabels()
      });
    } catch (err) {
      console.error('WebGL init failed, switching to text list mode:', err);
      document.body.classList.add('no-webgl');
      this.openTextListModal();
    }
  }

  // --- Background Piano Music (User Attached Audio) ---
  initAudio() {
    if (this.bgmAudio) return;
    const isSubpath = window.location.pathname.includes('/site');
    const audioSrc = isSubpath ? 'audio/bgm.mp3' : 'site/audio/bgm.mp3';
    this.bgmAudio = new Audio(audioSrc);
    this.bgmAudio.loop = true;
    this.bgmAudio.volume = 0.5;
  }

  toggleSound() {
    this.initAudio();
    if (!this.bgmAudio) return;

    this.state.soundEnabled = !this.state.soundEnabled;
    const btn = document.getElementById('btn-sound');
    if (btn) {
      btn.classList.toggle('active', this.state.soundEnabled);
      btn.innerHTML = this.state.soundEnabled ? '🔊 鋼琴音樂: 開' : '🔇 音樂: 關';
    }

    if (this.state.soundEnabled) {
      const p = this.bgmAudio.play();
      if (p !== undefined) {
        p.catch((err) => console.warn('Audio play prevented:', err));
      }
      this.showToast('已播放專屬鋼琴背景音樂 🎹');
    } else {
      this.bgmAudio.pause();
      this.showToast('已暫停背景音樂');
    }
    this.saveState();
  }

  // --- Theme & Lighting Switcher ---
  applyTheme(themeId) {
    this.state.theme = themeId;
    document.documentElement.setAttribute('data-theme', themeId);

    document.querySelectorAll('.theme-btn[data-theme]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-theme') === themeId);
    });

    if (this.scene) {
      this.scene.applyThemeColors(themeId);
    }
    this.saveState();
  }

  applyDayNight(mode) {
    this.state.dayNight = mode;
    document.querySelectorAll('.daynight-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });

    if (this.scene) {
      this.scene.applyDayNightLighting(mode);
    }
    this.saveState();
    const names = { day: '晨光日間', sunset: '暖陽黃昏', night: '沉靜星夜' };
    this.showToast(`已切換為「${names[mode]}」光線`);
  }

  toggleReducedMotion() {
    this.state.reducedMotion = !this.state.reducedMotion;
    const btn = document.getElementById('btn-reduced-motion');
    if (btn) {
      btn.classList.toggle('active', this.state.reducedMotion);
      btn.innerHTML = this.state.reducedMotion ? '⏸ 動態: 已暫停' : '▶ 動態: 正常';
    }
    if (this.scene) {
      this.scene.setReducedMotion(this.state.reducedMotion);
    }
    this.saveState();
    this.showToast(this.state.reducedMotion ? '已開啟減少動態保護' : '已恢復自然動態效果');
  }

  // --- Real-time Clock ---
  setupClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;

    const updateClock = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');

      let period = '日間';
      if (now.getHours() >= 17 && now.getHours() < 19) period = '黃昏';
      else if (now.getHours() >= 19 || now.getHours() < 6) period = '夜晚';

      clockEl.innerHTML = `🕒 臺灣時間 <strong>${hours}:${mins}:${secs}</strong> <span class="badge-time">${period}</span>`;
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  // --- Floating 3D Island Labels (Strict Screen Bounds Clamping) ---
  updateFloatingLabels() {
    if (!this.scene) return;

    const islandIds = [
      'island-center',
      'island-01',
      'island-02',
      'island-03',
      'island-04',
      'island-05',
      'island-06',
      'island-07'
    ];

    islandIds.forEach((id) => {
      const el = document.getElementById(`tag-${id}`);
      if (!el) return;

      const screen = this.scene.getIslandScreenPosition(id);
      const margin = 20;
      if (
        screen &&
        screen.visible &&
        screen.x >= margin &&
        screen.x <= window.innerWidth - margin &&
        screen.y >= 45 &&
        screen.y <= window.innerHeight - 80
      ) {
        el.style.display = 'block';
        el.style.left = `${screen.x}px`;
        el.style.top = `${screen.y}px`;
      } else {
        el.style.display = 'none';
      }
    });
  }

  // --- Drawer & Content Navigation ---
  openIslandDrawer(islandId) {
    if (islandId === 'island-center') {
      this.openCenterIslandModal();
      return;
    }

    const island = this.content?.islands.find((isl) => isl.id === islandId);
    if (!island) return;

    // Track visit & badges
    if (!this.state.visitedIslands.includes(islandId)) {
      this.state.visitedIslands.push(islandId);
      this.saveState();
      this.updateProgressUI();
      this.triggerConfetti();
      this.showToast(`✨ 抵達「${island.name}」！`);
    }

    // Unlock badges
    const badgeMap = {
      'island-01': 'badge-diabetes',
      'island-02': 'badge-weight',
      'island-03': 'badge-bone',
      'island-04': 'badge-muscle',
      'island-05': 'badge-metabolic',
      'island-06': 'badge-dental',
      'island-07': 'badge-thyroid'
    };
    if (badgeMap[islandId]) {
      this.unlockCard(badgeMap[islandId]);
    }

    const drawer = document.getElementById('content-drawer');
    const drawerBody = document.getElementById('drawer-body');
    if (!drawer || !drawerBody) return;

    drawerBody.innerHTML = `
      <div class="drawer-header-content">
        <div class="flex items-center justify-between mb-2">
          <span class="category-pill">${island.group}</span>
          <span class="island-order-badge font-bold">島嶼 #0${island.order}</span>
        </div>
        <h2 class="text-2xl font-bold mb-1 text-primary-heading">${island.icon} ${island.name}</h2>
        <p class="text-sm text-muted mb-3 leading-relaxed">${island.intro}</p>
        
        <div class="landmark-banner p-3 rounded-xl mb-4 bg-surface-alt border border-line">
          <div class="flex items-center gap-2 font-bold text-sm text-primary mb-1">
            <span>🏛️ 特色地標建築</span>
            <span>${island.landmark}</span>
          </div>
          <p class="text-xs text-muted leading-relaxed">${island.landmarkDesc}</p>
        </div>

        <!-- Key Indicators Pill Row -->
        <div class="grid grid-cols-3 gap-2 mb-4">
          ${island.keyStats.map(st => `
            <div class="stat-card p-2 text-center rounded-xl bg-surface-alt border border-line">
              <div class="text-[11px] text-muted">${st.label}</div>
              <div class="text-xs font-bold text-primary mt-0.5">${st.value}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="section-tabs mb-4 flex gap-2 border-b border-line pb-2">
        <button class="tab-btn active" data-tab="myths">💡 迷思破解全清單 (${island.myths.length})</button>
        <button class="tab-btn" data-tab="quiz">🎯 島嶼隨堂測驗 (${island.quiz ? island.quiz.length : 0})</button>
      </div>

      <div id="tab-pane-myths" class="tab-pane active space-y-3">
        ${island.myths.map((m, idx) => `
          <div class="card p-4 rounded-xl border border-line bg-surface hover:border-primary transition">
            <div class="flex items-start gap-2 mb-2">
              <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0">迷思 #${idx + 1}</span>
              <h4 class="font-bold text-base text-ink">${m.myth}</h4>
            </div>
            <div class="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 text-xs text-emerald-950 mb-2 leading-relaxed">
              <div class="font-bold text-emerald-800 mb-0.5">✅ 彰基醫學團隊解答真相：</div>
              ${m.truth}
            </div>
            <div class="text-xs text-muted flex items-start gap-1.5 pt-1 border-t border-line">
              <span class="text-primary font-bold">🎯 行動建議：</span>
              <span>${m.action}</span>
            </div>
          </div>
        `).join('')}

        <div class="p-3 bg-surface-alt border border-line rounded-xl text-xs text-muted text-center mt-3">
          ${this.content.generalReminder}
        </div>
      </div>

      <div id="tab-pane-quiz" class="tab-pane hidden space-y-4">
        ${this.renderQuizHTML(island)}
      </div>
    `;

    // Bind tab switching
    drawerBody.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-tab');
        drawerBody.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        drawerBody.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.add('hidden'));
        const activePane = drawerBody.querySelector(`#tab-pane-${target}`);
        if (activePane) activePane.classList.remove('hidden');
      });
    });

    // Bind quiz submission
    this.bindQuizEvents(drawerBody, island);

    drawer.classList.add('open');
  }

  closeDrawer() {
    const drawer = document.getElementById('content-drawer');
    if (drawer) drawer.classList.remove('open');
  }

  // --- Central Medical Hub Modal (彰化基督教醫院 內分泌暨新陳代謝科 - 全體醫師一覽) ---
  openCenterIslandModal() {
    const central = this.content?.central;
    if (!central) return;

    // Track Central visit
    if (!this.state.visitedIslands.includes('island-center')) {
      this.state.visitedIslands.push('island-center');
      this.saveState();
      this.updateProgressUI();
    }
    this.unlockCard('badge-welcome');

    let modal = document.getElementById('modal-central-hub');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-central-hub';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const doctors = central.doctors || [];

    modal.innerHTML = `
      <div class="modal-card modal-large" style="max-width: 960px;">
        <div class="modal-header">
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">🏛️</span>
            <div>
              <h3 class="modal-title font-bold text-lg text-primary">${central.name}</h3>
              <p class="text-xs text-muted">${central.title} · 全體主治醫師與專科門診一覽（共 ${doctors.length} 位專科醫師）</p>
            </div>
          </div>
          <button class="btn-modal-close" id="btn-close-central">✕</button>
        </div>

        <div class="modal-body space-y-4 max-h-[78vh] overflow-y-auto pr-1">
          <!-- Overview Card -->
          <div class="card p-3.5 rounded-xl border border-line bg-surface-alt flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="text-xs leading-relaxed text-muted">
              ${central.intro}
            </div>
            <div class="flex flex-wrap gap-2 flex-shrink-0">
              <a href="https://www1.cch.org.tw/opd/service-e.aspx?id=0107&Page=11&#p" target="_blank" rel="noopener noreferrer" class="btn-action px-3.5 py-2 bg-primary text-white rounded-xl text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 shadow-sm hover:opacity-90">
                <span>📅</span> 彰基門診線上掛號
              </a>
              <a href="${central.officialUrl}" target="_blank" rel="noopener noreferrer" class="btn-action px-3.5 py-2 bg-surface border border-line text-ink rounded-xl text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5 shadow-sm hover:border-primary">
                <span>🌐</span> 專科首頁
              </a>
            </div>
          </div>

          <!-- Doctor Filter and Search Bar -->
          <div class="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-surface p-2.5 rounded-xl border border-line">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-xs font-bold text-muted whitespace-nowrap">專長快選：</span>
              <button class="doc-filter-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-primary text-white" data-filter="all">全部 (${doctors.length})</button>
              <button class="doc-filter-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-alt text-ink border border-line" data-filter="糖尿病">糖尿病</button>
              <button class="doc-filter-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-alt text-ink border border-line" data-filter="甲狀腺">甲狀腺</button>
              <button class="doc-filter-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-alt text-ink border border-line" data-filter="骨質疏鬆">骨質疏鬆</button>
              <button class="doc-filter-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-alt text-ink border border-line" data-filter="代謝">高血脂/代謝</button>
            </div>
            <input type="text" id="doc-search-input" placeholder="搜尋醫師姓名或專長..." class="w-full sm:w-48 px-3 py-1.5 rounded-lg border border-line bg-surface-alt text-xs text-ink focus:outline-none focus:border-primary" />
          </div>

          <!-- Doctor Cards Grid (All 18 Doctors) -->
          <div id="doctor-cards-grid" class="grid grid-cols-1 md:grid-cols-2 gap-3">
            ${this.renderDoctorCards(doctors)}
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.querySelector('#btn-close-central')?.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    // Doctor Search & Filter Handlers
    const gridEl = modal.querySelector('#doctor-cards-grid');
    const searchInput = modal.querySelector('#doc-search-input');
    const filterBtns = modal.querySelectorAll('.doc-filter-btn');

    let currentFilter = 'all';
    let currentQuery = '';

    const updateFilter = () => {
      let filtered = doctors;
      if (currentFilter !== 'all') {
        filtered = filtered.filter(doc => 
          doc.name.includes(currentFilter) ||
          doc.specialties.some(s => s.includes(currentFilter))
        );
      }
      if (currentQuery) {
        filtered = filtered.filter(doc =>
          doc.name.toLowerCase().includes(currentQuery) ||
          doc.title.toLowerCase().includes(currentQuery) ||
          doc.specialties.some(s => s.toLowerCase().includes(currentQuery))
        );
      }
      gridEl.innerHTML = this.renderDoctorCards(filtered);
    };

    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        filterBtns.forEach(b => {
          b.className = 'doc-filter-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-surface-alt text-ink border border-line';
        });
        e.currentTarget.className = 'doc-filter-btn px-2.5 py-1 rounded-lg text-xs font-bold bg-primary text-white';
        currentFilter = e.currentTarget.getAttribute('data-filter');
        updateFilter();
      });
    });

    searchInput?.addEventListener('input', (e) => {
      currentQuery = e.target.value.trim().toLowerCase();
      updateFilter();
    });
  }

  renderDoctorCards(doctors) {
    if (!doctors || doctors.length === 0) {
      return `<div class="col-span-2 text-center py-8 text-xs text-muted">查無相符的專科醫師</div>`;
    }

    return doctors.map(doc => `
      <div class="card p-3.5 rounded-xl border border-line bg-surface hover:border-primary transition flex flex-col justify-between">
        <div>
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-base font-bold text-ink">${doc.name}</span>
                ${doc.name.includes('兼任') ? '<span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">兼任</span>' : '<span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">主治醫師</span>'}
              </div>
              <p class="text-[11px] text-primary font-medium mt-0.5">${doc.title}</p>
            </div>
            <a href="${doc.appointmentUrl || 'https://www1.cch.org.tw/opd/service-e.aspx?id=0107&Page=11&#p'}" target="_blank" rel="noopener noreferrer" class="btn-action px-2.5 py-1 bg-primary text-white rounded-lg text-xs font-bold whitespace-nowrap shadow-sm hover:opacity-90 inline-flex items-center gap-1">
              <span>📅</span> 線上掛號
            </a>
          </div>

          <div class="mt-2 pt-2 border-t border-line/60">
            <span class="text-[10px] font-bold text-muted block mb-1">主治疾患與專長：</span>
            <div class="flex flex-wrap gap-1">
              ${doc.specialties.map(spec => `
                <span class="text-[11px] px-2 py-0.5 rounded-md bg-surface-alt text-ink border border-line/50">
                  ${spec}
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[11px]">
          <span class="text-muted">彰化基督教醫院 門診部</span>
          <a href="${doc.officialUrl}" target="_blank" rel="noopener noreferrer" class="text-primary font-bold hover:underline inline-flex items-center gap-0.5">
            醫師詳細簡介 →
          </a>
        </div>
      </div>
    `).join('');
  }

  // --- Quiz Generator ---
  renderQuizHTML(island) {
    if (!island.quiz || island.quiz.length === 0) {
      return `<p class="text-xs text-muted p-4 text-center">本島嶼小測驗籌備中</p>`;
    }

    return `
      <div class="bg-blue-50/70 p-3 rounded-xl border border-blue-100 text-xs text-blue-950 mb-3">
        <strong>🎯 實證衛教測驗：</strong>測試您對${island.name}的理解，答對可累積健康積分！
      </div>

      ${island.quiz.map((q, qIdx) => `
        <div class="quiz-box card p-4 rounded-xl border border-line bg-surface mb-3" data-q-idx="${qIdx}">
          <p class="font-bold text-sm text-ink mb-3">${qIdx + 1}. ${q.q}</p>
          <div class="space-y-2">
            ${q.options.map((opt, optIdx) => `
              <label class="quiz-option">
                <input type="radio" name="quiz-${island.id}-${qIdx}" value="${optIdx}" class="hidden" />
                <span class="opt-indicator">${['A', 'B', 'C', 'D'][optIdx]}</span>
                <span class="opt-text text-xs leading-relaxed text-ink">${opt}</span>
              </label>
            `).join('')}
          </div>
          <div class="quiz-result hidden mt-3 p-3 rounded-xl text-xs border"></div>
        </div>
      `).join('')}

      <button id="btn-submit-quiz" class="btn-action w-full py-2.5 bg-primary text-white rounded-xl font-bold text-xs shadow-sm hover:opacity-90">
        送出測驗答案並查看解析
      </button>
    `;
  }

  bindQuizEvents(container, island) {
    const submitBtn = container.querySelector('#btn-submit-quiz');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', () => {
      let correctCount = 0;
      island.quiz.forEach((q, qIdx) => {
        const box = container.querySelector(`.quiz-box[data-q-idx="${qIdx}"]`);
        const checked = box.querySelector(`input[name="quiz-${island.id}-${qIdx}"]:checked`);
        const resultEl = box.querySelector('.quiz-result');

        if (!checked) {
          resultEl.className = 'quiz-result mt-3 p-3 rounded-xl text-xs border bg-amber-50 text-amber-900 border-amber-200';
          resultEl.innerHTML = '⚠️ 請先選擇此題答案！';
          resultEl.classList.remove('hidden');
          return;
        }

        const selected = parseInt(checked.value, 10);
        if (selected === q.correct) {
          correctCount++;
          resultEl.className = 'quiz-result mt-3 p-3 rounded-xl text-xs border bg-emerald-50 text-emerald-950 border-emerald-200';
          resultEl.innerHTML = `✅ <strong>回答正確！</strong><br>${q.explanation}`;
        } else {
          resultEl.className = 'quiz-result mt-3 p-3 rounded-xl text-xs border bg-rose-50 text-rose-950 border-rose-200';
          resultEl.innerHTML = `❌ <strong>回答錯誤</strong>（正確解答：${['A', 'B', 'C', 'D'][q.correct]}）<br>${q.explanation}`;
        }
        resultEl.classList.remove('hidden');
      });

      this.state.quizScores[island.id] = correctCount;
      this.saveState();
      this.updateProgressUI();

      if (correctCount === island.quiz.length) {
        this.triggerConfetti();
        this.showToast(`🎉 恭喜！${island.name}測驗獲得滿分！`);
      } else {
        this.showToast(`測驗完成！您答對了 ${correctCount} / ${island.quiz.length} 題`);
      }
    });
  }

  // --- Feature Modal: Seven Islands Text List (無障礙與純文字模式) ---
  openTextListModal() {
    let modal = document.getElementById('modal-list');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-list';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const islands = this.content?.islands || [];
    const central = this.content?.central;

    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="text-xl">🗺️</span>
            <div>
              <h3 class="modal-title font-bold text-base">七大重點衛教島嶼 清單</h3>
              <p class="text-xs text-muted">彰基常見健康與疾病迷思解答手冊 · 快速導覽</p>
            </div>
          </div>
          <button class="btn-modal-close" id="btn-close-list">✕</button>
        </div>

        <div class="modal-body space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          <!-- Central Hub -->
          <div class="card p-3 rounded-xl border-2 border-primary/40 bg-primary/5 flex items-center justify-between">
            <div>
              <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-white">醫療總部</span>
              <h4 class="font-bold text-sm text-ink mt-1">🏛️ ${central?.name}</h4>
              <p class="text-xs text-muted">全體 18 位內分泌暨新陳代謝科主治醫師總覽</p>
            </div>
            <button class="btn-action px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold btn-open-island-from-list" data-id="island-center">
              查看全體醫師
            </button>
          </div>

          <!-- 7 Outer Islands -->
          ${islands.map(isl => `
            <div class="card p-3 rounded-xl border border-line bg-surface flex items-center justify-between hover:border-primary transition">
              <div>
                <div class="flex items-center gap-1.5 mb-0.5">
                  <span class="text-xs font-bold text-muted">#0${isl.order}</span>
                  <span class="text-xs font-bold px-1.5 py-0.2 rounded bg-surface-alt text-primary">${isl.group}</span>
                </div>
                <h4 class="font-bold text-sm text-ink">${isl.icon} ${isl.name}</h4>
                <p class="text-[11px] text-muted">${isl.myths.length} 項迷思全破解 · ${isl.landmark}</p>
              </div>
              <button class="btn-action px-3 py-1.5 bg-surface-alt border border-line text-ink rounded-lg text-xs font-bold hover:bg-primary hover:text-white btn-open-island-from-list" data-id="${isl.id}">
                前往島嶼
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.querySelector('#btn-close-list')?.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    modal.querySelectorAll('.btn-open-island-from-list').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        modal.classList.remove('open');
        if (this.scene) {
          this.scene.focusIsland(id);
        }
        this.openIslandDrawer(id);
      });
    });
  }

  // --- Feature Modal: Guide (糖糖小嚮導) ---
  openGuideModal() {
    let modal = document.getElementById('modal-guide');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-guide';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="text-2xl">👩‍⚕️</span>
            <div>
              <h3 class="modal-title font-bold text-base">糖糖衛教師 · 健康智能小嚮導</h3>
              <p class="text-xs text-muted">彰基內分泌七大迷思即時解答庫</p>
            </div>
          </div>
          <button class="btn-modal-close" id="btn-close-guide">✕</button>
        </div>

        <div class="modal-body space-y-4">
          <div class="flex items-start gap-3 p-3 bg-surface-alt rounded-xl border border-line text-xs">
            <span class="text-2xl">💡</span>
            <div>
              <strong>您好！我是彰基糖糖衛教師~</strong><br>
              請輸入您想了解的健康疑問（如：吃甜食、減重宵夜、大骨湯補鈣、深蹲防肌少、腰圍標準、洗牙、甲狀腺大脖子、杜思德醫師）：
            </div>
          </div>

          <div class="flex gap-2">
            <input type="text" id="guide-search-input" placeholder="輸入關鍵字，例如：吃甜、大骨湯、腰圍、重訓..." class="flex-1 px-3 py-2 rounded-xl border border-line bg-surface text-xs text-ink focus:outline-none focus:border-primary" />
            <button id="btn-guide-search" class="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold">查詢</button>
          </div>

          <div class="flex flex-wrap gap-1.5 text-xs">
            <span class="text-muted text-[11px] self-center">快速問答：</span>
            <button class="quick-pill" data-q="吃太甜才會得糖尿病">吃甜食得糖尿病?</button>
            <button class="quick-pill" data-q="宵夜">減重能吃宵夜?</button>
            <button class="quick-pill" data-q="大骨湯">大骨湯能補鈣?</button>
            <button class="quick-pill" data-q="散步預防肌少">散步能防肌少?</button>
            <button class="quick-pill" data-q="腰圍">代謝症候群腰圍?</button>
            <button class="quick-pill" data-q="牙周">糖尿病與牙周病?</button>
            <button class="quick-pill" data-q="大脖子">大脖子是甲亢?</button>
            <button class="quick-pill" data-q="杜思德">杜思德醫師簡介</button>
          </div>

          <div id="guide-answer-box" class="p-4 bg-surface rounded-xl border border-line min-h-[140px] max-h-[220px] overflow-y-auto text-xs leading-relaxed">
            請輸入上方關鍵字或點擊快捷標籤，我會為您調閱彰基衛教手冊的精準解答！
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.querySelector('#btn-close-guide')?.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    const input = modal.querySelector('#guide-search-input');
    const answerBox = modal.querySelector('#guide-answer-box');

    const handleSearch = (query) => {
      if (!query.trim()) return;
      const q = query.toLowerCase();

      if (q.includes('杜思德') || q.includes('門診') || q.includes('掛號') || q.includes('醫生') || q.includes('醫師')) {
        answerBox.innerHTML = `
          <div class="text-primary font-bold mb-1">🏛️ 彰基內分泌醫療中心 · 杜思德 主治醫師</div>
          <p class="mb-2">杜思德醫師為前中華民國糖尿病衛教學會理事長，專精糖尿病、肥胖減重、骨質疏鬆、肌少症及甲狀腺疾患。</p>
          <button class="px-3 py-1 bg-primary text-white rounded-lg text-xs font-bold" id="btn-goto-center-hub">查看完整資歷與門診掛號</button>
        `;
        answerBox.querySelector('#btn-goto-center-hub')?.addEventListener('click', () => {
          modal.classList.remove('open');
          this.openCenterIslandModal();
        });
        return;
      }

      // Search across all myths
      let matched = [];
      this.content?.islands.forEach((isl) => {
        isl.myths.forEach((m) => {
          if (m.myth.toLowerCase().includes(q) || m.truth.toLowerCase().includes(q)) {
            matched.push({ island: isl, item: m });
          }
        });
      });

      if (matched.length > 0) {
        answerBox.innerHTML = matched.map((match) => `
          <div class="mb-3 pb-2 border-b border-line last:border-none">
            <div class="font-bold text-primary mb-0.5">${match.island.icon} 【${match.island.name}】</div>
            <div class="font-bold text-ink mb-1">❌ 迷思：${match.item.myth}</div>
            <div class="bg-emerald-50 p-2 rounded-lg text-emerald-950 text-[11px] mb-1">✅ <strong>真相：</strong>${match.item.truth}</div>
            <div class="text-[11px] text-muted">🎯 <strong>建議：</strong>${match.item.action}</div>
          </div>
        `).join('');
      } else {
        answerBox.innerHTML = `
          <div class="text-muted text-center py-4">
            抱歉，未找到與「${query}」完全吻合的迷思。您可以嘗試搜尋「吃甜、洗腎、大骨湯、散步、腰圍、刷牙、海帶、甲狀腺」等關鍵字，或點選下方「七大島嶼清單」直接閱讀！
          </div>
        `;
      }
    };

    modal.querySelector('#btn-guide-search')?.addEventListener('click', () => handleSearch(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch(input.value);
    });

    modal.querySelectorAll('.quick-pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        const kw = e.currentTarget.getAttribute('data-q');
        input.value = kw;
        handleSearch(kw);
      });
    });
  }

  // --- Feature Modal: Daily Key & Health Chest ---
  checkDailyKeys() {
    const today = new Date().toDateString();
    if (this.state.lastKeyDate !== today) {
      this.state.dailyKeys = 3;
      this.state.lastKeyDate = today;
      this.saveState();
    }
  }

  openDailyChestModal() {
    this.checkDailyKeys();

    let modal = document.getElementById('modal-chest');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-chest';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const tips = [
      "💡 彰基醫師叮嚀：低血糖（<70 mg/dL）應遵循 15-15 原則補充方糖或純果汁，切忌食用高脂巧克力！",
      "💡 彰基醫師叮嚀：極端節食去澱粉只會減掉水分與肌肉，選擇全穀雜糧與維持肌肉才是長久之計！",
      "💡 彰基醫師叮嚀：身高比年輕時矮 4 公分以上，是無痛脊椎壓迫骨折警訊，請儘速檢查骨質密度！",
      "💡 彰基醫師叮嚀：散步主要強化心肺，預防肌少症務必加入彈力帶或深蹲等阻力運動！",
      "💡 彰基醫師叮嚀：男性腰圍 ≥ 90 cm、女性 ≥ 80 cm是內臟脂肪警訊，減重 5~10% 各項指標可全面逆轉！",
      "💡 彰基醫師叮嚀：糖尿病與牙周病具有雙向發炎影響，每晚務必確實使用牙線清潔牙縫死角！",
      "💡 彰基醫師叮嚀：臨床逾 90% 甲狀腺結節為良性，定期追蹤超音波即可，毋須恐慌盲目禁碘！"
    ];

    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="text-xl">🎁</span>
            <h3 class="modal-title font-bold text-base">每日健康鑰匙寶箱</h3>
          </div>
          <button class="btn-modal-close" id="btn-close-chest">✕</button>
        </div>

        <div class="modal-body text-center space-y-4">
          <div class="text-4xl py-2">🗝️</div>
          <p class="text-xs text-muted">今日尚有 <strong class="text-primary text-sm">${this.state.dailyKeys}</strong> 把鑰匙（每天自動重置 3 把）</p>

          <div id="chest-reward-area" class="p-3 bg-surface-alt rounded-xl border border-line text-xs min-h-[60px] flex items-center justify-center">
            ${this.state.dailyKeys > 0 ? '點擊下方按鈕開啟健康知識錦囊！' : '今天的鑰匙已經用完囉，明天再來開寶箱吧！'}
          </div>

          <button id="btn-open-chest" class="btn-action w-full py-2.5 bg-primary text-white rounded-xl text-xs font-bold ${this.state.dailyKeys <= 0 ? 'opacity-50 cursor-not-allowed' : ''}">
            開啟寶箱（消耗 1 把鑰匙）
          </button>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.querySelector('#btn-close-chest')?.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    modal.querySelector('#btn-open-chest')?.addEventListener('click', () => {
      if (this.state.dailyKeys <= 0) return;
      this.state.dailyKeys--;
      this.saveState();

      const randomTip = tips[Math.floor(Math.random() * tips.length)];
      modal.querySelector('#chest-reward-area').innerHTML = `
        <div class="text-primary font-bold leading-relaxed text-xs">
          ${randomTip}
        </div>
      `;
      this.triggerConfetti();
      this.openDailyChestModal();
    });
  }

  // --- Feature Modal: Collection & Badges ---
  unlockCard(badgeId) {
    if (!this.state.unlockedCards.includes(badgeId)) {
      this.state.unlockedCards.push(badgeId);
      this.saveState();
      this.showToast('🎖️ 解鎖全新衛教榮譽圖鑑！');
    }
  }

  openCollectionModal() {
    let modal = document.getElementById('modal-collection');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-collection';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const badges = [
      { id: 'badge-welcome', icon: '🏛️', name: '彰基內分泌總部', desc: '造訪彰化基督教醫院內分泌暨新陳代謝科，認識全體18位專科主治醫師。' },
      { id: 'badge-diabetes', icon: '🩸', name: '穩糖護心腎星', desc: '探索糖尿病迷思島，精通 HbA1c 與低血糖防護。' },
      { id: 'badge-weight', icon: '⚖️', name: '健康減脂達人', desc: '探索健康減重迷思島，破解極端節食與代謝陷阱。' },
      { id: 'badge-bone', icon: '🦴', name: '骨骼守護金盾', desc: '探索骨質疏鬆迷思島，掌握鈣質、維生素D與負重運動。' },
      { id: 'badge-muscle', icon: '💪', name: '阻力增肌先鋒', desc: '探索肌少症迷思島，重視每餐優質蛋白與阻抗鍛鍊。' },
      { id: 'badge-metabolic', icon: '📏', name: '黃金腰圍標竿', desc: '探索代謝症候群迷思島，堅守男90女80逆轉心血管風險。' },
      { id: 'badge-dental', icon: '🦷', name: '齒顎共照守護', desc: '探索牙周病共病迷思島，貫徹定期潔牙阻斷全身發炎。' },
      { id: 'badge-thyroid', icon: '🦋', name: '甲狀腺智慧眼', desc: '探索甲狀腺迷思島，正確認知良性結節與抽血超音波。' }
    ];

    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏆</span>
            <h3 class="modal-title font-bold text-base">七大衛教 榮譽圖鑑</h3>
          </div>
          <button class="btn-modal-close" id="btn-close-collection">✕</button>
        </div>

        <div class="modal-body space-y-3">
          <p class="text-xs text-muted">造訪各島嶼並研讀衛教迷思，解鎖所有健康徽章：</p>
          <div class="grid grid-cols-2 gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
            ${badges.map((b) => {
              const unlocked = this.state.unlockedCards.includes(b.id);
              return `
                <div class="p-3 rounded-xl border ${unlocked ? 'border-primary/40 bg-surface' : 'border-line bg-surface-alt/60 opacity-60'} text-center">
                  <div class="text-2xl mb-1">${unlocked ? b.icon : '🔒'}</div>
                  <h4 class="font-bold text-xs ${unlocked ? 'text-primary' : 'text-muted'} mb-1">${b.name}</h4>
                  <p class="text-[10px] text-muted leading-tight">${unlocked ? b.desc : '探索對應主題島嶼解鎖'}</p>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.querySelector('#btn-close-collection')?.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // --- Feature Modal: Certificate Generator (HTML5 Canvas) ---
  openCertificateModal() {
    let modal = document.getElementById('modal-certificate');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-certificate';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card modal-large">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="text-xl">📜</span>
            <h3 class="modal-title font-bold text-base">結業榮譽證書頒發</h3>
          </div>
          <button class="btn-modal-close" id="btn-close-cert">✕</button>
        </div>

        <div class="modal-body space-y-4">
          <div class="text-xs text-muted">
            表彰您對彰基七大健康迷思與內分泌醫療團隊專業指引之探索成就！
          </div>

          <div class="flex items-center gap-2">
            <label class="text-xs font-bold text-ink whitespace-nowrap">受獎者姓名：</label>
            <input type="text" id="cert-name-input" value="${this.state.userName}" class="flex-1 px-3 py-1.5 rounded-lg border border-line bg-surface text-xs text-ink focus:outline-none focus:border-primary" />
            <button id="btn-update-cert" class="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold">更新證書</button>
          </div>

          <div class="canvas-wrapper flex justify-center bg-surface-alt p-2 rounded-xl border border-line overflow-hidden">
            <canvas id="cert-canvas" width="800" height="500" class="max-w-full h-auto rounded-lg shadow-sm"></canvas>
          </div>

          <div class="flex justify-end gap-2">
            <button id="btn-download-cert" class="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:opacity-90">
              💾 下載證書圖片 (PNG)
            </button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.querySelector('#btn-close-cert')?.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    const canvas = modal.querySelector('#cert-canvas');
    const nameInput = modal.querySelector('#cert-name-input');

    const drawCertificate = (name) => {
      const ctx = canvas.getContext('2d');
      // Background
      ctx.fillStyle = '#fbfdfc';
      ctx.fillRect(0, 0, 800, 500);

      // Elegant Dual Borders
      ctx.strokeStyle = '#2a8a74';
      ctx.lineWidth = 10;
      ctx.strokeRect(20, 20, 760, 460);

      ctx.strokeStyle = '#e27d60';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 30, 740, 440);

      // Header Title
      ctx.fillStyle = '#1e3a34';
      ctx.font = 'bold 30px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('彰基內分泌健康迷思群島 · 榮譽結業證書', 400, 85);

      ctx.fillStyle = '#6b7280';
      ctx.font = '14px "Noto Sans TC", sans-serif';
      ctx.fillText('CERTIFICATE OF HEALTH KNOWLEDGE & MYTH EXPLORATION', 400, 115);

      // Recipient Name
      ctx.fillStyle = '#2a8a74';
      ctx.font = 'bold 36px "Huninn", "Noto Sans TC", sans-serif';
      ctx.fillText(name || '健康守護勇者', 400, 195);

      // Citation text
      ctx.fillStyle = '#374151';
      ctx.font = '16px "Noto Sans TC", sans-serif';
      ctx.fillText('恭喜您已完整造訪彰基內分泌 3D 群島，深入研讀七大主題衛教項目，', 400, 255);
      ctx.fillText('破解 70 項健康迷思與臨床指引，展現卓越之健康素養與自我守護決心！', 400, 285);

      // Statistics box
      const visitedCount = this.state.visitedIslands.length;
      let totalScore = 0;
      Object.values(this.state.quizScores).forEach((sc) => (totalScore += sc));

      ctx.fillStyle = '#f0fdf9';
      ctx.strokeStyle = '#99f6e4';
      ctx.lineWidth = 1;
      ctx.fillRect(180, 320, 440, 50);
      ctx.strokeRect(180, 320, 440, 50);

      ctx.fillStyle = '#0f766e';
      ctx.font = 'bold 15px "Noto Sans TC", sans-serif';
      ctx.fillText(`已訪島嶼：${visitedCount} / 8 座  |  測驗累積積分：${totalScore} 分`, 400, 352);

      // Seal and Sign-off
      ctx.fillStyle = '#4b5563';
      ctx.font = '13px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('發行單位：彰化基督教醫院 內分泌暨新陳代謝科 醫療團隊', 50, 425);
      ctx.fillText('總部陣容：全體 18 位內分泌暨新陳代謝專科主治醫師', 50, 445);

      // Stamp
      ctx.save();
      ctx.translate(670, 410);
      ctx.rotate(-0.1);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 3;
      ctx.strokeRect(-65, -30, 130, 60);
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 13px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('彰化基督教醫院', 0, -8);
      ctx.fillText('內分泌暨新陳代謝科', 0, 14);
      ctx.restore();
    };

    drawCertificate(this.state.userName);

    modal.querySelector('#btn-update-cert')?.addEventListener('click', () => {
      this.state.userName = nameInput.value.trim() || '健康守護者';
      this.saveState();
      drawCertificate(this.state.userName);
      this.showToast('證書姓名已更新！');
    });

    modal.querySelector('#btn-download-cert')?.addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `彰基內分泌群島榮譽證書_${this.state.userName}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  // --- Feature Modal: Save Code (跨裝置接關碼) ---
  openSaveCodeModal() {
    let modal = document.getElementById('modal-savecode');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-savecode';
      modal.className = 'modal-backdrop';
      document.body.appendChild(modal);
    }

    const exportCode = btoa(unescape(encodeURIComponent(JSON.stringify(this.state))));

    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="flex items-center gap-2">
            <span class="text-xl">🔑</span>
            <h3 class="modal-title font-bold text-base">跨裝置接關碼 (進度存取)</h3>
          </div>
          <button class="btn-modal-close" id="btn-close-savecode">✕</button>
        </div>

        <div class="modal-body space-y-4">
          <div>
            <label class="text-xs font-bold text-muted mb-1 block">您的專屬進度接關代碼：</label>
            <textarea id="savecode-export" class="w-full p-2.5 rounded-xl border border-line bg-surface-alt text-xs font-mono select-all focus:outline-none" rows="3" readonly>${exportCode}</textarea>
            <button id="btn-copy-savecode" class="mt-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold">複製接關碼</button>
          </div>

          <div class="border-t border-line pt-3">
            <label class="text-xs font-bold text-muted mb-1 block">在其他裝置還原進度：</label>
            <textarea id="savecode-import" class="w-full p-2.5 rounded-xl border border-line bg-surface text-xs font-mono focus:outline-none focus:border-primary" rows="2" placeholder="在此貼上接關代碼..."></textarea>
            <button id="btn-apply-savecode" class="mt-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold">載入進度</button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('open');
    modal.querySelector('#btn-close-savecode')?.addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    modal.querySelector('#btn-copy-savecode')?.addEventListener('click', () => {
      navigator.clipboard.writeText(exportCode).then(() => {
        this.showToast('✅ 接關代碼已成功複製！');
      });
    });

    modal.querySelector('#btn-apply-savecode')?.addEventListener('click', () => {
      const code = modal.querySelector('#savecode-import').value.trim();
      if (!code) return;
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(code))));
        this.state = { ...this.state, ...decoded };
        this.saveState();
        this.updateProgressUI();
        modal.classList.remove('open');
        this.showToast('🎉 進度已成功同步還原！');
      } catch (err) {
        alert('無效的接關代碼，請確認代碼完整性。');
      }
    });
  }

  // --- Feature: Share Card ---
  openShareModal() {
    const text = `🏝️ 我正在探索「彰基內分泌健康迷思群島」！由前糖尿病衛教學會理事長 杜思德醫師醫療團隊製作，破解糖尿病、減重、骨鬆、肌少症、代謝症候群、牙周病及甲狀腺7大迷思，快來一起測試您的健康觀念：\n${window.location.href}`;
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('📋 分享文案與島嶼連結已複製至剪貼簿！');
    }).catch(() => {
      prompt('請複製以下分享文案：', text);
    });
  }

  // --- UI Updates ---
  updateProgressUI() {
    const totalIslands = 8; // Central Hub + 7 Outer Islands
    const visited = this.state.visitedIslands.length;
    const pct = Math.min(Math.round((visited / totalIslands) * 100), 100);

    const textEl = document.getElementById('progress-bar-text');
    const fillEl = document.getElementById('progress-bar-fill');
    if (textEl) textEl.textContent = `探索進度: ${pct}% (${visited}/${totalIslands}座)`;
    if (fillEl) fillEl.style.width = `${pct}%`;
  }

  triggerConfetti() {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 }
      });
    } catch (e) {
      // Confetti fallback
    }
  }

  showToast(message) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  // --- Event Bindings ---
  setupUI() {
    // 1. Overview Button
    document.getElementById('btn-overview')?.addEventListener('click', () => {
      if (this.scene) this.scene.resetToOverview();
      this.closeDrawer();
      this.showToast('已切換為群島全景視角');
    });

    // 2. Dock Toggle
    const dock = document.getElementById('bottom-dock');
    const toggleBtn = document.getElementById('btn-dock-toggle');
    if (toggleBtn && dock) {
      toggleBtn.addEventListener('click', () => {
        dock.classList.toggle('collapsed');
        toggleBtn.textContent = dock.classList.contains('collapsed') ? '▴ 展開控制塢' : '▾ 收合控制塢';
      });
    }

    // 3. Floating 3D Island Tags click handlers
    const islandIds = [
      'island-center',
      'island-01',
      'island-02',
      'island-03',
      'island-04',
      'island-05',
      'island-06',
      'island-07'
    ];
    islandIds.forEach((id) => {
      document.getElementById(`tag-${id}`)?.addEventListener('click', () => {
        if (this.scene) this.scene.focusIsland(id);
        this.openIslandDrawer(id);
      });
    });

    // 4. Drawer Close Button
    document.getElementById('btn-drawer-close')?.addEventListener('click', () => this.closeDrawer());

    // 5. Place List Button
    document.getElementById('btn-list')?.addEventListener('click', () => this.openTextListModal());

    // 6. Theme Buttons
    document.querySelectorAll('.theme-btn[data-theme]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const theme = e.currentTarget.getAttribute('data-theme');
        this.applyTheme(theme);
      });
    });

    // 7. Day / Night Buttons
    document.querySelectorAll('.daynight-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.getAttribute('data-mode');
        this.applyDayNight(mode);
      });
    });

    // 8. Reduced Motion toggle
    document.getElementById('btn-reduced-motion')?.addEventListener('click', () => this.toggleReducedMotion());

    // 9. Sound toggle
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());

    // 10. Feature modal buttons
    document.getElementById('btn-guide')?.addEventListener('click', () => this.openGuideModal());
    document.getElementById('btn-chest')?.addEventListener('click', () => this.openDailyChestModal());
    document.getElementById('btn-collection')?.addEventListener('click', () => this.openCollectionModal());
    document.getElementById('btn-certificate')?.addEventListener('click', () => this.openCertificateModal());
    document.getElementById('btn-savecode')?.addEventListener('click', () => this.openSaveCodeModal());
    document.getElementById('btn-share')?.addEventListener('click', () => this.openShareModal());
  }
}

// Start Application on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new IslandApp();
  app.init();
  window.__islandApp = app;
});
