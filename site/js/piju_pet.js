// Piju OS - Pijuzinho 3D Virtual Pet Companion
// Renders the 3D pet on screen for all employees, walking, waving, idling, and getting dizzy when shaken.

window.pijuPet = {
    container: null,
    canvas: null,
    renderer: null,
    scene: null,
    camera: null,
    clock: null,
    mixers: {},
    models: {},
    currentState: 'idle', // 'idle' | 'walk' | 'wave' | 'dizzy'
    posX: 0,
    posY: 0,
    targetX: 0,
    walkSpeed: 40, // pixels per second
    walkDirection: 1, // 1 = right, -1 = left
    stateTimer: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
    shakeVelocity: 0,
    shakeEnergy: 0,
    bubbleEl: null,
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
        if (!window.THREE || !window.THREE.GLTFLoader) {
            console.warn("Three.js ou GLTFLoader não carregado para Pijuzinho.");
            return;
        }

        this.createDOM();
        this.initThree();
        this.loadModels();
        this.setupEvents();
        this.isInitialized = true;

        this.animate = this.animate.bind(this);
        requestAnimationFrame(this.animate);

        // Saudação inicial
        setTimeout(() => {
            this.showBubble("Olá! Eu sou o Pijuzinho 🐮");
        }, 1500);
    },

    createDOM() {
        // Floating Pet Container
        this.container = document.createElement('div');
        this.container.id = 'pijuzinho-pet-container';
        this.container.className = 'fixed z-[9990] select-none transition-transform duration-75';
        this.container.style.width = '140px';
        this.container.style.height = '160px';
        this.container.style.bottom = '20px';
        this.container.style.left = '80px';
        this.container.style.cursor = 'grab';
        this.container.style.touchAction = 'none';

        // Speech Bubble
        this.bubbleEl = document.createElement('div');
        this.bubbleEl.id = 'pijuzinho-bubble';
        this.bubbleEl.className = 'absolute -top-12 left-1/2 -translate-x-1/2 bg-obsidianCard/95 border border-amber-500/40 text-amber-200 text-[10px] font-bold px-3 py-1.5 rounded-xl shadow-2xl backdrop-blur-md opacity-0 pointer-events-none transition-all duration-300 whitespace-nowrap text-center';
        this.bubbleEl.innerHTML = `<span>Olá!</span>`;
        this.container.appendChild(this.bubbleEl);

        // Badge / Name Tag
        const badge = document.createElement('div');
        badge.className = 'absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full pointer-events-none shadow';
        badge.innerHTML = `<i class="fa-solid fa-cow mr-1 text-[8px]"></i>Pijuzinho`;
        this.container.appendChild(badge);

        // 3D Canvas
        this.canvas = document.createElement('canvas');
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        this.container.appendChild(this.canvas);

        document.body.appendChild(this.container);

        // Initial screen coords
        this.posX = Math.min(window.innerWidth - 180, Math.max(80, window.innerWidth - 300));
        this.posY = 20;
        this.targetX = this.posX;
        this.updatePosition();
    },

    initThree() {
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(40, 140 / 160, 0.1, 100);
        this.camera.position.set(0, 0.2, 4.2);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });
        this.renderer.setSize(140, 160);
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

        const modelKeys = ['IDLE', 'ANDA', 'ACENA', 'TONTO'];

        modelKeys.forEach(key => {
            if (!window.PIJU_MODELS || !window.PIJU_MODELS[key]) return;

            try {
                const buffer = this.dataUriToArrayBuffer(window.PIJU_MODELS[key]);
                loader.parse(buffer, '', (gltf) => {
                    const scene = gltf.scene;

                    // Ajusta escala e centraliza
                    const box = new THREE.Box3().setFromObject(scene);
                    const size = box.getSize(new THREE.Vector3());
                    const center = box.getCenter(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z) || 1;
                    const scale = 2.4 / maxDim;

                    scene.scale.set(scale, scale, scale);
                    scene.position.x = -center.x * scale;
                    scene.position.y = -box.min.y * scale - 1.1;
                    scene.position.z = -center.z * scale;

                    // Group wrapper
                    const group = new THREE.Group();
                    group.add(scene);
                    group.visible = false;
                    this.scene.add(group);

                    this.models[key] = group;

                    // Animações
                    if (gltf.animations && gltf.animations.length > 0) {
                        const mixer = new THREE.AnimationMixer(scene);
                        const action = mixer.clipAction(gltf.animations[0]);
                        action.play();
                        this.mixers[key] = mixer;
                    }

                    // Se for o primeiro (IDLE), ativa
                    if (key === 'IDLE') {
                        this.switchState('idle');
                    }
                }, (err) => {
                    console.error("Erro ao carregar modelo 3D:", key, err);
                });
            } catch (e) {
                console.error("Exceção ao parsear GLB:", key, e);
            }
        });
    },

    switchState(newState) {
        this.currentState = newState;
        this.stateTimer = 0;

        // Oculta todos os modelos
        Object.keys(this.models).forEach(k => {
            if (this.models[k]) this.models[k].visible = false;
        });

        if (newState === 'idle') {
            if (this.models.IDLE) this.models.IDLE.visible = true;
            this.stateDuration = 4 + Math.random() * 5; // 4 a 9s
        } else if (newState === 'walk') {
            // Usa ANDA se tiver meshes, ou IDLE animado andando
            const walkModel = this.models.ANDA || this.models.IDLE;
            if (walkModel) walkModel.visible = true;
            
            // Escolhe novo destino aleatório na tela
            const minX = 70;
            const maxX = Math.max(minX, window.innerWidth - 180);
            this.targetX = minX + Math.random() * (maxX - minX);
            this.walkDirection = this.targetX > this.posX ? 1 : -1;
            this.stateDuration = 5 + Math.random() * 6; // 5 a 11s
        } else if (newState === 'wave') {
            if (this.models.ACENA) this.models.ACENA.visible = true;
            else if (this.models.IDLE) this.models.IDLE.visible = true;
            this.stateDuration = 3.5;
            this.showBubble(this.phrases[Math.floor(Math.random() * this.phrases.length)]);
        } else if (newState === 'dizzy') {
            if (this.models.TONTO) this.models.TONTO.visible = true;
            else if (this.models.IDLE) this.models.IDLE.visible = true;
            this.stateDuration = 3.5;
            this.showBubble("💫 @ _ @ 💫 Fiquei tonto!");
        }
    },

    setupEvents() {
        const onStart = (e) => {
            this.isDragging = true;
            this.container.style.cursor = 'grabbing';
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

            // Detecção de balançar (Shake detection)
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

            this.posX = Math.max(20, Math.min(window.innerWidth - 160, clientX - this.dragStartX));
            this.posY = Math.max(10, Math.min(window.innerHeight - 180, (window.innerHeight - clientY) - this.dragStartY));
            this.targetX = this.posX;
            this.updatePosition();
        };

        const onEnd = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.container.style.cursor = 'grab';
                if (this.currentState !== 'dizzy') {
                    // Após soltar, acena amigavelmente!
                    this.switchState('wave');
                }
            }
        };

        this.container.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);

        this.container.addEventListener('touchstart', onStart, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onEnd);

        // Click no pet faz ele acenar
        this.container.addEventListener('click', () => {
            if (this.currentState !== 'dizzy') {
                this.switchState('wave');
            }
        });

        // Reposiciona no redimensionamento da janela
        window.addEventListener('resize', () => {
            this.posX = Math.min(this.posX, window.innerWidth - 180);
            this.updatePosition();
        });
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

        // Atualiza animações 3D ativas
        Object.values(this.mixers).forEach(mixer => {
            mixer.update(delta);
        });

        // Máquina de estados autônoma
        if (!this.isDragging) {
            this.stateTimer += delta;

            if (this.currentState === 'idle') {
                // Leve respiração / oscilação
                if (this.models.IDLE) {
                    this.models.IDLE.rotation.y = Math.sin(Date.now() * 0.002) * 0.15;
                }
                if (this.stateTimer >= this.stateDuration) {
                    // Decide entre andar (70%) ou acenar (30%)
                    if (Math.random() < 0.7) this.switchState('walk');
                    else this.switchState('wave');
                }
            } else if (this.currentState === 'walk') {
                // Move na direção do destino
                const dist = this.targetX - this.posX;
                const step = this.walkSpeed * delta;

                // Rotação suave olhando para o lado que está andando
                const targetRotY = this.walkDirection > 0 ? 0.45 : -0.45;
                const currentModel = this.models.ANDA || this.models.IDLE;
                if (currentModel) {
                    currentModel.rotation.y += (targetRotY - currentModel.rotation.y) * 0.1;
                    // Passo ritmado
                    currentModel.position.y = -1.1 + Math.abs(Math.sin(Date.now() * 0.012)) * 0.08;
                }

                if (Math.abs(dist) <= step || this.stateTimer >= this.stateDuration) {
                    this.posX = this.targetX;
                    this.updatePosition();
                    this.switchState('idle');
                } else {
                    this.posX += this.walkDirection * step;
                    this.updatePosition();
                }
            } else if (this.currentState === 'wave') {
                const currentModel = this.models.ACENA || this.models.IDLE;
                if (currentModel) {
                    currentModel.rotation.y = Math.sin(Date.now() * 0.005) * 0.2;
                }
                if (this.stateTimer >= this.stateDuration) {
                    this.switchState('idle');
                }
            } else if (this.currentState === 'dizzy') {
                const currentModel = this.models.TONTO || this.models.IDLE;
                if (currentModel) {
                    // Rotação e balanço de tontura
                    currentModel.rotation.y += delta * 12;
                    currentModel.rotation.z = Math.sin(Date.now() * 0.02) * 0.25;
                }
                if (this.stateTimer >= this.stateDuration) {
                    if (currentModel) currentModel.rotation.z = 0;
                    this.switchState('idle');
                }
            }
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    show() {
        if (!this.isInitialized) this.init();
        if (this.container) this.container.style.display = 'block';
    },

    hide() {
        if (this.container) this.container.style.display = 'none';
    }
};
