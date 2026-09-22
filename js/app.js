// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let vocabulary = [];
let phrases = [];
let temporary = [];
let currentMode = 'cards';
let currentLevel = localStorage.getItem('level') || 'all';

// Исправление: загружаем positions и добавляем недостающие поля
let positions = JSON.parse(localStorage.getItem('positions') || '{}');
positions.cards = positions.cards || 0;
positions.test = positions.test || 0;
positions.write = positions.write || 0;
positions.phrases = positions.phrases || 0;
positions.temporary = positions.temporary || 0;
positions.listening = positions.listening || 0;

let learned = JSON.parse(localStorage.getItem('learned') || '[]');

let xp = parseInt(localStorage.getItem('xp') || '0');
let dailyXP = parseInt(localStorage.getItem('dailyXP') || '0');
let lastActiveDate = localStorage.getItem('lastActiveDate') || '';
let streak = parseInt(localStorage.getItem('streak') || '0');
let achievements = JSON.parse(localStorage.getItem('achievements') || '[]');

let srsData = JSON.parse(localStorage.getItem('srsData') || '{}');

const DAILY_GOAL = 20;
const SRS_INTERVALS = [0, 1, 2, 4, 7, 14];

let currentUser = null;

// ===== СИНХРОНИЗАЦИЯ С FIREBASE =====
async function syncToFirebase() {
    if (!currentUser || !window.firebaseSetDoc) return;
    try {
        await window.firebaseSetDoc(
            window.firebaseDoc(window.firebaseDb, 'users', currentUser.uid),
            { xp, dailyXP, lastActiveDate, streak, achievements, learned, positions, currentLevel, temporary, srsData },
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
            if (data.positions) {
                positions.cards = data.positions.cards || 0;
                positions.test = data.positions.test || 0;
                positions.write = data.positions.write || 0;
                positions.phrases = data.positions.phrases || 0;
                positions.temporary = data.positions.temporary || 0;
                positions.listening = data.positions.listening || 0;
            }
            currentLevel = data.currentLevel ?? currentLevel;
            temporary = data.temporary ?? temporary;
            srsData = data.srsData ?? srsData;

            localStorage.setItem('xp', xp.toString());
            localStorage.setItem('dailyXP', dailyXP.toString());
            localStorage.setItem('lastActiveDate', lastActiveDate);
            localStorage.setItem('streak', streak.toString());
            localStorage.setItem('achievements', JSON.stringify(achievements));
            localStorage.setItem('learned', JSON.stringify(learned));
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

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData() {
    try {
        const vocabRes = await fetch('data/vocabulary.json');
        vocabulary = await vocabRes.json();

        const phrasesRes = await fetch('data/phrases.json');
        phrases = await phrasesRes.json();

        const tempRes = await fetch('data/temporary.json');
        temporary = await tempRes.json();

        const localTemp = localStorage.getItem('temporary');
        if (localTemp) {
            try {
                const parsed = JSON.parse(localTemp);
                if (parsed.length > 0) temporary = parsed;
            } catch (e) {}
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
function getSrsData(word) {
    if (!srsData[word]) {
        srsData[word] = { level: 0, next: 0 };
    }
    return srsData[word];
}

function updateSrs(word, correct) {
    const data = getSrsData(word);
    if (correct) {
        data.level = Math.min(data.level + 1, 5);
        const days = SRS_INTERVALS[data.level];
        data.next = Date.now() + days * 24 * 60 * 60 * 1000;
    } else {
        data.level = 0;
        data.next = Date.now();
    }
    srsData[word] = data;
    localStorage.setItem('srsData', JSON.stringify(srsData));
    syncToFirebase();
}

function isDue(word) {
    const data = getSrsData(word);
    return Date.now() >= data.next;
}

function getDueWords() {
    const all = getFilteredVocabulary();
    const due = all.filter(w => isDue(w.word));
    due.sort((a, b) => {
        const aLevel = getSrsData(a.word).level;
        const bLevel = getSrsData(b.word).level;
        return aLevel - bLevel;
    });
    return due;
}

// ===== STREAK =====
function checkStreak() {
    const today = new Date().toDateString();
    if (lastActiveDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (lastActiveDate === yesterday.toDateString()) {
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
function updateStats() {
    const dueCount = getDueWords().length;
    document.getElementById('progress-info').textContent =
        `Learned: ${learned.length} / ${vocabulary.length} · Due: ${dueCount}`;
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
            positions = { cards: 0, test: 0, write: 0, phrases: 0, temporary: 0, listening: 0 };
            savePositions();
            renderLevelButtons();
            renderMode(currentMode);
        };
    });
}

function getFilteredVocabulary() {
    if (currentLevel === 'all') return vocabulary;
    return vocabulary.filter(word => {
        const idx = vocabulary.indexOf(word);
        if (currentLevel === 'A1') return idx < 300;
        if (currentLevel === 'A2') return idx >= 300 && idx < 600;
        if (currentLevel === 'B1') return idx >= 600;
        return true;
    });
}

function getFilteredPhrases() {
    if (currentLevel === 'all') return phrases;
    return phrases.filter(phrase => {
        const idx = phrases.indexOf(phrase);
        if (currentLevel === 'A1') return idx < 30;
        if (currentLevel === 'A2') return idx >= 30 && idx < 60;
        if (currentLevel === 'B1') return idx >= 60;
        return true;
    });
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

    const srs = getSrsData(word.word);
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
                <strong>Word Family:</strong> ${word.family.join(', ')}
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
        updateSrs(word.word, true);
        addXP(10);
        positions.cards = 0;
        renderCards();
        updateStats();
    };

    document.getElementById('btn-dontknow').onclick = () => {
        updateSrs(word.word, false);
        addXP(2);
        positions.cards++;
        if (positions.cards >= dueWords.length) positions.cards = 0;
        renderCards();
        updateStats();
    };

    updateFooterButtons(dueWords.length);
}

// ===== ТЕСТ =====
function renderTest() {
    const data = getFilteredVocabulary().filter(w =>
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
    while (wrongOptions.length < 3) {
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
                updateSrs(word.word, true);
                addXP(10);
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('.test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                feedback.textContent = `✗ Неправильно. Правильный ответ: ${correct} (+2 XP)`;
                feedback.className = 'test-feedback wrong';
                updateSrs(word.word, false);
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
    const data = getFilteredVocabulary();
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
            updateSrs(word.word, true);
            addXP(10);
        } else {
            feedback.textContent = `✗ Неправильно. Правильный ответ: ${word.word} (+2 XP)`;
            feedback.className = 'write-feedback wrong';
            updateSrs(word.word, false);
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
        updateSrs(word.word, false);
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
    while (wrongOptions.length < 3) {
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
    const data = getFilteredVocabulary();
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

    setTimeout(() => speak(word.word), 500);

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
            updateSrs(word.word, true);
            addXP(10);
        } else {
            feedback.textContent = `✗ Неправильно. Правильный ответ: ${word.word} (+2 XP)`;
            feedback.className = 'write-feedback wrong';
            updateSrs(word.word, false);
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
    document.getElementById('content').innerHTML = `
        <div class="temporary-header">
            <h2>📝 Temporary Words</h2>
            <button class="btn btn-primary" id="btn-add-temp">+ Add Word</button>
        </div>
        <div class="temp-form" id="temp-form" style="display: none;">
            <input type="text" id="temp-word" placeholder="English word" autocomplete="off">
            <input type="text" id="temp-translation" placeholder="Перевод" autocomplete="off">
            <input type="text" id="temp-transcription" placeholder="Транскрипция (например, [олвэйс])" autocomplete="off">
            <button class="btn btn-success" id="btn-save-temp">Save</button>
            <button class="btn btn-secondary" id="btn-cancel-temp">Cancel</button>
        </div>
        <div class="temp-list" id="temp-list">
            ${temporary.length === 0 ? '<p>No temporary words yet. Add your first word!</p>' : ''}
        </div>
    `;

    document.getElementById('btn-add-temp').onclick = () => {
        document.getElementById('temp-form').style.display = 'block';
        document.getElementById('temp-word').focus();
    };

    document.getElementById('btn-cancel-temp').onclick = () => {
        document.getElementById('temp-form').style.display = 'none';
        document.getElementById('temp-word').value = '';
        document.getElementById('temp-translation').value = '';
        document.getElementById('temp-transcription').value = '';
    };

    document.getElementById('btn-save-temp').onclick = () => {
        const word = document.getElementById('temp-word').value.trim();
        const translation = document.getElementById('temp-translation').value.trim();
        const transcription = document.getElementById('temp-transcription').value.trim();

        if (!word || !translation) {
            alert('Введи слово и перевод!');
            return;
        }

        temporary.push({
            word: word,
            translation: translation,
            transcription_ru: transcription.replace(/[\[\]]/g, ''),
            frequency: 0,
            note: '',
            example: '',
            example_translation: ''
        });

        localStorage.setItem('temporary', JSON.stringify(temporary));
        syncToFirebase();
        renderTemporary();
    };

    const listContainer = document.getElementById('temp-list');
    if (temporary.length > 0) {
        listContainer.innerHTML = temporary.map((w, i) => `
            <div class="temp-item">
                <div class="temp-item-info">
                    <strong>${w.word}</strong>
                    <button class="speak-btn" onclick="speak('${w.word.replace(/'/g, "\\'")}')">🔊</button>
                    <span class="temp-transcription">[${w.transcription_ru || ''}]</span>
                    <span class="temp-translation">${w.translation}</span>
                </div>
                <button class="btn btn-warning" onclick="deleteTempWord(${i})">🗑 Delete</button>
            </div>
        `).join('');
    }
}

function deleteTempWord(index) {
    if (!confirm('Удалить это слово?')) return;
    temporary.splice(index, 1);
    localStorage.setItem('temporary', JSON.stringify(temporary));
    syncToFirebase();
    renderTemporary();
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
    if (currentMode === 'test' || currentMode === 'write' || currentMode === 'temporary' || currentMode === 'listening') {
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
