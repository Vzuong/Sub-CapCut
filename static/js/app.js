document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileNameSpan = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file-btn');

    const form = document.getElementById('translator-form');
    const processBtn = document.getElementById('process-btn');
    
    const progressCard = document.getElementById('progress-card');
    const progressTitle = document.getElementById('progress-title');
    const progressMessage = document.getElementById('progress-message');
    const progressBar = document.getElementById('progress-bar');

    const placeholderState = document.getElementById('placeholder-state');
    const resultsContainer = document.getElementById('results-container');
    const statCount = document.getElementById('stat-count');
    const statTime = document.getElementById('stat-time');
    const contextBody = document.getElementById('context-body');
    const subtitlesTbody = document.getElementById('subtitles-tbody');
    const srtCodeBlock = document.getElementById('srt-code-block');
    const previewLang = document.getElementById('preview-lang');

    const downloadOriginalBtn = document.getElementById('download-original-btn');
    const downloadTranslatedBtn = document.getElementById('download-translated-btn');
    const copySrtBtn = document.getElementById('copy-srt-btn');

    let currentSelectedFile = null;
    let processedResult = null;

    // --- File Drag & Drop Handlers ---
    dropZone.addEventListener('click', (e) => {
        if (e.target !== removeFileBtn && !removeFileBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleFileSelected(fileInput.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFileSelected(e.dataTransfer.files[0]);
        }
    });

    function handleFileSelected(file) {
        const ext = file.name.toLowerCase();
        if (!ext.endsWith('.json') && !ext.endsWith('.srt')) {
            alert('Vui lòng chọn file định dạng .json hoặc .srt!');
            return;
        }
        currentSelectedFile = file;
        fileNameSpan.textContent = file.name;
        fileInfo.classList.remove('hidden');
    }

    removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentSelectedFile = null;
        fileInput.value = '';
        fileInfo.classList.add('hidden');
    });

    // --- Input Tabs (Upload vs Paste) ---
    const inputTabBtns = document.querySelectorAll('.tab-selectors:not(.border-tabs) .tab-btn');
    inputTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            inputTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetTab = btn.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // --- Preview Mode Tabs (Table vs SRT) ---
    const previewTabBtns = document.querySelectorAll('.border-tabs .tab-btn');
    previewTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            previewTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetTab = btn.getAttribute('data-preview-tab');
            document.querySelectorAll('.preview-content-box').forEach(box => box.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // --- Form Submission ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const activeInputTab = document.querySelector('.tab-selectors:not(.border-tabs) .tab-btn.active').getAttribute('data-tab');
        const targetLang = document.getElementById('target-lang').value;
        const speedFactor = parseFloat(document.getElementById('speed-factor').value) || 1.0;

        const formData = new FormData();
        formData.append('target_language', targetLang);
        formData.append('speed_factor', speedFactor);

        if (activeInputTab === 'tab-upload') {
            if (!currentSelectedFile) {
                alert('Vui lòng chọn hoặc kéo thả file JSON / SRT trước khi bấm Bắt đầu!');
                return;
            }
            formData.append('file', currentSelectedFile);
        } else {
            const jsonText = document.getElementById('json-text').value.trim();
            if (!jsonText) {
                alert('Vui lòng dán nội dung JSON hoặc SRT vào ô văn bản!');
                return;
            }
            formData.append('json_text', jsonText);
        }

        // Show loading progress
        showProgress('🚀 Khởi động Agent...', 'Đang đọc và phân tích cấu trúc phụ đề...', 15);
        processBtn.disabled = true;

        try {
            updateProgress('🤖 AI Agent đang trinh sát ngữ cảnh & dịch...', 'Đang xử lý toàn bộ phụ đề trong 1 quy trình liên tục...', 50);

            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Có lỗi xảy ra trong quá trình xử lý');
            }

            updateProgress('🎉 Hoàn thành!', `Đã biên dịch xong toàn bộ phụ đề trong ${data.elapsed_total_sec || 0}s`, 100);
            processedResult = data;

            setTimeout(() => {
                hideProgress();
                renderResults(data, targetLang);
                processBtn.disabled = false;
            }, 600);

        } catch (err) {
            alert(`Lỗi: ${err.message}`);
            hideProgress();
            processBtn.disabled = false;
        }
    });

    // --- Progress UI helpers ---
    function showProgress(title, message, percent) {
        progressTitle.textContent = title;
        progressMessage.textContent = message;
        progressBar.style.width = `${percent}%`;
        progressCard.classList.remove('hidden');
    }

    function updateProgress(title, message, percent) {
        progressTitle.textContent = title;
        progressMessage.textContent = message;
        progressBar.style.width = `${percent}%`;
    }

    function hideProgress() {
        progressCard.classList.add('hidden');
    }

    // --- Render Results UI ---
    function renderResults(data, targetLang) {
        placeholderState.classList.add('hidden');
        resultsContainer.classList.remove('hidden');

        statCount.textContent = data.total_lines || 0;
        if (statTime) {
            statTime.textContent = `${data.elapsed_total_sec || 0}s`;
        }

        previewLang.textContent = targetLang;
        contextBody.textContent = data.context_info || 'Không có ngữ cảnh chi tiết.';

        // Render Table Rows
        subtitlesTbody.innerHTML = '';
        if (data.blocks && data.blocks.length > 0) {
            data.blocks.forEach(block => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${block.id}</td>
                    <td class="srt-time">${block.start} &rarr;<br>${block.end}</td>
                    <td class="sub-orig">${escapeHtml(block.original)}</td>
                    <td class="sub-trans">${escapeHtml(block.translated)}</td>
                `;
                subtitlesTbody.appendChild(tr);
            });
        }

        // Render Raw SRT Text
        srtCodeBlock.textContent = data.translated_srt || '';
    }

    // Helper to get sanitized language string for filename
    function getLangSlug(lang) {
        return lang.replace(/[\s()]+/g, '_').replace(/_+$/, '');
    }

    // Helper to get base filename
    function getFileBaseName() {
        if (processedResult && processedResult.filename_base && processedResult.filename_base !== 'subtitles') {
            return processedResult.filename_base;
        }
        if (currentSelectedFile) {
            const idx = currentSelectedFile.name.lastIndexOf('.');
            return idx > 0 ? currentSelectedFile.name.substring(0, idx) : currentSelectedFile.name;
        }
        return 'subtitles';
    }

    // --- Download Actions ---
    downloadOriginalBtn.addEventListener('click', () => {
        if (!processedResult || !processedResult.original_srt) return;
        const baseName = getFileBaseName();
        downloadFile(`${baseName}_original.srt`, processedResult.original_srt);
    });

    downloadTranslatedBtn.addEventListener('click', () => {
        if (!processedResult || !processedResult.translated_srt) return;
        const baseName = getFileBaseName();
        const rawLang = document.getElementById('target-lang').value;
        const langSlug = getLangSlug(rawLang);
        downloadFile(`${baseName}_${langSlug}.srt`, processedResult.translated_srt);
    });

    function downloadFile(filename, textContent) {
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Copy SRT Clipboard ---
    copySrtBtn.addEventListener('click', () => {
        if (!processedResult || !processedResult.translated_srt) return;
        navigator.clipboard.writeText(processedResult.translated_srt).then(() => {
            const origText = copySrtBtn.innerHTML;
            copySrtBtn.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép!';
            setTimeout(() => {
                copySrtBtn.innerHTML = origText;
            }, 2000);
        });
    });

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ========================================================
    // INTERACTIVE SPOTLIGHT CARD TRACKING
    // Theo dõi tọa độ chuột để tạo quầng sáng quét mờ theo con trỏ
    // ========================================================
    const spotlightCards = document.querySelectorAll('.spotlight-card');
    spotlightCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // ========================================================
    // QUANTUM CYBER LASER GRID ENGINE (60 FPS - 3 COLORS ONLY)
    // Hệ thống mạng lưới Laze Lượng Tử & Hạt Năng Lượng Đa Chiều
    // Màu sắc: Void Black (nền) • Electric Cyan • Pure White
    // ========================================================
    const qCanvas = document.getElementById('quantumCanvas');
    if (qCanvas) {
        const ctx = qCanvas.getContext('2d');
        let width = qCanvas.width = window.innerWidth;
        let height = qCanvas.height = window.innerHeight;

        let mouse = {
            x: -1000,
            y: -1000,
            radius: 160,
            active: false
        };

        window.addEventListener('resize', () => {
            width = qCanvas.width = window.innerWidth;
            height = qCanvas.height = window.innerHeight;
            initParticles();
        });

        window.addEventListener('mousemove', (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            mouse.active = true;
        });

        window.addEventListener('mouseleave', () => {
            mouse.active = false;
            mouse.x = -1000;
            mouse.y = -1000;
        });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                mouse.x = e.touches[0].clientX;
                mouse.y = e.touches[0].clientY;
                mouse.active = true;
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            mouse.active = false;
            mouse.x = -1000;
            mouse.y = -1000;
        });

        // Particle Class
        class QuantumNode {
            constructor() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.baseX = this.x;
                this.baseY = this.y;
                this.vx = (Math.random() - 0.5) * 0.7;
                this.vy = (Math.random() - 0.5) * 0.7;
                this.radius = Math.random() * 1.8 + 1.2;
                this.colorType = Math.random() > 0.25 ? 'cyan' : 'white';
                this.pulsePhase = Math.random() * Math.PI * 2;
                this.pulseSpeed = Math.random() * 0.03 + 0.015;
            }

            update() {
                this.x += this.vx;
                this.y += this.vy;
                this.pulsePhase += this.pulseSpeed;

                // Bounce at edges
                if (this.x < 0 || this.x > width) this.vx *= -1;
                if (this.y < 0 || this.y > height) this.vy *= -1;

                // Mouse interaction - gentle magnetic repulse/attract
                if (mouse.active) {
                    const dx = mouse.x - this.x;
                    const dy = mouse.y - this.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < mouse.radius && dist > 0) {
                        const force = (mouse.radius - dist) / mouse.radius;
                        const angle = Math.atan2(dy, dx);
                        // Repel slightly
                        this.x -= Math.cos(angle) * force * 3.5;
                        this.y -= Math.sin(angle) * force * 3.5;
                    }
                }
            }

            draw() {
                const pulse = (Math.sin(this.pulsePhase) + 1) * 0.5; // 0 to 1
                const currentRadius = this.radius * (0.85 + pulse * 0.35);

                ctx.beginPath();
                ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);

                if (this.colorType === 'cyan') {
                    ctx.fillStyle = `rgba(0, 240, 255, ${0.45 + pulse * 0.45})`;
                    ctx.shadowColor = 'rgba(0, 240, 255, 0.7)';
                    ctx.shadowBlur = 8;
                } else {
                    ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + pulse * 0.4})`;
                    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
                    ctx.shadowBlur = 10;
                }
                ctx.fill();
                ctx.shadowBlur = 0; // reset
            }
        }

        let particles = [];
        function initParticles() {
            particles = [];
            // Node density responsive
            const count = Math.min(Math.floor((width * height) / 16000), 85);
            for (let i = 0; i < count; i++) {
                particles.push(new QuantumNode());
            }
        }
        initParticles();

        // Laser beam lines between close nodes
        const maxDistance = 145;
        const maxDistSq = maxDistance * maxDistance;

        // Energy pulses running along laser lines
        class EnergyPulse {
            constructor(p1, p2) {
                this.p1 = p1;
                this.p2 = p2;
                this.t = 0;
                this.speed = Math.random() * 0.03 + 0.02;
            }

            update() {
                this.t += this.speed;
            }

            draw() {
                const px = this.p1.x + (this.p2.x - this.p1.x) * this.t;
                const py = this.p1.y + (this.p2.y - this.p1.y) * this.t;
                ctx.beginPath();
                ctx.arc(px, py, 2.2, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = '#00f0ff';
                ctx.shadowBlur = 12;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }

        let energyPulses = [];

        function renderQuantumGrid() {
            ctx.clearRect(0, 0, width, height);

            // 1. Draw Laser Connections
            const len = particles.length;
            for (let i = 0; i < len; i++) {
                const pi = particles[i];
                for (let j = i + 1; j < len; j++) {
                    const pj = particles[j];
                    const dx = pi.x - pj.x;
                    const dy = pi.y - pj.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq < maxDistSq) {
                        const dist = Math.sqrt(distSq);
                        const alpha = (1 - dist / maxDistance) * 0.28;

                        ctx.beginPath();
                        ctx.moveTo(pi.x, pi.y);
                        ctx.lineTo(pj.x, pj.y);
                        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
                        ctx.lineWidth = 0.9;
                        ctx.stroke();

                        // Occasionally spawn laser spark pulse
                        if (Math.random() < 0.0004 && energyPulses.length < 8) {
                            energyPulses.push(new EnergyPulse(pi, pj));
                        }
                    }
                }

                // Laser connection to mouse cursor
                if (mouse.active) {
                    const mdx = pi.x - mouse.x;
                    const mdy = pi.y - mouse.y;
                    const mDistSq = mdx * mdx + mdy * mdy;
                    if (mDistSq < mouse.radius * mouse.radius) {
                        const mDist = Math.sqrt(mDistSq);
                        const mAlpha = (1 - mDist / mouse.radius) * 0.45;

                        ctx.beginPath();
                        ctx.moveTo(pi.x, pi.y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.strokeStyle = `rgba(0, 240, 255, ${mAlpha})`;
                        ctx.lineWidth = 1.2;
                        ctx.stroke();
                    }
                }
            }

            // 2. Draw Energy Pulses
            for (let k = energyPulses.length - 1; k >= 0; k--) {
                const ep = energyPulses[k];
                ep.update();
                if (ep.t >= 1) {
                    energyPulses.splice(k, 1);
                } else {
                    ep.draw();
                }
            }

            // 3. Update & Draw Particles
            for (let i = 0; i < len; i++) {
                particles[i].update();
                particles[i].draw();
            }

            requestAnimationFrame(renderQuantumGrid);
        }

        renderQuantumGrid();
    }
});
