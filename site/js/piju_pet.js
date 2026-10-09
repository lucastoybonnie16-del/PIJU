// Piju OS - Pijuzinho 3D Virtual Pet Companion
// Renders the 3D pet on screen for all employees, walking, waving, idling, and getting dizzy when shaken.

window.pijuPet = {
    container: null,
    canvas: null,
    renderer: null,
    scene: null,
    camera: null,
    clock: null,
    masterGroup: null,     // THREE.Group containing the master model
    masterModel: null,     // IDLE gltf.scene with all 5 meshes
    mixer: null,           // Single AnimationMixer for all animations
    actions: {},           // { idle: Action, walk: Action, wave: Action }
    currentAction: null,
    currentState: 'idle',  // 'idle' | 'walk' | 'wave' | 'dizzy'
    baseRotationY: -Math.PI / 2, // -90 deg: front face (Piracanjuba logo + pudding) faces directly to user
    baseModelPosY: -1.05,
    posX: 0,
    posY: 0,
    targetX: 0,
    walkSpeed: 45,         // px/s
    walkDirection: 1,      // 1 = right, -1 = left
    stateTimer: 0,
    stateDuration: 5,
    isLocked: false,       // Trava para congelar o Pijuzinho no lugar
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    shakeEnergy: 0,
    bubbleEl: null,
    bubbleTimeout: null,
    isInitialized: false,

    phrases: [
        "Olá! Eu sou o Pijuzinho 🐮",
        "🥛 Piracanjuba: Qualidade em cada gota!",
        "Checando a acidez e o alizarol!",
        "Tenha um excelente turno de trabalho! ✨",
        "Rastreabilidade 100% segura no Segundo Cérebro!",
        "Bitrem descarregado com sucesso! 🚚",
        "Padrão MAPA rigoroso e aprovado! 🏆",
        "Qualquer dúvida, fale com a IA Piju!"
    ],

    init() {
        if (this.isInitialized) return;
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }
        if (!window.THREE || !window.THREE.GLTFLoader) {
            console.warn("Three.js ou GLTFLoader não carregado para Pijuzinho.");
            return;
        }

        // Recupera preferência de trava salva no navegador
        try {
            this.isLocked = localStorage.getItem('piju_pet_locked') === 'true';
        } catch (e) {
            this.isLocked = false;
        }

        this.createDOM();
        this.initThree();
        this.loadModels();
        this.setupEvents();
        this.updateLockUI();
        this.isInitialized = true;

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        // Saudação inicial
        setTimeout(() => {
            this.showBubble("Olá! Eu sou o Pijuzinho 🐮");
        }, 1200);
    },

    createDOM() {
        // Floating Pet Container
        this.container = document.createElement('div');
        this.container.id = 'pijuzinho-pet-container';
        this.container.className = 'fixed z-[9990] select-none transition-transform duration-75 flex flex-col items-center pointer-events-none';
        this.container.style.width = '150px';
        this.container.style.height = '180px';
        this.container.style.bottom = '20px';
        this.container.style.left = '80px';
        this.container.style.touchAction = 'none';

        // Speech Bubble
        this.bubbleEl = document.createElement('div');
        this.bubbleEl.id = 'pijuzinho-bubble';
        this.bubbleEl.className = 'absolute -top-11 left-1/2 -translate-x-1/2 bg-[#121316] border border-amber-500/50 text-amber-200 text-[11px] font-semibold px-3 py-1.5 rounded-xl shadow-2xl opacity-0 pointer-events-none transition-all duration-300 whitespace-nowrap text-center z-30';
        this.bubbleEl.style.boxShadow = '0 6px 20px rgba(0,0,0,0.85), 0 0 10px rgba(245, 158, 11, 0.25)';
        this.bubbleEl.innerHTML = `<span>Olá!</span>`;
        this.container.appendChild(this.bubbleEl);

        // 3D Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'pijuzinho-canvas';
        this.canvas.style.width = '150px';
        this.canvas.style.height = '145px';
        this.canvas.style.display = 'block';
        this.canvas.style.cursor = 'grab';
        this.canvas.className = 'pointer-events-auto';
        this.container.appendChild(this.canvas);

        // Bottom Badge & Lock Bar (Opaque Obsidian Bar, No Text Bleed)
        const badgeBar = document.createElement('div');
        badgeBar.id = 'pijuzinho-badge-bar';
        badgeBar.className = 'w-full bg-[#121316] border border-amber-500/60 rounded-full py-1 px-2.5 shadow-2xl flex items-center justify-between pointer-events-auto select-none mt-1 z-20';
        badgeBar.style.boxShadow = '0 4px 16px rgba(0,0,0,0.9), 0 0 8px rgba(245, 158, 11, 0.25)';
        badgeBar.innerHTML = `
            <div class="flex items-center gap-1.5 text-amber-300 font-bold text-[10px] tracking-wide pointer-events-none">
                <i class="fa-solid fa-cow text-amber-400 text-[9px]"></i>
                <span>Pijuzinho</span>
            </div>
            <div class="w-[1px] h-3 bg-white/20 pointer-events-none"></div>
            <button id="piju-lock-btn" type="button" class="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold transition active:scale-95 cursor-pointer">
                <i id="piju-lock-icon" class="fa-solid fa-lock-open text-emerald-400 text-[9px]"></i>
                <span id="piju-lock-text" class="text-gray-300 font-mono text-[9px]">Livre</span>
            </button>
        `;
        this.container.appendChild(badgeBar);

        document.body.appendChild(this.container);

        // Initial screen coords (com folga para barra de navegação no mobile)
        const isMobile = window.innerWidth < 640;
        this.posX = Math.min(window.innerWidth - (isMobile ? 145 : 190), Math.max(20, window.innerWidth - 200));
        this.posY = isMobile ? 65 : 20;
        this.targetX = this.posX;
        this.clampPosition();
        this.updatePosition();
    },

    updateLockUI() {
        const btn = document.getElementById('piju-lock-btn');
        const icon = document.getElementById('piju-lock-icon');
        const text = document.getElementById('piju-lock-text');
        if (!btn || !icon || !text) return;

        if (this.isLocked) {
            icon.className = 'fa-solid fa-lock text-amber-400 text-[9px]';
            text.textContent = 'Travado';
            text.className = 'text-amber-300 font-mono text-[9px] font-bold';
            btn.className = 'flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 cursor-pointer transition hover:bg-amber-500/30 active:scale-95';
            btn.title = 'Pijuzinho está travado no lugar. Clique para liberar movimentação.';
        } else {
            icon.className = 'fa-solid fa-lock-open text-emerald-400 text-[9px]';
            text.textContent = 'Livre';
            text.className = 'text-gray-300 font-mono text-[9px] font-semibold';
            btn.className = 'flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:bg-white/15 cursor-pointer transition active:scale-95';
            btn.title = 'Pijuzinho está livre para passear. Clique para travar no lugar.';
        }
    },

    toggleLock(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        this.isLocked = !this.isLocked;
        try {
            localStorage.setItem('piju_pet_locked', this.isLocked ? 'true' : 'false');
        } catch (err) {}

        this.updateLockUI();

        if (this.isLocked) {
            this.switchState('idle');
            this.showBubble("Travei aqui! 🔒 Fico de guarda!");
        } else {
            this.showBubble("Destravado! 🔓 Posso passear!");
        }
    },

    initThree() {
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(40, 150 / 145, 0.1, 100);
        this.camera.position.set(0, 0.2, 4.2);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(150, 145);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        // Iluminação de estúdio para realçar as cores da Piracanjuba
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(2, 4, 3);
        this.scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0xf59e0b, 0.8);
        backLight.position.set(-2, 2, -2);
        this.scene.add(backLight);

        // Master group wrapper
        this.masterGroup = new THREE.Group();
        this.masterGroup.rotation.y = this.baseRotationY;
        this.scene.add(this.masterGroup);
    },

    dataUriToArrayBuffer(dataUri) {
        const base64 = dataUri.split(',')[1];
        const binary = atob(base64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    },

    loadModels() {
        const loader = new THREE.GLTFLoader();

        // 1. Carrega o modelo mestre IDLE (que contém todas as 5 malhas completas da caixinha e membros)
        if (window.PIJU_MODELS && window.PIJU_MODELS.IDLE) {
            try {
                const idleBuf = this.dataUriToArrayBuffer(window.PIJU_MODELS.IDLE);
                loader.parse(idleBuf, '', (gltf) => {
                    const scene = gltf.scene;

                    // Ajusta escala e centraliza perfeitamente
                    const box = new THREE.Box3().setFromObject(scene);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z) || 1;
                    const scale = 2.45 / maxDim;

                    scene.scale.set(scale, scale, scale);
                    scene.position.x = -center.x * scale;
                    scene.position.y = -box.min.y * scale - 1.05;
                    scene.position.z = -center.z * scale;
                    this.baseModelPosY = scene.position.y;

                    this.masterModel = scene;
                    this.masterGroup.add(scene);

                    // Cria o AnimationMixer vinculado ao modelo completo
                    this.mixer = new THREE.AnimationMixer(scene);

                    if (gltf.animations && gltf.animations.length > 0) {
                        this.actions.idle = this.mixer.clipAction(gltf.animations[0]);
                        this.actions.idle.play();
                        this.currentAction = this.actions.idle;
                    }

                    // 2. Extrai clipe de caminhada de ANDA
                    this.loadAnimationClip('ANDA', 'walk', loader);

                    // 3. Extrai clipe de acenar de ACENA
                    this.loadAnimationClip('ACENA', 'wave', loader);

                    this.switchState('idle');
                }, (err) => {
                    console.error("Erro ao carregar modelo 3D IDLE:", err);
                });
            } catch (e) {
                console.error("Exceção ao parsear IDLE:", e);
            }
        }
    },

    loadAnimationClip(key, actionName, loader) {
        if (!window.PIJU_MODELS || !window.PIJU_MODELS[key]) return;
        try {
            const buf = this.dataUriToArrayBuffer(window.PIJU_MODELS[key]);
            loader.parse(buf, '', (gltf) => {
                if (gltf.animations && gltf.animations.length > 0 && this.mixer) {
                    const action = this.mixer.clipAction(gltf.animations[0]);
                    this.actions[actionName] = action;
                }
            }, (err) => {
                console.warn(`Erro ao carregar animação ${actionName}:`, err);
            });
        } catch (e) {
            console.warn(`Exceção ao carregar animação ${actionName}:`, e);
        }
    },

    playAction(actionName) {
        if (!this.actions[actionName] || !this.mixer) return;
        const nextAction = this.actions[actionName];
        if (this.currentAction === nextAction) return;

        if (this.currentAction) {
            this.currentAction.fadeOut(0.25);
        }
        nextAction.reset().fadeIn(0.25).play();
        this.currentAction = nextAction;
    },

    switchState(newState) {
        // Se estiver travado, nunca transiciona para walk
        if (this.isLocked && newState === 'walk') {
            newState = 'idle';
        }

        this.currentState = newState;
        this.stateTimer = 0;

        if (newState === 'idle') {
            this.playAction('idle');
            this.stateDuration = 4 + Math.random() * 5; // 4 a 9s
        } else if (newState === 'walk') {
            this.playAction('walk');

            // Escolhe novo destino aleatório garantidamente dentro da tela visível
            const minX = 60;
            const maxX = Math.max(minX + 80, window.innerWidth - 190);
            this.targetX = minX + Math.random() * (maxX - minX);
            this.walkDirection = this.targetX >= this.posX ? 1 : -1;
            this.stateDuration = 4 + Math.random() * 5; // 4 a 9s
        } else if (newState === 'wave') {
            this.playAction('wave');
            this.stateDuration = 3.2;
            this.showBubble(this.phrases[Math.floor(Math.random() * this.phrases.length)]);
        } else if (newState === 'dizzy') {
            this.playAction('idle');
            this.stateDuration = 3.5;
            this.showBubble("💫 @ _ @ 💫 Fiquei tontinho!");
        }
    },

    setupEvents() {
        const onStart = (e) => {
            // Se o clique foi no botão de travar, não inicia arraste
            if (e.target && (e.target.closest('#piju-lock-btn') || e.target.id === 'piju-lock-btn')) {
                return;
            }

            this.isDragging = true;
            this.canvas.style.cursor = 'grabbing';
            const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
            this.dragStartX = clientX - this.posX;
            this.dragStartY = (window.innerHeight - clientY) - this.posY;
            this.lastMouseX = clientX;
            this.lastMouseY = clientY;
            this.shakeEnergy = 0;
        };

        const onMove = (e) => {
            if (!this.isDragging) return;
            const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
            const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

            const dx = clientX - this.lastMouseX;
            const dy = clientY - this.lastMouseY;
            const speed = Math.sqrt(dx * dx + dy * dy);

            // Detecção de balançar rápido (Shake detection)
            if (speed > 18) {
                this.shakeEnergy += speed * 0.12;
                if (this.shakeEnergy > 100 && this.currentState !== 'dizzy') {
                    this.switchState('dizzy');
                    this.shakeEnergy = 0;
                }
            } else {
                this.shakeEnergy = Math.max(0, this.shakeEnergy - 1);
            }

            this.lastMouseX = clientX;
            this.lastMouseY = clientY;

            this.posX = clientX - this.dragStartX;
            this.posY = (window.innerHeight - clientY) - this.dragStartY;
            this.clampPosition();
            this.targetX = this.posX;
            this.updatePosition();
        };

        const onEnd = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.canvas.style.cursor = 'grab';
                if (this.currentState !== 'dizzy') {
                    // Após soltar, dá um aceno simpático
                    this.switchState('wave');
                }
            }
        };

        // Eventos no Canvas e Container
        this.canvas.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);

        this.canvas.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onEnd);

        // Clique no canvas (sem arrastar) faz acenar
        this.canvas.addEventListener('click', () => {
            if (this.currentState !== 'dizzy' && !this.isDragging) {
                this.switchState('wave');
            }
        });

        // Evento no botão de Travar/Destravar
        const lockBtn = document.getElementById('piju-lock-btn');
        if (lockBtn) {
            lockBtn.addEventListener('click', (e) => this.toggleLock(e));
            lockBtn.addEventListener('mousedown', (e) => e.stopPropagation());
            lockBtn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
        }

        // Reposiciona no redimensionamento da janela sem sumir da tela
        window.addEventListener('resize', () => {
            this.clampPosition();
            this.updatePosition();
        });
    },

    clampPosition() {
        const isMobile = window.innerWidth < 640;
        const minX = 15;
        const maxX = Math.max(minX, window.innerWidth - (isMobile ? 145 : 180));
        this.posX = Math.max(minX, Math.min(maxX, this.posX));

        const minY = isMobile ? 60 : 10;
        const maxY = Math.max(minY, window.innerHeight - (isMobile ? 180 : 200));
        this.posY = Math.max(minY, Math.min(maxY, this.posY));
    },

    showBubble(text) {
        if (!this.bubbleEl) return;
        this.bubbleEl.querySelector('span').textContent = text;
        this.bubbleEl.style.opacity = '1';
        this.bubbleEl.style.transform = 'translateX(-50%) translateY(-6px)';

        if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
        this.bubbleTimeout = setTimeout(() => {
            if (this.bubbleEl) {
                this.bubbleEl.style.opacity = '0';
                this.bubbleEl.style.transform = 'translateX(-50%) translateY(0)';
            }
        }, 3200);
    },

    updatePosition() {
        if (!this.container) return;
        this.container.style.left = `${this.posX}px`;
        this.container.style.bottom = `${this.posY}px`;
    },

    animate() {
        requestAnimationFrame(this.animate);

        const delta = this.clock ? this.clock.getDelta() : 0.016;

        // Atualiza animações 3D
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Máquina de estados autônoma
        if (!this.isDragging && this.masterGroup) {
            this.stateTimer += delta;

            let targetRotY = this.baseRotationY; // -Math.PI / 2 (olha direto pro usuário)

            if (this.currentState === 'idle') {
                // Parado: olha diretamente para o usuário com leve respiração frontal
                targetRotY = this.baseRotationY + Math.sin(Date.now() * 0.002) * 0.05;

                // Se o modelo desceu do pulo de andar, reseta posição Y
                if (this.masterModel) {
                    this.masterModel.position.y += (this.baseModelPosY - this.masterModel.position.y) * 0.1;
                }

                if (this.stateTimer >= this.stateDuration) {
                    if (this.isLocked) {
                        // Se estiver travado, NÃO anda! Apenas acena ocasionalmente ou permanece parado
                        if (Math.random() < 0.25) this.switchState('wave');
                        else this.stateTimer = 0;
                    } else {
                        // Livre: decide entre andar (65%) ou acenar (35%)
                        if (Math.random() < 0.65) this.switchState('walk');
                        else this.switchState('wave');
                    }
                }
            } else if (this.currentState === 'walk') {
                // Se foi travado durante o walk, cancela imediatamente
                if (this.isLocked) {
                    this.switchState('idle');
                    return;
                }

                // Anda de lado na direção do movimento
                // Se andando pra direita (1): vira de lado para a direita (-0.35 rad)
                // Se andando pra esquerda (-1): vira de lado para a esquerda (-Math.PI + 0.35 rad)
                targetRotY = this.walkDirection > 0 ? -0.35 : (-Math.PI + 0.35);

                // Passo ritmado
                if (this.masterModel) {
                    this.masterModel.position.y = this.baseModelPosY + Math.abs(Math.sin(Date.now() * 0.014)) * 0.07;
                }

                const dist = this.targetX - this.posX;
                const step = this.walkSpeed * delta;

                if (Math.abs(dist) <= step || this.stateTimer >= this.stateDuration) {
                    this.posX = this.targetX;
                    this.clampPosition();
                    this.updatePosition();
                    this.switchState('idle');
                } else {
                    this.posX += this.walkDirection * step;
                    this.clampPosition();
                    this.updatePosition();
                }
            } else if (this.currentState === 'wave') {
                // Acenando: olha direto pro usuário com leve inclinação amigável
                targetRotY = this.baseRotationY + Math.sin(Date.now() * 0.004) * 0.1;

                if (this.masterModel) {
                    this.masterModel.position.y += (this.baseModelPosY - this.masterModel.position.y) * 0.1;
                }

                if (this.stateTimer >= this.stateDuration) {
                    this.switchState('idle');
                }
            } else if (this.currentState === 'dizzy') {
                // Tontura: gira rápido e oscila o eixo Z
                this.masterGroup.rotation.y += delta * 12;
                this.masterGroup.rotation.z = Math.sin(Date.now() * 0.025) * 0.28;

                if (this.stateTimer >= this.stateDuration) {
                    this.masterGroup.rotation.z = 0;
                    this.switchState('idle');
                }
            }

            // Interpolação suave de rotação (exceto durante giro rápido da tontura)
            if (this.currentState !== 'dizzy') {
                this.masterGroup.rotation.y += (targetRotY - this.masterGroup.rotation.y) * 0.12;
                this.masterGroup.rotation.z += (0 - this.masterGroup.rotation.z) * 0.12;
            }
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    show() {
        if (!this.isInitialized) this.init();
        if (this.container) this.container.style.display = 'flex';
    },

    hide() {
        if (this.container) this.container.style.display = 'none';
    }
};
