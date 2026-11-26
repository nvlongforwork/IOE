    let appState = {
        studentName: '', grade: '', examRoundText: '',
        isTeacher: false,
        questions: [],
        answers: {},
        orderPlaced: {},
        orderBankShuffled: {},
        currentQuestionIndex: 0,
        startTime: null,
        timerInterval: null,
        timeElapsed: 0,
        retryMode: false,
        round1: null,
        round2: null
    };

    const POINTS_PER_QUESTION = 10;

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function formatTime(s) {
        return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
    }

    // --- Sidebar (mobile) ---
    function openSidebar() {
        document.getElementById('sidebar-panel').classList.add('open');
        document.getElementById('sidebar-overlay').classList.add('open');
    }
    function closeSidebar() {
        document.getElementById('sidebar-panel').classList.remove('open');
        document.getElementById('sidebar-overlay').classList.remove('open');
    }
    document.getElementById('btn-sidebar-toggle').onclick = openSidebar;

    // --- Modal ---
    const modal = {
        show(title, desc, buttons, icon='fa-exclamation-circle', iconColor='text-ruby') {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-desc').innerHTML = desc;
        const iconEl = document.getElementById('modal-icon');
        iconEl.className = `text-5xl mb-4 ${iconColor}`;
        iconEl.innerHTML = `<i class="fas ${icon}"></i>`;
        const actionsEl = document.getElementById('modal-actions');
        actionsEl.innerHTML = '';
        buttons.forEach(btn => {
            const b = document.createElement('button');
            b.className = `flex-1 py-3 px-3 rounded-xl font-bold transition-all active:scale-95 text-sm ${btn.class}`;
            b.textContent = btn.text;
            b.onclick = () => { if(btn.onClick) btn.onClick(); if(btn.close!==false) modal.hide(); };
            actionsEl.appendChild(b);
        });
        document.getElementById('global-modal').classList.remove('hidden');
        },
        hide() { document.getElementById('global-modal').classList.add('hidden'); }
    };

    function showScreen(id) {
        ['screen-start','screen-quiz','screen-result','screen-review'].forEach(s => {
        document.getElementById(s).classList.add('hidden');
        });
        document.getElementById(id).classList.remove('hidden');
        window.scrollTo(0,0);
    }

    // --- Teacher key ---
    document.getElementById('teacher-key').addEventListener('input', e => {
        if (e.target.value === '968903') {
        appState.isTeacher = true;
        e.target.style.backgroundColor = '#dcfce7';
        modal.show('Thành công','Đã xác nhận Giáo viên.',[{text:'Đóng',class:'bg-green-500 text-white'}],'fa-check-circle','text-green-500');
        setTimeout(()=>e.target.value='', 1500);
        }
    });

    // --- Shuffle ---
    function shuffleArray(arr) {
        for (let i=arr.length-1;i>0;i--) {
        const j=Math.floor(Math.random()*(i+1));
        [arr[i],arr[j]]=[arr[j],arr[i]];
        }
        return arr;
    }

    // --- Fetch questions ---
    async function fetchQuestions(fileName, count) {
        try {
        modal.show('Đang tải...','Vui lòng chờ...',[],'fa-spinner fa-spin','text-blue-500');
        const res = await fetch(`./${fileName}`);
        if (!res.ok) throw new Error(`Không tìm thấy file: <b>${fileName}</b>`);
        const raw = await res.json();
        modal.hide();

        let data = [];
        const processPart = part => {
            if (!part) return;
            part.forEach(item => {
            let opts = [];
            if (item.options) {
                opts = typeof item.options==='string'
                ? item.options.split(/,\s*(?=[A-D]\.)/)
                : item.options;
            }
            data.push({ q: item.question||item.q, opts, ans: item.answer||item.ans, exp: item.explanation||item.exp||'', img: item.image||'', aud: item.audio||'' });
            });
        };
        if (raw.part_A||raw.part_B||raw.part_C) {
            processPart(raw.part_A);
            processPart(raw.part_B);
            processPart(raw.part_C);
        } else {
            data = raw;
        }

        data = shuffleArray(data);
        if (count>0) data = data.slice(0,count);

        return data.map((item,i)=>({
            id: i+1,
            text: (item.q||'').replace(/^Ảnh:\s*/,'').replace(/\[[^\]]+\]/g,'').trim(),
            image: item.img||'',
            audio: item.aud||'',
            options: item.opts ? shuffleArray([...item.opts]).map(o=>o.replace(/\[[^\]]+\]/g,'').trim()) : [],
            correct: (item.ans||'').replace(/\[[^\]]+\]/g,'').trim(),
            explanation: item.exp||''
        }));
        } catch(err) {
        modal.hide();
        modal.show('Lỗi tải dữ liệu',`<div class="text-left bg-red-50 p-3 rounded-lg border border-red-200 text-sm text-red-700">${err.message}</div>`,[{text:'Đóng',class:'bg-ruby text-white'}]);
        return null;
        }
    }

    // --- Quiz mode toggle ---
    let quizMode = 'full';
    function setQuizMode(m) {
        quizMode = m;
        const isFull = m === 'full';
        document.getElementById('mode-full').className =
        'flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ' +
        (isFull ? 'border-ruby bg-ruby text-white' : 'border-gray-300 bg-white text-gray-600');
        document.getElementById('mode-partial').className =
        'flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ' +
        (!isFull ? 'border-ruby bg-ruby text-white' : 'border-gray-300 bg-white text-gray-600');
        document.getElementById('partial-count-wrap').classList.toggle('hidden', isFull);
    }

    // --- Start form ---
    document.getElementById('start-form').addEventListener('submit', async e => {
        e.preventDefault();
        const name = document.getElementById('student-name').value.trim();
        const grade = document.getElementById('student-grade').value;
        const round = document.getElementById('exam-round').value;
        const mode = document.getElementById('test-mode').value;
        const passcode = document.getElementById('passcode').value;

        if (passcode!=='1235' && !appState.isTeacher) {
        modal.show('Sai mã xác nhận','Vui lòng nhập đúng mã xác nhận.',[{text:'Thử lại',class:'bg-ruby text-white'}]);
        return;
        }

        let qCount;
        if (quizMode === 'full') {
        qCount = 200;
        } else {
        const raw = parseInt(document.getElementById('question-count').value, 10);
        if (isNaN(raw) || raw < 1) {
            modal.show('Thông báo','Vui lòng nhập số câu hỏi hợp lệ (1–199).',[{text:'OK',class:'bg-ruby text-white'}]);
            return;
        }
        qCount = Math.min(raw, 199);
        }

        appState.studentName = name;
        appState.grade = grade;
        appState.examRoundText = document.getElementById('exam-round').options[document.getElementById('exam-round').selectedIndex].text;

        const topic = mode.split('-')[1];
        appState.topicNum = topic;
        const fileName = `media/json/lop${grade}/json${grade}.vong${round}.${topic}.json`;

        const qs = await fetchQuestions(fileName, qCount);
        if (qs && qs.length>0) {
        appState.questions = qs;
        appState.answers = {};
        appState.orderPlaced = {};
        appState.orderBankShuffled = {};
        appState.currentQuestionIndex = 0;
        appState.retryMode = false;
        appState.round1 = null;
        appState.round2 = null;
        try { if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); } catch(e){}
        initQuiz();
        } else if (qs && qs.length===0) {
        modal.show('Thông báo','File dữ liệu trống.',[{text:'Đóng',class:'bg-gray-500 text-white'}]);
        }
    });

    const TOPIC_NAMES = {
        '3': {'1': 'Từ vựng & Ngữ pháp', '2': 'Nghe hiểu', '3': 'Từ vựng & Chính tả', '4': 'Ngữ pháp & Điền từ', '5': 'Sắp xếp câu & Giao tiếp'},
        '4': {'1': 'Từ vựng – Chính tả – Ngữ pháp', '2': 'Ngữ pháp & Cấu trúc câu', '3': 'Giao tiếp & Hỏi đáp tình huống', '4': 'Phát âm, Trọng âm & Nhận biết hình ảnh', '5': 'Luyện Nghe'},
        '5': {'1': 'Từ vựng theo chủ điểm', '2': 'Phát âm, Trọng âm & Chính tả', '3': 'Danh từ, Mạo từ & Đại từ', '4': 'Nhận biết hình ảnh & Phát âm', '5': 'Luyện Nghe'},
        '6': {'1': 'Từ vựng & Ngữ pháp', '2': 'Đọc hiểu', '3': 'Sắp xếp câu', '4': 'Phát âm & Trọng âm', '5': 'Nghe hiểu'},
        '7': {'1': 'Từ vựng', '2': 'Ngữ pháp & Sắp xếp câu', '3': 'Giao tiếp & Ngữ pháp nâng cao', '4': 'Phát âm & Trọng âm', '5': 'Luyện Nghe'},
        '8': {'1': 'Từ vựng & Ngữ pháp', '2': 'Ngữ pháp & Sắp xếp câu', '3': 'Giao tiếp & Ngữ pháp nâng cao', '4': 'Phát âm & Trọng âm', '5': 'Luyện Nghe'},
        '9': {'1': 'Từ vựng', '2': 'Ngữ pháp', '3': 'Giao tiếp & Ngữ pháp nâng cao', '4': 'Phát âm & Trọng âm', '5': 'Luyện Nghe'}
    };

    function initQuiz() {
        showScreen('screen-quiz');
        closeSidebar();
        document.getElementById('quiz-student-info').textContent = `${appState.studentName} - Lớp ${appState.grade}`;
        document.getElementById('info-name').textContent = appState.studentName;
        document.getElementById('info-grade').textContent = `Lớp ${appState.grade}`;
        document.getElementById('info-round').textContent = appState.examRoundText;
        const topicNum = appState.topicNum || '';
        const gradeTopics = TOPIC_NAMES[String(appState.grade)] || {};
        const topicLabel = `Chuyên đề ${topicNum}${gradeTopics[topicNum] ? ' · ' + gradeTopics[topicNum] : ''}`;
        document.getElementById('info-topic').textContent = topicLabel;
        document.getElementById('total-q-label').textContent = `/ ${appState.questions.length}`;
        renderQuestionList();
        renderQuestion(0);
        startTimer();
        updateProgress();
    }

    // --- Ordering (drag-and-drop) question helpers ---
    function isOrderQuestion(q) {
        if (q.options?.length) return false;
        const t = q.text.trimEnd();
        return t.endsWith('/') && t.split('/').filter(s => s.trim()).length >= 2;
    }

    function parseOrderFragments(text) {
        const hasSapXep = /^Sắp xếp/i.test(text);
        const colonIdx = text.indexOf(':');
        const part = (hasSapXep && colonIdx >= 0) ? text.slice(colonIdx + 1) : text;
        return part.split('/').map(s => s.trim()).filter(Boolean);
    }

    function updateOrderAnswer(q, frags) {
        const sentence = (appState.orderPlaced[q.id] || []).map(i => frags[i]).join(' ');
        if (sentence) appState.answers[q.id] = sentence;
        else delete appState.answers[q.id];
        const navBtn = document.getElementById(`nav-btn-${appState.currentQuestionIndex}`);
        if (navBtn) {
        const answered = !!appState.answers[q.id];
        navBtn.className = `w-full aspect-square rounded-lg font-bold text-xs flex items-center justify-center transition-colors border-2 shadow-sm ${answered ? 'bg-ruby text-white border-ruby' : 'bg-white text-gray-600 border-gray-200 hover:border-ruby'}`;
        }
        updateAnsweredCount();
    }

    function renderOrderUI(q, frags) {
        if (!appState.orderBankShuffled[q.id])
        appState.orderBankShuffled[q.id] = shuffleArray(frags.map((_, i) => i));
        if (!appState.orderPlaced[q.id])
        appState.orderPlaced[q.id] = [];

        const placedIdxs = appState.orderPlaced[q.id];
        const placedSet = new Set(placedIdxs);
        const bankOrder = appState.orderBankShuffled[q.id].filter(i => !placedSet.has(i));

        const chipCls = 'order-chip select-none rounded-lg px-3 py-2 lg:px-5 lg:py-3 text-sm lg:text-xl font-medium cursor-pointer transition-all flex items-center gap-1.5 lg:gap-2';
        const placedHtml = placedIdxs.map((idx, pos) => `
        <div class="${chipCls} placed bg-ruby text-white shadow-sm" data-idx="${idx}" data-pos="${pos}" draggable="true">
            <i class="fas fa-grip-vertical text-xs lg:text-sm opacity-50"></i>${escapeHtml(frags[idx])}
        </div>`).join('');
        const bankHtml = bankOrder.map(idx => `
        <div class="${chipCls} bank bg-white border-2 border-gray-200 text-gray-800 hover:border-ruby hover:bg-red-50" data-idx="${idx}">
            ${escapeHtml(frags[idx])}
        </div>`).join('');

        const container = document.getElementById('options-container');
        container.innerHTML = `
        <div class="flex flex-col gap-4 lg:gap-6">
            <div>
            <div class="text-xs lg:text-base font-semibold text-gray-500 mb-2 lg:mb-3 uppercase tracking-wide flex items-center gap-1.5">
                <i class="fas fa-list-ol"></i> Câu trả lời của bạn
                ${placedIdxs.length > 0 ? `<button id="order-clear" class="ml-auto text-xs lg:text-sm text-gray-400 hover:text-red-500 font-normal normal-case"><i class="fas fa-rotate-left mr-1"></i>Xóa hết</button>` : ''}
            </div>
            <div id="order-answer-zone" class="min-h-[52px] lg:min-h-[80px] border-2 border-dashed ${placedIdxs.length > 0 ? 'border-ruby/40 bg-red-50/30' : 'border-gray-300 bg-gray-50'} rounded-xl p-3 lg:p-5 flex flex-wrap gap-2 lg:gap-3">
                ${placedHtml || '<span class="text-gray-400 text-sm lg:text-lg italic">Bấm vào từ bên dưới để chọn...</span>'}
            </div>
            </div>
            <div>
            <div class="text-xs lg:text-base font-semibold text-gray-500 mb-2 lg:mb-3 uppercase tracking-wide flex items-center gap-1.5">
                <i class="fas fa-layer-group"></i> Từ/cụm từ
            </div>
            <div id="order-bank-zone" class="flex flex-wrap gap-2 lg:gap-3">
                ${bankHtml || '<span class="text-gray-400 text-sm lg:text-lg italic">Đã chọn hết!</span>'}
            </div>
            </div>
        </div>`;

        // Click bank → add to placed
        container.querySelectorAll('.order-chip.bank').forEach(chip => {
        chip.addEventListener('click', () => {
            appState.orderPlaced[q.id].push(parseInt(chip.dataset.idx));
            updateOrderAnswer(q, frags);
            renderOrderUI(q, frags);
        });
        });

        // Click placed → remove
        container.querySelectorAll('.order-chip.placed').forEach(chip => {
        chip.addEventListener('click', () => {
            appState.orderPlaced[q.id].splice(parseInt(chip.dataset.pos), 1);
            updateOrderAnswer(q, frags);
            renderOrderUI(q, frags);
        });
        });

        // Clear button
        const clearBtn = document.getElementById('order-clear');
        if (clearBtn) clearBtn.addEventListener('click', e => {
        e.stopPropagation();
        appState.orderPlaced[q.id] = [];
        updateOrderAnswer(q, frags);
        renderOrderUI(q, frags);
        });

        // Drag-and-drop reorder within answer zone (desktop)
        let dragSrcPos = null;
        container.querySelectorAll('.order-chip.placed').forEach(chip => {
        chip.addEventListener('dragstart', e => {
            dragSrcPos = parseInt(chip.dataset.pos);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => chip.classList.add('opacity-40'), 0);
        });
        chip.addEventListener('dragend', () => chip.classList.remove('opacity-40'));
        chip.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
        chip.addEventListener('drop', e => {
            e.preventDefault();
            const targetPos = parseInt(chip.dataset.pos);
            if (dragSrcPos !== null && dragSrcPos !== targetPos) {
            const [moved] = appState.orderPlaced[q.id].splice(dragSrcPos, 1);
            appState.orderPlaced[q.id].splice(targetPos, 0, moved);
            updateOrderAnswer(q, frags);
            renderOrderUI(q, frags);
            }
            dragSrcPos = null;
        });
        });
    }

    function renderQuestionList() {
        const grid = document.getElementById('question-grid');
        grid.innerHTML = '';
        appState.questions.forEach((q,i) => {
        const btn = document.createElement('button');
        const answered = !!appState.answers[q.id];
        btn.className = `w-full aspect-square rounded-lg font-bold text-xs flex items-center justify-center transition-colors border-2 shadow-sm
            ${answered ? 'bg-ruby text-white border-ruby' : 'bg-white text-gray-600 border-gray-200 hover:border-ruby'}`;
        btn.textContent = i+1;
        btn.id = `nav-btn-${i}`;
        btn.onclick = () => { renderQuestion(i); closeSidebar(); };
        grid.appendChild(btn);
        });
        updateAnsweredCount();
    }

    function renderQuestion(index) {
        if (index<0||index>=appState.questions.length) return;
        const old = document.getElementById(`nav-btn-${appState.currentQuestionIndex}`);
        if (old) old.classList.remove('ring-4','ring-red-200');

        appState.currentQuestionIndex = index;
        const q = appState.questions[index];

        const cur = document.getElementById(`nav-btn-${index}`);
        if (cur) {
        cur.classList.add('ring-4','ring-red-200');
        cur.scrollIntoView({behavior:'smooth',block:'nearest'});
        }

        document.getElementById('current-q-label').textContent = `Câu ${index+1}`;
        const isOrder = isOrderQuestion(q);
        if (isOrder) {
        const hasSapXep = /^Sắp xếp/i.test(q.text);
        if (hasSapXep) {
            const colonIdx = q.text.indexOf(':');
            const instr = colonIdx >= 0 ? q.text.slice(0, colonIdx + 1) : 'Sắp xếp:';
            document.getElementById('question-text').innerHTML = escapeHtml(instr);
        } else {
            document.getElementById('question-text').innerHTML = 'Sắp xếp thành câu đúng:';
        }
        } else {
        document.getElementById('question-text').innerHTML = q.text;
        }
        const qImgEl = document.getElementById('question-image');
        if (q.image) {
        qImgEl.innerHTML = `<img src="${q.image}" class="max-w-full rounded-xl mx-auto block question-media">`;
        qImgEl.classList.remove('hidden');
        } else {
        qImgEl.innerHTML = '';
        qImgEl.classList.add('hidden');
        }
        const qAudEl = document.getElementById('question-audio');
        const audPlayer = document.getElementById('audio-player');
        const audSrc = document.getElementById('audio-src');
        if (q.audio) {
        audSrc.src = q.audio;
        audPlayer.load();
        qAudEl.classList.remove('hidden');
        } else {
        audSrc.src = '';
        qAudEl.classList.add('hidden');
        }

        const opts = document.getElementById('options-container');
        opts.innerHTML = '';

        if (q.options && q.options.length>0) {
        const labels=['A','B','C','D','E','F'];
        q.options.forEach((opt,i)=>{
            const sel = appState.answers[q.id]===opt;
            const btn = document.createElement('button');
            btn.className = `w-full text-left py-4 px-5 lg:py-6 lg:px-8 rounded-xl border-2 transition-all flex items-center gap-4 lg:gap-6
            ${sel ? 'border-ruby bg-red-50' : 'border-gray-200 bg-white hover:border-ruby/50 hover:bg-gray-50'}`;
            btn.innerHTML = `
            <div class="w-9 h-9 lg:w-16 lg:h-16 rounded-full flex items-center justify-center font-bold text-base lg:text-2xl shrink-0 transition-colors
                ${sel ? 'bg-ruby text-white' : 'bg-gray-100 text-gray-500'}">
                ${labels[i]}
            </div>
            <div class="text-gray-800 font-medium text-base sm:text-lg lg:text-3xl flex-1">${opt.replace(/^[A-D]\.\s*/, '')}</div>
            <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0
                ${sel ? 'border-ruby bg-ruby' : 'border-gray-300'}">
                ${sel ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
            </div>`;
            btn.onclick = () => selectOption(q.id, opt);
            opts.appendChild(btn);
        });
        } else if (isOrder) {
        renderOrderUI(q, parseOrderFragments(q.text));
        } else {
        opts.innerHTML = `
            <label class="text-sm lg:text-xl font-semibold text-gray-500 mb-1 lg:mb-2 block">Gõ từ/cụm từ còn thiếu:</label>
            <input type="text" id="fill-answer-input" autocomplete="off" autocorrect="off" spellcheck="false"
            class="w-full px-4 py-3.5 lg:px-6 lg:py-6 rounded-xl border-2 border-gray-200 focus:border-ruby focus:ring-2 focus:ring-red-100 outline-none transition-all text-base lg:text-3xl font-medium text-gray-800"
            placeholder="Nhập đáp án...">`;
        const inp = document.getElementById('fill-answer-input');
        inp.value = appState.answers[q.id]||'';
        inp.addEventListener('input', e => inputTextAnswer(q.id, e.target.value));
        inp.focus();
        }

        const prev = document.getElementById('btn-prev');
        const next = document.getElementById('btn-next');
        prev.classList.toggle('invisible', index===0);
        if (index===appState.questions.length-1) {
        next.innerHTML = '<i class="fas fa-check mr-1.5"></i> Hoàn thành';
        next.className = next.className.replace(/bg-gray-800|hover:bg-black/g,'');
        next.classList.add('bg-green-600','hover:bg-green-700');
        } else {
        next.innerHTML = 'Tiếp theo <i class="fas fa-arrow-right ml-1.5"></i>';
        next.classList.remove('bg-green-600','hover:bg-green-700');
        next.classList.add('bg-gray-800','hover:bg-black');
        }
    }

    function selectOption(qid, opt) {
        appState.answers[qid] = opt;
        renderQuestion(appState.currentQuestionIndex);
        const btn = document.getElementById(`nav-btn-${appState.currentQuestionIndex}`);
        if (btn) {
        btn.className = btn.className.replace(/bg-white|text-gray-600|border-gray-200/g,'');
        btn.classList.add('bg-ruby','text-white','border-ruby');
        }
        updateAnsweredCount();
        updateProgress();
    }

    function inputTextAnswer(qid, val) {
        if (val.trim()==='') delete appState.answers[qid];
        else appState.answers[qid] = val;
        const btn = document.getElementById(`nav-btn-${appState.currentQuestionIndex}`);
        if (btn) {
        const answered = !!appState.answers[qid];
        btn.classList.toggle('bg-ruby', answered);
        btn.classList.toggle('text-white', answered);
        btn.classList.toggle('border-ruby', answered);
        btn.classList.toggle('bg-white', !answered);
        btn.classList.toggle('text-gray-600', !answered);
        btn.classList.toggle('border-gray-200', !answered);
        }
        updateAnsweredCount();
        updateProgress();
    }

    function getFillAnswer(txt) {
        const m = txt.match(/^(.*?)\s*\(/);
        return (m ? m[1] : txt).trim().toLowerCase();
    }

    function isAnswerCorrect(q) {
        const a = appState.answers[q.id];
        if (a===undefined) return false;
        if (q.options&&q.options.length>0) { const strip=s=>s.replace(/<[^>]+>/g,''); return strip(a)===strip(q.correct); }
        return a.trim().toLowerCase()===getFillAnswer(q.correct);
    }

    function updateAnsweredCount() {
        const n = Object.keys(appState.answers).length;
        const t = appState.questions.length;
        const txt = `${n}/${t}`;
        document.getElementById('answered-count').textContent = txt;
        document.getElementById('answered-count-mobile').textContent = txt;
    }

    function updateProgress() {
        const p = (Object.keys(appState.answers).length/appState.questions.length)*100;
        document.getElementById('progress-bar').style.width = `${p}%`;
    }

    document.getElementById('btn-prev').onclick = () => renderQuestion(appState.currentQuestionIndex-1);
    document.getElementById('btn-next').onclick = () => {
        if (appState.currentQuestionIndex===appState.questions.length-1) confirmSubmit();
        else renderQuestion(appState.currentQuestionIndex+1);
    };
    document.getElementById('btn-submit-top').onclick = confirmSubmit;

    function startTimer() {
        appState.timeElapsed = 0;
        appState.timerInterval = setInterval(()=>{
        appState.timeElapsed++;
        document.getElementById('timer').textContent = formatTime(appState.timeElapsed);
        },1000);
    }

    function stopTimer() {
        clearInterval(appState.timerInterval);
        try { if(document.fullscreenElement) document.exitFullscreen(); } catch(e){}
    }

    function confirmSubmit() {
        const answered = Object.keys(appState.answers).length;
        const total = appState.questions.length;
        if (appState.isTeacher) { submitQuiz(); return; }
        if (answered<total) {
        modal.show('Chưa hoàn thành',`Bạn mới làm ${answered}/${total} câu. Có chắc muốn nộp không?`,[
            {text:'Làm tiếp',class:'bg-gray-200 text-gray-800'},
            {text:'Nộp bài',class:'bg-ruby text-white',onClick:submitQuiz}
        ],'fa-question-circle','text-yellow-500');
        } else {
        modal.show('Xác nhận nộp bài','Bạn đã hoàn thành tất cả câu hỏi. Nộp bài?',[
            {text:'Xem lại',class:'bg-gray-200 text-gray-800'},
            {text:'Nộp bài',class:'bg-ruby text-white',onClick:submitQuiz}
        ],'fa-check-circle','text-green-500');
        }
    }

    function submitQuiz() {
        stopTimer();
        let correct = 0;
        appState.questions.forEach(q => { if(isAnswerCorrect(q)) correct++; });
        const total = appState.questions.length;
        const wrong = total - correct;
        const stats = { correct, wrong, time: appState.timeElapsed, total };

        if (appState.retryMode) {
        appState.round2 = stats;
        showScreen('screen-result');
        document.getElementById('result-name-class').textContent = `${appState.studentName} - Lớp ${appState.grade} (${appState.examRoundText})`;
        renderResultFinal(appState.round1, appState.round2);
        } else {
        appState.round1 = stats;
        showScreen('screen-result');
        document.getElementById('result-name-class').textContent = `${appState.studentName} - Lớp ${appState.grade} (${appState.examRoundText})`;
        if (wrong > 0 && !appState.isTeacher) {
            renderResultRound1(appState.round1);
        } else {
            renderResultFinal(appState.round1, null);
        }
        }
    }

    function renderResultRound1(r1) {
        const pct = Math.round((r1.correct / r1.total) * 100);
        const score = r1.correct * POINTS_PER_QUESTION;
        document.getElementById('result-title').textContent = 'Kết quả Lần 1';
        document.getElementById('result-body').innerHTML = `
        <div class="flex flex-col items-center gap-5">
            <div class="relative w-36 h-36">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" stroke-width="10"/>
                <circle id="r1-circle" cx="50" cy="50" r="45" fill="none" stroke="#e60000" stroke-width="10"
                stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="283"/>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span id="r1-pct" class="text-3xl font-extrabold text-gray-800">0%</span>
                <span class="text-xs text-gray-400 font-medium">${score}/${r1.total * POINTS_PER_QUESTION} điểm</span>
            </div>
            </div>
            <div class="w-full grid grid-cols-3 gap-3 text-center">
            <div class="bg-green-50 rounded-2xl p-3">
                <div class="text-2xl font-extrabold text-green-600">${r1.correct}</div>
                <div class="text-xs text-gray-500 mt-0.5">Câu đúng</div>
            </div>
            <div class="bg-red-50 rounded-2xl p-3">
                <div class="text-2xl font-extrabold text-red-500">${r1.wrong}</div>
                <div class="text-xs text-gray-500 mt-0.5">Câu sai</div>
            </div>
            <div class="bg-blue-50 rounded-2xl p-3">
                <div class="text-xl font-extrabold text-blue-500">${formatTime(r1.time)}</div>
                <div class="text-xs text-gray-500 mt-0.5">Thời gian</div>
            </div>
            </div>
            <div class="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
            <p class="text-amber-800 font-semibold text-sm"><i class="fas fa-exclamation-triangle text-amber-500 mr-1"></i>Bạn còn <b>${r1.wrong} câu sai</b>. Hãy làm lại để cải thiện điểm!</p>
            </div>
            <button id="btn-start-round2" class="w-full py-3.5 bg-ruby text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 hover:bg-ruby-dark active:scale-95 transition-all">
            <i class="fas fa-redo"></i> Bắt đầu Lần 2
            </button>
        </div>`;
        // Animate circle
        let cur = 0;
        const circleEl = document.getElementById('r1-circle');
        const pctEl = document.getElementById('r1-pct');
        const iv = setInterval(() => {
        if (cur >= pct) { clearInterval(iv); return; }
        cur++;
        pctEl.textContent = `${cur}%`;
        circleEl.style.strokeDashoffset = 283 - (283 * cur / 100);
        }, 20);
        document.getElementById('btn-start-round2').onclick = startRetryMode;
    }

    function renderResultFinal(r1, r2) {
        const totalCorrect = r1.correct + (r2 ? r2.correct : 0);
        const totalQ = r1.total + (r2 ? r2.total : 0);
        const totalScore = totalCorrect * POINTS_PER_QUESTION;
        const maxScore = totalQ * POINTS_PER_QUESTION;
        const pct = Math.round((r1.correct / r1.total) * 100);

        document.getElementById('result-title').textContent = 'Hoàn thành!';

        let tableHtml = '';
        if (r2) {
        tableHtml = `
        <div class="w-full overflow-hidden rounded-2xl border border-gray-200 text-sm">
            <table class="w-full">
            <thead class="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                <th class="text-left px-4 py-2.5">Lượt</th>
                <th class="text-center px-4 py-2.5">Đúng</th>
                <th class="text-center px-4 py-2.5">Sai</th>
                <th class="text-center px-4 py-2.5">Điểm</th>
                <th class="text-center px-4 py-2.5">Thời gian</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
                <tr class="bg-white">
                <td class="px-4 py-2.5 font-semibold text-gray-700">Lần 1</td>
                <td class="text-center px-4 py-2.5 text-green-600 font-bold">${r1.correct}</td>
                <td class="text-center px-4 py-2.5 text-red-500 font-bold">${r1.wrong}</td>
                <td class="text-center px-4 py-2.5 font-semibold">${r1.correct * POINTS_PER_QUESTION}</td>
                <td class="text-center px-4 py-2.5 text-blue-500">${formatTime(r1.time)}</td>
                </tr>
                <tr class="bg-gray-50">
                <td class="px-4 py-2.5 font-semibold text-gray-700">Lần 2</td>
                <td class="text-center px-4 py-2.5 text-green-600 font-bold">${r2.correct}</td>
                <td class="text-center px-4 py-2.5 text-red-500 font-bold">${r2.wrong}</td>
                <td class="text-center px-4 py-2.5 font-semibold">${r2.correct * POINTS_PER_QUESTION}</td>
                <td class="text-center px-4 py-2.5 text-blue-500">${formatTime(r2.time)}</td>
                </tr>
                <tr class="bg-ruby text-white font-extrabold">
                <td class="px-4 py-2.5">Tổng</td>
                <td class="text-center px-4 py-2.5">${totalCorrect}</td>
                <td class="text-center px-4 py-2.5">—</td>
                <td class="text-center px-4 py-2.5">${totalScore}</td>
                <td class="text-center px-4 py-2.5">${formatTime(r1.time + r2.time)}</td>
                </tr>
            </tbody>
            </table>
        </div>`;
        } else {
        const score = r1.correct * POINTS_PER_QUESTION;
        tableHtml = `
        <div class="w-full grid grid-cols-3 gap-3 text-center">
            <div class="bg-green-50 rounded-2xl p-3">
            <div class="text-2xl font-extrabold text-green-600">${r1.correct}</div>
            <div class="text-xs text-gray-500 mt-0.5">Câu đúng</div>
            </div>
            <div class="bg-red-50 rounded-2xl p-3">
            <div class="text-2xl font-extrabold text-red-500">${r1.wrong}</div>
            <div class="text-xs text-gray-500 mt-0.5">Câu sai</div>
            </div>
            <div class="bg-blue-50 rounded-2xl p-3">
            <div class="text-xl font-extrabold text-blue-500">${formatTime(r1.time)}</div>
            <div class="text-xs text-gray-500 mt-0.5">Thời gian</div>
            </div>
        </div>`;
        }

        document.getElementById('result-body').innerHTML = `
        <div class="flex flex-col items-center gap-5">
            <div class="relative w-36 h-36">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#f3f4f6" stroke-width="10"/>
                <circle id="final-circle" cx="50" cy="50" r="45" fill="none" stroke="#e60000" stroke-width="10"
                stroke-linecap="round" stroke-dasharray="283" stroke-dashoffset="283"/>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
                <span id="final-pct" class="text-3xl font-extrabold text-gray-800">0%</span>
                <span class="text-xs text-gray-400 font-medium">${r2 ? totalScore + '/' + maxScore : (r1.correct * POINTS_PER_QUESTION) + '/' + (r1.total * POINTS_PER_QUESTION)} điểm</span>
            </div>
            </div>
            ${tableHtml}
            <div id="result-btn-row" class="w-full flex gap-3">
            <button id="btn-review" class="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-gray-200 active:scale-95 transition-all">
                <i class="fas fa-list-ul"></i> Xem lại
            </button>
            <button id="btn-save-result" class="flex-1 py-3 bg-ruby text-white font-semibold rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-ruby-dark active:scale-95 transition-all">
                <i class="fas fa-download"></i> Lưu kết quả
            </button>
            </div>
        </div>`;

        // Animate circle (based on round 1 pct for display)
        let cur = 0;
        const circleEl = document.getElementById('final-circle');
        const pctEl = document.getElementById('final-pct');
        const iv = setInterval(() => {
        if (cur >= pct) { clearInterval(iv); return; }
        cur++;
        pctEl.textContent = `${cur}%`;
        circleEl.style.strokeDashoffset = 283 - (283 * cur / 100);
        }, 20);

        document.getElementById('btn-review').onclick = () => {
        showScreen('screen-review');
        renderReview('wrong');
        };

        document.getElementById('btn-save-result').onclick = async () => {
        const btn = document.getElementById('btn-save-result');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo...';
        const btnRow = document.getElementById('result-btn-row');
        btnRow.style.display = 'none';
        try {
            const card = document.getElementById('result-card');
            const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' });
            const link = document.createElement('a');
            const name = (appState.studentName || 'ket-qua').replace(/\s+/g, '-');
            link.download = `IOE-${name}-L${appState.grade}-V${appState.examRoundText}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } finally {
            btnRow.style.display = '';
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-download"></i> Lưu kết quả';
        }
        };
    }

    function startRetryMode() {
        appState.retryMode = true;
        appState.questions = appState.questions.filter(q => !isAnswerCorrect(q));
        appState.answers = {};
        appState.orderPlaced = {};
        appState.orderBankShuffled = {};
        appState.currentQuestionIndex = 0;
        appState.timeElapsed = 0;
        initQuiz();
    }

    function renderReview(filter) {
        // Update filter button styles
        const filters = {
        wrong:   document.getElementById('filter-wrong'),
        correct: document.getElementById('filter-correct'),
        all:     document.getElementById('filter-all'),
        };
        const activeColors = { wrong: 'bg-red-500 text-white border-red-500', correct: 'bg-green-500 text-white border-green-500', all: 'bg-ruby text-white border-ruby' };
        Object.keys(filters).forEach(k => {
        filters[k].className = 'flex-1 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border-2 ' +
            (k === filter ? activeColors[k] : 'bg-white text-gray-600 border-gray-200');
        });

        const container = document.getElementById('review-container');
        container.innerHTML = '';
        const qs = appState.questions.filter(q => {
        const ok = isAnswerCorrect(q);
        if (filter === 'wrong') return !ok;
        if (filter === 'correct') return ok;
        return true;
        });

        if (qs.length === 0) {
        container.innerHTML = `<div class="text-center py-16 text-gray-400">
            <i class="fas fa-${filter==='wrong'?'trophy text-yellow-400':'times-circle'} text-4xl mb-3 block"></i>
            <p class="font-semibold">${filter==='wrong'?'Không có câu sai! Tuyệt vời!':'Không có câu đúng.'}</p>
        </div>`;
        return;
        }

        qs.forEach((q)=>{
        const ok = isAnswerCorrect(q);
        const globalIdx = appState.questions.indexOf(q);
        const card = document.createElement('div');
        card.className = `bg-white p-4 sm:p-6 rounded-2xl shadow-sm border-l-4 ${ok?'border-green-500':'border-red-500'}`;
        let optsHtml='';
        if (q.options&&q.options.length>0) {
            const L=['A','B','C','D','E','F'];
            const stripTags=s=>(s||'').replace(/<[^>]+>/g,'');
            q.options.forEach((opt,j)=>{
            const isUser=appState.answers[q.id]===opt;
            const isAns=stripTags(q.correct)===stripTags(opt);
            let bg='bg-gray-50',txt='text-gray-700',border='border-gray-200',icon='';
            if(isAns){bg='bg-green-50';txt='text-green-800 font-bold';border='border-green-300';icon='<i class="fas fa-check-circle text-green-500 ml-2"></i>';}
            else if(isUser&&!ok){bg='bg-red-50';txt='text-red-800';border='border-red-300';icon='<i class="fas fa-times-circle text-red-500 ml-2"></i>';}
            optsHtml+=`<div class="p-2.5 rounded-lg border ${border} ${bg} ${txt} flex items-center justify-between text-sm">
                <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full bg-white border flex items-center justify-center text-xs ${isAns?'border-green-500 text-green-600':isUser?'border-red-500 text-red-600':'border-gray-300 text-gray-500'}">${L[j]}</span>
                <span>${opt}</span>
                </div>${icon}</div>`;
            });
        } else {
            const uv=appState.answers[q.id];
            const ud=uv!==undefined?escapeHtml(uv):'(Chưa trả lời)';
            optsHtml=`
            <div class="p-2.5 rounded-lg border text-sm ${ok?'border-green-300 bg-green-50':'border-red-300 bg-red-50'}">
                <span class="text-gray-500">Bạn trả lời: </span>
                <span class="font-bold ${ok?'text-green-800':'text-red-800'}">${ud}</span>
            </div>
            <div class="p-2.5 rounded-lg border border-green-300 bg-green-50 text-sm">
                <span class="text-gray-500">Đáp án đúng: </span>
                <span class="font-bold text-green-800">${escapeHtml(q.correct)}</span>
            </div>`;
        }
        card.innerHTML=`
            <div class="flex justify-between items-start mb-3 gap-2">
            <h4 class="font-bold text-gray-800 text-sm sm:text-base flex-1">Câu ${globalIdx+1}: ${q.text}</h4>
            <span class="px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${ok?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}">${ok?'Đúng':'Sai'}</span>
            </div>
            <div class="space-y-1.5 mb-3">${optsHtml}</div>
            ${q.explanation?`<div class="bg-blue-50 border border-blue-100 rounded-lg p-3 text-blue-800 text-xs"><i class="fas fa-lightbulb text-yellow-500 mr-1"></i><b>Giải thích:</b> ${q.explanation}</div>`:''}`;
        container.appendChild(card);
        });
    }

    document.getElementById('btn-back-result').onclick = () => showScreen('screen-result');

    document.getElementById('btn-save-result').onclick = async () => {
        const btn = document.getElementById('btn-save-result');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo...';
        const btnRow = btn.parentElement;
        btnRow.style.display = 'none';
        try {
        const card = document.getElementById('result-card');
        const canvas = await html2canvas(card, { scale: 2, useCORS: true, backgroundColor: '#f9fafb' });
        const link = document.createElement('a');
        const name = (appState.studentName || 'ket-qua').replace(/\s+/g, '-');
        link.download = `IOE-${name}-L${appState.grade}-V${appState.examRound}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        } finally {
        btnRow.style.display = '';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-download"></i> Lưu kết quả';
        }
    };

// Bind UI actions in JavaScript instead of inline HTML event attributes.
document.getElementById('mode-full').addEventListener('click', () => setQuizMode('full'));
document.getElementById('mode-partial').addEventListener('click', () => setQuizMode('partial'));
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
document.getElementById('btn-sidebar-close').addEventListener('click', closeSidebar);
for (const filter of ['wrong', 'correct', 'all']) {
    document.getElementById(`filter-${filter}`).addEventListener('click', () => renderReview(filter));
}
