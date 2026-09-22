// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let vocabulary = [];
let phrases = [];
let temporary = [];
let sentences = [];
let currentMode = 'cards';
let currentLevel = localStorage.getItem('level') || 'all';

let positions = JSON.parse(localStorage.getItem('positions') || '{}');
positions.cards = positions.cards || 0;
positions.test = positions.test || 0;
positions.write = positions.write || 0;
positions.phrases = positions.phrases || 0;
positions.temporary = positions.temporary || 0;
positions.listening = positions.listening || 0;
positions.tempCards = positions.tempCards || 0;
positions.tempTest = positions.tempTest || 0;
positions.tempWrite = positions.tempWrite || 0;
positions.sentBuild = positions.sentBuild || 0;
positions.sentChoose = positions.sentChoose || 0;
positions.sentTranslate = positions.sentTranslate || 0;

let tempSubMode = 'list';

// Sentences
let sentSubMode = 'build'; // 'build' | 'choose' | 'translate'
let sentFilter = 'all';    // 'all' | 'present_simple' | 'present_continuous' | ...

let learned = JSON.parse(localStorage.getItem('learned') || '[]');
let mastered = JSON.parse(localStorage.getItem('mastered') || '[]');

let xp = parseInt(localStorage.getItem('xp') || '0');
let dailyXP = parseInt(localStorage.getItem('dailyXP') || '0');
let lastActiveDate = localStorage.getItem('lastActiveDate') || '';
let streak = parseInt(localStorage.getItem('streak') || '0');
let achievements = JSON.parse(localStorage.getItem('achievements') || '[]');

let srsData = JSON.parse(localStorage.getItem('srsData') || '{}');

const DAILY_GOAL = 20;
const SRS_INTERVALS = [0, 1, 2, 4, 7, 14];

const LEVEL_RANGES = {
    A1: { start: 0,   end: 300 },
    A2: { start: 300, end: 600 },
    B1: { start: 600, end: Infinity }
};

let currentUser = null;

// ===== ХЕЛПЕРЫ ДЛЯ FAMILY / COLLOCATIONS =====
function formatFamily(family) {
    if (!family || family.length === 0) return '';
    return family.map(f => {
        if (typeof f === 'string') return f;
        if (f && f.translation) {
            return `${f.word} <span class="meta-translation">(${f.translation})</span>`;
        }
        return f.word || '';
    }).join(' · ');
}

function formatCollocations(collocations) {
    if (!collocations || collocations.length === 0) return '';
    return collocations.map(c => {
        if (typeof c === 'string') return c;
        if (c && c.translation) {
            return `${c.phrase} <span class="meta-translation">(${c.translation})</span>`;
        }
        return c.phrase || '';
    }).join(' · ');
}

// ===== СИНХРОНИЗАЦИЯ С FIREBASE =====
async function syncToFirebase() {
    if (!currentUser || !window.firebaseSetDoc) return;
    try {
        const payload = {
            xp, dailyXP, lastActiveDate, streak, achievements,
            learned, mastered, positions, currentLevel, srsData
        };
        if (Array.isArray(temporary) && temporary.length > 0) {
            payload.temporary = temporary;
        }
        await window.firebaseSetDoc(
            window.firebaseDoc(window.firebaseDb, 'users', currentUser.uid),
            payload,
            { merge: true }
        );
        console.log('✅ Synced to Firebase');
    } catch (e) {
        console.error('❌ Sync error:', e);
    }
}

async function loadFromFirebase() {
    if (!currentUser || !window.firebaseGetDoc) return;
    try {
        const docRef = window.firebaseDoc(window.firebaseDb, 'users', currentUser.uid);
        const docSnap = await window.firebaseGetDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            xp = data.xp ?? xp;
            dailyXP = data.dailyXP ?? dailyXP;
            lastActiveDate = data.lastActiveDate ?? lastActiveDate;
            streak = data.streak ?? streak;
            achievements = data.achievements ?? achievements;
            learned = data.learned ?? learned;
            mastered = data.mastered ?? mastered;
            if (data.positions) {
                positions.cards = data.positions.cards || 0;
                positions.test = data.positions.test || 0;
                positions.write = data.positions.write || 0;
                positions.phrases = data.positions.phrases || 0;
                positions.temporary = data.positions.temporary || 0;
                positions.listening = data.positions.listening || 0;
                positions.tempCards = data.positions.tempCards || 0;
                positions.tempTest = data.positions.tempTest || 0;
                positions.tempWrite = data.positions.tempWrite || 0;
                positions.sentBuild = data.positions.sentBuild || 0;
                positions.sentChoose = data.positions.sentChoose || 0;
                positions.sentTranslate = data.positions.sentTranslate || 0;
            }
            currentLevel = data.currentLevel ?? currentLevel;
            if (Array.isArray(data.temporary) && data.temporary.length > 0) {
                temporary = mergeTemporary(temporary, data.temporary);
            }
            srsData = data.srsData ?? srsData;

            localStorage.setItem('xp', xp.toString());
            localStorage.setItem('dailyXP', dailyXP.toString());
            localStorage.setItem('lastActiveDate', lastActiveDate);
            localStorage.setItem('streak', streak.toString());
            localStorage.setItem('achievements', JSON.stringify(achievements));
            localStorage.setItem('learned', JSON.stringify(learned));
            localStorage.setItem('mastered', JSON.stringify(mastered));
            localStorage.setItem('positions', JSON.stringify(positions));
            localStorage.setItem('level', currentLevel);
            localStorage.setItem('temporary', JSON.stringify(temporary));
            localStorage.setItem('srsData', JSON.stringify(srsData));

            console.log('✅ Loaded from Firebase');
        } else {
            console.log('ℹ️ No data in Firebase yet, using local');
        }
    } catch (e) {
        console.error('❌ Load error:', e);
    }
}

function initFirebase() {
    if (!window.firebaseOnAuthStateChanged) {
        console.warn('⚠️ Firebase not loaded');
        return;
    }

    window.firebaseOnAuthStateChanged(window.firebaseAuth, (user) => {
        if (user) {
            currentUser = user;
            console.log('👤 Anonymous user:', user.uid);
            loadFromFirebase().then(() => {
                updateStats();
                renderLevelButtons();
                renderMode(currentMode);
            });
        } else {
            window.firebaseSignInAnonymously(window.firebaseAuth).catch((error) => {
                console.error('Auth error:', error);
            });
        }
    });
}

