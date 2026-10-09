// Piju OS - Main Application State, Controller & BI Dashboard

const DRIVERS = [
    {
        name: 'Jobesvaldo Pinto',
        photo: 'assets/motorista_jobesvaldo.jpg',
        info: 'CNH: E • Válida • Piracanjuba Frota Oficial',
        fazenda: 'Fazenda Santa Tereza (Piracanjuba - GO)',
        rota: 'GO-217 -> Eixo de Coleta Sul -> Portaria Central',
        distancia: '64 km (1h 10min)',
        temp: '3.4°C (Refrigerado)'
    },
    {
        name: 'Carlos Eduardo Silva',
        photo: 'assets/motorista_carlos.jpg',
        info: 'CNH: E • Válida • Lacticínios Log',
        fazenda: 'Fazenda Bela Vista (Bela Vista de Goiás - GO)',
        rota: 'GO-020 -> Linha de Coleta Norte -> Rodovia GO-147',
        distancia: '148 km (2h 20min)',
        temp: '3.6°C (Refrigerado)'
    },
    {
        name: 'Marcos Rogério Santos',
        photo: 'assets/motorista_marcos.jpg',
        info: 'CNH: E • Válida • TransLeite Brasil',
        fazenda: 'Sítio Pôr do Sol (Morrinhos - GO)',
        rota: 'BR-153 -> Trecho Vicinal Sul -> Acesso Industrial',
        distancia: '112 km (1h 45min)',
        temp: '3.8°C (Refrigerado)'
    },
    {
        name: 'Antônio José Peixoto',
        photo: 'assets/motorista_antonio.jpg',
        info: 'CNH: E • Válida • Coop Leite Piracanjuba',
        fazenda: 'Agropecuária Rio Claro (Cristianópolis - GO)',
        rota: 'GO-139 -> Eixo Logístico Leste -> Entrada 01',
        distancia: '89 km (1h 25min)',
        temp: '3.5°C (Refrigerado)'
    }
];

// Log de Cargas Recusadas (Alimentado dinamicamente pelo Laboratório IA)
const REJECTED_TRUCKS_LOG = [];

