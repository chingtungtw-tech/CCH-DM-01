/**
 * 彰基糖友島 - 主應用程式邏輯 (State, Sound Synthesizer, Quiz, UI & Storage)
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
      readLiterature: [],
      unlockedCards: ['card-01'],
      quizScores: {},
      dailyKeys: 3,
      lastKeyDate: new Date().toDateString(),
      chestOpenedToday: 0
    };

    // UI State
    this.activeIsland = null;
    this.activeBuilding = null;
    this.activeModal = null;
    this.searchQuery = '';

    // Audio context for synthesizer
    this.audioCtx = null;
    this.bgmTimer = null;

    this.init();
  }

  async init() {
    this.loadState();
    await this.loadContent();
    this.applyTheme(this.state.theme);
    this.initScene();
    this.setupUIEvents();
    this.setupClock();
    this.updateProgressUI();
    this.updateFloatingLabels();
    this.checkDailyKeys();

    // Remove loading screen
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 500);
    }
  }

  // --- State Persistence ---
  loadState() {
    try {
      const saved = localStorage.getItem('cch_dm_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      }
    } catch (e) {
      console.warn('Could not read state from localStorage', e);
    }

    // Check system preference for reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.state.reducedMotion = true;
    }
  }

  saveState() {
    try {
      localStorage.setItem('cch_dm_state', JSON.stringify(this.state));
      this.updateProgressUI();
    } catch (e) {
      console.warn('Could not save state to localStorage', e);
    }
  }

  resetProgress() {
    if (confirm('確定要重置所有探索進度、圖鑑卡片與測驗紀錄嗎？')) {
      localStorage.removeItem('cch_dm_state');
      this.state.visitedIslands = [];
      this.state.readLiterature = [];
      this.state.unlockedCards = ['card-01'];
      this.state.quizScores = {};
      this.saveState();
      this.showToast('探索進度已成功重置');
      this.updateProgressUI();
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
      alert('載入島嶼內容時發生錯誤，請重新整理網頁。');
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
        onSelectBuilding: (bldgData) => this.openBuildingDetail(bldgData),
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

    // Update active state in theme buttons
    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === themeId);
    });

    if (this.scene) {
      this.scene.applyTheme(themeId);
    }
    this.saveState();
  }

  setDayNight(mode) {
    this.state.dayNight = mode;
    document.querySelectorAll('.daynight-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (this.scene) {
      this.scene.applyDayNight(mode);
    }
    this.saveState();
    this.showToast(`已切換至 ${mode === 'day' ? '晨光日間' : mode === 'sunset' ? '暖陽黃昏' : '靜謐星夜'}`);
    this.unlockCard('card-06');
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

  // --- Floating 3D Island Labels ---
  updateFloatingLabels() {
    if (!this.scene) return;

    const islandIds = ['island-center', 'island-01', 'island-02'];
    islandIds.forEach((id) => {
      const el = document.getElementById(`tag-${id}`);
      if (!el) return;

      const screen = this.scene.getIslandScreenPosition(id);
      const margin = 40;
      if (
        screen &&
        screen.visible &&
        screen.x >= margin &&
        screen.x <= window.innerWidth - margin &&
        screen.y >= 50 &&
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

    const island = this.content.islands.find((i) => i.id === islandId);
    if (!island) return;

    this.activeIsland = island;
    if (!this.state.visitedIslands.includes(islandId)) {
      this.state.visitedIslands.push(islandId);
      this.saveState();
    }

    // Award cards
    if (islandId === 'island-01') this.unlockCard('card-02');
    if (islandId === 'island-02') this.unlockCard('card-03');

    const drawer = document.getElementById('content-drawer');
    const drawerBody = document.getElementById('drawer-body');
    if (!drawer || !drawerBody) return;

    drawerBody.innerHTML = `
      <div class="drawer-header-content">
        <div class="flex items-center justify-between mb-2">
          <span class="category-pill">${island.group}</span>
          <span class="island-order-badge">島嶼 #0${island.order}</span>
        </div>
        <h2 class="text-2xl font-bold mb-1 text-primary-heading">${island.name}</h2>
        <p class="text-sm text-muted mb-4">${island.intro}</p>
        <div class="landmark-banner p-3 rounded-xl mb-4 bg-surface-alt border border-line">
          <div class="flex items-center gap-2 font-bold text-sm text-primary">
            <span>🏛️ 獨特地標建築</span>
            <span>${island.landmark}</span>
          </div>
          <p class="text-xs text-muted mt-1">${island.landmarkDesc}</p>
        </div>
      </div>

      <div class="section-tabs mb-4 flex gap-2 border-b border-line pb-2">
        <button class="tab-btn active" data-tab="knowledge">📖 知識重點 (${island.points.length})</button>
        <button class="tab-btn" data-tab="literature">🏙️ 文獻城市 (${island.literature.length} 棟房子)</button>
        <button class="tab-btn" data-tab="quiz">🎯 島嶼小測驗</button>
      </div>

      <div id="tab-pane-knowledge" class="tab-pane active space-y-3">
        ${island.points.map((pt) => `
          <div class="card p-4 rounded-xl border border-line bg-surface">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="point-tag text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">${pt.tag}</span>
              <h4 class="font-bold text-base text-ink">${pt.title}</h4>
            </div>
            <p class="text-sm text-ink leading-relaxed">${pt.content}</p>
          </div>
        `).join('')}
      </div>

      <div id="tab-pane-literature" class="tab-pane hidden space-y-3">
        <div class="bg-blue-50/70 p-3 rounded-xl text-xs text-blue-900 border border-blue-100 flex items-start gap-2">
          <span>💡</span>
          <div>
            <strong>文獻知識島城市法則：</strong>每棟房子代表一篇實證文獻，屋頂色彩與造形對應文獻種類。點擊可展開 APA 引用一鍵複製與 DOI 開放連結。
          </div>
        </div>
        ${island.literature.map((lit) => `
          <div class="card literature-card p-4 rounded-xl border border-line bg-surface hover:shadow-md transition cursor-pointer" data-lit-id="${lit.id}">
            <div class="flex items-start justify-between gap-2 mb-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="w-3 h-3 rounded-full inline-block" style="background-color: ${lit.roofColor};"></span>
                <span class="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">${lit.type}</span>
                <span class="text-xs text-muted font-medium">${lit.year} 年</span>
              </div>
              <span class="badge-status text-xs ${lit.retracted ? 'bg-red-100 text-red-600' : 'bg-emerald-50 text-emerald-700'} px-2 py-0.5 rounded">
                ${lit.retracted ? '⚠️ 已撤回' : '✓ 同行評審'}
              </span>
            </div>
            <h4 class="font-bold text-sm text-ink mt-1 hover:text-primary transition">${lit.title}</h4>
            <p class="text-xs text-muted mt-1">作者：${lit.authors.join('、')}</p>
            <p class="text-xs text-ink/80 mt-2 bg-surface-alt p-2 rounded-lg leading-relaxed">${lit.summary}</p>
            <div class="flex items-center justify-between mt-3 pt-2 border-t border-line/60">
              <span class="text-xs text-primary font-bold">點擊查看 APA 引用 & 詳情 →</span>
              <span class="text-xs text-muted">DOI: ${lit.doi}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <div id="tab-pane-quiz" class="tab-pane hidden space-y-4">
        <div class="bg-amber-50/80 p-3 rounded-xl text-xs text-amber-900 border border-amber-200">
          <strong>🎯 ${island.name} 隨堂測驗：</strong>共 3 題實證知識題，完成後可獲得榮譽健康評分與成就卡片！
        </div>
        <div id="quiz-container-${island.id}"></div>
      </div>
    `;

    // Tab switching inside drawer
    drawer.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        drawer.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        drawer.querySelectorAll('.tab-pane').forEach((p) => p.classList.add('hidden'));
        btn.classList.add('active');
        const pane = document.getElementById(`tab-pane-${btn.dataset.tab}`);
        if (pane) pane.classList.remove('hidden');
      });
    });

    // Literature card click inside drawer
    drawer.querySelectorAll('.literature-card').forEach((card) => {
      card.addEventListener('click', () => {
        const litId = card.dataset.litId;
        const lit = island.literature.find((l) => l.id === litId);
        if (lit) this.openBuildingDetail({ ...lit, islandId: island.id });
      });
    });

    // Render Quiz
    this.renderIslandQuiz(island);

    drawer.classList.add('open');
  }

  closeDrawer() {
    const drawer = document.getElementById('content-drawer');
    if (drawer) drawer.classList.remove('open');
    if (this.scene) this.scene.resetToOverview();
  }

  // --- Central Library Modal ---
  openCenterIslandModal() {
    this.unlockCard('card-01');
    const modal = document.getElementById('central-library-modal');
    if (!modal) return;

    // Aggregate all literature from both islands
    const allLits = [];
    this.content.islands.forEach((isl) => {
      isl.literature.forEach((lit) => {
        allLits.push({ ...lit, islandName: isl.name, islandId: isl.id });
      });
    });

    const body = document.getElementById('central-library-body');
    if (body) {
      body.innerHTML = `
        <div class="mb-4">
          <div class="flex items-center gap-3 mb-2">
            <span class="text-3xl">🏛️</span>
            <div>
              <h2 class="text-2xl font-bold text-primary-heading">彰基糖友島 · 中央圖書館</h2>
              <p class="text-sm text-muted">全島文獻總目錄、實證數據中心與引用清單匯出</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          ${this.content.centerIsland.keyStats.map((st) => `
            <div class="stat-card p-3 rounded-xl bg-surface-alt border border-line text-center">
              <div class="text-xs text-muted mb-0.5">${st.label}</div>
              <div class="text-lg font-black text-primary">${st.value}</div>
              <div class="text-[11px] text-muted">${st.note}</div>
            </div>
          `).join('')}
        </div>

        <div class="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 class="font-bold text-base text-ink flex items-center gap-1.5">
            <span>📚 全站文獻總目錄</span>
            <span class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">${allLits.length} 篇實證論文</span>
          </h3>
          <div class="flex gap-2">
            <button id="btn-export-all-apa" class="btn-action text-xs px-3 py-1.5 rounded-lg bg-primary text-white font-bold hover:opacity-90">
              📋 複製全部 APA 引用
            </button>
            <a href="${this.content.centerIsland.materialDownload.path}" target="_blank" download class="btn-action text-xs px-3 py-1.5 rounded-lg border border-primary text-primary font-bold hover:bg-primary/10 flex items-center gap-1">
              📥 下載年鑑 PDF (4.4MB)
            </a>
          </div>
        </div>

        <div class="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
          ${allLits.map((lit) => `
            <div class="p-3.5 rounded-xl border border-line bg-surface hover:border-primary/50 transition">
              <div class="flex items-center justify-between gap-2 mb-1">
                <div class="flex items-center gap-1.5">
                  <span class="w-2.5 h-2.5 rounded-full inline-block" style="background-color: ${lit.roofColor};"></span>
                  <span class="text-xs font-bold text-primary">${lit.islandName}</span>
                  <span class="text-xs text-muted">· ${lit.type} (${lit.year})</span>
                </div>
                <button class="btn-copy-apa-single text-xs text-muted hover:text-primary" data-apa="${encodeURIComponent(lit.apa)}">
                  📋 複製 APA
                </button>
              </div>
              <h4 class="font-bold text-sm text-ink mb-1">${lit.title}</h4>
              <p class="text-xs text-muted mb-1.5">作者：${lit.authors.join('、')} ｜ 出處：${lit.journal}</p>
              <p class="text-xs text-ink/80 bg-surface-alt p-2 rounded-lg leading-relaxed">${lit.summary}</p>
            </div>
          `).join('')}
        </div>
      `;

      // Copy all APA
      const exportBtn = document.getElementById('btn-export-all-apa');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          const fullApa = allLits.map((l, idx) => `[${idx + 1}] ${l.apa}`).join('\n\n');
          navigator.clipboard.writeText(fullApa);
          this.showToast('已複製全島所有文獻之 APA 第 7 版引用清單！');
        });
      }

      // Copy single APA
      body.querySelectorAll('.btn-copy-apa-single').forEach((btn) => {
        btn.addEventListener('click', () => {
          const apaText = decodeURIComponent(btn.dataset.apa);
          navigator.clipboard.writeText(apaText);
          this.showToast('已複製該文獻 APA 第 7 版引用格式！');
        });
      });
    }

    this.openModal(modal);
  }

  // --- Individual Literature Building Detail Modal ---
  openBuildingDetail(spec) {
    if (!spec || !spec.id) return;
    this.closeDrawer();

    // Mark as read
    if (!this.state.readLiterature.includes(spec.id)) {
      this.state.readLiterature.push(spec.id);
      this.saveState();
    }

    // Find full lit record
    let lit = null;
    let islandName = '';
    for (const isl of this.content.islands) {
      const match = isl.literature.find((l) => l.id === spec.id);
      if (match) {
        lit = match;
        islandName = isl.name;
        break;
      }
    }
    if (!lit) return;

    if (lit.tags && lit.tags.includes('疫苗')) {
      this.unlockCard('card-04');
    }

    const modal = document.getElementById('literature-modal');
    const modalBody = document.getElementById('literature-modal-body');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-2">
          <span class="w-4 h-4 rounded-full" style="background-color: ${lit.roofColor};"></span>
          <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">${islandName}</span>
          <span class="text-xs text-muted font-medium">${lit.type}</span>
        </div>
        <span class="badge-status text-xs bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold">
          ✓ 同行評審驗證
        </span>
      </div>

      <h3 class="text-xl font-bold text-ink mb-2 leading-snug">${lit.title}</h3>

      <div class="text-xs text-muted space-y-1 mb-4 p-3 rounded-xl bg-surface-alt border border-line">
        <p><strong>作者：</strong>${lit.authors.join('、')}</p>
        <p><strong>收錄期刊：</strong>${lit.journal} (${lit.year})</p>
        <p><strong>數位物件識別碼 (DOI)：</strong><span class="font-mono text-primary">${lit.doi}</span></p>
      </div>

      <div class="mb-4">
        <h4 class="font-bold text-sm text-ink mb-1.5 flex items-center gap-1.5">
          <span>📝 論文重點筆記</span>
          <span class="text-[11px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">實證摘要整理</span>
        </h4>
        <p class="text-sm text-ink leading-relaxed bg-surface p-3 rounded-xl border border-line">
          ${lit.summary}
        </p>
      </div>

      <div class="mb-5">
        <div class="flex items-center justify-between mb-1.5">
          <h4 class="font-bold text-xs text-muted uppercase tracking-wider">APA 第 7 版引用格式</h4>
          <button id="btn-copy-apa-modal" class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
            <span>📋</span> 一鍵複製引用
          </button>
        </div>
        <div class="p-3 bg-surface-alt rounded-xl border border-line text-xs font-mono text-ink leading-relaxed break-all select-all">
          ${lit.apa}
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap pt-2 border-t border-line">
        <a href="https://doi.org/${lit.doi}" target="_blank" rel="noopener noreferrer" class="btn-action text-xs px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 flex items-center gap-1.5">
          <span>🔗</span> 開啟 DOI 原文連結 (新分頁)
        </a>
        <button id="btn-modal-close" class="btn-action text-xs px-4 py-2 rounded-xl border border-line text-muted font-bold hover:bg-surface-alt">
          關閉
        </button>
      </div>
    `;

    const copyBtn = document.getElementById('btn-copy-apa-modal');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(lit.apa);
        this.showToast('已複製 APA 第 7 版引用格式！');
      });
    }

    const closeBtn = document.getElementById('btn-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }

    this.openModal(modal);
  }

  // --- Island Quiz Engine ---
  renderIslandQuiz(island) {
    const container = document.getElementById(`quiz-container-${island.id}`);
    if (!container) return;

    let userAnswers = {};

    const render = () => {
      container.innerHTML = `
        <div class="space-y-4">
          ${island.quiz.map((item, qIdx) => `
            <div class="quiz-item p-3.5 rounded-xl border border-line bg-surface">
              <div class="font-bold text-sm text-ink mb-2">Q${qIdx + 1}. ${item.q}</div>
              <div class="space-y-1.5">
                ${item.options.map((opt, oIdx) => `
                  <label class="quiz-option flex items-center gap-2.5 p-2 rounded-lg border border-line/60 cursor-pointer text-xs text-ink hover:bg-surface-alt transition ${userAnswers[qIdx] === oIdx ? 'bg-primary/10 border-primary font-bold' : ''}">
                    <input type="radio" name="quiz-${island.id}-${qIdx}" value="${oIdx}" ${userAnswers[qIdx] === oIdx ? 'checked' : ''} class="hidden">
                    <span class="opt-indicator w-4 h-4 rounded-full border border-primary/50 flex items-center justify-center text-[10px]">
                      ${userAnswers[qIdx] === oIdx ? '●' : String.fromCharCode(65 + oIdx)}
                    </span>
                    <span>${opt}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          `).join('')}

          <button id="btn-submit-quiz-${island.id}" class="w-full py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-sm hover:opacity-95 transition">
            送出測驗並查看解答
          </button>
        </div>
      `;

      // Radio change handlers
      island.quiz.forEach((_, qIdx) => {
        container.querySelectorAll(`input[name="quiz-${island.id}-${qIdx}"]`).forEach((radio) => {
          radio.addEventListener('change', (e) => {
            userAnswers[qIdx] = parseInt(e.target.value);
            render();
          });
        });
      });

      // Submit
      const submitBtn = document.getElementById(`btn-submit-quiz-${island.id}`);
      if (submitBtn) {
        submitBtn.addEventListener('click', () => {
          let score = 0;
          island.quiz.forEach((q, idx) => {
            if (userAnswers[idx] === q.ans) score++;
          });

          this.state.quizScores[island.id] = score;
          this.saveState();

          // Celebration
          confetti({ particleCount: 60, spread: 60, origin: { y: 0.7 } });

          // Check if all quizzes passed
          const totalScore = Object.values(this.state.quizScores).reduce((a, b) => a + b, 0);
          if (totalScore >= 6) {
            this.unlockCard('card-05');
          }

          container.innerHTML = `
            <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center mb-4">
              <div class="text-3xl mb-1">🎉</div>
              <h4 class="font-black text-lg text-emerald-800">測驗完成！</h4>
              <p class="text-xs text-emerald-700 mt-1">
                您的成績：<strong>${score} / ${island.quiz.length} 題正確</strong>
              </p>
            </div>
            <div class="space-y-3">
              ${island.quiz.map((q, idx) => `
                <div class="p-3 rounded-xl border border-line bg-surface text-xs">
                  <div class="font-bold text-ink mb-1">Q${idx + 1}. ${q.q}</div>
                  <div class="text-xs ${userAnswers[idx] === q.ans ? 'text-emerald-700 font-bold' : 'text-red-600'}">
                    您的回答：${q.options[userAnswers[idx]] || '未作答'} (${userAnswers[idx] === q.ans ? '✓ 正確' : '✗ 錯誤'})
                  </div>
                  <div class="text-xs text-primary font-bold mt-0.5">正確答案：${q.options[q.ans]}</div>
                  <div class="text-[11px] text-muted mt-1 bg-surface-alt p-2 rounded">
                    <strong>解析：</strong>${q.explanation}
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        });
      }
    };

    render();
  }

  // --- Collection Cards & Badges ---
  unlockCard(cardId) {
    if (!this.state.unlockedCards.includes(cardId)) {
      this.state.unlockedCards.push(cardId);
      this.saveState();
      const card = this.content.collectionCards.find((c) => c.id === cardId);
      if (card) {
        this.showToast(`🏆 解鎖新成就卡片：【${card.title}】！`);
        confetti({ particleCount: 40, spread: 50, origin: { y: 0.8 } });
      }
    }
  }

  openCollectionModal() {
    const modal = document.getElementById('collection-modal');
    const body = document.getElementById('collection-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-xl font-bold text-primary-heading">🏆 糖友島榮譽圖鑑</h3>
          <p class="text-xs text-muted">收集全島 6 面實證徽章，解鎖健康榮譽證書</p>
        </div>
        <div class="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full">
          已收集 ${this.state.unlockedCards.length} / ${this.content.collectionCards.length}
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${this.content.collectionCards.map((card) => {
          const unlocked = this.state.unlockedCards.includes(card.id);
          return `
            <div class="card p-3 rounded-xl border text-center transition ${unlocked ? 'bg-surface border-primary/40 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-60'}">
              <div class="text-3xl mb-1.5">${unlocked ? card.icon : '🔒'}</div>
              <h4 class="font-bold text-xs text-ink mb-1">${card.title}</h4>
              <p class="text-[11px] text-muted leading-tight">${card.desc}</p>
              <div class="mt-2 text-[10px] font-bold ${unlocked ? 'text-primary' : 'text-gray-400'}">
                ${unlocked ? '✓ 已解鎖' : '未達成'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    this.openModal(modal);
  }

  // --- Certificate Generator (Canvas Download) ---
  openCertificateModal() {
    const totalIslands = this.content.islands.length;
    const visited = this.state.visitedIslands.length;
    const totalQuiz = Object.values(this.state.quizScores).reduce((a, b) => a + b, 0);

    const modal = document.getElementById('certificate-modal');
    const body = document.getElementById('certificate-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="text-center mb-4">
        <h3 class="text-xl font-bold text-primary-heading">📜 彰基糖友島榮譽結業證書</h3>
        <p class="text-xs text-muted">表彰您對糖尿病流行病學、器官保護指引與全方位照護之探索成就</p>
      </div>

      <div class="p-3 bg-surface-alt rounded-xl border border-line mb-4 text-xs space-y-1">
        <div class="flex justify-between"><span>已探索主題島嶼：</span><strong>${visited} / ${totalIslands}</strong></div>
        <div class="flex justify-between"><span>已研讀實證文獻：</span><strong>${this.state.readLiterature.length} / 8 篇</strong></div>
        <div class="flex justify-between"><span>測驗累計正確題數：</span><strong>${totalQuiz} / 6 題</strong></div>
      </div>

      <div class="mb-4">
        <label class="block text-xs font-bold text-ink mb-1">請輸入證書上的尊姓大名 / 暱稱：</label>
        <input type="text" id="cert-user-name" placeholder="例如：張健康 先生/女士" value="糖友健康勇者" class="w-full px-3 py-2 text-sm rounded-lg border border-line bg-surface text-ink focus:outline-none focus:border-primary">
      </div>

      <div class="canvas-preview-box mb-4 overflow-hidden rounded-xl border border-line bg-surface flex justify-center p-2">
        <canvas id="cert-canvas" width="600" height="420" class="w-full max-w-[500px] rounded shadow-sm"></canvas>
      </div>

      <div class="flex items-center justify-end gap-2">
        <button id="btn-download-cert" class="btn-action text-xs px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 flex items-center gap-1.5">
          <span>💾</span> 下載證書圖片 (PNG)
        </button>
      </div>
    `;

    const canvas = document.getElementById('cert-canvas');
    const nameInput = document.getElementById('cert-user-name');

    const drawCert = () => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#f8fdfa');
      bgGrad.addColorStop(1, '#e7f5f0');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Ornate Border
      ctx.strokeStyle = '#2a8a74';
      ctx.lineWidth = 8;
      ctx.strokeRect(12, 12, w - 24, h - 24);

      ctx.strokeStyle = '#e46a5e';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 20, w - 40, h - 40);

      // Title
      ctx.fillStyle = '#2a8a74';
      ctx.font = 'bold 26px "Huninn", "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('彰基糖友島 · 健康守護榮譽證書', w / 2, 65);

      ctx.fillStyle = '#64748b';
      ctx.font = '13px "Noto Sans TC", sans-serif';
      ctx.fillText('CERTIFICATE OF DIABETES KNOWLEDGE EXPLORATION', w / 2, 88);

      // Divider line
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(80, 105);
      ctx.lineTo(w - 80, 105);
      ctx.stroke();

      // Recipient
      ctx.fillStyle = '#1e3a34';
      ctx.font = 'bold 22px "Huninn", "Noto Sans TC", sans-serif';
      const name = (nameInput && nameInput.value) || '糖友健康勇者';
      ctx.fillText(name, w / 2, 150);

      // Body text
      ctx.fillStyle = '#334155';
      ctx.font = '14px "Noto Sans TC", sans-serif';
      ctx.fillText('恭喜您已完整造訪彰基糖友島 3D 群島，深入研讀臺灣糖尿病流行病學實證、', w / 2, 195);
      ctx.fillText('掌握器官保護新藥與併發症預防關鍵，並展現卓越的自我健康管理決心！', w / 2, 222);

      // Stats badge
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(80, 250, w - 160, 48);
      ctx.strokeStyle = '#2a8a74';
      ctx.lineWidth = 1;
      ctx.strokeRect(80, 250, w - 160, 48);

      ctx.fillStyle = '#2a8a74';
      ctx.font = 'bold 13px "Noto Sans TC", sans-serif';
      ctx.fillText(`已訪島嶼：${visited}/${totalIslands}   |   實證文獻：${this.state.readLiterature.length}/8 篇   |   測驗積分：${totalQuiz}/6`, w / 2, 280);

      // Signatures & Stamp
      ctx.fillStyle = '#475569';
      ctx.font = '12px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('發行單位：彰化基督教醫院 糖尿病照護團隊', 40, 360);
      ctx.fillText(`發行日期：${new Date().toLocaleDateString('zh-TW')}`, 40, 380);

      // Red seal stamp
      ctx.save();
      ctx.translate(w - 110, 350);
      ctx.rotate(-0.15);
      ctx.strokeStyle = '#e46a5e';
      ctx.lineWidth = 3;
      ctx.strokeRect(-40, -25, 80, 50);
      ctx.fillStyle = '#e46a5e';
      ctx.font = 'bold 13px "Huninn", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('彰基糖友島', 0, -4);
      ctx.fillText('數位印鑑', 0, 16);
      ctx.restore();
    };

    drawCert();
    if (nameInput) {
      nameInput.addEventListener('input', drawCert);
    }

    const dlBtn = document.getElementById('btn-download-cert');
    if (dlBtn && canvas) {
      dlBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `彰基糖友島_榮譽證書_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.showToast('榮譽結業證書已成功下載！');
      });
    }

    this.openModal(modal);
  }

  // --- Daily Key & Treasure Chest ---
  checkDailyKeys() {
    const today = new Date().toDateString();
    if (this.state.lastKeyDate !== today) {
      this.state.dailyKeys = 3;
      this.state.lastKeyDate = today;
      this.state.chestOpenedToday = 0;
      this.saveState();
    }
  }

  openChestModal() {
    this.checkDailyKeys();
    const modal = document.getElementById('chest-modal');
    const body = document.getElementById('chest-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="text-center mb-4">
        <div class="text-4xl mb-2">🎁</div>
        <h3 class="text-xl font-bold text-primary-heading">海島每日健康寶箱</h3>
        <p class="text-xs text-muted">今日剩餘鑰匙：<strong class="text-primary text-base">${this.state.dailyKeys}</strong> 把</p>
      </div>

      <div id="chest-interactive-box" class="p-6 rounded-2xl bg-surface-alt border border-line text-center">
        ${this.state.dailyKeys > 0 ? `
          <div class="text-5xl cursor-pointer hover:scale-110 transition mb-3" id="chest-target">
            📦
          </div>
          <button id="btn-open-chest" class="btn-action text-xs px-5 py-2.5 rounded-xl bg-accent text-white font-bold hover:opacity-90 shadow-sm">
            🔑 使用 1 把鑰匙開啟寶箱
          </button>
        ` : `
          <div class="text-4xl mb-2">📭</div>
          <p class="text-sm text-muted font-bold">今天的 3 把鑰匙已用完囉！</p>
          <p class="text-xs text-muted mt-1">明日凌晨將自動為您重置 3 把新鑰匙，敬請期待~</p>
        `}
      </div>
    `;

    const openBtn = document.getElementById('btn-open-chest');
    const chestTarget = document.getElementById('chest-target');

    const handleOpen = () => {
      if (this.state.dailyKeys <= 0) return;
      this.state.dailyKeys--;
      this.state.chestOpenedToday++;
      this.saveState();

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });

      const tips = [
        '小叮嚀：第 2 型糖尿病發病年齡中位數為 60 歲，40 歲起建議每三年善用免費成人健檢！',
        '保腎密技：SGLT-2 抑制劑與 GLP-1 RA 具備臨床驗證的心臟與腎臟實證保護力！',
        '疫苗強心針：65 歲以上糖友按時施打公費流感與肺炎鏈球菌疫苗，降低肺炎重症與死亡率達 20% 以上！',
        '護眼守則：每年至少完成一次散瞳眼底鏡檢查，早期發現糖尿病視網膜病變可避免視力嚴重損傷！',
        '糖足防線：每天洗澡後擦乾腳趾縫，並仔細檢視足底有無紅腫或微小傷口！'
      ];
      const randomTip = tips[Math.floor(Math.random() * tips.length)];

      const box = document.getElementById('chest-interactive-box');
      if (box) {
        box.innerHTML = `
          <div class="text-5xl mb-2">✨💎✨</div>
          <h4 class="font-bold text-base text-primary mb-1">寶箱開啟成功！獲得健康智慧寶石</h4>
          <p class="text-xs text-ink leading-relaxed p-3 bg-surface rounded-xl border border-line my-3">
            ${randomTip}
          </p>
          <p class="text-xs text-muted mb-3">今日剩餘鑰匙：<strong>${this.state.dailyKeys}</strong> 把</p>
          ${this.state.dailyKeys > 0 ? `
            <button id="btn-open-again" class="btn-action text-xs px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90">
              再開一次
            </button>
          ` : '<span class="text-xs text-muted font-bold">今日寶箱已全數開啟完畢！</span>'}
        `;

        const againBtn = document.getElementById('btn-open-again');
        if (againBtn) againBtn.addEventListener('click', () => this.openChestModal());
      }
    };

    if (openBtn) openBtn.addEventListener('click', handleOpen);
    if (chestTarget) chestTarget.addEventListener('click', handleOpen);

    this.openModal(modal);
  }

  // --- Assistant (彰基糖糖衛教師) AI Q&A Modal ---
  openGuideModal() {
    const modal = document.getElementById('guide-modal');
    const body = document.getElementById('guide-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="flex items-center gap-3 mb-4 p-3 bg-surface-alt rounded-2xl border border-line">
        <div class="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-2xl border border-primary/30">
          👩‍⚕️
        </div>
        <div>
          <h3 class="font-bold text-base text-primary-heading">${this.content.site.mascot.name}</h3>
          <p class="text-xs text-muted">${this.content.site.mascot.description}</p>
        </div>
      </div>

      <div class="mb-4">
        <label class="block text-xs font-bold text-ink mb-1.5">請輸入您想了解的糖尿病問題（關鍵字比對）：</label>
        <div class="flex gap-2">
          <input type="text" id="guide-input" placeholder="例如：洗腎、疫苗、藥物、盛行率、ABC目標..." class="flex-1 px-3 py-2 text-xs rounded-xl border border-line bg-surface text-ink focus:outline-none focus:border-primary">
          <button id="btn-ask-guide" class="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90">
            發問
          </button>
        </div>
      </div>

      <div class="mb-3">
        <span class="text-xs text-muted font-bold">熱門常見提問：</span>
        <div class="flex gap-1.5 flex-wrap mt-1.5" id="guide-quick-pills">
          ${this.content.faq.map((item) => `
            <button class="quick-pill text-[11px] px-2.5 py-1 rounded-full border border-line bg-surface text-ink hover:border-primary transition" data-q="${item.q}">
              ${item.q}
            </button>
          `).join('')}
        </div>
      </div>

      <div id="guide-response-box" class="p-3.5 rounded-xl border border-line bg-surface min-h-[110px] text-xs text-ink leading-relaxed">
        哈囉！我是彰基糖糖衛教師，點擊上方熱門問題，或直接搜尋關鍵字，我會立即為您調出年鑑與臨床實證解說喔！
      </div>
    `;

    const input = document.getElementById('guide-input');
    const askBtn = document.getElementById('btn-ask-guide');
    const resBox = document.getElementById('guide-response-box');

    const handleAsk = (queryText) => {
      const q = (queryText || (input && input.value) || '').trim().toLowerCase();
      if (!q) return;

      // Match in FAQ
      const hit = this.content.faq.find((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));
      if (hit) {
        resBox.innerHTML = `
          <div class="font-bold text-primary mb-1">【糖糖衛教師回覆】</div>
          <p class="mb-2.5">${hit.a}</p>
          <div class="pt-2 border-t border-line flex items-center justify-between text-[11px]">
            <span class="text-muted">資料出處：${hit.islandName}</span>
            <button class="text-primary font-bold hover:underline" id="guide-nav-island" data-id="${hit.islandId}">
              飛往 ${hit.islandName} 查看詳情 →
            </button>
          </div>
        `;
        const navBtn = document.getElementById('guide-nav-island');
        if (navBtn) {
          navBtn.addEventListener('click', () => {
            this.closeModal();
            this.openIslandDrawer(navBtn.dataset.id);
          });
        }
      } else {
        resBox.innerHTML = `
          <div class="font-bold text-amber-700 mb-1">【糖糖衛教師提醒】</div>
          <p>抱歉，目前資料庫未找到與「${q}」完全匹配的項目。建議嘗試輸入關鍵字：<strong>盛行率、心腎、洗腎、疫苗、P4P、血糖</strong>，或點選上方熱門常見提問查看詳細實證！</p>
        `;
      }
    };

    if (askBtn) askBtn.addEventListener('click', () => handleAsk());
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAsk();
      });
    }

    body.querySelectorAll('.quick-pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        if (input) input.value = pill.dataset.q;
        handleAsk(pill.dataset.q);
      });
    });

    this.openModal(modal);
  }

  // --- Save Code (接關碼) ---
  openSaveCodeModal() {
    const modal = document.getElementById('savecode-modal');
    const body = document.getElementById('savecode-modal-body');
    if (!modal || !body) return;

    // Encode current state to Base64
    const exportCode = btoa(unescape(encodeURIComponent(JSON.stringify(this.state))));

    body.innerHTML = `
      <div class="mb-4">
        <h3 class="text-xl font-bold text-primary-heading">🔑 跨裝置進度接關碼</h3>
        <p class="text-xs text-muted">換電腦或手機玩？複製專屬接關碼，隨時接續您的探索旅程！</p>
      </div>

      <div class="mb-4">
        <label class="block text-xs font-bold text-ink mb-1">您目前的探索接關碼：</label>
        <div class="flex gap-2">
          <input type="text" readonly value="${exportCode}" id="export-code-input" class="flex-1 px-3 py-2 text-xs font-mono rounded-lg border border-line bg-surface-alt text-ink select-all">
          <button id="btn-copy-savecode" class="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90">
            複製
          </button>
        </div>
      </div>

      <div class="pt-3 border-t border-line mb-3">
        <label class="block text-xs font-bold text-ink mb-1">貼上在另一台裝置取得的接關碼：</label>
        <textarea id="import-code-input" rows="3" placeholder="在此貼上 Base64 接關碼字串..." class="w-full px-3 py-2 text-xs font-mono rounded-lg border border-line bg-surface text-ink focus:outline-none focus:border-primary mb-2"></textarea>
        <button id="btn-import-savecode" class="w-full py-2 bg-surface-alt border border-primary text-primary font-bold text-xs rounded-lg hover:bg-primary/10 transition">
          還原並讀取進度
        </button>
      </div>
    `;

    const copyBtn = document.getElementById('btn-copy-savecode');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(exportCode);
        this.showToast('接關碼已成功複製至剪貼簿！');
      });
    }

    const importBtn = document.getElementById('btn-import-savecode');
    if (importBtn) {
      importBtn.addEventListener('click', () => {
        const val = document.getElementById('import-code-input')?.value.trim();
        if (!val) {
          alert('請先貼上接關碼！');
          return;
        }
        try {
          const decoded = JSON.parse(decodeURIComponent(escape(atob(val))));
          if (decoded && Array.isArray(decoded.visitedIslands)) {
            this.state = { ...this.state, ...decoded };
            this.saveState();
            this.applyTheme(this.state.theme);
            this.setDayNight(this.state.dayNight);
            this.showToast('🎉 進度已成功還原！');
            this.closeModal();
          } else {
            throw new Error('Invalid format');
          }
        } catch (e) {
          alert('接關碼格式不正確，請確認代碼是否完整複製！');
        }
      });
    }

    this.openModal(modal);
  }

  // --- Share Card Generator ---
  openShareModal() {
    const modal = document.getElementById('share-modal');
    const body = document.getElementById('share-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="text-center mb-4">
        <h3 class="text-xl font-bold text-primary-heading">📤 分享彰基糖友島</h3>
        <p class="text-xs text-muted">邀請親友與病友一起解鎖臺灣糖尿病流行大數據</p>
      </div>

      <div class="p-4 rounded-xl bg-surface-alt border border-line mb-4 text-xs space-y-2">
        <p class="font-bold text-ink">跟著彰基糖友島，解鎖糖尿病的秘密吧~</p>
        <p class="text-muted leading-relaxed">
          這是一座專為大眾打造的 3D 文獻知識島，收錄《2026臺灣糖尿病流行病學年鑑》關鍵實證、心腎保護新藥、疫苗防護與照護品質指引，歡迎一同探索！
        </p>
        <div class="pt-2 font-mono text-[11px] text-primary break-all">
          ${window.location.href}
        </div>
      </div>

      <div class="flex items-center justify-end gap-2">
        <button id="btn-copy-share-url" class="btn-action text-xs px-4 py-2 rounded-xl bg-primary text-white font-bold hover:opacity-90 flex items-center gap-1.5">
          <span>📋</span> 複製分享連結
        </button>
      </div>
    `;

    const copyBtn = document.getElementById('btn-copy-share-url');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(window.location.href);
        this.showToast('分享連結已複製至剪貼簿！');
      });
    }

    this.openModal(modal);
  }

  // --- Text Directory & Equal Fallback Modal ---
  openTextListModal() {
    const modal = document.getElementById('text-list-modal');
    const body = document.getElementById('text-list-modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
      <div class="mb-4">
        <h3 class="text-xl font-bold text-primary-heading">🗺️ 全島地點與文獻清單</h3>
        <p class="text-xs text-muted">不用 3D 也能完整閱讀全站所有島嶼、衛教重點與文獻目錄</p>
      </div>

      <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <!-- Central Island -->
        <div class="p-4 rounded-xl border border-primary/30 bg-surface">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-primary text-white">中央島</span>
            <span class="text-xs text-muted">${this.content.centerIsland.role}</span>
          </div>
          <h4 class="font-bold text-base text-ink mb-1">${this.content.centerIsland.name}</h4>
          <p class="text-xs text-muted mb-3">${this.content.centerIsland.description}</p>
          <button class="btn-open-center-from-list text-xs px-3 py-1.5 bg-primary/10 text-primary font-bold rounded-lg hover:bg-primary/20">
            開啟中央圖書館總目錄 →
          </button>
        </div>

        <!-- Islands -->
        ${this.content.islands.map((isl) => `
          <div class="p-4 rounded-xl border border-line bg-surface">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-bold px-2 py-0.5 rounded bg-surface-alt text-primary border border-primary/30">島嶼 #0${isl.order} · ${isl.group}</span>
              <span class="text-xs text-muted">${isl.landmark}</span>
            </div>
            <h4 class="font-bold text-base text-ink mb-1">${isl.name}</h4>
            <p class="text-xs text-muted mb-2.5">${isl.intro}</p>
            <div class="space-y-2 mb-3">
              ${isl.points.map((p) => `
                <div class="text-xs bg-surface-alt p-2 rounded-lg">
                  <span class="font-bold text-primary">【${p.tag}】</span>
                  <span class="text-ink">${p.title}</span>
                </div>
              `).join('')}
            </div>
            <button class="btn-open-island-from-list text-xs px-3 py-1.5 bg-primary text-white font-bold rounded-lg hover:opacity-90" data-id="${isl.id}">
              進入 ${isl.name} 詳情與文獻 →
            </button>
          </div>
        `).join('')}
      </div>
    `;

    body.querySelector('.btn-open-center-from-list')?.addEventListener('click', () => {
      this.closeModal();
      this.openCenterIslandModal();
    });

    body.querySelectorAll('.btn-open-island-from-list').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.closeModal();
        this.openIslandDrawer(btn.dataset.id);
      });
    });

    this.openModal(modal);
  }

  // --- Modal Helpers ---
  openModal(modalEl) {
    if (this.activeModal) this.activeModal.classList.remove('open');
    this.activeModal = modalEl;
    modalEl.classList.add('open');
  }

  closeModal() {
    if (this.activeModal) {
      this.activeModal.classList.remove('open');
      this.activeModal = null;
    }
  }

  showToast(msg) {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  updateProgressUI() {
    const totalIslands = this.content ? this.content.islands.length : 2;
    const visited = this.state.visitedIslands.length;
    const percent = Math.min(100, Math.round((visited / totalIslands) * 100));

    const progressFill = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-bar-text');

    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `探索進度: ${percent}% (${visited}/${totalIslands}島)`;
  }

  // --- Setup Top & Bottom UI Controls ---
  setupUIEvents() {
    // 1. Theme buttons
    document.querySelectorAll('.theme-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.applyTheme(btn.dataset.theme));
    });

    // 2. Day/Night buttons
    document.querySelectorAll('.daynight-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.setDayNight(btn.dataset.mode));
    });

    // 3. Overview button
    document.getElementById('btn-overview')?.addEventListener('click', () => {
      this.closeDrawer();
      if (this.scene) this.scene.resetToOverview();
    });

    // 4. Reduced Motion toggle
    document.getElementById('btn-reduced-motion')?.addEventListener('click', () => this.toggleReducedMotion());

    // 5. Sound toggle
    document.getElementById('btn-sound')?.addEventListener('click', () => this.toggleSound());

    // 6. Feature modal buttons
    document.getElementById('btn-guide')?.addEventListener('click', () => this.openGuideModal());
    document.getElementById('btn-collection')?.addEventListener('click', () => this.openCollectionModal());
    document.getElementById('btn-certificate')?.addEventListener('click', () => this.openCertificateModal());
    document.getElementById('btn-chest')?.addEventListener('click', () => this.openChestModal());
    document.getElementById('btn-savecode')?.addEventListener('click', () => this.openSaveCodeModal());
    document.getElementById('btn-share')?.addEventListener('click', () => this.openShareModal());
    document.getElementById('btn-list')?.addEventListener('click', () => this.openTextListModal());

    // 7. Floating Island HTML tags
    document.querySelectorAll('.floating-island-tag').forEach((tag) => {
      tag.addEventListener('click', () => {
        const id = tag.dataset.islandId;
        if (id) {
          if (this.scene) this.scene.focusIsland(id);
          this.openIslandDrawer(id);
        }
      });
    });

    // 8. Drawer Close button
    document.getElementById('btn-drawer-close')?.addEventListener('click', () => this.closeDrawer());

    // 9. Modal close backdrop & close buttons
    document.querySelectorAll('.modal-backdrop, .btn-modal-x').forEach((el) => {
      el.addEventListener('click', () => this.closeModal());
    });

    // 10. Bottom Dock Collapse / Expand toggle
    const dock = document.getElementById('bottom-dock');
    const dockToggle = document.getElementById('btn-dock-toggle');
    if (dock && dockToggle) {
      dockToggle.addEventListener('click', () => {
        dock.classList.toggle('collapsed');
        dockToggle.innerHTML = dock.classList.contains('collapsed') ? '▴ 展開控制塢' : '▾ 收合控制塢';
      });
    }

    // 11. Global Keyboard Esc support
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.activeModal) {
          this.closeModal();
        } else {
          this.closeDrawer();
        }
      }
    });
  }
}

// Bootstrap once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new IslandApp();
});