// ===== MERGE TEMPORARY =====
function mergeTemporary(base, extra) {
    const map = new Map();
    [...base, ...extra].forEach(item => {
        if (item && item.word) {
            map.set(item.word.toLowerCase(), item);
        }
    });
    return Array.from(map.values());
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData() {
    try {
        const vocabRes = await fetch('data/vocabulary.json');
        vocabulary = await vocabRes.json();

        const phrasesRes = await fetch('data/phrases.json');
        phrases = await phrasesRes.json();

        let tempFromJson = [];
        try {
            const tempRes = await fetch('data/temporary.json');
            tempFromJson = await tempRes.json();
            if (!Array.isArray(tempFromJson)) tempFromJson = [];
        } catch (e) {
            console.warn('temporary.json не загружен:', e);
        }

        let tempFromLocal = [];
        try {
            const localTemp = localStorage.getItem('temporary');
            if (localTemp) {
                const parsed = JSON.parse(localTemp);
                if (Array.isArray(parsed)) tempFromLocal = parsed;
            }
        } catch (e) {
            console.warn('local temporary ошибка:', e);
        }

        temporary = mergeTemporary(tempFromJson, tempFromLocal);
        localStorage.setItem('temporary', JSON.stringify(temporary));

        // sentences.json (может отсутствовать — не критично)
        try {
            const sentRes = await fetch('data/sentences.json');
            sentences = await sentRes.json();
            if (!Array.isArray(sentences)) sentences = [];
        } catch (e) {
            console.warn('sentences.json не загружен:', e);
            sentences = [];
        }

        checkStreak();
        updateStats();
        renderLevelButtons();
        renderMode('cards');

        initFirebase();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        document.getElementById('content').innerHTML =
            '<p style="color: red;">Ошибка загрузки данных.</p>';
    }
}

// ===== SRS ЛОГИКА =====
function getSrsData(word, isTemp = false) {
    const key = isTemp ? `temp:${word}` : word;
    if (!srsData[key]) {
        srsData[key] = { level: 0, next: 0 };
    }
    return srsData[key];
}

function updateSrs(word, correct, isTemp = false) {
    const key = isTemp ? `temp:${word}` : word;
    const data = getSrsData(word, isTemp);
    if (correct) {
        data.level = Math.min(data.level + 1, 5);
        const days = SRS_INTERVALS[data.level];
        data.next = Date.now() + days * 24 * 60 * 60 * 1000;
    } else {
        data.level = 0;
        data.next = Date.now();
    }
    srsData[key] = data;
    localStorage.setItem('srsData', JSON.stringify(srsData));
    syncToFirebase();
}

function isDue(word, isTemp = false) {
    const data = getSrsData(word, isTemp);
    return Date.now() >= data.next;
}

function getDueWords() {
    const all = getFilteredVocabulary();
    const due = all.filter(w => !isMastered(w.word) && isDue(w.word, false));
    due.sort((a, b) => {
        const aLevel = getSrsData(a.word, false).level;
        const bLevel = getSrsData(b.word, false).level;
        return aLevel - bLevel;
    });
    return due;
}

// ===== MASTERED =====
function isMastered(word) {
    return mastered.includes(word);
}

function addMastered(word) {
    if (!mastered.includes(word)) {
        mastered.push(word);
        localStorage.setItem('mastered', JSON.stringify(mastered));
    }
    const idx = learned.indexOf(word);
    if (idx !== -1) {
        learned.splice(idx, 1);
        localStorage.setItem('learned', JSON.stringify(learned));
    }
    syncToFirebase();
}

function removeMastered(word) {
    const idx = mastered.indexOf(word);
    if (idx !== -1) {
        mastered.splice(idx, 1);
        localStorage.setItem('mastered', JSON.stringify(mastered));
        const key = word;
        if (srsData[key]) {
            srsData[key] = { level: 0, next: 0 };
            localStorage.setItem('srsData', JSON.stringify(srsData));
        }
        syncToFirebase();
    }
}

// ===== STREAK =====
function checkStreak() {
    const today = new Date().toDateString();
    if (lastActiveDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastActiveDate === yesterday.toDateString()) {
            // streak продолжается
        } else if (lastActiveDate !== '') {
            streak = 0;
        }
        lastActiveDate = today;
        dailyXP = 0;
        localStorage.setItem('lastActiveDate', today);
        localStorage.setItem('dailyXP', '0');
        localStorage.setItem('streak', streak.toString());
    }
}

// ===== XP =====
function addXP(amount) {
    xp += amount;
    dailyXP += amount;
    localStorage.setItem('xp', xp.toString());
    localStorage.setItem('dailyXP', dailyXP.toString());
    updateStats();
    syncToFirebase();
}

function getLevelName() {
    if (xp < 100) return 'Beginner';
    if (xp < 500) return 'Amateur';
    if (xp < 1500) return 'Advanced';
    if (xp < 3000) return 'Pro';
    return 'Master';
}

// ===== СТАТИСТИКА =====
function getLevelTotal() {
    return getFilteredVocabulary().length;
}

function getLevelLearnedCount() {
    const levelWords = getFilteredVocabulary();
    const learnedSet = new Set(learned);
    return levelWords.filter(w => learnedSet.has(w.word)).length;
}

function updateStats() {
    const levelTotal = getLevelTotal();
    const levelLearned = getLevelLearnedCount();
    const dueCount = getDueWords().length;

    const levelLabel = currentLevel === 'all' ? '' : ` [${currentLevel}]`;
    document.getElementById('progress-info').textContent =
        `Learned: ${levelLearned} / ${levelTotal}${levelLabel} · Due: ${dueCount} · 🏆 ${mastered.length}`;

    document.getElementById('xp-info').textContent = `${xp} XP`;
    document.getElementById('streak-info').textContent = streak;
    document.getElementById('level-info').textContent = getLevelName();

    document.getElementById('goal-progress').textContent = `${dailyXP} / ${DAILY_GOAL} XP`;
    const percent = Math.min(100, (dailyXP / DAILY_GOAL) * 100);
    document.getElementById('goal-bar-fill').style.width = `${percent}%`;
}

function savePositions() {
    localStorage.setItem('positions', JSON.stringify(positions));
    syncToFirebase();
}

// ===== ОЗВУЧКА =====
function speak(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }
}

// ===== ВЫБОР УРОВНЯ =====
function renderLevelButtons() {
    const container = document.getElementById('level-buttons');
    if (!container) return;

    const levels = ['all', 'A1', 'A2', 'B1'];
    container.innerHTML = levels.map(lvl =>
        `<button class="level-btn ${lvl === currentLevel ? 'active' : ''}" data-level="${lvl}">
            ${lvl === 'all' ? 'All' : lvl}
        </button>`
    ).join('');

    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.onclick = () => {
            currentLevel = btn.dataset.level;
            localStorage.setItem('level', currentLevel);
            positions = {
                cards: 0, test: 0, write: 0, phrases: 0,
                temporary: 0, listening: 0,
                tempCards: 0, tempTest: 0, tempWrite: 0,
                sentBuild: 0, sentChoose: 0, sentTranslate: 0
            };
            savePositions();
            renderLevelButtons();
            renderMode(currentMode);
            updateStats();
        };
    });
}

function getFilteredVocabulary() {
    if (currentLevel === 'all') return vocabulary;
    const range = LEVEL_RANGES[currentLevel];
    if (!range) return vocabulary;
    return vocabulary.slice(range.start, Math.min(range.end, vocabulary.length));
}

function getFilteredPhrases() {
    if (currentLevel === 'all') return phrases;
    const total = phrases.length;
    const step = Math.ceil(total / 3);
    if (currentLevel === 'A1') return phrases.slice(0, step);
    if (currentLevel === 'A2') return phrases.slice(step, step * 2);
    if (currentLevel === 'B1') return phrases.slice(step * 2);
    return phrases;
}

// ===== ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ =====
function renderMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    if (mode === 'cards') renderCards();
    else if (mode === 'test') renderTest();
    else if (mode === 'write') renderWrite();
    else if (mode === 'phrases') renderPhrases();
    else if (mode === 'temporary') renderTemporary();
    else if (mode === 'listening') renderListening();
    else if (mode === 'mastered') renderMastered();
    else if (mode === 'sentences') renderSentences();
}

