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
    const statUnit = document.getElementById('stat-unit');
    const statFormat = document.getElementById('stat-format');
    const contextBody = document.getElementById('context-body');
    const subtitlesTbody = document.getElementById('subtitles-tbody');
    const rawCodeBlock = document.getElementById('raw-code-block');
    const previewLang = document.getElementById('preview-lang');
    const thPositionLabel = document.getElementById('th-position-label');
    const rawTabLabel = document.getElementById('raw-tab-label');
    const rawBadge = document.getElementById('raw-badge');

    const downloadOriginalBtn = document.getElementById('download-original-btn');
    const downloadOriginalText = document.getElementById('download-original-text');
    const downloadTranslatedBtn = document.getElementById('download-translated-btn');
    const downloadTranslatedText = document.getElementById('download-translated-text');
    const downloadDraftBtn = document.getElementById('download-draft-btn');
    const saveStatus = document.getElementById('save-status');
    const headerCopyBtn = document.getElementById('header-copy-btn');
    const headerCopyText = document.getElementById('header-copy-text');
    const copyPreviewBtn = document.getElementById('copy-preview-btn');
    const copyPreviewText = document.getElementById('copy-preview-text');
    const copyRawBtn = document.getElementById('copy-raw-btn');

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
        if (!ext.endsWith('.json') && !ext.endsWith('.srt') && !ext.endsWith('.txt')) {
            alert('Vui lòng chọn file định dạng .json, .srt hoặc .txt!');
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

    // --- Preview Mode Tabs (Table vs Raw) ---
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
                alert('Vui lòng chọn hoặc kéo thả file (.json, .srt, .txt) trước khi bấm Bắt đầu!');
                return;
            }
            formData.append('file', currentSelectedFile);
        } else {
            const pastedText = document.getElementById('json-text').value.trim();
            if (!pastedText) {
                alert('Vui lòng dán nội dung văn bản, SRT hoặc JSON vào ô văn bản!');
                return;
            }
            formData.append('json_text', pastedText);
        }

        // Show loading progress
        showProgress('🚀 Khởi động AI Engine...', 'Đang nạp dữ liệu và phân tích mạch ngữ cảnh...', 20);
        processBtn.disabled = true;

        try {
            updateProgress('🤖 AI Agent đang dịch thuật & giữ nguyên định dạng...', 'Đang xử lý nội dung bằng mô hình Gemini AI...', 55);

            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Có lỗi xảy ra trong quá trình xử lý');
            }

            updateProgress('🎉 Hoàn thành!', 'Đã biên dịch thành công và bảo toàn 100% định dạng.', 100);
            processedResult = data;

            setTimeout(() => {
                hideProgress();
                renderResults(data, targetLang);
                processBtn.disabled = false;
            }, 500);

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

        statCount.textContent = data.total_lines || (data.blocks ? data.blocks.length : 1);
        previewLang.textContent = targetLang;
        contextBody.textContent = data.context_info || 'Không có ngữ cảnh chi tiết.';

        const fmt = data.format_type || 'text';

        // Adaptive Labels based on format
        if (fmt === 'text') {
            statUnit.textContent = 'Đoạn / Câu';
            statFormat.textContent = 'Văn bản thuần';
            if (thPositionLabel) thPositionLabel.textContent = 'Vị Trí / Đoạn';
            if (rawTabLabel) rawTabLabel.textContent = 'Văn Bản Hoàn Chỉnh';
            if (rawBadge) rawBadge.textContent = 'Văn Bản Định Dạng Gốc';
            if (downloadOriginalText) downloadOriginalText.textContent = 'Tải Bản Gốc (.txt)';
            if (downloadTranslatedText) downloadTranslatedText.textContent = 'Tải Bản Dịch (.txt)';
            if (headerCopyText) headerCopyText.textContent = 'Sao Chép Văn Bản';
        } else if (fmt === 'srt') {
            statUnit.textContent = 'Dòng phụ đề';
            statFormat.textContent = 'Phụ đề SRT';
            if (thPositionLabel) thPositionLabel.textContent = 'Thời Gian';
            if (rawTabLabel) rawTabLabel.textContent = 'Xem File SRT Thô';
            if (rawBadge) rawBadge.textContent = 'File Phụ Đề SRT';
            if (downloadOriginalText) downloadOriginalText.textContent = 'Tải SRT Gốc (.srt)';
            if (downloadTranslatedText) downloadTranslatedText.textContent = 'Tải SRT Đã Dịch (.srt)';
            if (headerCopyText) headerCopyText.textContent = 'Sao Chép SRT';
        } else if (fmt === 'capcut_json') {
            statUnit.textContent = 'Phụ đề CapCut';
            statFormat.textContent = 'CapCut JSON';
            if (thPositionLabel) thPositionLabel.textContent = 'Thời Gian';
            if (rawTabLabel) rawTabLabel.textContent = 'Xem JSON / SRT';
            if (rawBadge) rawBadge.textContent = 'CapCut Draft JSON';
            if (downloadOriginalText) downloadOriginalText.textContent = 'Tải JSON Gốc';
            if (downloadTranslatedText) downloadTranslatedText.textContent = 'Tải SRT Đã Dịch';
            if (headerCopyText) headerCopyText.textContent = 'Sao Chép Kết Quả';
        } else {
            statUnit.textContent = 'Mục dữ liệu';
            statFormat.textContent = 'Dữ liệu JSON';
            if (thPositionLabel) thPositionLabel.textContent = 'Vị Trí / Key';
            if (rawTabLabel) rawTabLabel.textContent = 'Xem JSON Đã Dịch';
            if (rawBadge) rawBadge.textContent = 'JSON Chuẩn Hóa';
            if (downloadOriginalText) downloadOriginalText.textContent = 'Tải JSON Gốc';
            if (downloadTranslatedText) downloadTranslatedText.textContent = 'Tải JSON Dịch';
            if (headerCopyText) headerCopyText.textContent = 'Sao Chép JSON';
        }

        // Toggle Subtle CapCut Draft Download Button
        if (downloadDraftBtn) {
            if (fmt === 'capcut_json') {
                downloadDraftBtn.classList.remove('hidden');
            } else {
                downloadDraftBtn.classList.add('hidden');
            }
        }

        // Render Table Rows with Editable Cell and Row Copy Button
        subtitlesTbody.innerHTML = '';
        if (data.blocks && data.blocks.length > 0) {
            data.blocks.forEach((block, index) => {
                const tr = document.createElement('tr');
                const timeOrPos = block.end 
                    ? `${escapeHtml(block.start)} &rarr;<br>${escapeHtml(block.end)}` 
                    : escapeHtml(block.start);
                
                tr.innerHTML = `
                    <td>${block.id}</td>
                    <td class="srt-time">${timeOrPos}</td>
                    <td class="sub-orig">${escapeHtml(block.original)}</td>
                    <td class="sub-trans" contenteditable="true" spellcheck="false" data-index="${index}" title="Bấm vào để chỉnh sửa trực tiếp">${escapeHtml(block.translated)}</td>
                    <td style="text-align: center;">
                        <button type="button" class="btn-copy-row" title="Sao chép nội dung dịch này" data-text="${escapeHtml(block.translated)}">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </td>
                `;
                subtitlesTbody.appendChild(tr);
            });
        }

        // Render Raw/Full Translated Text
        const fullTranslated = data.translated_content || data.translated_srt || data.translated_json || '';
        rawCodeBlock.textContent = fullTranslated;

        if (fmt === 'text') {
            rawCodeBlock.classList.remove('monospace-mode');
        } else {
            rawCodeBlock.classList.add('monospace-mode');
        }

        const rawTextStats = document.getElementById('raw-text-stats');
        if (rawTextStats && fullTranslated) {
            const wordCount = fullTranslated.trim().split(/\s+/).filter(Boolean).length;
            const charCount = fullTranslated.length;
            rawTextStats.textContent = `• ${wordCount} từ (${charCount} ký tự)`;
        } else if (rawTextStats) {
            rawTextStats.textContent = '';
        }
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
        return 'translated_content';
    }

    // --- Download Actions ---
    downloadOriginalBtn.addEventListener('click', () => {
        if (!processedResult) return;
        const fmt = processedResult.format_type || 'text';
        const baseName = getFileBaseName();
        const content = processedResult.original_content || processedResult.original_srt || '';

        if (fmt === 'text') {
            downloadFile(`${baseName}_original.txt`, content);
        } else if (fmt === 'srt') {
            downloadFile(`${baseName}_original.srt`, content);
        } else {
            downloadFile(`${baseName}_original.json`, content);
        }
    });

    downloadTranslatedBtn.addEventListener('click', () => {
        if (!processedResult) return;
        const fmt = processedResult.format_type || 'text';
        const baseName = getFileBaseName();
        const rawLang = document.getElementById('target-lang').value;
        const langSlug = getLangSlug(rawLang);
        const content = processedResult.translated_content || processedResult.translated_srt || '';

        if (fmt === 'text') {
            downloadFile(`${baseName}_${langSlug}.txt`, content);
        } else if (fmt === 'srt') {
            downloadFile(`${baseName}_${langSlug}.srt`, content);
        } else {
            // For CapCut, if translated_srt is available, provide SRT, else JSON
            if (processedResult.translated_srt) {
                downloadFile(`${baseName}_${langSlug}.srt`, processedResult.translated_srt);
            } else {
                downloadFile(`${baseName}_${langSlug}.json`, content);
            }
        }
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

    // --- Universal Clipboard Copy Helper with Feedback ---
    function copyTextToClipboard(text, buttonElement) {
        if (!text) return;
        const originalHtml = buttonElement.innerHTML;

        const setSuccess = () => {
            buttonElement.classList.add('copied');
            buttonElement.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép!';
            setTimeout(() => {
                buttonElement.classList.remove('copied');
                buttonElement.innerHTML = originalHtml;
            }, 2500);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(setSuccess).catch(() => {
                fallbackCopyText(text);
                setSuccess();
            });
        } else {
            fallbackCopyText(text);
            setSuccess();
        }
    }

    function fallbackCopyText(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Fallback copy error:', err);
        }
        document.body.removeChild(textarea);
    }

    // Header Main Copy Button
    if (headerCopyBtn) {
        headerCopyBtn.addEventListener('click', () => {
            if (!processedResult) return;
            const textToCopy = processedResult.translated_content || processedResult.translated_srt || '';
            copyTextToClipboard(textToCopy, headerCopyBtn);
        });
    }

    // Preview Toolbar Copy Button
    if (copyPreviewBtn) {
        copyPreviewBtn.addEventListener('click', () => {
            if (!processedResult) return;
            const textToCopy = processedResult.translated_content || processedResult.translated_srt || '';
            copyTextToClipboard(textToCopy, copyPreviewBtn);
        });
    }

    // Raw Tab Top-Right Copy Button
    if (copyRawBtn) {
        copyRawBtn.addEventListener('click', () => {
            if (!processedResult) return;
            const textToCopy = processedResult.translated_content || processedResult.translated_srt || '';
            copyTextToClipboard(textToCopy, copyRawBtn);
        });
    }

    // Row-level Copy Buttons (Event Delegation)
    subtitlesTbody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-copy-row');
        if (btn) {
            const textToCopy = btn.getAttribute('data-text');
            if (textToCopy) {
                const origHtml = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-check" style="color:#00f0ff;"></i>';
                btn.style.borderColor = '#00f0ff';
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(textToCopy);
                } else {
                    fallbackCopyText(textToCopy);
                }
                setTimeout(() => {
                    btn.innerHTML = origHtml;
                    btn.style.borderColor = '';
                }, 1800);
            }
        }
    });

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Inline Table Editing Handler & Auto-Sync ---
    let editSyncTimer = null;
    let saveStatusTimer = null;

    function showSaveStatus() {
        if (!saveStatus) return;
        saveStatus.classList.remove('hidden');
        clearTimeout(saveStatusTimer);
        saveStatusTimer = setTimeout(() => {
            saveStatus.classList.add('hidden');
        }, 1800);
    }

    function syncAllOutputsFromBlocks() {
        if (!processedResult || !processedResult.blocks) return;
        const fmt = processedResult.format_type || 'text';

        // 1. Rebuild translated SRT
        if (fmt === 'srt' || fmt === 'capcut_json') {
            processedResult.translated_srt = processedResult.blocks.map(b => 
                `${b.id}\n${b.start} --> ${b.end}\n${b.translated}\n`
            ).join('\n').trim();
        }

        // 2. Rebuild CapCut JSON if available
        if (fmt === 'capcut_json' && processedResult.draft_json_data) {
            const texts = processedResult.draft_json_data.materials?.texts || [];
            const matMap = {};
            processedResult.blocks.forEach(b => {
                if (b.mat_id) matMap[b.mat_id] = b.translated;
            });

            texts.forEach(item => {
                if (item && item.id && matMap[item.id] !== undefined) {
                    try {
                        const cObj = typeof item.content === 'string' ? JSON.parse(item.content) : item.content;
                        cObj.text = matMap[item.id];
                        item.content = JSON.stringify(cObj);
                    } catch (err) {}
                }
            });
            processedResult.translated_json = JSON.stringify(processedResult.draft_json_data, null, 2);
        }

        // 3. Rebuild translated content for text
        if (fmt === 'text') {
            processedResult.translated_content = processedResult.blocks.map(b => b.translated).join('\n\n');
        } else {
            processedResult.translated_content = processedResult.translated_srt;
        }

        // 4. Update the Full/Document view
        const fullTranslated = processedResult.translated_content || processedResult.translated_srt || '';
        rawCodeBlock.textContent = fullTranslated;

        // 5. Update stats
        const rawTextStats = document.getElementById('raw-text-stats');
        if (rawTextStats && fullTranslated) {
            const wordCount = fullTranslated.trim().split(/\s+/).filter(Boolean).length;
            const charCount = fullTranslated.length;
            rawTextStats.textContent = `• ${wordCount} từ (${charCount} ký tự)`;
        }
    }

    subtitlesTbody.addEventListener('input', (e) => {
        const td = e.target.closest('.sub-trans[contenteditable="true"]');
        if (!td || !processedResult || !processedResult.blocks) return;

        const idx = parseInt(td.getAttribute('data-index'), 10);
        if (isNaN(idx) || !processedResult.blocks[idx]) return;

        const newText = td.innerText.trim();
        processedResult.blocks[idx].translated = newText;
        td.classList.add('edited-cell');

        // Update row copy button data-text
        const row = td.closest('tr');
        if (row) {
            const rowCopyBtn = row.querySelector('.btn-copy-row');
            if (rowCopyBtn) rowCopyBtn.setAttribute('data-text', newText);
        }

        clearTimeout(editSyncTimer);
        editSyncTimer = setTimeout(() => {
            syncAllOutputsFromBlocks();
            showSaveStatus();
        }, 180);
    });

    // Subtle Download Draft Button (for CapCut PC)
    if (downloadDraftBtn) {
        downloadDraftBtn.addEventListener('click', () => {
            if (!processedResult || !processedResult.translated_json) {
                alert('Không tìm thấy dữ liệu CapCut JSON hợp lệ để tải về.');
                return;
            }
            downloadFile('draft_content.json', processedResult.translated_json);

            const origHtml = downloadDraftBtn.innerHTML;
            downloadDraftBtn.innerHTML = '<i class="fa-solid fa-check"></i> Đã tải draft_content.json!';
            setTimeout(() => {
                downloadDraftBtn.innerHTML = origHtml;
            }, 3000);
        });
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