window.app = {
    state: {
        user: null,
        role: null,
        nodes: [],
        links: [],
        closedTruckIds: [] // Caminhões que saíram pela portaria de expedição
    },
    currentTruckIdx: -1,
    currentTruckData: null,
    charts: {},
    timerPortariaStart: Date.now(),
    timerBalancaStart: null,
    timerLabStart: null,
    timerInterval: null,

    init() {
        this.loadState();
        this.initTimers();
        if (this.state.user) {
            this.showMainLayout();
        }

        // Verifica se veio de um reset total
        if (sessionStorage.getItem('piju_reset_msg')) {
            sessionStorage.removeItem('piju_reset_msg');
            setTimeout(() => {
                this.showToast('✅ Banco de dados resetado com sucesso! Sistema 100% zerado e limpo.', 'success');
            }, 300);
        }
    },

    // --- State Persistence & Sanitation ---
    loadState() {
        // Purge preventivo para garantir que qualquer dado residual antigo do navegador seja zerado
        const PURGE_FLAG = 'piju_db_purged_v5';
        if (!localStorage.getItem(PURGE_FLAG)) {
            const savedUser = localStorage.getItem('piju_current_user') || 'GESTOR-PIRACANJUBA';
            const savedRole = localStorage.getItem('piju_current_role') || 'gestor';
            localStorage.clear();
            localStorage.setItem(PURGE_FLAG, 'true');
            localStorage.setItem('piju_current_user', savedUser);
            localStorage.setItem('piju_current_role', savedRole);
            this.state.user = savedUser;
            this.state.role = savedRole;
            this.state.nodes = [];
            this.state.links = [];
            this.state.closedTruckIds = [];
            this.saveState();
            return;
        }

        try {
            const raw = localStorage.getItem('piju_db_v5');
            if (raw) {
                const parsed = JSON.parse(raw);
                this.state.user = parsed.user || localStorage.getItem('piju_current_user') || 'GESTOR-PIRACANJUBA';
                this.state.role = parsed.role || localStorage.getItem('piju_current_role') || 'gestor';
                this.state.nodes = parsed.nodes || [];
                this.state.closedTruckIds = parsed.closedTruckIds || [];
                // Sanitize links to guarantee source and target are strings
                this.state.links = (parsed.links || []).map(l => ({
                    source: typeof l.source === 'object' ? l.source.id : l.source,
                    target: typeof l.target === 'object' ? l.target.id : l.target
                }));
            } else {
                this.seedInitialData();
            }
        } catch (e) {
            console.error("Erro ao carregar banco:", e);
            this.seedInitialData();
        }
    },

    saveState() {
        // Sanitize links before saving to avoid circular objects
        const cleanLinks = (this.state.links || []).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));

        const toSave = {
            user: this.state.user,
            role: this.state.role,
            nodes: this.state.nodes,
            links: cleanLinks,
            closedTruckIds: this.state.closedTruckIds || []
        };
        localStorage.setItem('piju_db_v5', JSON.stringify(toSave));
        if (this.state.user) localStorage.setItem('piju_current_user', this.state.user);
        if (this.state.role) localStorage.setItem('piju_current_role', this.state.role);
        this.renderFolders();
        this.updateStats();
        this.updateLivePlacasTable();
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'fa-circle-check text-emerald-400',
            warning: 'fa-triangle-exclamation text-amber-400',
            error: 'fa-circle-xmark text-red-400',
            info: 'fa-circle-info text-sky-400'
        };

        const borders = {
            success: 'border-emerald-500/40 bg-obsidianCard/95 text-emerald-100',
            warning: 'border-amber-500/40 bg-obsidianCard/95 text-amber-100',
            error: 'border-red-500/40 bg-obsidianCard/95 text-red-100',
            info: 'border-sky-500/40 bg-obsidianCard/95 text-sky-100'
        };

        const toast = document.createElement('div');
        toast.className = `toast-item pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border ${borders[type] || borders.success} shadow-2xl text-xs backdrop-blur-md transition-all duration-300`;
        
        toast.innerHTML = `
            <i class="fa-solid ${icons[type] || icons.success} text-base mt-0.5"></i>
            <div class="flex-1 leading-relaxed font-medium">${message}</div>
            <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-white ml-2 text-xs">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(30px)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    },

    clearData() {
        const modal = document.getElementById('modal-confirm-reset');
        if (modal) modal.classList.remove('hidden');
    },

    closeResetModal() {
        const modal = document.getElementById('modal-confirm-reset');
        if (modal) modal.classList.add('hidden');
    },

    // Reset total do banco: apaga o armazenamento e recarrega limpo
    confirmResetData() {
        this.closeResetModal();
        const curUser = this.state.user || 'GESTOR-PIRACANJUBA';
        const curRole = this.state.role || 'gestor';
        localStorage.clear();
        localStorage.setItem('piju_db_purged_v5', 'true');
        localStorage.setItem('piju_current_user', curUser);
        localStorage.setItem('piju_current_role', curRole);
        this.state.user = curUser;
        this.state.role = curRole;
        this.state.nodes = [];
        this.state.links = [];
        this.state.closedTruckIds = [];
        this.saveState();
        sessionStorage.setItem('piju_reset_msg', 'true');
        location.reload();
    },

    // Inicia com o banco de dados 100% zerado (sem caminhões pré-existentes)
    seedInitialData() {
        this.state.nodes = [];
        this.state.links = [];
        this.state.closedTruckIds = [];
        this.saveState();
    },

    getGraphData() {
        return {
            nodes: this.state.nodes || [],
            links: (this.state.links || []).map(l => ({
                source: typeof l.source === 'object' ? l.source.id : l.source,
                target: typeof l.target === 'object' ? l.target.id : l.target
            }))
        };
    },

    generateHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const timePart = Date.now().toString(16);
        return '0x' + Math.abs(hash).toString(16).padStart(8, '0') + timePart + 'a7f9';
    },

    // --- Authentication ---
    login() {
        const user = document.getElementById('login-user').value.trim();
        const role = document.getElementById('login-role').value;
        if (user) {
            this.state.user = user;
            this.state.role = role;
            this.saveState();
            this.showMainLayout();
        }
    },

    logout() {
        if (window.pijuPet) window.pijuPet.hide();
        const mobileTopbar = document.getElementById('mobile-topbar');
        const mobileBottomNav = document.getElementById('mobile-bottom-nav');
        if (mobileTopbar) mobileTopbar.classList.add('hidden');
        if (mobileBottomNav) mobileBottomNav.classList.add('hidden');
        this.state.user = null;
        this.state.role = null;
        this.saveState();
        location.reload();
    },

    // --- Layout & Role-Based Navigation ---
    showMainLayout() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('sidebar').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        document.getElementById('current-user-display').textContent = `${this.state.user} (${this.getRoleLabel(this.state.role)})`;
        
        // Exibe controles mobile se estiver em smartphone/Android
        const mobileTopbar = document.getElementById('mobile-topbar');
        const mobileBottomNav = document.getElementById('mobile-bottom-nav');
        if (mobileTopbar) {
            mobileTopbar.classList.remove('hidden');
            mobileTopbar.classList.add('flex');
            const badge = document.getElementById('mobile-current-role-badge');
            if (badge) badge.textContent = this.getRoleLabel(this.state.role).toUpperCase();
        }
        if (mobileBottomNav) {
            mobileBottomNav.classList.remove('hidden');
            mobileBottomNav.classList.add('flex');
            this.updateMobileStationButton();
        }

        // Exibe o pet 3D Pijuzinho para todos os funcionários logados
        if (window.pijuPet) {
            window.pijuPet.show();
        }

        // Inicia cronômetros em tempo real
        this.initTimers();

        // Exibe o botão de Resetar Banco SOMENTE para o Gestor Geral
        const btnReset = document.getElementById('btn-reset-db');
        if (btnReset) {
            if (this.state.role === 'gestor') {
                btnReset.classList.remove('hidden');
            } else {
                btnReset.classList.add('hidden');
            }
        }

        // Control Home Cards e BI Container visibility based on Role
        this.filterHomeCards();
        this.buildNavLinks();
        this.renderFolders();
        this.updateStats();

        if (this.state.role === 'gestor') {
            this.renderRejectedTrucksTable();
            this.updateLivePlacasTable();
            setTimeout(() => {
                this.initGestorCharts();
            }, 100);
        }

        // Redireciona diretamente para a estação do funcionário
        if (this.state.role === 'gestor') {
            this.navigate('home');
        } else {
            this.navigate(this.state.role);
        }
    },

    getRoleLabel(role) {
        const map = {
            'gestor': 'Gestor Geral',
            'portaria': 'Portaria',
            'balanca': 'Balança',
            'laboratorio': 'Laboratório',
            'producao': 'Produção',
            'expedicao': 'Expedição'
        };
        return map[role] || role;
    },

    filterHomeCards() {
        const isGestor = this.state.role === 'gestor';
        const gestorBi = document.getElementById('gestor-bi-container');
        if (gestorBi) {
            gestorBi.style.display = isGestor ? 'block' : 'none';
        }
        document.getElementById('card-portaria').style.display = (isGestor || this.state.role === 'portaria') ? 'flex' : 'none';
        document.getElementById('card-balanca').style.display = (isGestor || this.state.role === 'balanca') ? 'flex' : 'none';
        document.getElementById('card-laboratorio').style.display = (isGestor || this.state.role === 'laboratorio') ? 'flex' : 'none';
        document.getElementById('card-producao').style.display = (isGestor || this.state.role === 'producao') ? 'flex' : 'none';
        document.getElementById('card-expedicao').style.display = (isGestor || this.state.role === 'expedicao') ? 'flex' : 'none';
    },

    buildNavLinks() {
        const container = document.getElementById('nav-links-container');
        const role = this.state.role;
        const isGestor = role === 'gestor';

        let html = '';
        
        // Painel BI Executivo é 100% exclusivo do Gestor Geral
        if (isGestor) {
            html += `
                <a href="#" onclick="app.navigate('home')" class="nav-btn flex items-center px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition" data-target="home">
                    <i class="fa-solid fa-chart-line w-5 text-center text-amber-400"></i> Painel BI Executivo
                </a>
            `;
        }
        
        if (isGestor || role === 'portaria') {
            html += `
                <a href="#" onclick="app.navigate('portaria')" class="nav-btn flex items-center px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition" data-target="portaria">
                    <i class="fa-solid fa-truck w-5 text-center text-blue-400"></i> 1. Portaria (Recepção)
                </a>
            `;
        }

        if (isGestor || role === 'balanca') {
            html += `
                <a href="#" onclick="app.navigate('balanca')" class="nav-btn flex items-center px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition" data-target="balanca">
                    <i class="fa-solid fa-scale-balanced w-5 text-center text-emerald-400"></i> 2. Balança (Pesagem)
                </a>
            `;
        }

        if (isGestor || role === 'laboratorio') {
            html += `
                <a href="#" onclick="app.navigate('laboratorio')" class="nav-btn flex items-center px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition" data-target="laboratorio">
                    <i class="fa-solid fa-flask w-5 text-center text-amber-400"></i> 3. Laboratório (IA Piju)
                </a>
            `;
        }

        if (isGestor || role === 'producao') {
            html += `
                <a href="#" onclick="app.navigate('producao')" class="nav-btn flex items-center px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition" data-target="producao">
                    <i class="fa-solid fa-gears w-5 text-center text-purple-400"></i> 4. Produção & Envase
                </a>
            `;
        }

        if (isGestor || role === 'expedicao') {
            html += `
                <a href="#" onclick="app.navigate('expedicao')" class="nav-btn flex items-center px-3 py-2 rounded-lg text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition" data-target="expedicao">
                    <i class="fa-solid fa-dolly w-5 text-center text-sky-400"></i> 5. Expedição (Saída)
                </a>
            `;
        }

        html += `
            <a href="#" onclick="app.navigate('second-brain')" class="nav-btn flex items-center px-3 py-2 rounded-lg text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 transition mt-2" data-target="second-brain">
                <i class="fa-solid fa-network-wired w-5 text-center text-pijuAccent"></i> Segundo Cérebro (Grafo)
            </a>
        `;

        container.innerHTML = html;
    },

    navigate(viewId) {
        // Redireciona para o setor do funcionário caso tente acessar o Painel BI sem ser gestor
        if (viewId === 'home' && this.state.role !== 'gestor') {
            return this.navigate(this.state.role);
        }

        document.querySelectorAll('.view-panel').forEach(el => el.classList.add('hidden'));
        const targetView = document.getElementById(`view-${viewId}`);
        if (targetView) targetView.classList.remove('hidden');

        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.getAttribute('data-target') === viewId) {
                btn.classList.add('bg-gray-800', 'text-white', 'font-bold');
            } else {
                btn.classList.remove('bg-gray-800', 'text-white', 'font-bold');
            }
        });

        // Fecha drawer mobile automaticamente ao navegar
        this.closeMobileSidebar();
        this.updateMobileNavActive(viewId);

        // Lifecycle calls for view data setup
        if (viewId === 'portaria') this.simulateCamera();
        if (viewId === 'balanca') this.updateBalDropdown();
        if (viewId === 'laboratorio') this.updateLabDropdown();
        if (viewId === 'producao') this.updateProdDropdown();
        if (viewId === 'expedicao') this.updateExpDropdown();
        if (viewId === 'home' && this.state.role === 'gestor') {
            this.updateLivePlacasTable();
            setTimeout(() => this.initGestorCharts(), 50);
        }
        
        if (viewId === 'second-brain' && window.pijuGraph) {
            setTimeout(() => {
                window.pijuGraph.init();
                window.pijuGraph.resize();
            }, 50);
        }
    },

    // --- Mobile Navigation & Android Handlers ---
    toggleMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (!sidebar) return;
        const isClosed = sidebar.classList.contains('-translate-x-full');
        if (isClosed) {
            sidebar.classList.remove('-translate-x-full');
            sidebar.classList.add('translate-x-0');
            if (backdrop) backdrop.classList.remove('hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            sidebar.classList.remove('translate-x-0');
            if (backdrop) backdrop.classList.add('hidden');
        }
    },

    closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (sidebar) {
            sidebar.classList.add('-translate-x-full');
            sidebar.classList.remove('translate-x-0');
        }
        if (backdrop) backdrop.classList.add('hidden');
    },

    updateMobileNavActive(viewId) {
        document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
            const v = btn.getAttribute('data-view');
            if (v === viewId || (v === 'station' && viewId === this.state.role)) {
                btn.classList.add('active', 'text-amber-400');
                btn.classList.remove('text-gray-400');
            } else {
                btn.classList.remove('active', 'text-amber-400');
                btn.classList.add('text-gray-400');
            }
        });
    },

    updateMobileStationButton() {
        const icon = document.getElementById('mobile-quick-station-icon');
        const label = document.getElementById('mobile-quick-station-label');
        if (!icon || !label) return;

        const role = this.state.role || 'gestor';
        const roleData = {
            'portaria': { icon: 'fa-solid fa-truck text-blue-400', label: 'Portaria' },
            'balanca': { icon: 'fa-solid fa-scale-balanced text-emerald-400', label: 'Balança' },
            'laboratorio': { icon: 'fa-solid fa-flask text-amber-400', label: 'Lab IA' },
            'producao': { icon: 'fa-solid fa-gears text-purple-400', label: 'Produção' },
            'expedicao': { icon: 'fa-solid fa-dolly text-sky-400', label: 'Expedição' },
            'gestor': { icon: 'fa-solid fa-chart-line text-amber-400', label: 'Gestão' }
        };

        const config = roleData[role] || roleData.gestor;
        icon.className = `${config.icon} text-base`;
        label.textContent = config.label;
    },

    goToMyStation() {
        const role = this.state.role;
        if (role && role !== 'gestor') {
            this.navigate(role);
        } else {
            this.navigate('home');
        }
    },

    toggleGraphPanel() {
        const panel = document.getElementById('graph-controls-panel');
        const btn = document.getElementById('btn-toggle-graph-panel');
        if (!panel) return;
        panel.classList.toggle('collapsed');
        if (btn) {
            const isCol = panel.classList.contains('collapsed');
            btn.innerHTML = isCol ? '<i class="fa-solid fa-chevron-down"></i>' : '<i class="fa-solid fa-chevron-up"></i>';
        }
    },

    // --- Volume & Mass Balance Helpers ---
    onBalVolumeChange() {
        const volInput = document.getElementById('bal-volume-input');
        const val = Math.max(0, parseFloat(volInput?.value) || 0);
        const calcEl = document.getElementById('bal-volume-calc');
        if (calcEl) calcEl.textContent = val.toLocaleString('pt-BR') + ' L';
        
        const tara = 18200;
        const pesoLeite = Math.round(val * 1.032);
        const pesoBruto = tara + pesoLeite;
        const brutoEl = document.getElementById('bal-peso-bruto');
        if (brutoEl) brutoEl.textContent = pesoBruto.toLocaleString('pt-BR') + ' kg';
    },

    getTruckVolume(truck) {
        if (!truck) return 0;
        if (truck.extra && typeof truck.extra.volumeNum === 'number') return truck.extra.volumeNum;
        const cleanLinks = (this.state.links || []).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));
        const bal = this.state.nodes.find(n => n.group === 2 && cleanLinks.some(l => l.source === truck.id && l.target === n.id));
        if (bal) return this.getBalVolume(bal);
        return 10000;
    },

    getBalVolume(balNode) {
        if (!balNode) return 0;
        if (balNode.extra && typeof balNode.extra.volumeNum === 'number') return balNode.extra.volumeNum;
        if (balNode.extra && balNode.extra['Volume Líquido']) {
            const parsed = parseFloat(balNode.extra['Volume Líquido'].replace(/\./g, '').replace(/[^\d.-]/g, ''));
            if (!isNaN(parsed)) return parsed;
        }
        return 10000;
    },

    getLabVolume(labNode) {
        if (!labNode) return 0;
        if (labNode.extra && typeof labNode.extra.volumeNum === 'number') return labNode.extra.volumeNum;
        if (labNode.extra && labNode.extra['Volume Associado']) {
            const parsed = parseFloat(labNode.extra['Volume Associado'].replace(/\./g, '').replace(/[^\d.-]/g, ''));
            if (!isNaN(parsed)) return parsed;
        }
        const cleanLinks = (this.state.links || []).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));
        const bal = this.state.nodes.find(n => n.group === 2 && cleanLinks.some(l => l.source === n.id && l.target === labNode.id));
        if (bal) return this.getBalVolume(bal);
        return 10000;
    },

    getTurnoNumber(hour) {
        if (hour >= 6 && hour < 14) return 1;
        if (hour >= 14 && hour < 22) return 2;
        return 3;
    },

    // --- Live Timers Controller ---
    initTimers() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerPortariaStart = Date.now();
        this.timerInterval = setInterval(() => {
            this.tickTimers();
        }, 1000);
    },

    tickTimers() {
        const fmt = (sec) => {
            const m = Math.floor(sec / 60).toString().padStart(2, '0');
            const s = (sec % 60).toString().padStart(2, '0');
            return `${m}:${s}`;
        };

        const elPort = document.getElementById('timer-portaria-live');
        if (elPort && this.timerPortariaStart) {
            const elapsed = Math.max(0, Math.floor((Date.now() - this.timerPortariaStart) / 1000));
            elPort.textContent = fmt(elapsed);
        }

        const elBal = document.getElementById('timer-balanca-live');
        if (elBal) {
            if (this.timerBalancaStart) {
                const elapsed = Math.max(0, Math.floor((Date.now() - this.timerBalancaStart) / 1000));
                elBal.textContent = fmt(elapsed);
            } else {
                elBal.textContent = '00:00';
            }
        }

        const elLab = document.getElementById('timer-lab-live');
        if (elLab) {
            if (this.timerLabStart) {
                const elapsed = Math.max(0, Math.floor((Date.now() - this.timerLabStart) / 1000));
                elLab.textContent = fmt(elapsed);
            } else {
                elLab.textContent = '00:00';
            }
        }
    },

    updateStats() {
        const trucks = this.state.nodes.filter(n => n.group === 1);
        const labsApprove = this.state.nodes.filter(n => n.group === 3);
        const labsReject = this.state.nodes.filter(n => n.group === 5);
        const closed = this.state.nodes.filter(n => n.id && n.id.startsWith('EXP-'));

        let volRecebido = trucks.reduce((sum, t) => sum + this.getTruckVolume(t), 0);
        let volAprovado = labsApprove.reduce((sum, l) => sum + this.getLabVolume(l), 0);
        let volRecusado = labsReject.reduce((sum, l) => sum + this.getLabVolume(l), 0);
        let volExpedido = 0;
        
        (this.state.closedTruckIds || []).forEach(cid => {
            const trk = this.state.nodes.find(n => n.id === cid);
            if (trk) volExpedido += this.getTruckVolume(trk);
        });
        if (volExpedido === 0 && closed.length > 0) {
            volExpedido = closed.length * 10000;
        }

        const elRec = document.getElementById('stat-vol-recebido');
        const elApr = document.getElementById('stat-vol-aprovado');
        const elRej = document.getElementById('stat-vol-recusado');
        const elExp = document.getElementById('stat-vol-expedido');

        if (elRec) elRec.textContent = volRecebido.toLocaleString('pt-BR') + ' L';
        if (elApr) elApr.textContent = volAprovado.toLocaleString('pt-BR') + ' L';
        if (elRej) elRej.textContent = volRecusado.toLocaleString('pt-BR') + ' L';
        if (elExp) elExp.textContent = volExpedido.toLocaleString('pt-BR') + ' L';

        const totalNodes = this.state.nodes.length;
        const badge = document.getElementById('folder-count-badge');
        if (badge) badge.textContent = `${totalNodes} nós`;

        this.updateTurnos();
    },

    updateTurnos() {
        const trucks = this.state.nodes.filter(n => n.group === 1);
        const labsApprove = this.state.nodes.filter(n => n.group === 3);
        const labsReject = this.state.nodes.filter(n => n.group === 5);

        const t1Vol = document.getElementById('turno1-vol');
        const t1Cam = document.getElementById('turno1-cam');
        const t1Tempo = document.getElementById('turno1-tempo');
        const t1Laudos = document.getElementById('turno1-laudos');
        const t1Rej = document.getElementById('turno1-rej');
        const t1Status = document.getElementById('turno1-status');

        const t2Vol = document.getElementById('turno2-vol');
        const t2Cam = document.getElementById('turno2-cam');
        const t2Tempo = document.getElementById('turno2-tempo');
        const t2Laudos = document.getElementById('turno2-laudos');
        const t2Rej = document.getElementById('turno2-rej');
        const t2Status = document.getElementById('turno2-status');

        const t3Vol = document.getElementById('turno3-vol');
        const t3Cam = document.getElementById('turno3-cam');
        const t3Tempo = document.getElementById('turno3-tempo');
        const t3Laudos = document.getElementById('turno3-laudos');
        const t3Rej = document.getElementById('turno3-rej');
        const t3Status = document.getElementById('turno3-status');

        const currentHour = new Date().getHours();
        const activeTurno = this.getTurnoNumber(currentHour);

        const cleanLinks = (this.state.links || []).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));

        const formatDuration = (totalSec) => {
            if (!totalSec || totalSec <= 0) return '0 min';
            if (totalSec < 60) return `${totalSec}s`;
            const m = Math.floor(totalSec / 60);
            const s = totalSec % 60;
            return s > 0 ? `${m}m ${s}s` : `${m} min`;
        };

        const processTurno = (tNum, vEl, cEl, tmEl, lEl, rEl, stEl, supervisor) => {
            const tList = trucks.filter(t => (t.extra?.turno === tNum) || (!t.extra?.turno && tNum === activeTurno));
            const camCount = tList.length;
            const volTurno = tList.reduce((sum, t) => sum + this.getTruckVolume(t), 0);

            let aprCount = 0;
            let rejCount = 0;
            let totalSec = 0;

            tList.forEach(t => {
                const bal = this.state.nodes.find(n => n.group === 2 && cleanLinks.some(l => l.source === t.id && l.target === n.id));
                if (bal) {
                    const lab = this.state.nodes.find(n => (n.group === 3 || n.group === 5) && cleanLinks.some(l => l.source === bal.id && l.target === n.id));
                    if (lab) {
                        if (lab.group === 3) aprCount++;
                        if (lab.group === 5) rejCount++;
                    }
                }
                const st = t.extra?.stageTimes || {};
                const sumSt = Object.values(st).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
                totalSec += (sumSt > 0 ? sumSt : 15);
            });

            const totalLaudos = aprCount + rejCount;
            const pct = totalLaudos > 0 ? ((aprCount / totalLaudos) * 100).toFixed(1) : (camCount > 0 ? '100.0' : '0');
            const avgSec = camCount > 0 ? Math.round(totalSec / camCount) : 0;
            const isActive = (tNum === activeTurno);

            if (vEl) vEl.textContent = volTurno.toLocaleString('pt-BR') + ' L';
            if (cEl) cEl.textContent = `${camCount} bitrens`;
            if (tmEl) tmEl.textContent = formatDuration(avgSec);
            if (lEl) lEl.textContent = `${aprCount} (${pct}%)`;
            if (rEl) rEl.textContent = `${rejCount} caminhões`;

            if (stEl) {
                if (isActive) {
                    stEl.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i> Em andamento • Supervisor ${supervisor} (${camCount} bitrens recebidos).`;
                } else if (camCount > 0) {
                    stEl.innerHTML = `<i class="fa-solid fa-check-double text-blue-400 mr-1"></i> Ciclo concluído com ${camCount} bitrens (${volTurno.toLocaleString('pt-BR')} L).`;
                } else {
                    stEl.innerHTML = `<i class="fa-solid fa-clock text-gray-500 mr-1"></i> Aguardando recebimento de leite no turno.`;
                }
            }
        };

        processTurno(1, t1Vol, t1Cam, t1Tempo, t1Laudos, t1Rej, t1Status, 'M. Castro');
        processTurno(2, t2Vol, t2Cam, t2Tempo, t2Laudos, t2Rej, t2Status, 'R. Lima');
        processTurno(3, t3Vol, t3Cam, t3Tempo, t3Laudos, t3Rej, t3Status, 'A. Borges');
    },

    // ========================================================
    // PAINEL DE BI DO GESTOR (CHART.JS GRÁFICOS DINÂMICOS)
    // ========================================================
    initGestorCharts() {
        if (!window.Chart) return;
        if (this.state.role !== 'gestor') return;

        const trucks = this.state.nodes.filter(n => n.group === 1);
        const hasTrucks = trucks.length > 0;

        const currentHour = new Date().getHours();
        const activeTurno = this.getTurnoNumber(currentHour);

        const getTurnoStats = (turnoNum) => {
            const tList = trucks.filter(t => (t.extra?.turno === turnoNum) || (!t.extra?.turno && turnoNum === activeTurno));
            if (tList.length === 0) return 0;
            let totalSec = 0;
            tList.forEach(t => {
                const st = t.extra?.stageTimes || {};
                const sumSt = Object.values(st).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0);
                totalSec += (sumSt > 0 ? sumSt : 15);
            });
            const avgSec = totalSec / tList.length;
            return Math.max(1, Math.round(avgSec / 60));
        };

        const turno1Min = hasTrucks ? getTurnoStats(1) : 0;
        const turno2Min = hasTrucks ? getTurnoStats(2) : 0;
        const turno3Min = hasTrucks ? getTurnoStats(3) : 0;

        // Gráfico 1: Tempo por Turno
        const ctxTurno = document.getElementById('chart-tempo-turno');
        if (ctxTurno) {
            if (this.charts.turno) this.charts.turno.destroy();
            this.charts.turno = new Chart(ctxTurno, {
                type: 'bar',
                data: {
                    labels: ['Turno 1 (06h-14h)', 'Turno 2 (14h-22h)', 'Turno 3 (22h-06h)'],
                    datasets: [{
                        label: 'Tempo Médio Total (min)',
                        data: hasTrucks ? [turno1Min, turno2Min, turno3Min] : [0, 0, 0],
                        backgroundColor: ['#f59e0b', '#38bdf8', '#c084fc'],
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#94a3b8', font: { size: 10 } }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', font: { size: 9 } }
                        }
                    }
                }
            });
        }

        // Gráfico 2: Tempo Médio por Categoria
        const ctxCat = document.getElementById('chart-tempo-categoria');
        if (ctxCat) {
            if (this.charts.categoria) this.charts.categoria.destroy();

            let sumPort = 0, sumBal = 0, sumLab = 0, sumDesc = 0, sumUht = 0, sumExp = 0;
            let countTrucks = trucks.length;
            trucks.forEach(t => {
                const st = t.extra?.stageTimes || {};
                sumPort += st.portaria || 8;
                sumBal += st.balanca || 6;
                sumLab += st.laboratorio || 18;
                sumDesc += st.descarga || 20;
                sumUht += st.producao || 30;
                sumExp += st.expedicao || 12;
            });

            const avgStage = (sumSec) => {
                if (countTrucks === 0) return 0;
                const sec = sumSec / countTrucks;
                return Math.max(1, Math.round(sec / 60));
            };

            const catData = hasTrucks 
                ? [avgStage(sumPort), avgStage(sumBal), avgStage(sumLab), avgStage(sumDesc), avgStage(sumUht), avgStage(sumExp)]
                : [0, 0, 0, 0, 0, 0];

            this.charts.categoria = new Chart(ctxCat, {
                type: 'bar',
                data: {
                    labels: ['Portaria', 'Balança', 'Laboratório', 'Descarga', 'UHT/Envase', 'Expedição'],
                    datasets: [{
                        label: 'Minutos por Etapa',
                        data: catData,
                        backgroundColor: '#38bdf8',
                        borderRadius: 5
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: '#94a3b8', font: { size: 10 } }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { color: '#94a3b8', font: { size: 9 } }
                        }
                    }
                }
            });
        }

        // Gráfico 3: Balanço de Massa do Leite (Doughnut)
        const ctxBalanco = document.getElementById('chart-balanco-leite');
        if (ctxBalanco) {
            if (this.charts.balanco) this.charts.balanco.destroy();
            
            const volRecebido = trucks.reduce((sum, t) => sum + this.getTruckVolume(t), 0);
            const labsApprove = this.state.nodes.filter(n => n.group === 3);
            const labsReject = this.state.nodes.filter(n => n.group === 5);
            const volAprovado = labsApprove.reduce((sum, l) => sum + this.getLabVolume(l), 0);
            const volRecusado = labsReject.reduce((sum, l) => sum + this.getLabVolume(l), 0);
            const inProcess = Math.max(0, volRecebido - volAprovado - volRecusado);
            
            const hasData = volAprovado > 0 || volRecusado > 0 || inProcess > 0;
            const dataVals = hasData ? [volAprovado, volRecusado, inProcess] : [1];
            const dataColors = hasData ? ['#10b981', '#ef4444', '#f59e0b'] : ['#262626'];
            const dataLabels = hasData 
                ? [`Aprovado (${volAprovado.toLocaleString('pt-BR')} L)`, `Recusado (${volRecusado.toLocaleString('pt-BR')} L)`, `Em Processamento (${inProcess.toLocaleString('pt-BR')} L)`]
                : ['Aguardando primeiro caminhão (0 L)'];

            this.charts.balanco = new Chart(ctxBalanco, {
                type: 'doughnut',
                data: {
                    labels: dataLabels,
                    datasets: [{
                        data: dataVals,
                        backgroundColor: dataColors,
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#cbd5e1', font: { size: 9 }, boxWidth: 10 }
                        }
                    },
                    cutout: '68%'
                }
            });
        }
    },

    // Tabela de Cargas Recusadas (Auditoria Legal)
    renderRejectedTrucksTable() {
        const tbody = document.getElementById('table-rejected-trucks');
        if (!tbody) return;

        // Pega APENAS nós recusados existentes no banco de dados (Group 5)
        const dbRejected = this.state.nodes.filter(n => n.group === 5).map(n => ({
            data: n.date || 'Hoje',
            placa: n.extra?.['Caminhão'] || 'Caminhão',
            motorista: 'Motorista do Lote',
            volume: n.extra?.['Volume Associado'] || (this.getLabVolume(n).toLocaleString('pt-BR') + ' L'),
            motivo: n.desc || 'Desvio nos parâmetros de acidez/alizarol',
            destino: 'ETE Piracanjuba (Tratamento de Efluentes & Neutralização)',
            status: 'Rejeitado / Descarte Legal'
        }));

        if (dbRejected.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-6 text-center text-gray-500 font-sans italic">
                        <i class="fa-solid fa-circle-check text-emerald-500 text-base mb-1 block"></i>
                        Nenhuma carga recusada até o momento. Todos os lotes recebidos estão em conformidade com o MAPA.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = dbRejected.map(r => `
            <tr class="hover:bg-red-950/20 transition">
                <td class="p-3 text-gray-400 font-sans">${r.data}</td>
                <td class="p-3 font-bold text-white">${r.placa}</td>
                <td class="p-3 text-gray-300 font-sans">${r.motorista}</td>
                <td class="p-3 text-red-400 font-bold">${r.volume}</td>
                <td class="p-3 text-gray-300 font-sans text-[11px]">${r.motivo}</td>
                <td class="p-3 text-gray-400 font-sans text-[11px]">${r.destino}</td>
                <td class="p-3"><span class="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold">DESCARTE</span></td>
            </tr>
        `).join('');
    },

    // Monitoramento ao Vivo das Placas
    updateLivePlacasTable() {
        const tbody = document.getElementById('table-live-trucks');
        if (!tbody) return;

        const trucks = this.state.nodes.filter(n => n.group === 1);
        if (trucks.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-6 text-center text-gray-500 italic">
                        <i class="fa-solid fa-truck text-2xl text-gray-600 mb-2 block"></i>
                        Nenhum caminhão registrado no sistema. Cadastre a entrada na Portaria para iniciar o fluxo.
                    </td>
                </tr>
            `;
            return;
        }

        const cleanLinks = (this.state.links || []).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));

        tbody.innerHTML = trucks.map(t => {
            const isClosed = (this.state.closedTruckIds || []).includes(t.id);
            
            // Determina a etapa atual do caminhão
            const bal = this.state.nodes.find(n => n.group === 2 && cleanLinks.some(l => l.source === t.id && l.target === n.id));
            let lab = null;
            if (bal) lab = this.state.nodes.find(n => (n.group === 3 || n.group === 5) && cleanLinks.some(l => l.source === bal.id && l.target === n.id));
            let prod = false;
            if (lab) prod = this.state.nodes.some(n => n.group === 4 && cleanLinks.some(l => l.source === lab.id && l.target === n.id));

            let etapaNome = '1. Portaria (Entrada)';
            let etapaBadge = 'bg-blue-500/20 text-blue-400';
            if (bal) { etapaNome = '2. Balança (Pesado)'; etapaBadge = 'bg-emerald-500/20 text-emerald-400'; }
            if (lab) {
                if (lab.group === 5) { etapaNome = '3. Lab (REJEITADO)'; etapaBadge = 'bg-red-500/20 text-red-400'; }
                else { etapaNome = '3. Lab (Aprovado)'; etapaBadge = 'bg-amber-500/20 text-amber-400'; }
            }
            if (prod) { etapaNome = '4. Produção & UHT'; etapaBadge = 'bg-purple-500/20 text-purple-400'; }
            if (isClosed) { etapaNome = '5. Expedição (Saída Concluída)'; etapaBadge = 'bg-sky-500/20 text-sky-400'; }

            const statusBloqueio = isClosed 
                ? '<span class="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold font-mono"><i class="fa-solid fa-lock mr-1"></i>TRANCADO / FINALIZADO</span>'
                : '<span class="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold font-mono"><i class="fa-solid fa-lock-open mr-1"></i>EM PROCESSO</span>';

            const volFormatted = this.getTruckVolume(t).toLocaleString('pt-BR') + ' L';

            return `
                <tr class="hover:bg-gray-800/40 transition">
                    <td class="p-3 font-bold text-white font-mono">${t.extra?.Placa || t.name}</td>
                    <td class="p-3 text-gray-300">${t.extra?.Motorista || 'N/A'}</td>
                    <td class="p-3 text-gray-400 text-xs">${t.extra?.['Fazenda Origem'] || 'N/A'}</td>
                    <td class="p-3 font-mono font-bold text-emerald-400">${volFormatted}</td>
                    <td class="p-3"><span class="px-2.5 py-1 rounded-md text-[11px] font-bold ${etapaBadge}">${etapaNome}</span></td>
                    <td class="p-3">${statusBloqueio}</td>
                    <td class="p-3 text-right">
                        <button onclick="app.focusNode('${t.id}')" class="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-amber-400 font-medium transition" title="Ver no Grafo">
                            <i class="fa-solid fa-eye"></i> Grafo
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // ========================================================
    // 1. MÓDULO PORTARIA & CÂMERA INTELIGENTE
    // ========================================================
    simulateCamera() {
        this.currentTruckIdx = (this.currentTruckIdx + 1) % DRIVERS.length;
        const driver = DRIVERS[this.currentTruckIdx];
        this.currentTruckData = driver;
        this.timerPortariaStart = Date.now();

        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const l = () => letters[Math.floor(Math.random() * letters.length)];
        const n = () => Math.floor(Math.random() * 10);
        const placa = `${l()}${l()}${l()}-${n()}${l()}${n()}${n()}`;

        const elPlaca = document.getElementById('camera-placa');
        if (elPlaca) elPlaca.textContent = placa;

        const now = new Date();
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const elTime = document.getElementById('camera-time');
        if (elTime) elTime.textContent = timeStr;

        // Render Driver Photo & Info
        document.getElementById('driver-photo').src = driver.photo;
        document.getElementById('driver-name').textContent = driver.name;
        document.getElementById('driver-info').textContent = driver.info;

        // Render Detailed Route
        document.getElementById('port-rota-details').innerHTML = `
            <div class="flex items-start gap-2 bg-obsidian p-2.5 rounded border border-gray-800">
                <i class="fa-solid fa-location-dot text-emerald-400 mt-0.5"></i>
                <div>
                    <div class="text-xs text-gray-400">Origem da Carga:</div>
                    <div class="text-xs font-bold text-white">${driver.fazenda}</div>
                </div>
            </div>
            <div class="flex items-start gap-2 bg-obsidian p-2.5 rounded border border-gray-800">
                <i class="fa-solid fa-road text-sky-400 mt-0.5"></i>
                <div>
                    <div class="text-xs text-gray-400">Trajeto Autorizado & Telemetria:</div>
                    <div class="text-xs font-bold text-white">${driver.rota}</div>
                    <div class="text-[10px] text-gray-400 mt-0.5">Distância: ${driver.distancia} • Temperatura Tanque: ${driver.temp}</div>
                </div>
            </div>
            <div class="flex items-center gap-2 text-xs text-emerald-400 font-mono pt-1">
                <i class="fa-solid fa-satellite-dish"></i> GPS Conectado • Lacre Digital #LC-88493 Ativo
            </div>
        `;
    },

    registerTruck() {
        const placa = document.getElementById('camera-placa').textContent;
        const driver = this.currentTruckData || DRIVERS[0];
        const id = 'TRK-' + Date.now();
        const today = new Date().toLocaleDateString('pt-BR');
        const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const rootId = 'DATE-' + today.replace(/\//g, '');
        const currentHour = new Date().getHours();
        const turnoNum = this.getTurnoNumber(currentHour);

        // Tempo decorrido na portaria
        const portSec = this.timerPortariaStart ? Math.max(1, Math.floor((Date.now() - this.timerPortariaStart) / 1000)) : 8;
        this.timerPortariaStart = Date.now();

        // Guarantee Daily Root Node
        if (!this.state.nodes.find(n => n.id === rootId)) {
            this.state.nodes.push({
                id: rootId,
                name: `Dia ${today}`,
                group: 0,
                val: 20,
                desc: `Nó Raiz Diário • Monitoramento Geral 2M Litros / Dia`,
                author: 'Sistema',
                date: today,
                hash: this.generateHash('ROOT' + today)
            });
        }

        const desc = `Motorista: ${driver.name} | Origem: ${driver.fazenda} | Trajeto: ${driver.rota} | Status: Encaminhado à Balança`;

        const truckNode = {
            id,
            name: `Caminhão ${placa}`,
            group: 1,
            val: 16,
            desc,
            author: `${this.state.user} (Portaria)`,
            date: `${today}, ${nowTime}`,
            hash: this.generateHash(id + placa + driver.name),
            extra: {
                'Placa': placa,
                'Motorista': driver.name,
                'Fazenda Origem': driver.fazenda,
                'Rota Rasteada': driver.rota,
                'Status': 'Aguardando Pesagem na Balança',
                'turno': turnoNum,
                'timestamp': Date.now(),
                'balStartTime': Date.now(),
                'stageTimes': {
                    portaria: portSec
                }
            }
        };

        this.state.nodes.push(truckNode);
        this.state.links.push({ source: rootId, target: id });

        this.saveState();
        this.showToast(`Caminhão ${placa} registrado na portaria! Encaminhado à Balança.`, 'success');
        this.simulateCamera();
    },

    // ========================================================
    // 2. MÓDULO BALANÇA & PESAGEM
    // ========================================================
    updateBalDropdown() {
        const select = document.getElementById('bal-caminhao');
        select.innerHTML = '';

        // Caminhões que NÃO foram finalizados/fechados na expedição
        const activeTrucks = this.state.nodes.filter(n => n.group === 1 && !(this.state.closedTruckIds || []).includes(n.id));

        const weighedTruckIds = this.state.links
            .filter(l => {
                const targetNode = this.state.nodes.find(n => n.id === (l.target.id || l.target));
                return targetNode && targetNode.group === 2;
            })
            .map(l => l.source.id || l.source);

        const available = activeTrucks.filter(t => !weighedTruckIds.includes(t.id));

        if (available.length === 0) {
            select.innerHTML = '<option value="">Nenhum caminhão aguardando pesagem</option>';
            document.getElementById('bal-ai-box').innerHTML = '<p class="text-gray-500">Nenhum caminhão na fila de pesagem.</p>';
            document.getElementById('bal-peso-bruto').textContent = '-- kg';
            document.getElementById('bal-tara').textContent = '-- kg';
            document.getElementById('bal-volume-calc').textContent = '0 L';
            document.getElementById('bal-volume-input').value = '';
            document.getElementById('bal-temp-input').value = '';
            return;
        }

        available.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.name} - ${t.extra?.Motorista || ''}</option>`;
        });

        this.onBalTruckSelect();
    },

    onBalTruckSelect() {
        const truckId = document.getElementById('bal-caminhao').value;
        const truck = this.state.nodes.find(n => n.id === truckId);
        if (!truck) {
            document.getElementById('bal-peso-bruto').textContent = '-- kg';
            document.getElementById('bal-tara').textContent = '-- kg';
            document.getElementById('bal-volume-calc').textContent = '0 L';
            document.getElementById('bal-volume-input').value = '';
            document.getElementById('bal-temp-input').value = '';
            this.timerBalancaStart = null;
            return;
        }

        // Cronômetro da Balança
        if (!truck.extra) truck.extra = {};
        if (!truck.extra.balStartTime) truck.extra.balStartTime = Date.now();
        this.timerBalancaStart = truck.extra.balStartTime;

        const defaultVol = truck.extra?.volumeNum || 10000;
        document.getElementById('bal-volume-input').value = defaultVol;
        document.getElementById('bal-temp-input').value = '3.8';
        this.onBalVolumeChange();

        const aiBox = document.getElementById('bal-ai-box');
        aiBox.innerHTML = `
            <div class="space-y-1.5">
                <div class="text-emerald-400 font-bold"><i class="fa-solid fa-check-circle"></i> Caminhão Identificado na Plataforma:</div>
                <div><strong>Placa:</strong> ${truck.extra?.Placa || truck.name}</div>
                <div><strong>Motorista:</strong> ${truck.extra?.Motorista || 'N/A'}</div>
                <div><strong>Origem:</strong> ${truck.extra?.['Fazenda Origem'] || 'N/A'}</div>
                <div class="mt-2 text-amber-300 text-[11px] bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    <i class="fa-solid fa-circle-info"></i> Piju IA: Estimativa de densidade do leite cru: 1.032 g/cm³. Volume e peso calculados em tempo real.
                </div>
            </div>
        `;
    },

    registerWeighing() {
        const truckId = document.getElementById('bal-caminhao').value;
        if (!truckId) return this.showToast("Selecione um caminhão para concluir a pesagem.", "warning");

        // Trava de segurança: Se o caminhão foi fechado na expedição, não pode mais mexer!
        if ((this.state.closedTruckIds || []).includes(truckId)) {
            return this.showToast("⚠️ Este caminhão já foi finalizado na expedição e está bloqueado!", "error");
        }

        const truck = this.state.nodes.find(n => n.id === truckId);
        const volumeNum = Math.max(0, parseFloat(document.getElementById('bal-volume-input').value) || 10000);
        const temp = document.getElementById('bal-temp-input').value || '3.8';
        const obs = document.getElementById('bal-obs-input').value || 'Pesagem padrão concluída';

        const taraNum = 18200;
        const pesoBrutoNum = taraNum + Math.round(volumeNum * 1.032);
        const pesoBrutoStr = pesoBrutoNum.toLocaleString('pt-BR') + ' kg';
        const volumeStr = volumeNum.toLocaleString('pt-BR') + ' L';

        // Tempo gasto na balança
        const balSec = this.timerBalancaStart ? Math.max(1, Math.floor((Date.now() - this.timerBalancaStart) / 1000)) : 10;
        this.timerBalancaStart = null;

        if (truck) {
            if (!truck.extra) truck.extra = {};
            truck.extra.volumeNum = volumeNum;
            truck.extra['Volume Líquido'] = volumeStr;
            truck.extra['Volume'] = volumeStr;
            if (!truck.extra.stageTimes) truck.extra.stageTimes = {};
            truck.extra.stageTimes.balanca = balSec;
            truck.extra.labStartTime = Date.now();
        }

        const id = 'BAL-' + Date.now();
        const today = new Date().toLocaleDateString('pt-BR');
        const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        const desc = `Volume Líquido: ${volumeStr} | Peso Bruto: ${pesoBrutoStr} | Tara: 18.200 kg | Temp: ${temp}°C | Obs: ${obs}`;

        const balNode = {
            id,
            name: `Pesagem: ${volumeStr}`,
            group: 2,
            val: 14,
            desc,
            author: `${this.state.user} (Balança)`,
            date: `${today}, ${nowTime}`,
            hash: this.generateHash(id + volumeNum + temp),
            extra: {
                'Caminhão': truck ? truck.name : 'N/A',
                'volumeNum': volumeNum,
                'Volume Líquido': volumeStr,
                'Peso Bruto': pesoBrutoStr,
                'Tara': '18.200 kg',
                'Temperatura': `${temp}°C`,
                'Observações': obs
            }
        };

        this.state.nodes.push(balNode);
        this.state.links.push({ source: truckId, target: id });

        this.saveState();
        this.showToast(`Pesagem de ${volumeStr} concluída com sucesso! Encaminhado ao Laboratório.`, 'success');
        this.updateBalDropdown();
    },

    // ========================================================
    // 3. MÓDULO LABORATÓRIO (IA PIJU)
    // ========================================================
    updateLabDropdown() {
        const select = document.getElementById('lab-caminhao');
        select.innerHTML = '';

        const weighNodes = this.state.nodes.filter(n => n.group === 2);
        const labTargetIds = this.state.links
            .filter(l => {
                const targetNode = this.state.nodes.find(n => n.id === (l.target.id || l.target));
                return targetNode && (targetNode.group === 3 || targetNode.group === 5);
            })
            .map(l => l.source.id || l.source);

        const available = weighNodes.filter(w => !labTargetIds.includes(w.id));

        if (available.length === 0) {
            select.innerHTML = '<option value="">Nenhuma carga aguardando análise de laboratório</option>';
            document.getElementById('lab-truck-summary').textContent = 'Nenhuma carga pendente de análise laboratorial.';
            document.getElementById('lab-acidez').value = '';
            document.getElementById('lab-ph').value = '';
            document.getElementById('lab-crio').value = '';
            document.getElementById('lab-micro').value = '';
            document.getElementById('lab-obs').value = '';
            document.getElementById('piju-chat').innerHTML = '<div class="text-sm text-gray-500 text-center italic py-8">Aguardando envio dos parâmetros físico-químicos para análise...</div>';
            document.getElementById('auth-controls').classList.add('hidden');
            this.timerLabStart = null;
            return;
        }

        available.forEach(w => {
            select.innerHTML += `<option value="${w.id}">${w.name} (${w.extra?.Caminhão || ''})</option>`;
        });

        this.onLabTruckSelect();
    },

    onLabTruckSelect() {
        const weighId = document.getElementById('lab-caminhao').value;
        const weigh = this.state.nodes.find(n => n.id === weighId);
        const summary = document.getElementById('lab-truck-summary');
        if (!weigh) {
            summary.textContent = 'Nenhum caminhão selecionado.';
            document.getElementById('lab-acidez').value = '';
            document.getElementById('lab-ph').value = '';
            document.getElementById('lab-crio').value = '';
            document.getElementById('lab-micro').value = '';
            document.getElementById('lab-obs').value = '';
            this.timerLabStart = null;
            return;
        }

        const volNum = this.getBalVolume(weigh);
        const volStr = volNum.toLocaleString('pt-BR') + ' L';
        const tara = 18200;
        const bruto = (tara + Math.round(volNum * 1.032)).toLocaleString('pt-BR') + ' kg';

        // Acha caminhão pai para iniciar timer
        const cleanLinks = (this.state.links || []).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));
        const trkLink = cleanLinks.find(l => l.target === weigh.id);
        const trk = trkLink ? this.state.nodes.find(n => n.id === trkLink.source) : null;
        if (trk && trk.extra && trk.extra.labStartTime) {
            this.timerLabStart = trk.extra.labStartTime;
        } else {
            this.timerLabStart = Date.now();
        }

        document.getElementById('lab-acidez').value = '16.0';
        document.getElementById('lab-ph').value = '6.70';
        document.getElementById('lab-alizarol').value = 'Normal';
        document.getElementById('lab-crio').value = '-0.530';
        document.getElementById('lab-micro').value = '< 300.000 UFC/ml';

        summary.innerHTML = `
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div><strong>Carga:</strong> ${weigh.extra?.Caminhão || 'N/A'}</div>
                <div><strong>Volume Pesado:</strong> <span class="text-emerald-400 font-bold">${volStr}</span></div>
                <div><strong>Temp. Entrada:</strong> ${weigh.extra?.Temperatura || '3.8°C'}</div>
                <div><strong>Tara/Bruto:</strong> 18.200 kg / ${bruto}</div>
            </div>
        `;
    },

    sendToPiju() {
        const weighId = document.getElementById('lab-caminhao').value;
        if (!weighId) return this.showToast("Não há carga selecionada para análise.", "warning");

        const weigh = this.state.nodes.find(n => n.id === weighId);
        const acidezVal = document.getElementById('lab-acidez').value;
        const acidez = acidezVal ? parseFloat(acidezVal) : 16.0;
        const phVal = document.getElementById('lab-ph').value;
        const ph = phVal ? parseFloat(phVal) : 6.70;
        const alizarol = document.getElementById('lab-alizarol').value || 'Normal';
        const crio = document.getElementById('lab-crio').value || '-0.530';
        const micro = document.getElementById('lab-micro').value || '< 300.000 UFC/ml';
        const obs = document.getElementById('lab-obs').value || 'Sensorial límpido e característico.';

        const chat = document.getElementById('piju-chat');
        chat.innerHTML = `
            <div class="flex items-center gap-2 text-amber-300 py-3">
                <i class="fa-solid fa-spinner fa-spin"></i> Piju IA processando parâmetros analíticos e comparando com padrões Piracanjuba...
            </div>
        `;
        document.getElementById('auth-controls').classList.add('hidden');

        setTimeout(() => {
            let isApproved = true;
            let reprovMotivos = [];

            if (ph < 6.60 || ph > 6.80) {
                isApproved = false;
                reprovMotivos.push(`pH ${ph} fora da faixa oficial (6.60 - 6.80)`);
            }
            if (acidez < 14 || acidez > 18) {
                isApproved = false;
                reprovMotivos.push(`Acidez ${acidez} ºD fora dos limites (14 - 18 ºD)`);
            }
            if (alizarol !== 'Normal') {
                isApproved = false;
                reprovMotivos.push(`Teste do Alizarol acusou instabilidade térmica / coagulação`);
            }

            const statusClass = isApproved ? 'text-emerald-400' : 'text-red-400';
            const statusBadge = isApproved ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30';
            const volStr = this.getBalVolume(weigh).toLocaleString('pt-BR') + ' L';

            chat.innerHTML = `
                <div class="bg-obsidian p-3.5 rounded-lg border border-gray-800 space-y-2 text-xs">
                    <div class="flex items-center justify-between pb-2 border-b border-gray-800">
                        <span class="font-bold text-white flex items-center gap-1.5">
                            <i class="fa-solid fa-shield-halved text-pijuAccent"></i> Laudo Analítico Emitido por IA
                        </span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${statusBadge}">
                            ${isApproved ? 'CONFORME MAPA' : 'NÃO CONFORME'}
                        </span>
                    </div>
                    
                    <div class="space-y-1 text-gray-300">
                        <div>• <strong>Volume Auditado:</strong> ${volStr}</div>
                        <div>• <strong>pH:</strong> ${ph} ${ph >= 6.60 && ph <= 6.80 ? '<span class="text-emerald-400">✓ Conforme</span>' : '<span class="text-red-400">✗ Alerta</span>'}</div>
                        <div>• <strong>Acidez Dornic:</strong> ${acidez} ºD ${acidez >= 14 && acidez <= 18 ? '<span class="text-emerald-400">✓ Conforme</span>' : '<span class="text-red-400">✗ Alerta</span>'}</div>
                        <div>• <strong>Alizarol 72%:</strong> ${alizarol} ${alizarol === 'Normal' ? '<span class="text-emerald-400">✓ Estável</span>' : '<span class="text-red-400">✗ Instável</span>'}</div>
                        <div>• <strong>Crioscopia:</strong> ${crio} °C <span class="text-emerald-400">✓ Sem água adicionada</span></div>
                        <div>• <strong>Microbiológico:</strong> ${micro} <span class="text-emerald-400">✓ Conforme</span></div>
                        <div>• <strong>Obs Técnico:</strong> ${obs}</div>
                    </div>

                    <div class="mt-3 pt-2 border-t border-gray-800 font-bold ${statusClass}">
                        ${isApproved 
                            ? '✨ RECOMENDAÇÃO PIJU: LEITE APTO PARA DESCARGA E DESTINO A UHT.' 
                            : `⚠️ RECOMENDAÇÃO PIJU: CARGA REJEITADA (${reprovMotivos.join('; ')}). NÃO DESCARREGAR EM SILO!`}
                    </div>
                </div>
            `;

            window.currentLabCtx = {
                weighId,
                acidez,
                ph,
                alizarol,
                crio,
                micro,
                obs,
                isRecommendedApprove: isApproved
            };

            document.getElementById('auth-controls').classList.remove('hidden');
        }, 1000);
    },

    authorizeTruck(userDecision) {
        const ctx = window.currentLabCtx;
        if (!ctx) return;

        const weigh = this.state.nodes.find(n => n.id === ctx.weighId);
        const volNum = this.getBalVolume(weigh);
        const volStr = volNum.toLocaleString('pt-BR') + ' L';
        const today = new Date().toLocaleDateString('pt-BR');
        const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const id = 'LAB-' + Date.now();

        // Cronômetro gasto no laboratório
        const labSec = this.timerLabStart ? Math.max(1, Math.floor((Date.now() - this.timerLabStart) / 1000)) : 18;
        this.timerLabStart = null;

        // Atualiza stageTimes do caminhão pai
        const cleanLinks = (this.state.links || []).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));
        const parentTruckLink = cleanLinks.find(l => l.target === ctx.weighId);
        if (parentTruckLink) {
            const parentTruck = this.state.nodes.find(n => n.id === parentTruckLink.source);
            if (parentTruck && parentTruck.extra) {
                if (!parentTruck.extra.stageTimes) parentTruck.extra.stageTimes = {};
                parentTruck.extra.stageTimes.laboratorio = labSec;
            }
        }

        const group = userDecision ? 3 : 5; // 3 = Aprovado (Amber), 5 = Recusado (Rose)
        const name = userDecision ? 'Laudo Lab: Aprovado' : 'Laudo Lab: RECUSADO';
        const desc = `pH: ${ctx.ph} | Acidez: ${ctx.acidez}ºD | Alizarol: ${ctx.alizarol} | Decisão: ${userDecision ? 'Liberado para Silos' : 'Retido para Descarte'}`;

        const labNode = {
            id,
            name,
            group,
            val: 16,
            desc,
            author: `${this.state.user} (Laboratório)`,
            date: `${today}, ${nowTime}`,
            hash: this.generateHash(id + desc + userDecision),
            extra: {
                'Decisão Final': userDecision ? 'Aprovado' : 'Recusado / Descarte',
                'pH': ctx.ph,
                'Acidez': `${ctx.acidez} ºD`,
                'Alizarol': ctx.alizarol,
                'Crioscopia': ctx.crio,
                'CBT': ctx.micro,
                'Observações': ctx.obs,
                'volumeNum': volNum,
                'Volume Associado': volStr,
                'Caminhão': weigh?.extra?.Caminhão || 'N/A'
            }
        };

        this.state.nodes.push(labNode);
        this.state.links.push({ source: ctx.weighId, target: id });

        this.saveState();
        document.getElementById('auth-controls').classList.add('hidden');

        if (userDecision) {
            this.showToast(`Laudo APROVADO emitido com sucesso (${volStr})! Lote liberado para a Produção.`, 'success');
        } else {
            this.showToast(`Carga RECUSADA (${volStr}) registrada no Segundo Cérebro para descarte legal.`, 'error');
            this.renderRejectedTrucksTable();
        }

        this.updateLabDropdown();
    },

    // ========================================================
    // 4. MÓDULO PRODUÇÃO & PROCESSAMENTO
    // ========================================================
    updateProdDropdown() {
        const select = document.getElementById('prod-caminhao');
        select.innerHTML = '';

        const approvedLabs = this.state.nodes.filter(n => n.group === 3);

        if (approvedLabs.length === 0) {
            select.innerHTML = '<option value="">Nenhum lote liberado pelo laboratório</option>';
            document.getElementById('prod-linha').value = '';
            document.getElementById('prod-temp').value = '';
            document.getElementById('prod-obs').value = '';
            return;
        }

        approvedLabs.forEach(lab => {
            select.innerHTML += `<option value="${lab.id}">${lab.name} (${lab.extra?.['Volume Associado'] || '10.000 L'}) - ${lab.date}</option>`;
        });
        if (!document.getElementById('prod-linha').value) document.getElementById('prod-linha').value = 'LINHA-UHT-01';
        if (!document.getElementById('prod-temp').value) document.getElementById('prod-temp').value = '142°C / 4.2 bar';
    },

    registerProductionStep() {
        const sourceId = document.getElementById('prod-caminhao').value;
        if (!sourceId) return this.showToast("Selecione um lote liberado pelo laboratório.", "warning");

        const etapa = document.getElementById('prod-etapa').value;
        const linha = document.getElementById('prod-linha').value || 'LINHA-UHT-01';
        const temp = document.getElementById('prod-temp').value || 'Normal';
        const obs = document.getElementById('prod-obs').value || 'Parâmetros operacionais dentro das especificações.';

        const today = new Date().toLocaleDateString('pt-BR');
        const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const id = 'PROD-' + Date.now();

        const desc = `${etapa} | Linha: ${linha} | Parâmetro: ${temp} | Obs: ${obs}`;

        // Atualiza tempo de produção do caminhão pai
        const cleanLinks = (this.state.links || []).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));
        const labToBalLink = cleanLinks.find(l => l.target === sourceId);
        if (labToBalLink) {
            const balToTrkLink = cleanLinks.find(l => l.target === labToBalLink.source);
            if (balToTrkLink) {
                const trk = this.state.nodes.find(n => n.id === balToTrkLink.source);
                if (trk && trk.extra) {
                    if (!trk.extra.stageTimes) trk.extra.stageTimes = {};
                    trk.extra.stageTimes.producao = (trk.extra.stageTimes.producao || 0) + 25;
                }
            }
        }

        const prodNode = {
            id,
            name: etapa.split('(')[0].trim(),
            group: 4,
            val: 13,
            desc,
            author: `${this.state.user} (Produção)`,
            date: `${today}, ${nowTime}`,
            hash: this.generateHash(id + etapa + linha),
            extra: {
                'Etapa Completa': etapa,
                'Linha / Silo': linha,
                'Parâmetro Medido': temp,
                'Observações': obs
            }
        };

        this.state.nodes.push(prodNode);
        this.state.links.push({ source: sourceId, target: id });

        this.saveState();
        this.showToast(`Etapa "${prodNode.name}" gravada com sucesso no Segundo Cérebro!`, 'success');
        document.getElementById('prod-obs').value = '';
    },

    // ========================================================
    // 5. MÓDULO EXPEDIÇÃO & SAÍDA DE FÁBRICA (BLOQUEIO TOTAL)
    // ========================================================
    updateExpDropdown() {
        const select = document.getElementById('exp-caminhao');
        select.innerHTML = '';

        // Mostra caminhões que ainda NÃO foram finalizados
        const openTrucks = this.state.nodes.filter(n => n.group === 1 && !(this.state.closedTruckIds || []).includes(n.id));

        if (openTrucks.length === 0) {
            select.innerHTML = '<option value="">Nenhum caminhão aguardando saída</option>';
            document.getElementById('exp-truck-summary').textContent = 'Nenhum caminhão aguardando liberação na portaria de saída.';
            document.getElementById('exp-lacre').value = '';
            document.getElementById('exp-destino').value = '';
            return;
        }

        openTrucks.forEach(t => {
            select.innerHTML += `<option value="${t.id}">${t.name} • ${t.extra?.Motorista || ''}</option>`;
        });

        this.onExpTruckSelect();
    },

    onExpTruckSelect() {
        const truckId = document.getElementById('exp-caminhao').value;
        const truck = this.state.nodes.find(n => n.id === truckId);
        const summary = document.getElementById('exp-truck-summary');
        if (!truck) {
            summary.textContent = 'Nenhum caminhão selecionado.';
            document.getElementById('exp-lacre').value = '';
            document.getElementById('exp-destino').value = '';
            return;
        }

        if (!document.getElementById('exp-lacre').value) {
            document.getElementById('exp-lacre').value = 'LACRE-EXP-' + Math.floor(10000 + Math.random() * 90000);
        }
        if (!document.getElementById('exp-destino').value) {
            document.getElementById('exp-destino').value = 'Centro de Distribuição São Paulo (CD-SP)';
        }

        const volStr = this.getTruckVolume(truck).toLocaleString('pt-BR') + ' Litros';

        summary.innerHTML = `
            <div class="grid grid-cols-2 gap-2 text-xs">
                <div><strong>Placa OCR:</strong> <span class="font-mono text-white font-bold">${truck.extra?.Placa || truck.name}</span></div>
                <div><strong>Motorista:</strong> ${truck.extra?.Motorista || 'N/A'}</div>
                <div><strong>Origem:</strong> ${truck.extra?.['Fazenda Origem'] || 'N/A'}</div>
                <div><strong>Volume Carga:</strong> <span class="text-sky-400 font-bold">${volStr}</span></div>
                <div class="col-span-2 text-emerald-400 mt-1">
                    <i class="fa-solid fa-circle-check"></i> Carga processada, envasada e liberada da quarentena sanitária.
                </div>
            </div>
        `;
    },

    registerTruckExit() {
        const truckId = document.getElementById('exp-caminhao').value;
        if (!truckId) return this.showToast("Selecione um caminhão para registrar a saída.", "warning");

        const truck = this.state.nodes.find(n => n.id === truckId);
        const lacre = document.getElementById('exp-lacre').value || 'LACRE-EXP-001';
        const destino = document.getElementById('exp-destino').value || 'CD Regional';

        const today = new Date().toLocaleDateString('pt-BR');
        const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const id = 'EXP-' + Date.now();

        const desc = `Saída de Fábrica Autorizada | Lacre: ${lacre} | Destino: ${destino} | Ciclo de Rastreabilidade Fechado e Trancado`;

        if (truck && truck.extra) {
            if (!truck.extra.stageTimes) truck.extra.stageTimes = {};
            truck.extra.stageTimes.expedicao = 15;
            truck.extra.finishedTimestamp = Date.now();
        }

        const expNode = {
            id,
            name: `Expedição: ${truck ? (truck.extra?.Placa || truck.name) : 'Caminhão'}`,
            group: 4,
            val: 14,
            desc,
            author: `${this.state.user} (Expedição)`,
            date: `${today}, ${nowTime}`,
            hash: this.generateHash(id + lacre + destino),
            extra: {
                'Status': 'Saída Concluída • Lacre Ativo',
                'Lacre de Expedição': lacre,
                'Destino': destino,
                'Bloqueio': 'Imutável • Finalizado',
                'volumeNum': truck ? this.getTruckVolume(truck) : 10000
            }
        };

        // Adiciona à lista de caminhões fechados (imutáveis)
        if (!this.state.closedTruckIds) this.state.closedTruckIds = [];
        this.state.closedTruckIds.push(truckId);

        this.state.nodes.push(expNode);
        this.state.links.push({ source: truckId, target: id });

        this.saveState();
        this.showToast(`🔒 Caminhão ${truck ? (truck.extra?.Placa || truck.name) : ''} finalizado e lacrado com sucesso! Carga bloqueada contra alterações.`, 'success');

        this.updateExpDropdown();
        this.updateLivePlacasTable();
    },

    // ========================================================
    // 6. OBSIDIAN FOLDER TREE VISUALIZER (SIDEBAR)
    // ========================================================
    renderFolders() {
        const container = document.getElementById('dynamic-folders');
        if (!container) return;
        container.innerHTML = '';

        const dateNodes = this.state.nodes.filter(n => n.group === 0);

        if (dateNodes.length === 0) {
            container.innerHTML = `
                <div class="px-3 py-8 text-center text-gray-500 text-xs">
                    <i class="fa-solid fa-folder-open text-2xl text-gray-600 mb-2 block"></i>
                    <div class="font-medium text-gray-400">Nenhum registro ativo</div>
                    <div class="text-[10px] text-gray-600 mt-1">Acesse a <strong>Portaria</strong> para registrar o primeiro caminhão.</div>
                </div>
            `;
            return;
        }

        dateNodes.forEach((dn, dIdx) => {
            const folderId = 'fld-date-' + dIdx;
            
            const cleanLinks = (this.state.links || []).map(l => ({
                source: typeof l.source === 'object' ? l.source.id : l.source,
                target: typeof l.target === 'object' ? l.target.id : l.target
            }));

            const trucks = this.state.nodes.filter(n => n.group === 1 && cleanLinks.some(l => l.source === dn.id && l.target === n.id));

            let dateHtml = `
                <div class="mb-1">
                    <div class="flex items-center px-2 py-1.5 hover:bg-gray-800 rounded-md cursor-pointer text-xs font-semibold text-gray-300 select-none" onclick="app.toggleFolder('${folderId}')">
                        <i id="icon-${folderId}" class="fa-solid fa-chevron-down text-[10px] w-4 text-gray-500"></i>
                        <i class="fa-regular fa-calendar text-gray-400 mr-1.5"></i>
                        <span>${dn.name}</span>
                    </div>
                    <div id="${folderId}" class="pl-4 py-1 space-y-1 border-l border-gray-800 ml-3">
            `;

            trucks.forEach((trk, tIdx) => {
                const trkFolderId = `fld-trk-${dIdx}-${tIdx}`;
                const isClosed = (this.state.closedTruckIds || []).includes(trk.id);

                // Acha Balança deste caminhão
                const balancaNode = this.state.nodes.find(n => n.group === 2 && cleanLinks.some(l => l.source === trk.id && l.target === n.id));
                
                // Acha Lab desta Balança
                let labNode = null;
                if (balancaNode) {
                    labNode = this.state.nodes.find(n => (n.group === 3 || n.group === 5) && cleanLinks.some(l => l.source === balancaNode.id && l.target === n.id));
                }

                // Acha etapas de Produção e Expedição
                let prodSteps = [];
                if (labNode) {
                    prodSteps = this.state.nodes.filter(n => n.group === 4 && cleanLinks.some(l => l.source === labNode.id && l.target === n.id));
                }

                // Acha nó de Expedição ligado diretamente ao caminhão
                const expNode = this.state.nodes.find(n => n.id.startsWith('EXP-') && cleanLinks.some(l => l.source === trk.id && l.target === n.id));

                dateHtml += `
                    <div>
                        <div class="flex items-center justify-between px-2 py-1 hover:bg-gray-800 rounded cursor-pointer text-xs ${isClosed ? 'text-gray-400' : 'text-sky-400'} font-medium select-none" onclick="app.toggleFolder('${trkFolderId}')">
                            <div class="flex items-center truncate">
                                <i id="icon-${trkFolderId}" class="fa-solid fa-chevron-down text-[9px] w-3 text-gray-500"></i>
                                <i class="fa-solid fa-truck text-[10px] mr-1.5"></i>
                                <span class="truncate">${trk.name}</span>
                            </div>
                            ${isClosed ? '<i class="fa-solid fa-lock text-[9px] text-red-400 ml-1" title="Trancado na Expedição"></i>' : ''}
                        </div>
                        <div id="${trkFolderId}" class="pl-3 py-0.5 space-y-0.5 border-l border-gray-800/80 ml-2">
                            <!-- Ficha Portaria -->
                            <div class="flex items-center px-2 py-1 hover:bg-gray-800 rounded cursor-pointer text-[11px] text-gray-400 hover:text-white" onclick="app.focusNode('${trk.id}')">
                                <i class="fa-solid fa-id-card text-blue-400 w-3.5 text-[9px]"></i>
                                <span class="truncate">Portaria & Rota</span>
                            </div>
                `;

                if (balancaNode) {
                    dateHtml += `
                        <div class="flex items-center px-2 py-1 hover:bg-gray-800 rounded cursor-pointer text-[11px] text-gray-400 hover:text-white" onclick="app.focusNode('${balancaNode.id}')">
                            <i class="fa-solid fa-scale-balanced text-emerald-400 w-3.5 text-[9px]"></i>
                            <span class="truncate">${balancaNode.name}</span>
                        </div>
                    `;
                }

                if (labNode) {
                    const isApprove = labNode.group === 3;
                    dateHtml += `
                        <div class="flex items-center px-2 py-1 hover:bg-gray-800 rounded cursor-pointer text-[11px] text-gray-400 hover:text-white" onclick="app.focusNode('${labNode.id}')">
                            <i class="fa-solid fa-flask ${isApprove ? 'text-amber-400' : 'text-red-400'} w-3.5 text-[9px]"></i>
                            <span class="truncate">${labNode.name}</span>
                        </div>
                    `;
                }

                if (prodSteps.length > 0) {
                    prodSteps.forEach(ps => {
                        dateHtml += `
                            <div class="flex items-center px-2 py-1 hover:bg-gray-800 rounded cursor-pointer text-[11px] text-gray-400 hover:text-white" onclick="app.focusNode('${ps.id}')">
                                <i class="fa-solid fa-gear text-purple-400 w-3.5 text-[9px]"></i>
                                <span class="truncate">${ps.name}</span>
                            </div>
                        `;
                    });
                }

                if (expNode) {
                    dateHtml += `
                        <div class="flex items-center px-2 py-1 hover:bg-gray-800 rounded cursor-pointer text-[11px] text-sky-400 hover:text-white" onclick="app.focusNode('${expNode.id}')">
                            <i class="fa-solid fa-lock text-sky-400 w-3.5 text-[9px]"></i>
                            <span class="truncate">${expNode.name}</span>
                        </div>
                    `;
                }

                dateHtml += `
                        </div>
                    </div>
                `;
            });

            dateHtml += `
                    </div>
                </div>
            `;

            container.innerHTML += dateHtml;
        });
    },

    toggleFolder(id) {
        const el = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        if (!el) return;
        if (el.classList.contains('hidden')) {
            el.classList.remove('hidden');
            if (icon) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-down');
            }
        } else {
            el.classList.add('hidden');
            if (icon) {
                icon.classList.remove('fa-chevron-down');
                icon.classList.add('fa-chevron-right');
            }
        }
    },

    focusNode(nodeId) {
        this.navigate('second-brain');
        setTimeout(() => {
            if (window.pijuGraph && window.pijuGraph.instance) {
                const node = window.pijuGraph.instance.graphData().nodes.find(n => n.id === nodeId);
                if (node) {
                    window.pijuGraph.instance.centerAt(node.x, node.y, 800);
                    window.pijuGraph.instance.zoom(3, 800);
                    window.pijuGraph.showNodeDetails(node);
                }
            }
        }, 150);
    },

    // --- Graph Controls ---
    updateGraphConfig() {
        const size = document.getElementById('cfg-node-size').value;
        const dist = document.getElementById('cfg-link-dist').value;

        document.getElementById('lbl-node-size').textContent = size;
        document.getElementById('lbl-link-dist').textContent = dist;

        if (window.pijuGraph) {
            window.pijuGraph.updateConfig(size, dist);
        }
    },

    resetGraphView() {
        if (window.pijuGraph) {
            window.pijuGraph.zoomToFit();
        }
    },

    closeNodeDetails() {
        const panel = document.getElementById('node-details');
        if (panel) panel.classList.add('translate-x-full');
    }
};

window.onload = () => {
    app.init();
};