// ===== КАРТОЧКИ (SRS) =====
function renderCards() {
    const dueWords = getDueWords();

    if (dueWords.length === 0) {
        document.getElementById('content').innerHTML = `
            <div class="card">
                <h2>🎉 All caught up!</h2>
                <p>No words due for review right now.</p>
                <p>Come back later or add new words.</p>
            </div>
        `;
        return;
    }

    if (positions.cards >= dueWords.length) positions.cards = 0;
    const word = dueWords[positions.cards];

    const srs = getSrsData(word.word, false);
    const transText = word.transcription_ru
        ? `<span class="card-transcription">[${word.transcription_ru}]</span>`
        : (word.ipa ? `<span class="card-transcription">${word.ipa}</span>` : '');

    const posText = word.pos ? `<span class="card-pos">${word.pos}</span>` : '';

    let hiddenContent = `<div class="card-translation">${word.translation}</div>`;
    if (word.note) {
        hiddenContent += `<div class="card-note">${word.note}</div>`;
    }
    if (word.example) {
        hiddenContent += `
            <div class="card-example">
                <div class="example-en">${word.example}</div>
                <div class="example-ru">${word.example_translation || ''}</div>
            </div>
        `;
    }
    if (word.family && word.family.length > 0) {
        hiddenContent += `
            <div class="card-family">
                <strong>Word Family:</strong> ${formatFamily(word.family)}
            </div>
        `;
    }
    if (word.collocations && word.collocations.length > 0) {
        hiddenContent += `
            <div class="card-collocations">
                <strong>Collocations:</strong> ${formatCollocations(word.collocations)}
            </div>
        `;
    }

    document.getElementById('content').innerHTML = `
        <div class="card">
            <div class="card-srs">SRS Level: ${srs.level}/5</div>
            <div class="card-word">
                ${word.word}
                <button class="speak-btn" onclick="speak('${word.word.replace(/'/g, "\\'")}')">🔊</button>
            </div>
            <div class="card-meta">
                ${transText} ${posText}
            </div>
            <div id="hidden-content" style="display: none;">
                ${hiddenContent}
            </div>
            <div id="buttons-before">
                <button class="btn btn-secondary" id="btn-show">👁 Показать перевод</button>
            </div>
            <div id="buttons-after" style="display: none;">
                <button class="btn btn-success" id="btn-learned">✓ Выучил (+10 XP)</button>
                <button class="btn btn-warning" id="btn-dontknow">✗ Не знаю</button>
                <button class="btn btn-master" id="btn-master">✓✓ Навсегда (+20 XP)</button>
            </div>
            <div class="card-frequency">Частота: ${word.frequency} · Слово ${positions.cards + 1} из ${dueWords.length} (due)</div>
        </div>
    `;

    document.getElementById('btn-show').onclick = () => {
        document.getElementById('hidden-content').style.display = 'block';
        document.getElementById('buttons-before').style.display = 'none';
        document.getElementById('buttons-after').style.display = 'block';
    };

    document.getElementById('btn-learned').onclick = () => {
        if (!learned.includes(word.word)) {
            learned.push(word.word);
            localStorage.setItem('learned', JSON.stringify(learned));
        }
        updateSrs(word.word, true, false);
        addXP(10);
        positions.cards = 0;
        renderCards();
        updateStats();
    };

    document.getElementById('btn-dontknow').onclick = () => {
        updateSrs(word.word, false, false);
        addXP(2);
        positions.cards++;
        if (positions.cards >= dueWords.length) positions.cards = 0;
        renderCards();
        updateStats();
    };

    document.getElementById('btn-master').onclick = () => {
        addMastered(word.word);
        addXP(20);
        positions.cards = 0;
        renderCards();
        updateStats();
    };

    updateFooterButtons(dueWords.length);
}

// ===== ТЕСТ =====
function renderTest() {
    const data = getFilteredVocabulary().filter(w =>
        !isMastered(w.word) &&
        !w.translation.includes(';') &&
        !w.translation.includes(',') &&
        w.translation.length > 2
    );

    if (data.length < 4) {
        document.getElementById('content').innerHTML = '<p>Недостаточно слов для теста.</p>';
        return;
    }

    if (positions.test >= data.length) positions.test = 0;
    const word = data[positions.test];
    const correct = word.translation;

    const wrongOptions = [];
    let guard = 0;
    while (wrongOptions.length < 3 && guard < 200) {
        guard++;
        const randomWord = data[Math.floor(Math.random() * data.length)];
        if (randomWord.translation !== correct && !wrongOptions.includes(randomWord.translation)) {
            wrongOptions.push(randomWord.translation);
        }
    }

    const options = [correct, ...wrongOptions].sort(() => Math.random() - 0.5);

    const transText = word.transcription_ru
        ? `<span class="card-transcription">[${word.transcription_ru}]</span>`
        : (word.ipa ? `<span class="card-transcription">${word.ipa}</span>` : '');

    document.getElementById('content').innerHTML = `
        <div class="test-question">
            ${word.word}
            <button class="speak-btn" onclick="speak('${word.word.replace(/'/g, "\\'")}')">🔊</button>
        </div>
        <div class="card-meta">
            ${transText}
            ${word.pos ? `<span class="card-pos">${word.pos}</span>` : ''}
        </div>
        <div class="test-options">
            ${options.map(opt => `<button class="test-option" data-answer="${opt}">${opt}</button>`).join('')}
        </div>
        <div class="test-feedback" id="test-feedback"></div>
        <button class="btn btn-success" id="btn-next-test" style="display: none;">Дальше →</button>
        <div class="card-frequency">Слово ${positions.test + 1} из ${data.length}</div>
    `;

    document.querySelectorAll('.test-option').forEach(btn => {
        btn.onclick = () => {
            const answer = btn.dataset.answer;
            const feedback = document.getElementById('test-feedback');

            if (answer === correct) {
                btn.classList.add('correct');
                feedback.textContent = '✓ Правильно! +10 XP';
                feedback.className = 'test-feedback correct';
                updateSrs(word.word, true, false);
                addXP(10);
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('.test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                feedback.textContent = `✗ Неправильно. Правильный ответ: ${correct} (+2 XP)`;
                feedback.className = 'test-feedback wrong';
                updateSrs(word.word, false, false);
                addXP(2);
            }
            document.querySelectorAll('.test-option').forEach(b => b.disabled = true);
            document.getElementById('btn-next-test').style.display = 'inline-block';
        };
    });

    document.getElementById('btn-next-test').onclick = () => {
        positions.test++;
        if (positions.test >= data.length) positions.test = 0;
        savePositions();
        renderTest();
    };

    updateFooterButtons(data.length);
}

// ===== НАПИСАНИЕ =====
function renderWrite() {
    const data = getFilteredVocabulary().filter(w => !isMastered(w.word));
    if (data.length === 0) {
        document.getElementById('content').innerHTML = '<p>Нет слов для этого уровня.</p>';
        return;
    }

    if (positions.write >= data.length) positions.write = 0;
    const word = data[positions.write];

    document.getElementById('content').innerHTML = `
        <div class="card-word">
            ${word.translation}
        </div>
        <input type="text" class="write-input" id="write-input" placeholder="Введи слово..." autocomplete="off">
        <button class="btn btn-primary" id="btn-check">✓ Проверить</button>
        <button class="btn btn-secondary" id="btn-show-answer">👁 Показать ответ</button>
        <button class="btn btn-success" id="btn-next-write" style="display: none;">Дальше →</button>
        <div class="write-feedback" id="write-feedback"></div>
        <div class="card-frequency">Подсказка: ${word.word.length} букв. Слово ${positions.write + 1} из ${data.length}</div>
    `;

    const input = document.getElementById('write-input');
    input.focus();

    document.getElementById('btn-check').onclick = () => {
        const answer = input.value.trim().toLowerCase();
        const feedback = document.getElementById('write-feedback');

        if (answer === word.word.toLowerCase()) {
            feedback.textContent = '✓ Правильно! +10 XP';
            feedback.className = 'write-feedback correct';
            updateSrs(word.word, true, false);
            addXP(10);
        } else {
            feedback.textContent = `✗ Неправильно. Правильный ответ: ${word.word} (+2 XP)`;
            feedback.className = 'write-feedback wrong';
            updateSrs(word.word, false, false);
            addXP(2);
        }
        document.getElementById('btn-check').disabled = true;
        document.getElementById('btn-show-answer').disabled = true;
        input.disabled = true;
        document.getElementById('btn-next-write').style.display = 'inline-block';
    };

    document.getElementById('btn-show-answer').onclick = () => {
        document.getElementById('write-feedback').textContent = `Правильный ответ: ${word.word}`;
        document.getElementById('write-feedback').className = 'write-feedback';
        document.getElementById('btn-check').disabled = true;
        document.getElementById('btn-show-answer').disabled = true;
        input.disabled = true;
        document.getElementById('btn-next-write').style.display = 'inline-block';
        updateSrs(word.word, false, false);
        addXP(2);
    };

    document.getElementById('btn-next-write').onclick = () => {
        positions.write++;
        if (positions.write >= data.length) positions.write = 0;
        savePositions();
        renderWrite();
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('btn-check').disabled) {
            document.getElementById('btn-check').click();
        }
    });

    updateFooterButtons(data.length);
}

