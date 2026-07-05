// ============================================
//  LeeceOS — Desktop Environment in JavaScript
// ============================================

const LeeceOS = (() => {
  'use strict';

  // ---------- STATE ----------
  const state = {
    windows: {},         // id -> { element, config }
    nextZ: 10,
    windowCount: 0,
    openSections: new Set(),
    minimized: new Set(),
    bootComplete: false,
    activeSpotlight: false,
  };

  const CONFIG = {
    sections: [
      { id: 'about',    title: 'About Me',       icon: 'fa-user' },
      { id: 'experience', title: 'Experience',   icon: 'fa-briefcase' },
      { id: 'skills',   title: 'Skills',         icon: 'fa-code' },
      { id: 'projects', title: 'Projects',       icon: 'fa-folder-open' },
      { id: 'education',title: 'Education',      icon: 'fa-graduation-cap' },
      { id: 'contact',  title: 'Contact',        icon: 'fa-envelope' },
    ],
  };

  // ---------- DOM REFS ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ---------- BOOT ----------
  function boot() {
    const fill = $('#boot-progress-fill');
    const status = $('#boot-status');
    const bootScreen = $('#boot-screen');

    const messages = [
      { pct: 15, msg: 'Loading kernel...' },
      { pct: 35, msg: 'Initializing display...' },
      { pct: 55, msg: 'Starting window manager...' },
      { pct: 75, msg: 'Mounting file system...' },
      { pct: 90, msg: 'Loading user profile...' },
      { pct: 100, msg: 'Ready' },
    ];

    let step = 0;
    function tick() {
      if (step >= messages.length) {
        finishBoot(bootScreen);
        return;
      }
      const { pct, msg } = messages[step];
      fill.style.width = pct + '%';
      status.textContent = msg;
      step++;
      setTimeout(tick, 500);
    }
    setTimeout(tick, 400);
  }

  function finishBoot(screen) {
    screen.classList.add('fade-out');
    setTimeout(() => {
      screen.style.display = 'none';
      state.bootComplete = true;
      $('#menubar').classList.remove('hidden');
      $('#dock').classList.remove('hidden');
      $('#desktop').classList.remove('hidden');
      initOS();
    }, 600);
  }

  // ---------- OS INIT ----------
  function initOS() {
    Clock.init();
    Dock.init();
    MenuBar.init();
    Spotlight.init();
    ContextMenu.init();
    Terminal.init();
    WindowManager.init();
  }

  // ---------- CLOCK ----------
  const Clock = {
    init() {
      this.update();
      setInterval(() => this.update(), 1000);
    },
    update() {
      const now = new Date();
      const h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      $('#clock').textContent = `${h12}:${m} ${ampm}`;
    },
  };

  // ---------- WINDOW MANAGER ----------
  const WindowManager = {
    init() {
      this.container = $('#windows-container');
    },

    open(sectionId) {
      // If already open (not minimized), focus it
      if (state.windows[sectionId]) {
        const w = state.windows[sectionId];
        if (state.minimized.has(sectionId)) {
          state.minimized.delete(sectionId);
          w.element.classList.remove('minimized');
          Dock.updateIndicator(sectionId);
        }
        this.focus(sectionId);
        return;
      }

      const section = CONFIG.sections.find((s) => s.id === sectionId);
      if (!section) return;

      const template = $(`#template-${sectionId}`);
      if (!template) return;

      const content = template.content.cloneNode(true);
      state.windowCount++;
      state.nextZ += 2;

      const el = document.createElement('div');
      el.className = 'window';
      el.dataset.window = sectionId;
      el.style.zIndex = state.nextZ;

      // Title bar
      const titlebar = document.createElement('div');
      titlebar.className = 'window-titlebar';
      titlebar.innerHTML = `
        <div class="window-traffic-lights">
          <span class="window-btn window-close" data-action="close" data-window="${sectionId}"></span>
          <span class="window-btn window-minimize" data-action="minimize" data-window="${sectionId}"></span>
          <span class="window-btn window-maximize" data-action="maximize" data-window="${sectionId}"></span>
        </div>
        <div class="window-title">${section.title}</div>
      `;

      const body = document.createElement('div');
      body.className = 'window-body';
      body.appendChild(content);

      el.appendChild(titlebar);
      el.appendChild(body);
      this.container.appendChild(el);

      // Position — cascade from last position
      const offset = (state.windowCount % 8) * 20;
      const vw = window.innerWidth;
      const vh = window.innerHeight - 28 - 72;
      const w = Math.min(el.offsetWidth || 540, vw - 80);
      body.style.maxHeight = (vh - 60) + 'px';
      const h = Math.min(body.scrollHeight + 36 + 40, vh - 20);
      
      el.style.left = Math.min(60 + offset, vw - w - 40) + 'px';
      el.style.top = Math.min(50 + offset, vh - h) + 'px';

      state.windows[sectionId] = { element: el, config: section };
      state.openSections.add(sectionId);
      Dock.updateIndicator(sectionId);

      // Event listeners for traffic lights
      titlebar.querySelectorAll('.window-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          const wid = btn.dataset.window;
          if (action === 'close') this.close(wid);
          else if (action === 'minimize') this.minimize(wid);
          else if (action === 'maximize') this.maximize(wid);
        });
      });

      // Click to focus
      el.addEventListener('mousedown', () => this.focus(sectionId));

      // Drag
      this.makeDraggable(el, titlebar);

      // Focus on open
      setTimeout(() => this.focus(sectionId), 50);
    },

    close(sectionId) {
      const w = state.windows[sectionId];
      if (!w) return;
      w.element.remove();
      delete state.windows[sectionId];
      state.openSections.delete(sectionId);
      state.minimized.delete(sectionId);
      Dock.updateIndicator(sectionId);
    },

    minimize(sectionId) {
      const w = state.windows[sectionId];
      if (!w) return;
      state.minimized.add(sectionId);
      w.element.classList.add('minimized');
      Dock.updateIndicator(sectionId);
    },

    maximize(sectionId) {
      const w = state.windows[sectionId];
      if (!w) return;
      const el = w.element;
      if (el.classList.contains('maximized')) {
        el.classList.remove('maximized');
        if (w._savedPos) {
          el.style.left = w._savedPos.left;
          el.style.top = w._savedPos.top;
          el.style.width = w._savedPos.width;
          el.style.height = w._savedPos.height;
        }
      } else {
        w._savedPos = {
          left: el.style.left,
          top: el.style.top,
          width: el.style.width,
          height: el.style.height,
        };
        el.classList.add('maximized');
      }
    },

    focus(sectionId) {
      const w = state.windows[sectionId];
      if (!w) return;
      state.nextZ += 2;
      w.element.style.zIndex = state.nextZ;
      Dock.setActive(sectionId);
    },

    makeDraggable(el, handle) {
      let isDragging = false;
      let startX, startY, origLeft, origTop;

      handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('.window-traffic-lights')) return;
        if (el.classList.contains('maximized')) return;
        isDragging = true;
        const rect = el.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origLeft = rect.left;
        origTop = rect.top;
        el.style.cursor = 'grabbing';
        el.style.transition = 'none';
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        el.style.left = (origLeft + dx) + 'px';
        el.style.top = (origTop + dy) + 'px';
      });

      document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        el.style.cursor = '';
        el.style.transition = '';
      });
    },
  };

  // ---------- DOCK ----------
  const Dock = {
    init() {
      $$('.dock-item[data-section]').forEach((item) => {
        item.addEventListener('click', () => {
          const section = item.dataset.section;
          WindowManager.open(section);
        });
      });
      $$('.dock-item[data-action]').forEach((item) => {
        item.addEventListener('click', () => {
          const action = item.dataset.action;
          if (action === 'resume') {
            window.open('cv.html', '_blank');
          }
        });
      });
    },

    updateIndicator(sectionId) {
      const item = document.querySelector(`.dock-item[data-section="${sectionId}"]`);
      if (!item) return;
      item.classList.remove('active', 'minimized');
      if (state.openSections.has(sectionId)) {
        if (state.minimized.has(sectionId)) {
          item.classList.add('minimized');
        } else {
          item.classList.add('active');
        }
      }
    },

    setActive(sectionId) {
      $$('.dock-item').forEach((el) => el.classList.remove('active'));
      const item = document.querySelector(`.dock-item[data-section="${sectionId}"]`);
      if (item && state.openSections.has(sectionId) && !state.minimized.has(sectionId)) {
        item.classList.add('active');
      }
    },
  };

  // ---------- MENU BAR ----------
  const MenuBar = {
    init() {
      $$('.menubar-item[data-section]').forEach((item) => {
        item.addEventListener('click', () => {
          const section = item.dataset.section;
          WindowManager.open(section);
        });
      });

      $('#spotlight-btn').addEventListener('click', () => {
        Spotlight.toggle();
      });
    },
  };

  // ---------- SPOTLIGHT SEARCH ----------
  const Spotlight = {
    init() {
      this.el = $('#spotlight');
      this.input = $('#spotlight-input');
      this.results = $('#spotlight-results');

      this.input.addEventListener('input', () => this.search());
      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.hide();
        if (e.key === 'Enter') {
          const first = this.results.querySelector('.spotlight-result');
          if (first) first.click();
        }
      });

      // Close on click outside
      document.addEventListener('click', (e) => {
        if (this.active && !this.el.contains(e.target) && e.target !== $('#spotlight-btn')) {
          this.hide();
        }
      });
    },

    toggle() {
      if (this.active) this.hide();
      else this.show();
    },

    show() {
      this.active = true;
      this.el.classList.remove('hidden');
      this.input.value = '';
      this.results.innerHTML = '';
      setTimeout(() => this.input.focus(), 100);
    },

    hide() {
      this.active = false;
      this.el.classList.add('hidden');
    },

    search() {
      const q = this.input.value.toLowerCase().trim();
      this.results.innerHTML = '';
      if (!q) return;

      const matches = CONFIG.sections.filter((s) =>
        s.title.toLowerCase().includes(q) || s.id.includes(q)
      );

      if (matches.length === 0) {
        this.results.innerHTML = '<div class="spotlight-result" style="color:var(--text-muted);cursor:default;">No results found</div>';
        return;
      }

      matches.forEach((s) => {
        const div = document.createElement('div');
        div.className = 'spotlight-result';
        div.innerHTML = `<i class="fas ${s.icon}"></i> ${s.title}`;
        div.addEventListener('click', () => {
          this.hide();
          WindowManager.open(s.id);
        });
        this.results.appendChild(div);
      });
    },
  };

  // ---------- CONTEXT MENU ----------
  const ContextMenu = {
    init() {
      this.el = $('#context-menu');

      // Desktop right-click
      $('#desktop').addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.show(e.clientX, e.clientY);
      });

      // Click items
      this.el.querySelectorAll('.context-menu-item[data-section]').forEach((item) => {
        item.addEventListener('click', () => {
          this.hide();
          WindowManager.open(item.dataset.section);
        });
      });

      this.el.querySelector('.context-menu-item[data-action="resume"]').addEventListener('click', () => {
        this.hide();
        window.open('cv.html', '_blank');
      });

      // Close on click outside
      document.addEventListener('click', (e) => {
        if (!this.el.contains(e.target)) this.hide();
      });

      // Close on escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.hide();
      });
    },

    show(x, y) {
      this.el.classList.remove('hidden');
      const rect = this.el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = Math.min(x, vw - rect.width - 10);
      let top = Math.min(y, vh - rect.height - 10);
      left = Math.max(10, left);
      top = Math.max(10, top);
      this.el.style.left = left + 'px';
      this.el.style.top = top + 'px';
    },

    hide() {
      this.el.classList.add('hidden');
    },
  };

  // ---------- TERMINAL EASTER EGG ----------
  const Terminal = {
    init() {
      // Double-click the clock opens a terminal
      const clock = $('#clock');
      let lastClick = 0;
      clock.addEventListener('click', () => {
        const now = Date.now();
        if (now - lastClick < 400) {
          this.open();
        }
        lastClick = now;
      });
    },

    open() {
      if ($('#terminal-overlay')) return;

      const overlay = document.createElement('div');
      overlay.id = 'terminal-overlay';
      overlay.innerHTML = `
        <div class="terminal-window">
          <div class="terminal-titlebar">
            <span class="window-btn window-close" id="terminal-close" style="display:inline-block;"></span>
            <span style="margin-left:8px;color:var(--text-secondary);">Terminal — leece@leeceos:~</span>
          </div>
          <div class="terminal-body" id="terminal-body">
            <span class="terminal-info">Welcome to LeeceOS Terminal v1.0</span>
            <span class="terminal-info">Type 'help' for available commands.</span>
            <span class="terminal-info">Type 'exit' or click close to quit.</span>

            <span id="terminal-output"></span>
            <span class="terminal-prompt">leece@leeceos:~$ </span><span id="terminal-input-line" contenteditable="true" style="outline:none;color:#74b087;"></span>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const inputLine = $('#terminal-input-line');
      const output = $('#terminal-output');
      const body = $('#terminal-body');

      inputLine.focus();

      const commands = {
        help() {
          return `Available commands:
  about     — Show info about me
  skills    — List technical skills
  projects  — Show my projects
  contact   — Get contact info
  clear     — Clear terminal
  whoami    — Display user info
  neofetch  — System info
  date      — Show current date/time
  exit      — Close terminal`;
        },
        about() {
          return 'Mxolisi Prince Qongwani — IT Technician & Software Developer\nBSc IT (Distinction) — Northwest University';
        },
        skills() {
          return 'Java, JavaScript, Python, C#, SQL, React, Vue.js, .NET, Spring Boot, Oracle, MySQL, Data Analytics, HTML, CSS';
        },
        projects() {
          return 'Open the Projects window to see my work! (Click Projects in the dock or menubar)';
        },
        contact() {
          return 'Email: mxolisiprince87@gmail.com\nPhone: +27 76 072 2175\nLocation: Potchefstroom, South Africa';
        },
        whoami() {
          return 'leece87 — Mxolisi Prince Qongwani';
        },
        neofetch() {
          return `LeeceOS 1.0
Kernel: JS/ES2024
Uptime: ${Math.floor((typeof process !== 'undefined' && process.uptime) ? process.uptime() : Date.now() / 1000)}s
Shell: LeeceTerm 2026
Resolution: ${window.innerWidth}x${window.innerHeight}
DE: LeeceDesktop
Theme: LeeceOS-Dark
CPU: Developer Brain (4.2 GHz)
Memory: Unlimited potential`;
        },
        date() {
          return new Date().toLocaleString();
        },
        clear() {
          return '__CLEAR__';
        },
        exit() {
          overlay.remove();
          return '';
        },
      };

      function executeCommand(cmd) {
        cmd = cmd.trim().toLowerCase();
        if (!cmd) return '';

        if (commands[cmd]) {
          const result = commands[cmd]();
          if (result === '__CLEAR__') {
            output.innerHTML = '';
            return '';
          }
          return result;
        }
        return `Command not found: ${cmd}. Type 'help' for available commands.`;
      }

      inputLine.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const cmd = inputLine.textContent;
          const result = executeCommand(cmd);

          // Append command to output
          output.innerHTML += `<span class="terminal-prompt">leece@leeceos:~$ </span>${cmd}\n`;

          if (result) {
            output.innerHTML += `<span class="terminal-output">${result}</span>\n`;
          }

          inputLine.textContent = '';
          body.scrollTop = body.scrollHeight;
        } else if (e.key === 'Escape') {
          overlay.remove();
        }
      });

      $('#terminal-close').addEventListener('click', () => overlay.remove());

      // Click outside input -> refocus
      body.addEventListener('click', () => inputLine.focus());
    },
  };

  // ---------- START ----------
  return {
    start() {
      boot();
    },
  };
})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', () => LeeceOS.start());
