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
});