// ===== ФРАЗЫ =====
function renderPhrases() {
    const data = getFilteredPhrases();
    if (data.length < 4) {
        document.getElementById('content').innerHTML = '<p>Недостаточно фраз для теста.</p>';
        return;
    }

    if (positions.phrases >= data.length) positions.phrases = 0;
    const phrase = data[positions.phrases];
    const correct = phrase.translation;

    const wrongOptions = [];
    let guard = 0;
    while (wrongOptions.length < 3 && guard < 200) {
        guard++;
        const randomPhrase = data[Math.floor(Math.random() * data.length)];
        if (randomPhrase.translation !== correct && !wrongOptions.includes(randomPhrase.translation)) {
            wrongOptions.push(randomPhrase.translation);
        }
    }

    const options = [correct, ...wrongOptions].sort(() => Math.random() - 0.5);

    document.getElementById('content').innerHTML = `
        <div class="test-question">
            ${phrase.phrase}
            <button class="speak-btn" onclick="speak('${phrase.phrase.replace(/'/g, "\\'")}')">🔊</button>
        </div>
        <div class="test-options">
            ${options.map(opt => `<button class="test-option" data-answer="${opt}">${opt}</button>`).join('')}
        </div>
        <div class="test-feedback" id="test-feedback"></div>
        <button class="btn btn-success" id="btn-next-phrase" style="display: none;">Дальше →</button>
        <div class="card-frequency">Фраза ${positions.phrases + 1} из ${data.length}</div>
    `;

    document.querySelectorAll('.test-option').forEach(btn => {
        btn.onclick = () => {
            const answer = btn.dataset.answer;
            const feedback = document.getElementById('test-feedback');

            if (answer === correct) {
                btn.classList.add('correct');
                feedback.textContent = '✓ Правильно! +10 XP';
                feedback.className = 'test-feedback correct';
                addXP(10);
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('.test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                feedback.textContent = `✗ Неправильно. Правильный ответ: ${correct} (+2 XP)`;
                feedback.className = 'test-feedback wrong';
                addXP(2);
            }
            document.querySelectorAll('.test-option').forEach(b => b.disabled = true);
            document.getElementById('btn-next-phrase').style.display = 'inline-block';
        };
    });

    document.getElementById('btn-next-phrase').onclick = () => {
        positions.phrases++;
        if (positions.phrases >= data.length) positions.phrases = 0;
        savePositions();
        renderPhrases();
    };

    updateFooterButtons(data.length);
}

// ===== АУДИРОВАНИЕ =====
function renderListening() {
    const data = getFilteredVocabulary().filter(w => !isMastered(w.word));
    if (data.length === 0) {
        document.getElementById('content').innerHTML = '<p>Нет слов для этого уровня.</p>';
        return;
    }

    if (positions.listening >= data.length) positions.listening = 0;
    const word = data[positions.listening];

    document.getElementById('content').innerHTML = `
        <div class="card">
            <div class="card-srs">🎧 Listen and write the word</div>
            <div class="card-word">
                <button class="speak-btn big-speak" onclick="speak('${word.word.replace(/'/g, "\\'")}')">🔊</button>
            </div>
            <input type="text" class="write-input" id="listen-input" placeholder="Введи слово..." autocomplete="off">
            <button class="btn btn-primary" id="btn-listen-check">✓ Проверить</button>
            <button class="btn btn-secondary" id="btn-listen-play">🔊 Повторить</button>
            <button class="btn btn-success" id="btn-next-listen" style="display: none;">Дальше →</button>
            <div class="write-feedback" id="listen-feedback"></div>
            <div class="card-frequency">Слово ${positions.listening + 1} из ${data.length}</div>
        </div>
    `;

    const input = document.getElementById('listen-input');
    input.focus();

    document.getElementById('btn-listen-play').onclick = () => {
        speak(word.word);
    };

    document.getElementById('btn-listen-check').onclick = () => {
        const answer = input.value.trim().toLowerCase();
        const feedback = document.getElementById('listen-feedback');

        if (answer === word.word.toLowerCase()) {
            feedback.textContent = '✓ Правильно! +10 XP';
            feedback.className = 'write-feedback correct';
            updateSrs(word.word, true, false);
            addXP(10);
        } else {
            feedback.textContent = `✗ Неправильно. Правильный ответ: ${word.word} (+2 XP)`;
            feedback.className = 'write-feedback wrong';
            updateSrs(word.word, false, false);
            addXP(2);
        }
        document.getElementById('btn-listen-check').disabled = true;
        input.disabled = true;
        document.getElementById('btn-next-listen').style.display = 'inline-block';
    };

    document.getElementById('btn-next-listen').onclick = () => {
        positions.listening++;
        if (positions.listening >= data.length) positions.listening = 0;
        savePositions();
        renderListening();
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('btn-listen-check').disabled) {
            document.getElementById('btn-listen-check').click();
        }
    });

    updateFooterButtons(data.length);
}

// ===== ВРЕМЕННЫЕ СЛОВА =====
function renderTemporary() {
    const subNav = `
        <div class="temp-subnav">
            <button class="temp-subnav-btn ${tempSubMode === 'list' ? 'active' : ''}" data-sub="list">📋 Список</button>
            <button class="temp-subnav-btn ${tempSubMode === 'cards' ? 'active' : ''}" data-sub="cards">📇 Карточки</button>
            <button class="temp-subnav-btn ${tempSubMode === 'test' ? 'active' : ''}" data-sub="test">✅ Тест</button>
            <button class="temp-subnav-btn ${tempSubMode === 'write' ? 'active' : ''}" data-sub="write">✏️ Написание</button>
        </div>
    `;

    let bodyHtml = '';

    if (tempSubMode === 'list') {
        bodyHtml = renderTempList();
    } else if (tempSubMode === 'cards') {
        bodyHtml = renderTempCards();
    } else if (tempSubMode === 'test') {
        bodyHtml = renderTempTest();
    } else if (tempSubMode === 'write') {
        bodyHtml = renderTempWrite();
    }

    document.getElementById('content').innerHTML = `
        <div class="temporary-header">
            <h2>📝 Temporary Words (${temporary.length})</h2>
        </div>
        ${subNav}
        ${bodyHtml}
    `;

    document.querySelectorAll('.temp-subnav-btn').forEach(btn => {
        btn.onclick = () => {
            tempSubMode = btn.dataset.sub;
            renderTemporary();
        };
    });

    if (tempSubMode === 'list') {
        attachTempListHandlers();
    } else if (tempSubMode === 'cards') {
        attachTempCardsHandlers();
    } else if (tempSubMode === 'test') {
        attachTempTestHandlers();
    } else if (tempSubMode === 'write') {
        attachTempWriteHandlers();
    }

    document.getElementById('btn-prev').disabled = true;
    document.getElementById('btn-next').disabled = true;
}

