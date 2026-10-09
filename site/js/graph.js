// Obsidian Palette
const groupColors = {
    0: '#9ca3af', // Gray - Data / Raiz
    1: '#38bdf8', // Sky Blue - Caminhão
    2: '#34d399', // Emerald - Balança
    3: '#fbbf24', // Amber - Laboratório (Aprovado)
    4: '#c084fc', // Purple - Produção (Silos/UHT)
    5: '#f87171'  // Rose - Laudo Recusado (Descarte)
};

const groupNames = {
    0: 'Data / Raiz',
    1: 'Caminhão (Recepção)',
    2: 'Balança (Pesagem)',
    3: 'Laboratório (Qualidade)',
    4: 'Produção (Processamento)',
    5: 'Lote Recusado'
};

window.pijuGraph = {
    instance: null,
    nodeSize: 6,
    linkDistance: 50,
    
    init() {
        const elem = document.getElementById('graph-container');
        if (!elem) return;

        // Clean deep clone from state to avoid object mutation issues
        const rawData = window.app.getGraphData();
        const cleanNodes = (rawData.nodes || []).map(n => ({
            id: n.id,
            name: n.name,
            group: n.group ?? 1,
            val: n.val ?? 10,
            desc: n.desc || '',
            author: n.author || 'Sistema',
            date: n.date || '',
            hash: n.hash || '',
            extra: n.extra || {}
        }));

        const cleanLinks = (rawData.links || []).map(l => ({
            source: typeof l.source === 'object' ? l.source.id : l.source,
            target: typeof l.target === 'object' ? l.target.id : l.target
        }));

        const graphData = { nodes: cleanNodes, links: cleanLinks };

        const emptyOverlay = document.getElementById('graph-empty-overlay');
        if (emptyOverlay) {
            if (cleanNodes.length === 0) emptyOverlay.classList.remove('hidden');
            else emptyOverlay.classList.add('hidden');
        }

        if (this.instance) {
            this.instance.graphData(graphData);
            if (cleanNodes.length > 0) {
                setTimeout(() => {
                    this.instance.zoomToFit(400, 40);
                }, 100);
            }
            return;
        }

        // Initialize ForceGraph - Organic Obsidian constellation style
        this.instance = ForceGraph()(elem)
            .backgroundColor('#141414')
            .nodeRelSize(this.nodeSize)
            .nodeColor(node => groupColors[node.group] || '#94a3b8')
            .linkColor(() => 'rgba(255, 255, 255, 0.18)')
            .linkWidth(1.5)
            .linkDirectionalParticles(2)
            .linkDirectionalParticleSpeed(0.005)
            .linkDirectionalParticleWidth(2)
            .nodeCanvasObject((node, ctx, globalScale) => {
                const label = node.name || node.id;
                const fontSize = Math.max(10 / globalScale, 3);
                const radius = node.group === 0 ? 8 : (node.group === 1 ? 6.5 : 5);
                const color = groupColors[node.group] || '#94a3b8';

                // Draw circle node with subtle glow
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0; // reset

                // Draw text label below node (Obsidian style)
                if (globalScale > 0.6) {
                    ctx.font = `${fontSize}px Inter, sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';
                    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
                    ctx.fillText(label, node.x, node.y + radius + 3);
                }
            })
            .onNodeClick(node => {
                this.instance.centerAt(node.x, node.y, 800);
                this.instance.zoom(2.5, 800);
                this.showNodeDetails(node);
            })
            .graphData(graphData);

        // Adjust forces to replicate Obsidian's constellation physics
        this.applyForces();

        setTimeout(() => {
            if (this.instance && cleanNodes.length > 0) this.instance.zoomToFit(500, 50);
        }, 200);
    },

    applyForces() {
        if (!this.instance) return;
        this.instance.d3Force('charge').strength(-140);
        this.instance.d3Force('link').distance(this.linkDistance);
        this.instance.d3ReheatSimulation();
    },

    updateConfig(size, dist) {
        this.nodeSize = parseInt(size);
        this.linkDistance = parseInt(dist);
        if (this.instance) {
            this.instance.nodeRelSize(this.nodeSize);
            this.instance.d3Force('link').distance(this.linkDistance);
            this.instance.d3Force('charge').strength(-(this.linkDistance * 3));
            this.instance.d3ReheatSimulation();
        }
    },

    resize() {
        if (this.instance) {
            const elem = document.getElementById('graph-container');
            if (elem) {
                this.instance.width(elem.clientWidth);
                this.instance.height(elem.clientHeight);
                this.instance.zoomToFit(300, 40);
            }
        }
    },

    zoomToFit() {
        if (this.instance) {
            this.instance.zoomToFit(500, 40);
        }
    },

    showNodeDetails(node) {
        const panel = document.getElementById('node-details');
        const title = document.getElementById('nd-title');
        const content = document.getElementById('nd-content');

        const color = groupColors[node.group] || '#38bdf8';
        const typeTitle = groupNames[node.group] || 'Registro';

        title.innerHTML = `
            <span class="w-3 h-3 rounded-full inline-block" style="background-color: ${color}"></span>
            <span class="truncate">${node.name}</span>
        `;
        
        // Format description items
        const descItems = (node.desc || '').split('|').map(item => item.trim()).filter(Boolean);

        let extraHtml = '';
        if (node.extra && Object.keys(node.extra).length > 0) {
            extraHtml = `
                <div class="bg-obsidian p-3.5 rounded-lg border border-gray-800">
                    <div class="text-[10px] font-bold text-pijuAccent uppercase tracking-wider mb-2">Parâmetros Detalhados</div>
                    <div class="space-y-1 text-xs text-gray-300 font-mono">
                        ${Object.entries(node.extra).map(([k, v]) => `
                            <div class="flex justify-between py-0.5 border-b border-gray-800/60">
                                <span class="text-gray-400">${k}:</span>
                                <span class="text-white font-bold">${v}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="inline-block px-2.5 py-1 rounded text-white text-[11px] font-bold uppercase tracking-wider" style="background-color: ${color}">
                ${typeTitle}
            </div>
            
            <div class="bg-obsidian p-3.5 rounded-lg border border-gray-800 space-y-2">
                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Resumo Operacional</div>
                <div class="space-y-1.5 text-xs text-gray-200">
                    ${descItems.map(d => `<div class="flex items-start gap-1.5"><i class="fa-solid fa-angle-right text-gray-500 mt-1"></i><span>${d}</span></div>`).join('')}
                </div>
            </div>

            ${extraHtml}

            <div class="bg-obsidian p-3.5 rounded-lg border border-gray-800 space-y-2 font-mono">
                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Rastreabilidade Imutável</div>
                <div class="text-[11px] text-gray-400 space-y-1">
                    <div class="flex justify-between"><span>Responsável:</span> <span class="text-white font-sans">${node.author || 'Técnico'}</span></div>
                    <div class="flex justify-between"><span>Carimbo de Data:</span> <span class="text-white font-sans">${node.date || 'Hoje'}</span></div>
                    <div class="flex justify-between"><span>Status Ledger:</span> <span class="text-emerald-400"><i class="fa-solid fa-check-double"></i> Auditado</span></div>
                    <div class="pt-2">
                        <span class="text-gray-500 text-[10px]">Hash SHA-256 (Imutável):</span>
                        <div class="text-[10px] text-amber-400/90 break-all bg-gray-900 p-2 rounded mt-1 border border-gray-800">${node.hash}</div>
                    </div>
                </div>
            </div>
        `;

        panel.classList.remove('translate-x-full');
    }
};

window.addEventListener('resize', () => {
    if (window.pijuGraph) window.pijuGraph.resize();
});