function renderTempList() {
    return `
        <div style="margin: 10px 0;">
            <button class="btn btn-primary" id="btn-add-temp">+ Добавить слово</button>
        </div>
        <div class="temp-form" id="temp-form" style="display: none;">
            <input type="text" id="temp-word" placeholder="English word" autocomplete="off">
            <input type="text" id="temp-translation" placeholder="Перевод" autocomplete="off">
            <input type="text" id="temp-transcription" placeholder="Транскрипция рус. (напр. уелд)" autocomplete="off">
            <button class="btn btn-success" id="btn-save-temp">Сохранить</button>
            <button class="btn btn-secondary" id="btn-cancel-temp">Отмена</button>
        </div>
        <div class="temp-list" id="temp-list">
            ${temporary.length === 0
                ? '<p style="color:#888;margin-top:20px;">Пока нет временных слов.</p>'
                : temporary.map((w, i) => `
                    <div class="temp-item">
                        <div class="temp-item-info">
                            <strong>${w.word}</strong>
                            <button class="speak-btn" onclick="speak('${w.word.replace(/'/g, "\\'")}')">🔊</button>
                            <span class="temp-transcription">[${w.transcription_ru || ''}]</span>
                            <span class="temp-translation">${w.translation}</span>
                        </div>
                        <button class="btn btn-warning" onclick="deleteTempWord(${i})">🗑</button>
                    </div>
                `).join('')
            }
        </div>
    `;
}

function attachTempListHandlers() {
    const addBtn = document.getElementById('btn-add-temp');
    if (addBtn) {
        addBtn.onclick = () => {
            document.getElementById('temp-form').style.display = 'block';
            document.getElementById('temp-word').focus();
        };
    }

    const cancelBtn = document.getElementById('btn-cancel-temp');
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            document.getElementById('temp-form').style.display = 'none';
            document.getElementById('temp-word').value = '';
            document.getElementById('temp-translation').value = '';
            document.getElementById('temp-transcription').value = '';
        };
    }

    const saveBtn = document.getElementById('btn-save-temp');
    if (saveBtn) {
        saveBtn.onclick = () => {
            const word = document.getElementById('temp-word').value.trim();
            const translation = document.getElementById('temp-translation').value.trim();
            const transcription = document.getElementById('temp-transcription').value.trim();

            if (!word || !translation) {
                alert('Введи слово и перевод!');
                return;
            }

            temporary = mergeTemporary(temporary, [{
                word: word,
                translation: translation,
                transcription_ru: transcription.replace(/[\[\]]/g, ''),
                frequency: 0,
                note: '',
                example: '',
                example_translation: '',
                family: [],
                collocations: []
            }]);

            localStorage.setItem('temporary', JSON.stringify(temporary));
            syncToFirebase();
            renderTemporary();
        };
    }
}

function deleteTempWord(index) {
    if (!confirm('Удалить это слово?')) return;
    temporary.splice(index, 1);
    localStorage.setItem('temporary', JSON.stringify(temporary));
    syncToFirebase();
    renderTemporary();
}

function renderTempCards() {
    if (temporary.length === 0) {
        return '<p style="color:#888;margin-top:20px;">Нет временных слов. Добавь в «Список».</p>';
    }

    if (positions.tempCards >= temporary.length) positions.tempCards = 0;
    const word = temporary[positions.tempCards];
    const srs = getSrsData(word.word, true);

    const transText = word.transcription_ru
        ? `<span class="card-transcription">[${word.transcription_ru}]</span>`
        : '';

    let hiddenContent = `<div class="card-translation">${word.translation}</div>`;
    if (word.note) {
        hiddenContent += `<div class="card-note">${word.note}</div>`;
    }

    return `
        <div class="card">
            <div class="card-srs">SRS (temp): ${srs.level}/5</div>
            <div class="card-word">
                ${word.word}
                <button class="speak-btn" onclick="speak('${word.word.replace(/'/g, "\\'")}')">🔊</button>
            </div>
            <div class="card-meta">${transText}</div>
            <div id="temp-hidden" style="display: none;">${hiddenContent}</div>
            <div id="temp-buttons-before">
                <button class="btn btn-secondary" id="temp-btn-show">👁 Показать перевод</button>
            </div>
            <div id="temp-buttons-after" style="display: none;">
                <button class="btn btn-success" id="temp-btn-learned">✓ Выучил (+10 XP)</button>
                <button class="btn btn-warning" id="temp-btn-dontknow">✗ Не знаю</button>
            </div>
            <div class="card-frequency">Слово ${positions.tempCards + 1} из ${temporary.length}</div>
        </div>
    `;
}

function attachTempCardsHandlers() {
    if (temporary.length === 0) return;

    const showBtn = document.getElementById('temp-btn-show');
    if (showBtn) {
        showBtn.onclick = () => {
            document.getElementById('temp-hidden').style.display = 'block';
            document.getElementById('temp-buttons-before').style.display = 'none';
            document.getElementById('temp-buttons-after').style.display = 'block';
        };
    }

    const learnedBtn = document.getElementById('temp-btn-learned');
    if (learnedBtn) {
        learnedBtn.onclick = () => {
            const word = temporary[positions.tempCards];
            updateSrs(word.word, true, true);
            addXP(10);
            positions.tempCards++;
            if (positions.tempCards >= temporary.length) positions.tempCards = 0;
            savePositions();
            renderTemporary();
        };
    }

    const dontBtn = document.getElementById('temp-btn-dontknow');
    if (dontBtn) {
        dontBtn.onclick = () => {
            const word = temporary[positions.tempCards];
            updateSrs(word.word, false, true);
            addXP(2);
            positions.tempCards++;
            if (positions.tempCards >= temporary.length) positions.tempCards = 0;
            savePositions();
            renderTemporary();
        };
    }
}

function renderTempTest() {
    if (temporary.length < 4) {
        return '<p style="color:#888;margin-top:20px;">Нужно минимум 4 слова для теста.</p>';
    }

    if (positions.tempTest >= temporary.length) positions.tempTest = 0;
    const word = temporary[positions.tempTest];
    const correct = word.translation;

    const wrongOptions = [];
    let guard = 0;
    while (wrongOptions.length < 3 && guard < 100) {
        guard++;
        const randomWord = temporary[Math.floor(Math.random() * temporary.length)];
        if (randomWord.translation !== correct && !wrongOptions.includes(randomWord.translation)) {
            wrongOptions.push(randomWord.translation);
        }
    }

    const options = [correct, ...wrongOptions].sort(() => Math.random() - 0.5);

    const transText = word.transcription_ru
        ? `<span class="card-transcription">[${word.transcription_ru}]</span>`
        : '';

    return `
        <div class="test-question">
            ${word.word}
            <button class="speak-btn" onclick="speak('${word.word.replace(/'/g, "\\'")}')">🔊</button>
        </div>
        <div class="card-meta">${transText}</div>
        <div class="test-options">
            ${options.map(opt => `<button class="test-option" data-answer="${opt}">${opt}</button>`).join('')}
        </div>
        <div class="test-feedback" id="temp-test-feedback"></div>
        <button class="btn btn-success" id="temp-btn-next-test" style="display: none;">Дальше →</button>
        <div class="card-frequency">Слово ${positions.tempTest + 1} из ${temporary.length}</div>
    `;
}

function attachTempTestHandlers() {
    if (temporary.length < 4) return;

    const word = temporary[positions.tempTest];
    const correct = word.translation;

    document.querySelectorAll('#content .test-option').forEach(btn => {
        btn.onclick = () => {
            const answer = btn.dataset.answer;
            const feedback = document.getElementById('temp-test-feedback');

            if (answer === correct) {
                btn.classList.add('correct');
                feedback.textContent = '✓ Правильно! +10 XP';
                feedback.className = 'test-feedback correct';
                updateSrs(word.word, true, true);
                addXP(10);
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('#content .test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                feedback.textContent = `✗ Неправильно. Правильный ответ: ${correct} (+2 XP)`;
                feedback.className = 'test-feedback wrong';
                updateSrs(word.word, false, true);
                addXP(2);
            }
            document.querySelectorAll('#content .test-option').forEach(b => b.disabled = true);
            document.getElementById('temp-btn-next-test').style.display = 'inline-block';
        };
    });

    const nextBtn = document.getElementById('temp-btn-next-test');
    if (nextBtn) {
        nextBtn.onclick = () => {
            positions.tempTest++;
            if (positions.tempTest >= temporary.length) positions.tempTest = 0;
            savePositions();
            renderTemporary();
        };
    }
}

function renderTempWrite() {
    if (temporary.length === 0) {
        return '<p style="color:#888;margin-top:20px;">Нет временных слов.</p>';
    }

    if (positions.tempWrite >= temporary.length) positions.tempWrite = 0;
    const word = temporary[positions.tempWrite];

    return `
        <div class="card-word">${word.translation}</div>
        <input type="text" class="write-input" id="temp-write-input" placeholder="Введи слово..." autocomplete="off">
        <button class="btn btn-primary" id="temp-btn-check">✓ Проверить</button>
        <button class="btn btn-secondary" id="temp-btn-show-answer">👁 Показать ответ</button>
        <button class="btn btn-success" id="temp-btn-next-write" style="display: none;">Дальше →</button>
        <div class="write-feedback" id="temp-write-feedback"></div>
        <div class="card-frequency">Подсказка: ${word.word.length} букв. Слово ${positions.tempWrite + 1} из ${temporary.length}</div>
    `;
}

function attachTempWriteHandlers() {
    if (temporary.length === 0) return;

    const word = temporary[positions.tempWrite];
    const input = document.getElementById('temp-write-input');
    input.focus();

    document.getElementById('temp-btn-check').onclick = () => {
        const answer = input.value.trim().toLowerCase();
        const feedback = document.getElementById('temp-write-feedback');

        if (answer === word.word.toLowerCase()) {
            feedback.textContent = '✓ Правильно! +10 XP';
            feedback.className = 'write-feedback correct';
            updateSrs(word.word, true, true);
            addXP(10);
        } else {
            feedback.textContent = `✗ Неправильно. Правильный ответ: ${word.word} (+2 XP)`;
            feedback.className = 'write-feedback wrong';
            updateSrs(word.word, false, true);
            addXP(2);
        }
        document.getElementById('temp-btn-check').disabled = true;
        document.getElementById('temp-btn-show-answer').disabled = true;
        input.disabled = true;
        document.getElementById('temp-btn-next-write').style.display = 'inline-block';
    };

    document.getElementById('temp-btn-show-answer').onclick = () => {
        document.getElementById('temp-write-feedback').textContent = `Правильный ответ: ${word.word}`;
        document.getElementById('temp-write-feedback').className = 'write-feedback';
        document.getElementById('temp-btn-check').disabled = true;
        document.getElementById('temp-btn-show-answer').disabled = true;
        input.disabled = true;
        document.getElementById('temp-btn-next-write').style.display = 'inline-block';
        updateSrs(word.word, false, true);
        addXP(2);
    };

    document.getElementById('temp-btn-next-write').onclick = () => {
        positions.tempWrite++;
        if (positions.tempWrite >= temporary.length) positions.tempWrite = 0;
        savePositions();
        renderTemporary();
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('temp-btn-check').disabled) {
            document.getElementById('temp-btn-check').click();
        }
    });
}

// ===== MASTERED ЭКРАН =====
function renderMastered() {
    if (mastered.length === 0) {
        document.getElementById('content').innerHTML = `
            <div class="mastered-header">
                <h2>🏆 Mastered (0)</h2>
            </div>
            <p class="mastered-empty">Пока нет слов, помеченных как «знаю навсегда».<br>
            В карточке нажми <b>✓✓ Навсегда</b>, чтобы добавить сюда.</p>
        `;
        document.getElementById('btn-prev').disabled = true;
        document.getElementById('btn-next').disabled = true;
        return;
    }

    const sorted = [...mastered].sort();

    document.getElementById('content').innerHTML = `
        <div class="mastered-header">
            <h2>🏆 Mastered (${mastered.length})</h2>
            <button class="btn btn-warning" id="btn-clear-mastered" style="min-width:auto;padding:8px 14px;font-size:13px;">🗑 Очистить всё</button>
        </div>
        <div class="mastered-list">
            ${sorted.map(word => `
                <div class="mastered-item">
                    <div class="mastered-item-info">
                        <strong>${word}</strong>
                        <button class="speak-btn" onclick="speak('${word.replace(/'/g, "\\'")}')">🔊</button>
                    </div>
                    <button class="btn btn-secondary" onclick="unmasterWord('${word.replace(/'/g, "\\'")}')" style="min-width:auto;">↩ Вернуть</button>
                </div>
            `).join('')}
        </div>
    `;

    document.getElementById('btn-clear-mastered').onclick = () => {
        if (!confirm(`Вернуть все ${mastered.length} слов в обучение?`)) return;
        mastered.forEach(w => removeMastered(w));
        renderMastered();
        updateStats();
    };

    document.getElementById('btn-prev').disabled = true;
    document.getElementById('btn-next').disabled = true;
}

function unmasterWord(word) {
    if (!confirm(`Вернуть «${word}» в обучение?`)) return;
    removeMastered(word);
    renderMastered();
    updateStats();
}

// ===== SENTENCES =====
function getFilteredSentences() {
    if (sentFilter === 'all') return sentences;
    return sentences.filter(s => s.tense === sentFilter);
}

function getUniqueTenses() {
    const map = new Map();
    sentences.forEach(s => {
        if (!map.has(s.tense)) {
            map.set(s.tense, s.tense_label);
        }
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
}

function renderSentences() {
    if (sentences.length === 0) {
        document.getElementById('content').innerHTML = `
            <div class="sentences-header">
                <h2>📖 Sentences</h2>
            </div>
            <p style="color:#888;margin-top:20px;">Файл <b>sentences.json</b> не загружен.<br>
            Проверь, что он лежит в <b>data/sentences.json</b>.</p>
        `;
        document.getElementById('btn-prev').disabled = true;
        document.getElementById('btn-next').disabled = true;
        return;
    }

    const tenses = getUniqueTenses();
    const filterChips = `
        <button class="sent-filter-chip ${sentFilter === 'all' ? 'active' : ''}" data-filter="all">All (${sentences.length})</button>
        ${tenses.map(t => {
            const count = sentences.filter(s => s.tense === t.key).length;
            return `<button class="sent-filter-chip ${sentFilter === t.key ? 'active' : ''}" data-filter="${t.key}">${t.label} (${count})</button>`;
        }).join('')}
    `;

    const subNav = `
        <div class="temp-subnav">
            <button class="temp-subnav-btn ${sentSubMode === 'build' ? 'active' : ''}" data-sub="build">🔤 Сборка</button>
            <button class="temp-subnav-btn ${sentSubMode === 'choose' ? 'active' : ''}" data-sub="choose">✅ Выбор времени</button>
            <button class="temp-subnav-btn ${sentSubMode === 'translate' ? 'active' : ''}" data-sub="translate">✏️ Перевод</button>
        </div>
    `;

    let bodyHtml = '';
    if (sentSubMode === 'build') bodyHtml = renderSentBuild();
    else if (sentSubMode === 'choose') bodyHtml = renderSentChoose();
    else if (sentSubMode === 'translate') bodyHtml = renderSentTranslate();

    document.getElementById('content').innerHTML = `
        <div class="sentences-header">
            <h2>📖 Sentences</h2>
        </div>
        <div class="sent-filters">${filterChips}</div>
        ${subNav}
        ${bodyHtml}
    `;

    document.querySelectorAll('.sent-filter-chip').forEach(btn => {
        btn.onclick = () => {
            sentFilter = btn.dataset.filter;
            renderSentences();
        };
    });

    document.querySelectorAll('.temp-subnav-btn').forEach(btn => {
        btn.onclick = () => {
            sentSubMode = btn.dataset.sub;
            renderSentences();
        };
    });

    if (sentSubMode === 'build') attachSentBuildHandlers();
    else if (sentSubMode === 'choose') attachSentChooseHandlers();
    else if (sentSubMode === 'translate') attachSentTranslateHandlers();

    document.getElementById('btn-prev').disabled = true;
    document.getElementById('btn-next').disabled = true;
}

// ----- Sentences: Build -----
function renderSentBuild() {
    const data = getFilteredSentences();
    if (data.length === 0) {
        return '<p style="color:#888;margin-top:20px;">Нет предложений под этот фильтр.</p>';
    }

    if (positions.sentBuild >= data.length) positions.sentBuild = 0;
    const sent = data[positions.sentBuild];

    // Перемешиваем слова
    const shuffled = [...sent.words].sort(() => Math.random() - 0.5);

    return `
        <div class="sent-task">
            <div class="sent-label">${sent.tense_label} · ${sent.hint}</div>
            <div class="sent-ru">${sent.ru}</div>
            <div class="sent-words" id="sent-words-pool">
                ${shuffled.map((w, i) => `<button class="sent-word-chip" data-word="${w}" data-idx="${i}">${w}</button>`).join('')}
            </div>
            <div class="sent-answer" id="sent-answer-area"></div>
            <div class="sent-feedback" id="sent-build-feedback"></div>
            <button class="btn btn-primary" id="sent-build-check" style="display:none;">✓ Проверить</button>
            <button class="btn btn-secondary" id="sent-build-reset">↺ Сбросить</button>
            <button class="btn btn-secondary" id="sent-build-show">👁 Показать ответ</button>
            <button class="btn btn-success" id="sent-build-next" style="display:none;">Дальше →</button>
            <div class="card-frequency">${positions.sentBuild + 1} из ${data.length}</div>
        </div>
    `;
}

function attachSentBuildHandlers() {
    const data = getFilteredSentences();
    if (data.length === 0) return;

    const sent = data[positions.sentBuild];
    const poolEl = document.getElementById('sent-words-pool');
    const answerEl = document.getElementById('sent-answer-area');
    const feedback = document.getElementById('sent-build-feedback');
    const checkBtn = document.getElementById('sent-build-check');
    const resetBtn = document.getElementById('sent-build-reset');
    const showBtn = document.getElementById('sent-build-show');
    const nextBtn = document.getElementById('sent-build-next');

    let picked = [];

    function updateUI() {
        // Pool
        poolEl.innerHTML = '';
        const poolWords = [...sent.words].sort(() => Math.random() - 0.5);
        poolWords.forEach(w => {
            const used = picked.filter(p => p === w).length;
            const available = poolWords.filter(p => p === w).length;
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip';
            btn.textContent = w;
            if (used >= available) btn.disabled = true;
            btn.onclick = () => {
                picked.push(w);
                render();
            };
            poolEl.appendChild(btn);
        });

        // Answer
        answerEl.innerHTML = '';
        picked.forEach((w, i) => {
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip picked';
            btn.textContent = w;
            btn.onclick = () => {
                picked.splice(i, 1);
                render();
            };
            answerEl.appendChild(btn);
        });

        checkBtn.style.display = picked.length === sent.words.length ? 'inline-block' : 'none';
    }

    function render() {
        // Просто перерисовываем pool/answer через updateUI
        updateUI();
    }

    // Первый рендер pool — без picked
    poolEl.innerHTML = '';
    const shuffled = [...sent.words].sort(() => Math.random() - 0.5);
    shuffled.forEach(w => {
        const btn = document.createElement('button');
        btn.className = 'sent-word-chip';
        btn.textContent = w;
        btn.onclick = () => {
            picked.push(w);
            updateUI();
        };
        poolEl.appendChild(btn);
    });

    checkBtn.onclick = () => {
        const userAnswer = picked.join(' ').trim();
        const correct = sent.words.join(' ').trim();

        if (userAnswer === correct) {
            feedback.textContent = '✓ Правильно! +10 XP';
            feedback.className = 'sent-feedback correct';
            addXP(10);
        } else {
            feedback.innerHTML = `✗ Не совсем.<br><b>Твой ответ:</b> ${userAnswer}<br><b>Правильно:</b> ${correct} (+2 XP)`;
            feedback.className = 'sent-feedback wrong';
            addXP(2);
        }
        document.querySelectorAll('.sent-word-chip').forEach(b => b.disabled = true);
        checkBtn.disabled = true;
        resetBtn.disabled = true;
        showBtn.disabled = true;
        nextBtn.style.display = 'inline-block';
    };

    resetBtn.onclick = () => {
        picked = [];
        feedback.textContent = '';
        feedback.className = 'sent-feedback';
        answerEl.innerHTML = '';
        updateUI();
    };

    showBtn.onclick = () => {
        feedback.innerHTML = `<b>Правильно:</b> ${sent.words.join(' ')}`;
        feedback.className = 'sent-feedback';
        document.querySelectorAll('.sent-word-chip').forEach(b => b.disabled = true);
        checkBtn.disabled = true;
        resetBtn.disabled = true;
        showBtn.disabled = true;
        nextBtn.style.display = 'inline-block';
    };

    nextBtn.onclick = () => {
        positions.sentBuild++;
        if (positions.sentBuild >= data.length) positions.sentBuild = 0;
        savePositions();
        renderSentences();
    };
}

// ----- Sentences: Choose tense -----
function renderSentChoose() {
    const data = getFilteredSentences();
    if (data.length < 4) {
        return '<p style="color:#888;margin-top:20px;">Нужно минимум 4 предложения.</p>';
    }

    if (positions.sentChoose >= data.length) positions.sentChoose = 0;
    const sent = data[positions.sentChoose];

    // Правильный ответ = label времени этого предложения
    const correct = sent.tense_label;

    // Собираем уникальные времена из данных и берём 3 неверных
    const allLabels = [...new Set(data.map(s => s.tense_label))];
    const wrongOptions = allLabels.filter(l => l !== correct).slice(0, 3);

    // Если уникальных времён мало — добавим «заглушки» из общего набора
    const fallback = ['Present Simple', 'Present Continuous', 'Present Perfect', 'Present Perfect Continuous', 'Past Simple', 'Future Simple'];
    for (const f of fallback) {
        if (wrongOptions.length >= 3) break;
        if (f !== correct && !wrongOptions.includes(f)) wrongOptions.push(f);
    }

    const options = [correct, ...wrongOptions.slice(0, 3)].sort(() => Math.random() - 0.5);

    return `
        <div class="sent-task">
            <div class="sent-label">Определи время</div>
            <div class="sent-en-big">${sent.en}</div>
            <button class="speak-btn" onclick="speak('${sent.en.replace(/'/g, "\\'")}')">🔊</button>
            <div class="test-options">
                ${options.map(opt => `<button class="test-option" data-answer="${opt}">${opt}</button>`).join('')}
            </div>
            <div class="sent-feedback" id="sent-choose-feedback"></div>
            <button class="btn btn-success" id="sent-choose-next" style="display:none;">Дальше →</button>
            <div class="card-frequency">${positions.sentChoose + 1} из ${data.length}</div>
        </div>
    `;
}

function attachSentChooseHandlers() {
    const data = getFilteredSentences();
    if (data.length < 4) return;

    const sent = data[positions.sentChoose];
    const correct = sent.tense_label;
    const feedback = document.getElementById('sent-choose-feedback');

    document.querySelectorAll('#content .test-option').forEach(btn => {
        btn.onclick = () => {
            const answer = btn.dataset.answer;

            if (answer === correct) {
                btn.classList.add('correct');
                feedback.textContent = `✓ Правильно! ${correct} · ${sent.hint} (+10 XP)`;
                feedback.className = 'sent-feedback correct';
                addXP(10);
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('#content .test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                feedback.textContent = `✗ Неправильно. Правильный ответ: ${correct} (+2 XP)`;
                feedback.className = 'sent-feedback wrong';
                addXP(2);
            }
            document.querySelectorAll('#content .test-option').forEach(b => b.disabled = true);
            document.getElementById('sent-choose-next').style.display = 'inline-block';
        };
    });

    document.getElementById('sent-choose-next').onclick = () => {
        positions.sentChoose++;
        if (positions.sentChoose >= data.length) positions.sentChoose = 0;
        savePositions();
        renderSentences();
    };
}

// ----- Sentences: Translate -----
function renderSentTranslate() {
    const data = getFilteredSentences();
    if (data.length === 0) {
        return '<p style="color:#888;margin-top:20px;">Нет предложений под этот фильтр.</p>';
    }

    if (positions.sentTranslate >= data.length) positions.sentTranslate = 0;
    const sent = data[positions.sentTranslate];

    return `
        <div class="sent-task">
            <div class="sent-label">${sent.tense_label} · ${sent.hint}</div>
            <div class="sent-ru-big">${sent.ru}</div>
            <input type="text" class="write-input" id="sent-translate-input" placeholder="Введи перевод..." autocomplete="off">
            <button class="btn btn-primary" id="sent-translate-check">✓ Показать эталон</button>
            <button class="btn btn-success" id="sent-translate-next" style="display:none;">Дальше →</button>
            <div class="sent-reference" id="sent-translate-ref" style="display:none;">
                <div class="sent-ref-label">Эталон:</div>
                <div class="sent-ref-en">${sent.en}</div>
                <button class="speak-btn" onclick="speak('${sent.en.replace(/'/g, "\\'")}')">🔊</button>
                <div class="sent-ref-hint">Оцени себя честно:</div>
                <button class="btn btn-success" id="sent-mark-correct">✓ Совпало (+10 XP)</button>
                <button class="btn btn-warning" id="sent-mark-partial">~ Частично (+5 XP)</button>
                <button class="btn btn-secondary" id="sent-mark-wrong">✗ Не смог (+2 XP)</button>
            </div>
            <div class="sent-feedback" id="sent-translate-feedback"></div>
            <div class="card-frequency">${positions.sentTranslate + 1} из ${data.length}</div>
        </div>
    `;
}

function attachSentTranslateHandlers() {
    const data = getFilteredSentences();
    if (data.length === 0) return;

    const sent = data[positions.sentTranslate];
    const input = document.getElementById('sent-translate-input');
    input.focus();

    document.getElementById('sent-translate-check').onclick = () => {
        const userAnswer = input.value.trim();
        if (!userAnswer) {
            alert('Сначала введи свой перевод');
            return;
        }
        document.getElementById('sent-translate-ref').style.display = 'block';
        document.getElementById('sent-translate-check').disabled = true;
        input.disabled = true;
        document.getElementById('sent-translate-next').style.display = 'inline-block';
    };

    document.getElementById('sent-mark-correct').onclick = () => {
        addXP(10);
        document.getElementById('sent-translate-feedback').textContent = '✓ +10 XP';
        document.getElementById('sent-translate-feedback').className = 'sent-feedback correct';
        document.querySelectorAll('#sent-translate-ref button').forEach(b => b.disabled = true);
    };

    document.getElementById('sent-mark-partial').onclick = () => {
        addXP(5);
        document.getElementById('sent-translate-feedback').textContent = '~ +5 XP';
        document.getElementById('sent-translate-feedback').className = 'sent-feedback';
        document.querySelectorAll('#sent-translate-ref button').forEach(b => b.disabled = true);
    };

    document.getElementById('sent-mark-wrong').onclick = () => {
        addXP(2);
        document.getElementById('sent-translate-feedback').textContent = '✗ +2 XP. Запомни эталон.';
        document.getElementById('sent-translate-feedback').className = 'sent-feedback wrong';
        document.querySelectorAll('#sent-translate-ref button').forEach(b => b.disabled = true);
    };

    document.getElementById('sent-translate-next').onclick = () => {
        positions.sentTranslate++;
        if (positions.sentTranslate >= data.length) positions.sentTranslate = 0;
        savePositions();
        renderSentences();
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('sent-translate-check').disabled) {
            document.getElementById('sent-translate-check').click();
        }
    });
}

// ===== НАВИГАЦИЯ =====
function nextCard() {
    if (currentMode === 'cards') {
        positions.cards++;
        renderCards();
        return;
    }
    const data = currentMode === 'phrases' ? getFilteredPhrases() : getFilteredVocabulary();
    if (positions[currentMode] < data.length - 1) {
        positions[currentMode]++;
    } else {
        positions[currentMode] = 0;
    }
    savePositions();
    renderMode(currentMode);
}

function prevCard() {
    if (currentMode === 'cards') {
        if (positions.cards > 0) positions.cards--;
        renderCards();
        return;
    }
    const data = currentMode === 'phrases' ? getFilteredPhrases() : getFilteredVocabulary();
    if (positions[currentMode] > 0) {
        positions[currentMode]--;
    } else {
        positions[currentMode] = data.length - 1;
    }
    savePositions();
    renderMode(currentMode);
}

function updateFooterButtons(total) {
    if (currentMode === 'test' || currentMode === 'write' ||
        currentMode === 'temporary' || currentMode === 'listening' ||
        currentMode === 'mastered' || currentMode === 'sentences') {
        document.getElementById('btn-prev').disabled = true;
        document.getElementById('btn-next').disabled = true;
        return;
    }
    document.getElementById('btn-prev').disabled = positions[currentMode] === 0;
    document.getElementById('btn-next').disabled = positions[currentMode] >= total - 1;
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.onclick = () => renderMode(btn.dataset.mode);
    });

    document.getElementById('btn-prev').onclick = prevCard;
    document.getElementById('btn-next').onclick = nextCard;

    loadData();
});
