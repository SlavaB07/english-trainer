// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let vocabulary = [];
let phrases = [];
let temporary = [];
let sentences = [];
let currentMode = 'dashboard';
let currentLevel = localStorage.getItem('level') || 'all';
let sessionProgress = JSON.parse(localStorage.getItem('sessionProgress') || '{"done": 0, "total": 0}');
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
let sentSubMode = 'build';
let sentTenseFilter = 'all';
let sentLevelFilter = 'all';
let currentTheme = 'all';
let phrasesSession = JSON.parse(localStorage.getItem('phrasesSession') || '{"done": 0, "total": 0}');
let shuffledPhrases = [];

function getShuffledPhrases() {
    if (shuffledPhrases.length === 0) {
        shuffledPhrases = shuffleArray([...phrases]);
    }
    return shuffledPhrases;
}

function resetPhrasesShuffle() {
    shuffledPhrases = [];
}
// === LEARNING PATH ===
let duoProgress = JSON.parse(localStorage.getItem('duoProgress') || '{}');
let lpExpandedTenses = JSON.parse(localStorage.getItem('lpExpandedTenses') || '[]');
let sentOrderOverride = null;
let sentReturnToLP = false;
let sentFromLP = false;
let lpQueue = [];
let lpIndex = 0;
let lpSkippedThisSession = new Set();

// === МОДУЛИ ===
let modulesData = null;
let currentModuleLevel = null; // 'A1', 'A2', ... или null (список уровней)
let currentModuleProgress = JSON.parse(localStorage.getItem('moduleProgress') || '{}');
// Структура: { "A1.1": { done_tasks: 129, total_tasks: 153, passed: false }, ... }
let levelUnlocked = JSON.parse(localStorage.getItem('levelUnlocked') || '{"A1": true}');
// Структура: { "A1": true, "A2": false, ... }
// === АКТИВНЫЙ ПОДМОДУЛЬ ===
let activeSubmodule = null; // { level, subId, tasks: [...], currentIndex: 0, errors: [] }
// === КОНТРОЛЬНАЯ ===
let activeControlTest = null; // { level, tasks: [...], currentIndex, correct, wrong, answers: [] }

let learned = JSON.parse(localStorage.getItem('learned') || '[]');
let mastered = JSON.parse(localStorage.getItem('mastered') || '[]');

let xp = parseInt(localStorage.getItem('xp') || '0');
let dailyXP = parseInt(localStorage.getItem('dailyXP') || '0');
let lastActiveDate = localStorage.getItem('lastActiveDate') || '';
let streak = parseInt(localStorage.getItem('streak') || '0');
let achievements = JSON.parse(localStorage.getItem('achievements') || '[]');
let userName = localStorage.getItem('userName') || '';

let srsData = JSON.parse(localStorage.getItem('srsData') || '{}');

const DAILY_GOAL = 20;
const SRS_INTERVALS = [0, 1, 2, 4, 7, 14];

let currentUser = null;

// ===== ТЕМА =====
function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.innerHTML = theme === 'dark'
        ? '<i data-lucide="sun"></i>'
        : '<i data-lucide="moon"></i>';
    if (window.lucide) window.lucide.createIcons();
}

function initTheme() {
    let saved = localStorage.getItem('theme');
    if (!saved || (saved !== 'light' && saved !== 'dark')) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        saved = prefersDark ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            updateThemeIcon(newTheme);
        }
    });
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

// ===== ИКОНКИ LUCIDE =====
function refreshIcons() {
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

// ===== ХЕЛПЕРЫ FAMILY/COLLOCATIONS =====
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

// ===== ХЕЛПЕР ПЕРЕВОДА =====
function getTranslation(item) {
    if (!item) return '';
    if (Array.isArray(item.translations) && item.translations.length > 0) {
        return item.translations[0];
    }
    if (typeof item.translation === 'string') {
        return item.translation;
    }
    return '';
}

function getAllTranslations(item) {
    if (!item) return [];
    if (Array.isArray(item.translations)) return item.translations;
    if (typeof item.translation === 'string') return [item.translation];
    return [];
}

// ===== FIREBASE =====
async function syncToFirebase() {
    if (!currentUser || !window.firebaseSetDoc) return;
    try {
        const payload = {
            xp, dailyXP, lastActiveDate, streak, achievements,
            learned, mastered, positions, currentLevel, srsData, userName,
            duoProgress
        };
        if (Array.isArray(temporary) && temporary.length > 0) {
            payload.temporary = temporary;
        }
        await window.firebaseSetDoc(
            window.firebaseDoc(window.firebaseDb, 'users', currentUser.uid),
            payload,
            { merge: true }
        );
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
            userName = data.userName ?? userName;
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

            if (data.duoProgress && typeof data.duoProgress === 'object') {
                const merged = { ...duoProgress };
                Object.keys(data.duoProgress).forEach(id => {
                    const remote = data.duoProgress[id] || {};
                    const local = merged[id] || {};
                    merged[id] = {
                        build: !!(local.build || remote.build),
                        translate: !!(local.translate || remote.translate)
                    };
                });
                duoProgress = merged;
            }

            localStorage.setItem('xp', xp.toString());
            localStorage.setItem('dailyXP', dailyXP.toString());
            localStorage.setItem('lastActiveDate', lastActiveDate);
            localStorage.setItem('streak', streak.toString());
            localStorage.setItem('achievements', JSON.stringify(achievements));
            localStorage.setItem('learned', JSON.stringify(learned));
            localStorage.setItem('mastered', JSON.stringify(mastered));
            localStorage.setItem('userName', userName);
            localStorage.setItem('positions', JSON.stringify(positions));
            localStorage.setItem('level', currentLevel);
            localStorage.setItem('temporary', JSON.stringify(temporary));
            localStorage.setItem('srsData', JSON.stringify(srsData));
            localStorage.setItem('duoProgress', JSON.stringify(duoProgress));

            if (currentMode === 'learning') {
                renderLearningPath();
            }
        }
    } catch (e) {
        console.error('❌ Load error:', e);
    }
}

function initFirebase() {
    if (!window.firebaseOnAuthStateChanged) return;
    window.firebaseOnAuthStateChanged(window.firebaseAuth, (user) => {
        if (user) {
            currentUser = user;
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

// ===== ЗАГРУЗКА =====
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
        } catch (e) { }

        let tempFromLocal = [];
        try {
            const localTemp = localStorage.getItem('temporary');
            if (localTemp) {
                const parsed = JSON.parse(localTemp);
                if (Array.isArray(parsed)) tempFromLocal = parsed;
            }
        } catch (e) { }

        temporary = mergeTemporary(tempFromJson, tempFromLocal);
        localStorage.setItem('temporary', JSON.stringify(temporary));

        try {
            const sentRes = await fetch('data/sentences.json');
            let loaded = await sentRes.json();
            if (!Array.isArray(loaded)) loaded = [];
            sentences = shuffleArray(loaded);
            console.log('📖 Загружено предложений:', sentences.length);
        } catch (e) {
            console.warn('sentences.json не загружен:', e);
            sentences = [];
        }
        // Загружаем модули
        try {
            const modRes = await fetch('data/modules.json');
            modulesData = await modRes.json();
            console.log('📦 Загружено модулей:', Object.keys(modulesData).length);
        } catch (e) {
            console.warn('modules.json не загружен:', e);
            modulesData = null;
        }

        checkStreak();
        updateStats();
        renderLevelButtons();
        renderMode('dashboard');

        initFirebase();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        document.getElementById('content').innerHTML =
            '<p style="color: red;">Ошибка загрузки данных.</p>';
    }
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ===== SRS =====
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

// ===== DUO PROGRESS =====
function markDuoDone(sentId, skill) {
    if (!skill) return;
    if (!duoProgress[sentId]) {
        duoProgress[sentId] = { build: false, translate: false };
    }
    if ('choose' in duoProgress[sentId]) {
        delete duoProgress[sentId].choose;
    }
    if (duoProgress[sentId][skill] === true) return;
    duoProgress[sentId][skill] = true;
    localStorage.setItem('duoProgress', JSON.stringify(duoProgress));
    syncToFirebase();
}

function isDuoDone(sentId) {
    const p = duoProgress[sentId];
    return !!(p && p.build && p.translate);
}

function getTenseProgress(tense) {
    const items = sentences.filter(s => s.tense === tense);
    const done = items.filter(s => isDuoDone(s.id)).length;
    return { done, total: items.length };
}

function getLevelProgress(tense, level) {
    const items = sentences.filter(s => s.tense === tense && s.level === level);
    const done = items.filter(s => isDuoDone(s.id)).length;
    return { done, total: items.length };
}

function getBlockProgress(tenseKeys) {
    const items = sentences.filter(s => tenseKeys.includes(s.tense));
    const done = items.filter(s => isDuoDone(s.id)).length;
    return { done, total: items.length };
}

function getBlockName(block) {
    if (block === 'present') return { label: 'Present', emoji: '🟢', color: 'green' };
    if (block === 'past') return { label: 'Past', emoji: '🟡', color: 'amber' };
    if (block === 'future') return { label: 'Future', emoji: '🔴', color: 'red' };
    return { label: block, emoji: '⚪', color: 'gray' };
}

function getTensesInBlock(block) {
    const order = ['simple', 'continuous', 'perfect', 'perfect_continuous'];
    const all = sentences
        .filter(s => s.tense.startsWith(block + '_'))
        .reduce((acc, s) => {
            if (!acc.find(t => t.key === s.tense)) {
                acc.push({ key: s.tense, label: s.tense_label });
            }
            return acc;
        }, []);

    all.sort((a, b) => {
        const aSuf = a.key.replace(block + '_', '');
        const bSuf = b.key.replace(block + '_', '');
        const ai = order.indexOf(aSuf);
        const bi = order.indexOf(bSuf);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return all;
}

function getBlockKeys() {
    return ['present', 'past', 'future'];
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
        if (srsData[word]) {
            srsData[word] = { level: 0, next: 0 };
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
            streak += 1;
        } else if (lastActiveDate !== '') {
            streak = 1;
        } else {
            streak = 1;
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
    const dueCount = getDueWords().length;

    const xpEl = document.getElementById('xp-info');
    const streakEl = document.getElementById('streak-info');
    const levelEl = document.getElementById('level-info');
    if (xpEl) xpEl.textContent = `${xp} XP`;
    if (streakEl) streakEl.textContent = streak;
    if (levelEl) levelEl.textContent = getLevelName();

    const greeting = document.getElementById('topbar-greeting');
    if (greeting) {
        greeting.textContent = userName ? `Привет, ${userName}! 👋` : 'Привет! 👋';
    }
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

// ===== УРОВНИ =====
function renderLevelButtons() {
    const container = document.getElementById('level-buttons');
    if (!container) return;

    const levels = ['all', 'A1', 'A2', 'B1', 'B2', 'C1'];
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
            resetShuffle();
            sessionProgress = { done: 0, total: 0 };
            localStorage.removeItem('sessionProgress');
            phrasesSession = { done: 0, total: 0 };
            localStorage.removeItem('phrasesSession');
            savePositions();
            renderLevelButtons();
            renderMode(currentMode);
            updateStats();
        };
    });
}

let shuffledVocab = [];

function getFilteredVocabulary() {
    if (shuffledVocab.length === 0) {
        shuffledVocab = shuffleArray([...vocabulary]);
    }
    if (currentLevel === 'all') return shuffledVocab;
    return shuffledVocab.filter(w => w.level === currentLevel);
}

function resetShuffle() {
    shuffledVocab = [];
}

function getFilteredPhrases() {
    let arr = getShuffledPhrases();
    if (currentLevel !== 'all') {
        arr = arr.filter(p => !p.level || p.level === currentLevel);
    }
    if (currentTheme !== 'all') {
        arr = arr.filter(p => p.theme === currentTheme);
    }
    return arr;
}

// ===== НАВИГАЦИЯ =====
function setActiveNav(mode) {
    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
}

function renderMode(mode) {
    if (mode !== 'sentences' && mode !== 'learning') {
        sentOrderOverride = null;
    }

    currentMode = mode;
    setActiveNav(mode);

    if (mode === 'dashboard') renderDashboard();
    else if (mode === 'learning') renderLearningPath();
    else if (mode === 'cards') renderCards();
    else if (mode === 'test') renderTest();
    else if (mode === 'write') renderWrite();
    else if (mode === 'phrases') renderPhrases();
    else if (mode === 'temporary') renderTemporary();
    else if (mode === 'listening') renderListening();
    else if (mode === 'mastered') renderMastered();
    else if (mode === 'sentences') renderSentences();
    else if (mode === 'profile') renderProfile();

    refreshIcons();
}

// ===== DASHBOARD =====
function renderDashboard() {
    const dueCount = getDueWords().length;
    const levelTotal = getLevelTotal();
    const levelLearned = getLevelLearnedCount();
    const progressPct = levelTotal > 0 ? Math.round((levelLearned / levelTotal) * 100) : 0;
    const dashoffset = 188.5 - (188.5 * progressPct / 100);

    const mascotHero = `
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="catBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#FFFFFF"/>
                    <stop offset="100%" stop-color="#E8ECFF"/>
                </linearGradient>
                <linearGradient id="catEar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#A5B4FC"/>
                    <stop offset="100%" stop-color="#818CF8"/>
                </linearGradient>
            </defs>
            <ellipse cx="100" cy="175" rx="55" ry="8" fill="rgba(0,0,0,0.15)"/>
            <path d="M55 90 Q55 50 75 35 L85 60 Q100 55 115 60 L125 35 Q145 50 145 90 Q145 145 100 145 Q55 145 55 90 Z" fill="url(#catBody)"/>
            <path d="M55 90 Q50 80 52 70 Q60 72 65 80 Z" fill="url(#catEar)"/>
            <path d="M145 90 Q150 80 148 70 Q140 72 135 80 Z" fill="url(#catEar)"/>
            <ellipse cx="80" cy="95" rx="4" ry="6" fill="#1A1D2E"/>
            <ellipse cx="120" cy="95" rx="4" ry="6" fill="#1A1D2E"/>
            <circle cx="81.5" cy="93" r="1.5" fill="#fff"/>
            <circle cx="121.5" cy="93" r="1.5" fill="#fff"/>
            <path d="M95 110 Q100 115 105 110" stroke="#1A1D2E" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M92 108 L92 118 M100 110 L100 120 M108 108 L108 118" stroke="#1A1D2E" stroke-width="1.5" stroke-linecap="round"/>
            <ellipse cx="65" cy="105" rx="6" ry="4" fill="#F472B6" opacity="0.5"/>
            <ellipse cx="135" cy="105" rx="6" ry="4" fill="#F472B6" opacity="0.5"/>
            <rect x="40" y="55" width="120" height="8" rx="4" fill="#5B5FE9"/>
            <rect x="45" y="48" width="30" height="20" rx="8" fill="#5B5FE9"/>
            <rect x="125" y="48" width="30" height="20" rx="8" fill="#5B5FE9"/>
            <rect x="35" y="40" width="130" height="16" rx="8" fill="#7C80F5"/>
            <rect x="85" y="138" width="30" height="22" rx="4" fill="#5B5FE9"/>
            <rect x="90" y="143" width="20" height="12" rx="2" fill="#EEF0FE"/>
            <circle cx="100" cy="149" r="2" fill="#5B5FE9"/>
        </svg>
    `;

    const mascotSmall = `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M28 45 Q28 22 38 16 L44 32 Q50 30 56 32 L62 16 Q72 22 72 45 Q72 70 50 70 Q28 70 28 45 Z" fill="#FFFFFF"/>
            <path d="M28 45 Q25 40 26 34 Q31 36 34 40 Z" fill="#FBBF24"/>
            <path d="M72 45 Q75 40 74 34 Q69 36 66 40 Z" fill="#FBBF24"/>
            <ellipse cx="41" cy="48" rx="2.5" ry="3.5" fill="#1A1D2E"/>
            <ellipse cx="59" cy="48" rx="2.5" ry="3.5" fill="#1A1D2E"/>
            <path d="M47 56 Q50 58.5 53 56" stroke="#1A1D2E" stroke-width="1.2" fill="none" stroke-linecap="round"/>
            <rect x="20" y="27" width="60" height="4" rx="2" fill="#5B5FE9"/>
            <rect x="22" y="24" width="15" height="10" rx="4" fill="#5B5FE9"/>
            <rect x="63" y="24" width="15" height="10" rx="4" fill="#5B5FE9"/>
        </svg>
    `;

    document.getElementById('content').innerHTML = `
        <div class="dash-wrap">
            <div class="dash-main">
                <div class="dash-hero">
                    <div class="dash-hero-content">
                        <div class="dash-hero-title">Время учить английский! 🚀</div>
                        <div class="dash-hero-subtitle">Новые слова, полезные фразы и уверенность в каждом разговоре.</div>
                        <button class="dash-hero-btn" onclick="renderMode('cards')">
                            <i data-lucide="play"></i>
                            Начать обучение
                        </button>
                    </div>
                    <div class="dash-hero-mascot">${mascotHero}</div>
                </div>

                <div class="dash-section">
                    <div class="dash-section-header">
                        <div class="dash-section-title">Выбери, с чего начать</div>
                        <div class="dash-section-meta">🔥 Цель дня: ${DAILY_GOAL} XP</div>
                    </div>
                    <div class="dash-actions">
                        <div class="dash-action i-cards" onclick="renderMode('cards')">
                            <div class="dash-action-icon"><i data-lucide="layers"></i></div>
                            <div class="dash-action-title">Карточки</div>
                            <div class="dash-action-sub">Слова и выражения</div>
                        </div>
                        <div class="dash-action i-write" onclick="renderMode('write')">
                            <div class="dash-action-icon"><i data-lucide="pencil"></i></div>
                            <div class="dash-action-title">Письмо</div>
                            <div class="dash-action-sub">Пиши правильно</div>
                        </div>
                        <div class="dash-action i-grammar" onclick="renderMode('sentences')">
                            <div class="dash-action-icon"><i data-lucide="book-open"></i></div>
                            <div class="dash-action-title">Грамматика</div>
                            <div class="dash-action-sub">Правила и времена</div>
                        </div>
                        <div class="dash-action i-listen" onclick="renderMode('listening')">
                            <div class="dash-action-icon"><i data-lucide="headphones"></i></div>
                            <div class="dash-action-title">Аудирование</div>
                            <div class="dash-action-sub">Слушай и понимай</div>
                        </div>
                        <div class="dash-action i-phrases" onclick="renderMode('phrases')">
                            <div class="dash-action-icon"><i data-lucide="message-circle"></i></div>
                            <div class="dash-action-title">Фразы</div>
                            <div class="dash-action-sub">Полезные выражения</div>
                        </div>
                        <div class="dash-action i-temp" onclick="renderMode('temporary')">
                            <div class="dash-action-icon"><i data-lucide="clock"></i></div>
                            <div class="dash-action-title">Временные</div>
                            <div class="dash-action-sub">Свои слова</div>
                        </div>
                    </div>
                </div>

                <div class="dash-section">
                    <div class="dash-continue">
                        <div class="dash-continue-progress">
                            <svg viewBox="0 0 72 72">
                                <circle class="dash-continue-progress-track" cx="36" cy="36" r="30"></circle>
                                <circle class="dash-continue-progress-fill" cx="36" cy="36" r="30"
                                    stroke-dasharray="188.5"
                                    stroke-dashoffset="${dashoffset}"></circle>
                            </svg>
                            <div class="dash-continue-num">${progressPct}%</div>
                        </div>
                        <div class="dash-continue-info">
                            <div class="dash-continue-title">Основной словарь</div>
                            <div class="dash-continue-sub">
                                ${levelLearned} / ${levelTotal} слов · ${dueCount} на повторение
                            </div>
                            <div class="dash-continue-actions">
                                <button class="btn btn-primary" onclick="renderMode('cards')" style="min-width:auto;">
                                    <i data-lucide="play"></i> Продолжить
                                </button>
                                <button class="btn btn-secondary" onclick="renderMode('mastered')" style="min-width:auto;">
                                    🏆 Mastered (${mastered.length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="dash-side">
                <div class="dash-card">
                    <div class="dash-card-title">Твоя статистика</div>
                    <div class="dash-stat-main">
                        <div class="dash-stat-main-icon"><i data-lucide="zap"></i></div>
                        <div>
                            <div class="dash-stat-main-num">${xp}</div>
                            <div class="dash-stat-main-label">Текущий опыт</div>
                        </div>
                    </div>
                    <div class="dash-stat-rows">
                        <div class="dash-stat-row">
                            <div class="dash-stat-row-left"><i data-lucide="flame"></i> Дней подряд</div>
                            <div class="dash-stat-row-value">${streak}</div>
                        </div>
                        <div class="dash-stat-row">
                            <div class="dash-stat-row-left"><i data-lucide="book"></i> Изучено слов</div>
                            <div class="dash-stat-row-value">${levelLearned}</div>
                        </div>
                        <div class="dash-stat-row">
                            <div class="dash-stat-row-left"><i data-lucide="trophy"></i> Mastered</div>
                            <div class="dash-stat-row-value">${mastered.length}</div>
                        </div>
                        <div class="dash-stat-row">
                            <div class="dash-stat-row-left"><i data-lucide="award"></i> Уровень</div>
                            <div class="dash-stat-row-value">${getLevelName()}</div>
                        </div>
                    </div>
                </div>

                <div class="dash-quote">
                    <div class="dash-quote-icon">"</div>
                    <div class="dash-quote-text">Лучший способ предсказать будущее — создать его.</div>
                    <div class="dash-quote-author">— Abraham Lincoln</div>
                </div>

                <div class="dash-motivation">
                    <div class="dash-motivation-mascot">${mascotSmall}</div>
                    <div class="dash-motivation-text">У тебя всё получится!</div>
                </div>
            </div>
        </div>
    `;

    refreshIcons();
}

// ===== CARDS =====
function renderCards() {
    const dueWords = getDueWords();

    if (sessionProgress.total === 0) {
        sessionProgress.total = dueWords.length;
        localStorage.setItem('sessionProgress', JSON.stringify(sessionProgress));
    }

    if (dueWords.length === 0) {
        document.getElementById('content').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="party-popper"></i></div>
                <div class="empty-title">Всё повторено! 🎉</div>
                <div class="empty-text">На сегодня нет слов для повторения.<br>Возвращайся позже или добавь новые слова.</div>
                <div class="empty-actions">
                    <button class="btn btn-primary" onclick="renderMode('temporary')">
                        <i data-lucide="plus"></i> Добавить слова
                    </button>
                    <button class="btn btn-secondary" onclick="renderMode('sentences')">
                        <i data-lucide="book-open"></i> Грамматика
                    </button>
                </div>
            </div>
        `;
        refreshIcons();
        return;
    }

    // Восстанавливаем последнее слово
    let lastWordCard = localStorage.getItem('lastWordCard') || '';
    if (lastWordCard) {
        const idx = dueWords.findIndex(w => w.word === lastWordCard);
        if (idx !== -1) positions.cards = idx;
    }

    if (positions.cards >= dueWords.length) positions.cards = 0;
    const word = dueWords[positions.cards];

    const srs = getSrsData(word.word, false);
    const transText = word.transcription_ru
        ? `<span class="card-transcription">[${word.transcription_ru}]</span>`
        : (word.ipa ? `<span class="card-transcription">${word.ipa}</span>` : '');

    const posText = word.pos ? `<span class="card-pos">${word.pos}</span>` : '';

    let hiddenContent = `<div class="card-translation">${word.translation}</div>`;
    if (word.note) hiddenContent += `<div class="card-note">${word.note}</div>`;
    if (word.example) {
        hiddenContent += `
            <div class="card-example">
                <div class="example-en">${word.example}</div>
                <div class="example-ru">${word.example_translation || ''}</div>
            </div>
        `;
    }

    //if (word.family && word.family.length > 0) {
    //    hiddenContent += `<div class="card-family"><strong>Word Family:</strong> ${formatFamily(word.family)}</div>`;
    //}
    //if (word.collocations && word.collocations.length > 0) {
    //    hiddenContent += `<div class="card-collocations"><strong>Collocations:</strong> ${formatCollocations(word.collocations)}</div>`;
    //}

    const progressPct = sessionProgress.total > 0
        ? Math.round(((sessionProgress.done + 1) / sessionProgress.total) * 100)
        : 0;

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="mode-progress">
                <div class="mode-progress-info">
                                        <span class="mode-progress-label">Карточка ${sessionProgress.done + 1} из ${sessionProgress.total}</span>
                    <span class="mode-progress-pct">${progressPct}%</span>
                </div>
                <div class="mode-progress-bar">
                    <div class="mode-progress-fill" style="width:${progressPct}%"></div>
                </div>
            </div>

            <div class="card mode-card">
                <div class="card-srs">
                    <i data-lucide="bar-chart-3"></i>
                    SRS Level ${srs.level}/5
                </div>
                <div class="card-word">
                    ${word.word}
                    <button class="speak-btn" onclick="speak('${word.word.replace(/'/g, "\\'")}')">
                        <i data-lucide="volume-2"></i>
                    </button>
                </div>
                <div class="card-meta">${transText} ${posText}</div>

                <div id="hidden-content" class="card-hidden" style="display: none;">
                    ${hiddenContent}
                </div>

                <div id="buttons-before" class="card-actions">
                    <button class="btn btn-primary btn-lg" id="btn-show">
                        <i data-lucide="eye"></i> Показать перевод
                    </button>
                    <button class="btn btn-secondary" onclick="renderMode('test')">
                        <i data-lucide="check-circle-2"></i> Режим теста
                    </button>
                </div>

                <div id="buttons-after" class="card-actions" style="display: none;">
                    <button class="btn btn-success" id="btn-learned">
                        <i data-lucide="check"></i> Выучил <span class="xp-tag">+10 XP</span>
                    </button>
                    <button class="btn btn-warning" id="btn-dontknow">
                        <i data-lucide="x"></i> Не знаю
                    </button>
                    <button class="btn btn-master" id="btn-master">
                        <i data-lucide="check-check"></i> Навсегда <span class="xp-tag">+20 XP</span>
                    </button>
                </div>

                <div class="card-frequency">
                    <i data-lucide="activity"></i> Частота: ${word.frequency}
                </div>
            </div>
        </div>
    `;

    document.getElementById('btn-show').onclick = () => {
        document.getElementById('hidden-content').style.display = 'block';
        document.getElementById('buttons-before').style.display = 'none';
        document.getElementById('buttons-after').style.display = 'flex';
        refreshIcons();
    };

    document.getElementById('btn-learned').onclick = () => {
        sessionProgress.done++;
        localStorage.setItem('sessionProgress', JSON.stringify(sessionProgress));
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
        sessionProgress.done++;
        localStorage.setItem('sessionProgress', JSON.stringify(sessionProgress));
        updateSrs(word.word, false, false);
        addXP(2);
        positions.cards++;
        if (positions.cards >= dueWords.length) positions.cards = 0;
        renderCards();
        updateStats();
    };

    document.getElementById('btn-master').onclick = () => {
        sessionProgress.done++;
        localStorage.setItem('sessionProgress', JSON.stringify(sessionProgress));
        addMastered(word.word);
        addXP(20);
        positions.cards = 0;
        renderCards();
        updateStats();
    };

    refreshIcons();
}

// ===== TEST =====
function renderTest() {
    const data = getFilteredVocabulary().filter(w =>
        !isMastered(w.word) &&
        !w.translation.includes(';') &&
        !w.translation.includes(',') &&
        w.translation.length > 2
    );

    if (data.length < 4) {
        document.getElementById('content').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="alert-circle"></i></div>
                <div class="empty-title">Недостаточно слов</div>
                <div class="empty-text">Для теста нужно минимум 4 слова в текущем уровне.</div>
            </div>
        `;
        refreshIcons();
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

    const progressPct = Math.round(((positions.test + 1) / data.length) * 100);

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="mode-progress">
                <div class="mode-progress-info">
                    <span class="mode-progress-label">Тест ${positions.test + 1} из ${data.length}</span>
                    <span class="mode-progress-pct">${progressPct}%</span>
                </div>
                <div class="mode-progress-bar">
                    <div class="mode-progress-fill" style="width:${progressPct}%"></div>
                </div>
            </div>

            <div class="mode-card">
                <div class="test-question">
                    ${word.word}
                    <button class="speak-btn" onclick="speak('${word.word.replace(/'/g, "\\'")}')">
                        <i data-lucide="volume-2"></i>
                    </button>
                </div>
                <div class="card-meta">
                    ${transText}
                    ${word.pos ? `<span class="card-pos">${word.pos}</span>` : ''}
                </div>
                <div class="test-options">
                    ${options.map(opt => `<button class="test-option" data-answer="${opt}">${opt}</button>`).join('')}
                </div>
                <div class="test-feedback" id="test-feedback"></div>
                <button class="btn btn-success btn-lg" id="btn-next-test" style="display: none;">
                    Дальше <i data-lucide="arrow-right"></i>
                </button>
            </div>
        </div>
    `;

    document.querySelectorAll('.test-option').forEach(btn => {
        btn.onclick = () => {
            const answer = btn.dataset.answer;
            const feedback = document.getElementById('test-feedback');

            if (answer === correct) {
                btn.classList.add('correct');
                feedback.innerHTML = '<i data-lucide="check-circle"></i> Правильно! +10 XP';
                feedback.className = 'test-feedback correct';
                updateSrs(word.word, true, false);
                addXP(10);
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('.test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                feedback.innerHTML = `<i data-lucide="x-circle"></i> Правильный ответ: ${correct} (+2 XP)`;
                feedback.className = 'test-feedback wrong';
                updateSrs(word.word, false, false);
                addXP(2);
            }
            document.querySelectorAll('.test-option').forEach(b => b.disabled = true);
            document.getElementById('btn-next-test').style.display = 'inline-flex';
            refreshIcons();
        };
    });

    document.getElementById('btn-next-test').onclick = () => {
        positions.test++;
        if (positions.test >= data.length) positions.test = 0;
        savePositions();
        renderTest();
    };

    refreshIcons();
}

// ===== WRITE =====
function renderWrite() {
    const data = getFilteredVocabulary().filter(w => !isMastered(w.word));
    if (data.length === 0) {
        document.getElementById('content').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="inbox"></i></div>
                <div class="empty-title">Нет слов</div>
                <div class="empty-text">Для этого уровня нет доступных слов.</div>
            </div>
        `;
        refreshIcons();
        return;
    }

    if (positions.write >= data.length) positions.write = 0;
    const word = data[positions.write];
    const progressPct = Math.round(((positions.write + 1) / data.length) * 100);

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="mode-progress">
                <div class="mode-progress-info">
                    <span class="mode-progress-label">Письмо ${positions.write + 1} из ${data.length}</span>
                    <span class="mode-progress-pct">${progressPct}%</span>
                </div>
                <div class="mode-progress-bar">
                    <div class="mode-progress-fill" style="width:${progressPct}%"></div>
                </div>
            </div>

            <div class="mode-card write-card">
                <div class="write-prompt">
                    <div class="write-prompt-label">Переведи на английский:</div>
                    <div class="write-prompt-word">${word.translation}</div>
                                        <div class="write-prompt-hint">
                        <i data-lucide="lightbulb"></i>
                        ${word.word.length} букв
                    </div>
                </div>

                <input type="text" class="write-input" id="write-input" placeholder="Введи слово на английском..." autocomplete="off" autocapitalize="off" spellcheck="false">

                <div class="card-actions">
                    <button class="btn btn-primary btn-lg" id="btn-check">
                        <i data-lucide="check"></i> Проверить
                    </button>
                    <button class="btn btn-secondary" id="btn-show-answer">
                        <i data-lucide="eye"></i> Показать ответ
                    </button>
                </div>

                <button class="btn btn-success btn-lg" id="btn-next-write" style="display: none;">
                    Дальше <i data-lucide="arrow-right"></i>
                </button>

                <div class="write-feedback" id="write-feedback"></div>
            </div>
        </div>
    `;

    const input = document.getElementById('write-input');
    input.focus();

    document.getElementById('btn-check').onclick = () => {
        const answer = input.value.trim().toLowerCase();
        const feedback = document.getElementById('write-feedback');

        if (answer === word.word.toLowerCase()) {
            feedback.innerHTML = '<i data-lucide="check-circle"></i> Правильно! +10 XP';
            feedback.className = 'write-feedback correct';
            updateSrs(word.word, true, false);
            addXP(10);
        } else {
            feedback.innerHTML = `<i data-lucide="x-circle"></i> Правильный ответ: <b>${word.word}</b> (+2 XP)`;
            feedback.className = 'write-feedback wrong';
            updateSrs(word.word, false, false);
            addXP(2);
        }
        document.getElementById('btn-check').disabled = true;
        document.getElementById('btn-show-answer').disabled = true;
        input.disabled = true;
        document.getElementById('btn-next-write').style.display = 'inline-flex';
        refreshIcons();
    };

    document.getElementById('btn-show-answer').onclick = () => {
        document.getElementById('write-feedback').innerHTML = `<i data-lucide="eye"></i> Правильный ответ: <b>${word.word}</b>`;
        document.getElementById('write-feedback').className = 'write-feedback';
        document.getElementById('btn-check').disabled = true;
        document.getElementById('btn-show-answer').disabled = true;
        input.disabled = true;
        document.getElementById('btn-next-write').style.display = 'inline-flex';
        updateSrs(word.word, false, false);
        addXP(2);
        refreshIcons();
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

    refreshIcons();
}

// ===== PHRASES =====
function getPhraseThemes() {
    const counts = {};
    phrases.forEach(p => {
        const t = p.theme || 'other';
        counts[t] = (counts[t] || 0) + 1;
    });
    // Сортируем по количеству
    const sorted = Object.entries(counts)
        .filter(([t, c]) => c >= 20)  // только темы >= 20
        .sort((a, b) => b[1] - a[1]);
    return sorted.map(([t, c]) => ({ theme: t, count: c }));
}

function renderPhrases() {
    const allWithTranslation = phrases.filter(p => getTranslation(p));
    const data = getFilteredPhrases().filter(p => getTranslation(p));
    // Инициализация сессии
    if (phrasesSession.total === 0) {
        phrasesSession.total = data.length;
        localStorage.setItem('phrasesSession', JSON.stringify(phrasesSession));
    }

    if (data.length < 4) {
        document.getElementById('content').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="message-circle"></i></div>
                <div class="empty-title">Недостаточно фраз</div>
                <div class="empty-text">Для этого уровня нужно минимум 4 фразы с переводом.</div>
            </div>
        `;
        refreshIcons();
        return;
    }

    if (positions.phrases >= data.length) positions.phrases = 0;
    const phrase = data[positions.phrases];
    const correct = getTranslation(phrase);

    const wrongOptions = [];
    let guard = 0;
    while (wrongOptions.length < 3 && guard < 500) {
        guard++;
        const randomPhrase = allWithTranslation[Math.floor(Math.random() * allWithTranslation.length)];
        const tr = getTranslation(randomPhrase);
        if (tr && tr !== correct && !wrongOptions.includes(tr)) {
            wrongOptions.push(tr);
        }
    }

    const options = [correct, ...wrongOptions].sort(() => Math.random() - 0.5);
    const progressPct = phrasesSession.total > 0
        ? Math.round(((phrasesSession.done + 1) / phrasesSession.total) * 100)
        : 0;
    // === КНОПКИ ТЕМ ===
    const themes = getPhraseThemes();
    const themeChips = `
        <button class="theme-chip ${currentTheme === 'all' ? 'active' : ''}" data-theme="all">
            All · ${phrases.filter(p => getTranslation(p)).length}
        </button>
        ${themes.map(t => `
            <button class="theme-chip ${currentTheme === t.theme ? 'active' : ''}" data-theme="${t.theme}">
                ${t.theme} · ${t.count}
            </button>
        `).join('')}
    `;
    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="mode-progress">
                <div class="mode-progress-info">
                    <span class="mode-progress-label">Фраза ${phrasesSession.done + 1} из ${phrasesSession.total}</span>
                    <span class="mode-progress-pct">${progressPct}%</span>
                </div>
                <div class="mode-progress-bar">
                    <div class="mode-progress-fill" style="width:${progressPct}%"></div>
                </div>
            </div>
            
            <div class="theme-chips-row">${themeChips}</div>

            <div class="mode-card">
                <div class="mode-badge">
                    <i data-lucide="message-square-quote"></i> Что это значит?
                </div>
                <div class="test-question">
                    ${phrase.phrase}
                    <button class="speak-btn" onclick="speak('${phrase.phrase.replace(/'/g, "\\'")}')">
                        <i data-lucide="volume-2"></i>
                    </button>
                </div>
                <div class="test-options">
                    ${options.map(opt => `<button class="test-option" data-answer="${opt}">${opt}</button>`).join('')}
                </div>
                <div class="test-feedback" id="test-feedback"></div>
                <button class="btn btn-success btn-lg" id="btn-next-phrase" style="display: none;">
                    Дальше <i data-lucide="arrow-right"></i>
                </button>
            </div>
        </div>
    `;

    document.querySelectorAll('.test-option').forEach(btn => {
        btn.onclick = () => {
            const answer = btn.dataset.answer;
            const feedback = document.getElementById('test-feedback');

            if (answer === correct) {
                btn.classList.add('correct');
                feedback.innerHTML = '<i data-lucide="check-circle"></i> Правильно! +10 XP';
                feedback.className = 'test-feedback correct';
                addXP(10);
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('.test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                feedback.innerHTML = `<i data-lucide="x-circle"></i> Правильный ответ: ${correct} (+2 XP)`;
                feedback.className = 'test-feedback wrong';
                addXP(2);
            }
            document.querySelectorAll('.test-option').forEach(b => b.disabled = true);
            document.getElementById('btn-next-phrase').style.display = 'inline-flex';
            refreshIcons();
        };
    });

    document.getElementById('btn-next-phrase').onclick = () => {
        phrasesSession.done++;
        localStorage.setItem('phrasesSession', JSON.stringify(phrasesSession));
        positions.phrases++;
        if (positions.phrases >= data.length) positions.phrases = 0;
        savePositions();
        renderPhrases();
    };

    // === ОБРАБОТЧИКИ ТЕМ ===
    document.querySelectorAll('.theme-chip').forEach(btn => {
        btn.onclick = () => {
            currentTheme = btn.dataset.theme;
            positions.phrases = 0;
            phrasesSession = { done: 0, total: 0 };
            localStorage.removeItem('phrasesSession');
            resetPhrasesShuffle();
            resetPhrasesShuffle();
            savePositions();
            renderPhrases();
        };
    });

    refreshIcons();
}

// ===== LISTENING =====
function renderListening() {
    const data = getFilteredVocabulary().filter(w => !isMastered(w.word));
    if (data.length === 0) {
        document.getElementById('content').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="headphones"></i></div>
                <div class="empty-title">Нет слов</div>
                <div class="empty-text">Для этого уровня нет доступных слов.</div>
            </div>
        `;
        refreshIcons();
        return;
    }

    if (positions.listening >= data.length) positions.listening = 0;
    const word = data[positions.listening];
    const progressPct = Math.round(((positions.listening + 1) / data.length) * 100);

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="mode-progress">
                <div class="mode-progress-info">
                    <span class="mode-progress-label">Аудирование ${positions.listening + 1} из ${data.length}</span>
                    <span class="mode-progress-pct">${progressPct}%</span>
                </div>
                <div class="mode-progress-bar">
                    <div class="mode-progress-fill" style="width:${progressPct}%"></div>
                </div>
            </div>

            <div class="mode-card listen-card">
                <div class="mode-badge">
                    <i data-lucide="ear"></i> Слушай и пиши
                </div>

                <button class="listen-big-btn" onclick="speak('${word.word.replace(/'/g, "\\'")}')">
                    <i data-lucide="volume-2"></i>
                </button>

                <div class="listen-hint">Нажми на кнопку и слушай слово</div>

                <input type="text" class="write-input" id="listen-input" placeholder="Введи слово..." autocomplete="off" autocapitalize="off" spellcheck="false">

                <div class="card-actions">
                    <button class="btn btn-primary btn-lg" id="btn-listen-check">
                        <i data-lucide="check"></i> Проверить
                    </button>
                    <button class="btn btn-secondary" id="btn-listen-play">
                        <i data-lucide="volume-2"></i> Повторить
                    </button>
                </div>

                <button class="btn btn-success btn-lg" id="btn-next-listen" style="display: none;">
                    Дальше <i data-lucide="arrow-right"></i>
                </button>

                <div class="write-feedback" id="listen-feedback"></div>
            </div>
        </div>
    `;

    const input = document.getElementById('listen-input');
    input.focus();

    document.getElementById('btn-listen-play').onclick = () => speak(word.word);

    document.getElementById('btn-listen-check').onclick = () => {
        const answer = input.value.trim().toLowerCase();
        const feedback = document.getElementById('listen-feedback');

        if (answer === word.word.toLowerCase()) {
            feedback.innerHTML = '<i data-lucide="check-circle"></i> Правильно! +10 XP';
            feedback.className = 'write-feedback correct';
            updateSrs(word.word, true, false);
            addXP(10);
        } else {
            feedback.innerHTML = `<i data-lucide="x-circle"></i> Правильный ответ: <b>${word.word}</b> (+2 XP)`;
            feedback.className = 'write-feedback wrong';
            updateSrs(word.word, false, false);
            addXP(2);
        }
        document.getElementById('btn-listen-check').disabled = true;
        input.disabled = true;
        document.getElementById('btn-next-listen').style.display = 'inline-flex';
        refreshIcons();
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

    refreshIcons();
}

// ===== TEMPORARY =====
function renderTemporary() {
    const subNav = `
        <div class="subnav">
            <button class="subnav-btn ${tempSubMode === 'list' ? 'active' : ''}" data-sub="list">
                <i data-lucide="list"></i> Список
            </button>
            <button class="subnav-btn ${tempSubMode === 'cards' ? 'active' : ''}" data-sub="cards">
                <i data-lucide="layers"></i> Карточки
            </button>
            <button class="subnav-btn ${tempSubMode === 'test' ? 'active' : ''}" data-sub="test">
                <i data-lucide="check-circle-2"></i> Тест
            </button>
            <button class="subnav-btn ${tempSubMode === 'write' ? 'active' : ''}" data-sub="write">
                <i data-lucide="pencil"></i> Написание
            </button>
        </div>
    `;

    let bodyHtml = '';
    if (tempSubMode === 'list') bodyHtml = renderTempList();
    else if (tempSubMode === 'cards') bodyHtml = renderTempCards();
    else if (tempSubMode === 'test') bodyHtml = renderTempTest();
    else if (tempSubMode === 'write') bodyHtml = renderTempWrite();

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="list-header">
                <div>
                    <div class="list-title">
                        <i data-lucide="clock"></i> Temporary Words
                    </div>
                    <div class="list-subtitle">${temporary.length} слов в твоём списке</div>
                </div>
            </div>
            ${subNav}
            ${bodyHtml}
        </div>
    `;

    document.querySelectorAll('.subnav-btn').forEach(btn => {
        btn.onclick = () => {
            tempSubMode = btn.dataset.sub;
            renderTemporary();
        };
    });

    if (tempSubMode === 'list') attachTempListHandlers();
    else if (tempSubMode === 'cards') attachTempCardsHandlers();
    else if (tempSubMode === 'test') attachTempTestHandlers();
    else if (tempSubMode === 'write') attachTempWriteHandlers();

    refreshIcons();
}

function renderTempList() {
    return `
        <div style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
            <button class="btn btn-primary" id="btn-add-temp">
                <i data-lucide="plus"></i> Добавить слово
            </button>
        </div>
        <div class="temp-form" id="temp-form" style="display: none;">
            <input type="text" id="temp-word" placeholder="English word" autocomplete="off">
            <input type="text" id="temp-translation" placeholder="Перевод" autocomplete="off">
            <input type="text" id="temp-transcription" placeholder="Транскрипция рус. (напр. уелд)" autocomplete="off">
            <div style="display: flex; gap: 8px;">
                <button class="btn btn-success" id="btn-save-temp">
                    <i data-lucide="check"></i> Сохранить
                </button>
                <button class="btn btn-secondary" id="btn-cancel-temp">Отмена</button>
            </div>
        </div>
        <div class="list-items">
            ${temporary.length === 0
            ? `<div class="empty-inline">
                    <i data-lucide="inbox"></i>
                    <div>Пока нет временных слов. Нажми «Добавить слово».</div>
                </div>`
            : temporary.map((w, i) => `
                    <div class="list-item">
                        <div class="list-item-info">
                            <strong>${w.word}</strong>
                            <button class="speak-btn speak-btn-sm" onclick="speak('${w.word.replace(/'/g, "\\'")}')">
                                <i data-lucide="volume-2"></i>
                            </button>
                            ${w.transcription_ru ? `<span class="list-transcription">[${w.transcription_ru}]</span>` : ''}
                            <span class="list-translation">${w.translation}</span>
                        </div>
                        <button class="btn btn-warning btn-sm" onclick="deleteTempWord(${i})">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                `).join('')
        }
        </div>
    `;
}

function attachTempListHandlers() {
    const addBtn = document.getElementById('btn-add-temp');
    if (addBtn) addBtn.onclick = () => {
        document.getElementById('temp-form').style.display = 'flex';
        document.getElementById('temp-word').focus();
    };

    const cancelBtn = document.getElementById('btn-cancel-temp');
    if (cancelBtn) cancelBtn.onclick = () => {
        document.getElementById('temp-form').style.display = 'none';
        document.getElementById('temp-word').value = '';
        document.getElementById('temp-translation').value = '';
        document.getElementById('temp-transcription').value = '';
    };

    const saveBtn = document.getElementById('btn-save-temp');
    if (saveBtn) saveBtn.onclick = () => {
        const word = document.getElementById('temp-word').value.trim();
        const translation = document.getElementById('temp-translation').value.trim();
        const transcription = document.getElementById('temp-transcription').value.trim();

        if (!word || !translation) {
            alert('Введи слово и перевод!');
            return;
        }

        temporary = mergeTemporary(temporary, [{
            word, translation,
            transcription_ru: transcription.replace(/[\[\]]/g, ''),
            frequency: 0, note: '', example: '', example_translation: '',
            family: [], collocations: []
        }]);

        localStorage.setItem('temporary', JSON.stringify(temporary));
        syncToFirebase();
        renderTemporary();
    };
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
        return `<div class="empty-inline"><i data-lucide="inbox"></i><div>Нет слов. Добавь в «Список».</div></div>`;
    }

    if (positions.tempCards >= temporary.length) positions.tempCards = 0;
    const word = temporary[positions.tempCards];
    const srs = getSrsData(word.word, true);
    const progressPct = Math.round(((positions.tempCards + 1) / temporary.length) * 100);

    let hiddenContent = `<div class="card-translation">${word.translation}</div>`;
    if (word.note) hiddenContent += `<div class="card-note">${word.note}</div>`;

    return `
        <div class="mode-progress">
            <div class="mode-progress-info">
                <span class="mode-progress-label">Слово ${positions.tempCards + 1} из ${temporary.length}</span>
                <span class="mode-progress-pct">${progressPct}%</span>
            </div>
            <div class="mode-progress-bar"><div class="mode-progress-fill" style="width:${progressPct}%"></div></div>
        </div>
        <div class="mode-card">
            <div class="card-srs"><i data-lucide="bar-chart-3"></i> SRS Level ${srs.level}/5</div>
            <div class="card-word">
                ${word.word}
                <button class="speak-btn" onclick="speak('${word.word.replace(/'/g, "\\'")}')">
                    <i data-lucide="volume-2"></i>
                </button>
            </div>
            ${word.transcription_ru ? `<div class="card-meta"><span class="card-transcription">[${word.transcription_ru}]</span></div>` : ''}
            <div id="temp-hidden" class="card-hidden" style="display: none;">${hiddenContent}</div>
            <div id="temp-buttons-before" class="card-actions">
                <button class="btn btn-primary btn-lg" id="temp-btn-show">
                    <i data-lucide="eye"></i> Показать перевод
                </button>
            </div>
            <div id="temp-buttons-after" class="card-actions" style="display: none;">
                <button class="btn btn-success" id="temp-btn-learned">
                    <i data-lucide="check"></i> Выучил <span class="xp-tag">+10 XP</span>
                </button>
                <button class="btn btn-warning" id="temp-btn-dontknow">
                    <i data-lucide="x"></i> Не знаю
                </button>
            </div>
        </div>
    `;
}

function attachTempCardsHandlers() {
    if (temporary.length === 0) return;

    const showBtn = document.getElementById('temp-btn-show');
    if (showBtn) showBtn.onclick = () => {
        document.getElementById('temp-hidden').style.display = 'block';
        document.getElementById('temp-buttons-before').style.display = 'none';
        document.getElementById('temp-buttons-after').style.display = 'flex';
        refreshIcons();
    };

    const learnedBtn = document.getElementById('temp-btn-learned');
    if (learnedBtn) learnedBtn.onclick = () => {
        const word = temporary[positions.tempCards];
        updateSrs(word.word, true, true);
        addXP(10);
        positions.tempCards++;
        if (positions.tempCards >= temporary.length) positions.tempCards = 0;
        savePositions();
        renderTemporary();
    };

    const dontBtn = document.getElementById('temp-btn-dontknow');
    if (dontBtn) dontBtn.onclick = () => {
        const word = temporary[positions.tempCards];
        updateSrs(word.word, false, true);
        addXP(2);
        positions.tempCards++;
        if (positions.tempCards >= temporary.length) positions.tempCards = 0;
        savePositions();
        renderTemporary();
    };
}

function renderTempTest() {
    if (temporary.length < 2) return `<div class="empty-inline"><i data-lucide="alert-circle"></i><div>Нужно минимум 2 слова для теста.</div></div>`;

    if (positions.tempTest >= temporary.length) positions.tempTest = 0;
    const word = temporary[positions.tempTest];
    const correct = word.translation;

    const wrongOptions = [];
    let guard = 0;
    while (wrongOptions.length < 3 && guard < 200) {
        guard++;
        const randomWord = temporary[Math.floor(Math.random() * temporary.length)];
        if (randomWord.translation !== correct && !wrongOptions.includes(randomWord.translation)) {
            wrongOptions.push(randomWord.translation);
        }
    }

    const options = [correct, ...wrongOptions].sort(() => Math.random() - 0.5);
    const progressPct = Math.round(((positions.tempTest + 1) / temporary.length) * 100);

    return `
        <div class="mode-progress">
            <div class="mode-progress-info">
                <span class="mode-progress-label">Тест ${positions.tempTest + 1} из ${temporary.length}</span>
                <span class="mode-progress-pct">${progressPct}%</span>
            </div>
            <div class="mode-progress-bar"><div class="mode-progress-fill" style="width:${progressPct}%"></div></div>
        </div>
        <div class="mode-card">
            <div class="test-question">
                ${word.word}
                <button class="speak-btn" onclick="speak('${word.word.replace(/'/g, "\\'")}')">
                    <i data-lucide="volume-2"></i>
                </button>
            </div>
            ${word.transcription_ru ? `<div class="card-meta"><span class="card-transcription">[${word.transcription_ru}]</span></div>` : ''}
            <div class="test-options">
                ${options.map(opt => `<button class="test-option" data-answer="${opt}">${opt}</button>`).join('')}
            </div>
            <div class="test-feedback" id="temp-test-feedback"></div>
            <button class="btn btn-success btn-lg" id="temp-btn-next-test" style="display: none;">
                Дальше <i data-lucide="arrow-right"></i>
            </button>
        </div>
    `;
}

function attachTempTestHandlers() {
    if (temporary.length < 2) return;

    const word = temporary[positions.tempTest];
    const correct = word.translation;

    document.querySelectorAll('#content .test-option').forEach(btn => {
        btn.onclick = () => {
            const answer = btn.dataset.answer;
            const feedback = document.getElementById('temp-test-feedback');

            if (answer === correct) {
                btn.classList.add('correct');
                feedback.innerHTML = '<i data-lucide="check-circle"></i> Правильно! +10 XP';
                feedback.className = 'test-feedback correct';
                updateSrs(word.word, true, true);
                addXP(10);
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('#content .test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                feedback.innerHTML = `<i data-lucide="x-circle"></i> Правильный ответ: ${correct} (+2 XP)`;
                feedback.className = 'test-feedback wrong';
                updateSrs(word.word, false, true);
                addXP(2);
            }
            document.querySelectorAll('#content .test-option').forEach(b => b.disabled = true);
            document.getElementById('temp-btn-next-test').style.display = 'inline-flex';
            refreshIcons();
        };
    });

    const nextBtn = document.getElementById('temp-btn-next-test');
    if (nextBtn) nextBtn.onclick = () => {
        positions.tempTest++;
        if (positions.tempTest >= temporary.length) positions.tempTest = 0;
        savePositions();
        renderTemporary();
    };
}

function renderTempWrite() {
    if (temporary.length === 0) return `<div class="empty-inline"><i data-lucide="inbox"></i><div>Нет слов.</div></div>`;

    if (positions.tempWrite >= temporary.length) positions.tempWrite = 0;
    const word = temporary[positions.tempWrite];
    const progressPct = Math.round(((positions.tempWrite + 1) / temporary.length) * 100);

    return `
        <div class="mode-progress">
            <div class="mode-progress-info">
                <span class="mode-progress-label">Написание ${positions.tempWrite + 1} из ${temporary.length}</span>
                <span class="mode-progress-pct">${progressPct}%</span>
            </div>
            <div class="mode-progress-bar"><div class="mode-progress-fill" style="width:${progressPct}%"></div></div>
        </div>
        <div class="mode-card write-card">
            <div class="write-prompt">
                <div class="write-prompt-label">Переведи на английский:</div>
                <div class="write-prompt-word">${word.translation}</div>
                <div class="write-prompt-hint"><i data-lucide="lightbulb"></i> ${word.word.length} букв</div>
            </div>
            <input type="text" class="write-input" id="temp-write-input" placeholder="Введи слово..." autocomplete="off" autocapitalize="off" spellcheck="false">
            <div class="card-actions">
                <button class="btn btn-primary btn-lg" id="temp-btn-check">
                    <i data-lucide="check"></i> Проверить
                </button>
                <button class="btn btn-secondary" id="temp-btn-show-answer">
                    <i data-lucide="eye"></i> Показать ответ
                </button>
            </div>
            <button class="btn btn-success btn-lg" id="temp-btn-next-write" style="display: none;">
                Дальше <i data-lucide="arrow-right"></i>
            </button>
            <div class="write-feedback" id="temp-write-feedback"></div>
        </div>
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
            feedback.innerHTML = '<i data-lucide="check-circle"></i> Правильно! +10 XP';
            feedback.className = 'write-feedback correct';
            updateSrs(word.word, true, true);
            addXP(10);
        } else {
            feedback.innerHTML = `<i data-lucide="x-circle"></i> Правильный ответ: <b>${word.word}</b> (+2 XP)`;
            feedback.className = 'write-feedback wrong';
            updateSrs(word.word, false, true);
            addXP(2);
        }
        document.getElementById('temp-btn-check').disabled = true;
        document.getElementById('temp-btn-show-answer').disabled = true;
        input.disabled = true;
        document.getElementById('temp-btn-next-write').style.display = 'inline-flex';
        refreshIcons();
    };

    document.getElementById('temp-btn-show-answer').onclick = () => {
        document.getElementById('temp-write-feedback').innerHTML = `<i data-lucide="eye"></i> Правильный ответ: <b>${word.word}</b>`;
        document.getElementById('temp-write-feedback').className = 'write-feedback';
        document.getElementById('temp-btn-check').disabled = true;
        document.getElementById('temp-btn-show-answer').disabled = true;
        input.disabled = true;
        document.getElementById('temp-btn-next-write').style.display = 'inline-flex';
        updateSrs(word.word, false, true);
        addXP(2);
        refreshIcons();
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

// ===== MASTERED =====
function renderMastered() {
    if (mastered.length === 0) {
        document.getElementById('content').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="trophy"></i></div>
                <div class="empty-title">Пока пусто</div>
                <div class="empty-text">Здесь будут слова, которые ты отметил как «знаю навсегда».<br>В карточке нажми <b>✓✓ Навсегда</b>.</div>
                <div class="empty-actions">
                    <button class="btn btn-primary" onclick="renderMode('cards')">
                        <i data-lucide="layers"></i> К карточкам
                    </button>
                </div>
            </div>
        `;
        refreshIcons();
        return;
    }

    const sorted = [...mastered].sort();

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="list-header">
                <div>
                    <div class="list-title">
                        <i data-lucide="trophy"></i> Mastered
                    </div>
                    <div class="list-subtitle">${mastered.length} слов знаешь навсегда</div>
                </div>
                <button class="btn btn-secondary" id="btn-clear-mastered">
                    <i data-lucide="trash-2"></i> Очистить всё
                </button>
            </div>

            <div class="list-items">
                ${sorted.map(word => `
                    <div class="list-item list-item-success">
                        <div class="list-item-info">
                            <strong>${word}</strong>
                            <button class="speak-btn speak-btn-sm" onclick="speak('${word.replace(/'/g, "\\'")}')">
                                <i data-lucide="volume-2"></i>
                            </button>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="unmasterWord('${word.replace(/'/g, "\\'")}')">
                            <i data-lucide="undo-2"></i> Вернуть
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.getElementById('btn-clear-mastered').onclick = () => {
        if (!confirm(`Вернуть все ${mastered.length} слов в обучение?`)) return;
        mastered.forEach(w => removeMastered(w));
        renderMastered();
        updateStats();
    };

    refreshIcons();
}

function unmasterWord(word) {
    if (!confirm(`Вернуть «${word}» в обучение?`)) return;
    removeMastered(word);
    renderMastered();
    updateStats();
}

// ===== SENTENCES =====
function getFilteredSentences() {
    let result = sentences.filter(s => {
        if (sentTenseFilter !== 'all' && s.tense !== sentTenseFilter) return false;
        if (sentLevelFilter !== 'all' && s.level !== sentLevelFilter) return false;
        return true;
    });

    if (sentOrderOverride === 'ordered') {
        result = [...result].sort((a, b) => a.id - b.id);
    }

    return result;
}

function getUniqueTenses() {
    const map = new Map();
    sentences.forEach(s => {
        if (!map.has(s.tense)) map.set(s.tense, s.tense_label);
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
}

function getUniqueLevels() {
    const set = new Set();
    sentences.forEach(s => { if (s.level) set.add(s.level); });
    return ['A1', 'A2', 'B1', 'B2', 'C1'].filter(lvl => set.has(lvl));
}

function renderSentences() {
    if (sentences.length === 0) {
        document.getElementById('content').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="book-open"></i></div>
                <div class="empty-title">Нет предложений</div>
                <div class="empty-text">Файл <b>sentences.json</b> не загружен.</div>
            </div>
        `;
        refreshIcons();
        return;
    }

    if (sentFromLP) {
        renderSentencesLP();
        return;
    }

    const tenses = getUniqueTenses();
    const totalAll = sentences.length;
    const totalLevelFiltered = getFilteredSentences().length;

    const tenseChips = `
        <button class="chip ${sentTenseFilter === 'all' ? 'active' : ''}" data-tense="all">
            All · ${totalAll}
        </button>
        ${tenses.map(t => {
        const count = sentences.filter(s => s.tense === t.key).length;
        return `<button class="chip ${sentTenseFilter === t.key ? 'active' : ''}" data-tense="${t.key}">
                ${t.label} · ${count}
            </button>`;
    }).join('')}
    `;

    const levels = getUniqueLevels();
    const levelChips = levels.map(lvl => {
        const count = sentences.filter(s => {
            if (sentTenseFilter !== 'all' && s.tense !== sentTenseFilter) return false;
            return s.level === lvl;
        }).length;
        return `<button class="chip chip-level ${sentLevelFilter === lvl ? 'active' : ''}" data-level="${lvl}">
            ${lvl} · ${count}
        </button>`;
    }).join('');

    const subNav = `
        <div class="subnav">
            <button class="subnav-btn ${sentSubMode === 'build' ? 'active' : ''}" data-sub="build">
                <i data-lucide="puzzle"></i> Сборка
            </button>
            <button class="subnav-btn ${sentSubMode === 'choose' ? 'active' : ''}" data-sub="choose">
                <i data-lucide="check-circle-2"></i> Выбор времени
            </button>
            <button class="subnav-btn ${sentSubMode === 'translate' ? 'active' : ''}" data-sub="translate">
                <i data-lucide="pencil"></i> Перевод
            </button>
        </div>
    `;

    let bodyHtml = '';
    if (sentSubMode === 'build') bodyHtml = renderSentBuild();
    else if (sentSubMode === 'choose') bodyHtml = renderSentChoose();
    else if (sentSubMode === 'translate') bodyHtml = renderSentTranslate();

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="list-header">
                <div>
                    <div class="list-title"><i data-lucide="book-open"></i> Грамматика</div>
                    <div class="list-subtitle">
                        12 времён · ${sentences.length} предложений · показано ${totalLevelFiltered}
                    </div>
                </div>
            </div>
            <div class="chips-row">${tenseChips}</div>
            <div class="chips-row chips-row-levels">${levelChips}</div>
            ${subNav}
            ${bodyHtml}
        </div>
    `;

    document.querySelectorAll('.chip[data-tense]').forEach(btn => {
        btn.onclick = () => {
            sentTenseFilter = btn.dataset.tense;
            sentLevelFilter = 'all';

            if (sentFromLP) {
                rebuildLPQueue();
            } else {
                sentOrderOverride = null;
            }
            renderSentences();
        };
    });

    document.querySelectorAll('.chip[data-level]').forEach(btn => {
        btn.onclick = () => {
            const lvl = btn.dataset.level;
            if (sentLevelFilter === lvl) {
                sentLevelFilter = 'all';
            } else {
                sentLevelFilter = lvl;
            }

            if (sentFromLP) {
                rebuildLPQueue();
            } else {
                sentOrderOverride = null;
            }
            renderSentences();
        };
    });

    document.querySelectorAll('.subnav-btn').forEach(btn => {
        btn.onclick = () => {
            sentSubMode = btn.dataset.sub;
            renderSentences();
        };
    });

    if (sentSubMode === 'build') attachSentBuildHandlers();
    else if (sentSubMode === 'choose') attachSentChooseHandlers();
    else if (sentSubMode === 'translate') attachSentTranslateHandlers();

    refreshIcons();
}

function renderSentBuild() {
    const data = getFilteredSentences();
    if (data.length === 0) return `<div class="empty-inline"><i data-lucide="inbox"></i><div>Нет предложений под этот фильтр.</div></div>`;

    if (positions.sentBuild >= data.length) positions.sentBuild = 0;
    const sent = data[positions.sentBuild];
    const shuffled = [...sent.words].sort(() => Math.random() - 0.5);
    const progressPct = Math.round(((positions.sentBuild + 1) / data.length) * 100);

    return `
        <div class="mode-progress">
            <div class="mode-progress-info">
                <span class="mode-progress-label">${positions.sentBuild + 1} из ${data.length}</span>
                <span class="mode-progress-pct">${progressPct}%</span>
            </div>
            <div class="mode-progress-bar"><div class="mode-progress-fill" style="width:${progressPct}%"></div></div>
        </div>
        <div class="mode-card sent-task">
            <div class="mode-badge">
                <i data-lucide="puzzle"></i> Собери предложение · ${sent.tense_label}
            </div>
            <div class="sent-ru">${sent.ru}</div>
            <div class="sent-words" id="sent-words-pool">
                ${shuffled.map(w => `<button class="sent-word-chip" data-word="${w}">${w}</button>`).join('')}
            </div>
            <div class="sent-answer" id="sent-answer-area"></div>
            <div class="sent-feedback" id="sent-build-feedback"></div>
            <div class="card-actions">
                <button class="btn btn-primary btn-lg" id="sent-build-check" style="display:none;">
                    <i data-lucide="check"></i> Проверить
                </button>
                <button class="btn btn-secondary" id="sent-build-reset">
                    <i data-lucide="rotate-ccw"></i> Сбросить
                </button>
                <button class="btn btn-secondary" id="sent-build-show">
                    <i data-lucide="eye"></i> Показать ответ
                </button>
            </div>
            <button class="btn btn-success btn-lg" id="sent-build-next" style="display:none;">
                Дальше <i data-lucide="arrow-right"></i>
            </button>
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
        poolEl.innerHTML = '';
        const shuffled = [...sent.words].sort(() => Math.random() - 0.5);
        shuffled.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip';
            btn.textContent = w;
            const used = picked.filter(p => p === w).length;
            const available = shuffled.filter(p => p === w).length;
            if (used >= available) btn.disabled = true;
            btn.onclick = () => { picked.push(w); updateUI(); };
            poolEl.appendChild(btn);
        });

        answerEl.innerHTML = '';
        picked.forEach((w, i) => {
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip picked';
            btn.textContent = w;
            btn.onclick = () => { picked.splice(i, 1); updateUI(); };
            answerEl.appendChild(btn);
        });

        checkBtn.style.display = picked.length === sent.words.length ? 'inline-flex' : 'none';
    }

    updateUI();
    refreshIcons();

    checkBtn.onclick = () => {
        const userAnswer = picked.join(' ').trim();
        const correct = sent.words.join(' ').trim();

        if (userAnswer === correct) {
            feedback.innerHTML = '<i data-lucide="check-circle"></i> Правильно! +10 XP';
            feedback.className = 'sent-feedback correct';
            addXP(10);
            markDuoDone(sent.id, 'build');
        } else {
            feedback.innerHTML = `<i data-lucide="x-circle"></i> Твой: ${userAnswer}<br>Правильно: <b>${correct}</b> (+2 XP)`;
            feedback.className = 'sent-feedback wrong';
            addXP(2);
        }
        document.querySelectorAll('.sent-word-chip').forEach(b => b.disabled = true);
        checkBtn.disabled = true;
        resetBtn.disabled = true;
        showBtn.disabled = true;
        nextBtn.style.display = 'inline-flex';
        refreshIcons();
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
        nextBtn.style.display = 'inline-flex';
    };

    nextBtn.onclick = () => {
        positions.sentBuild++;
        if (positions.sentBuild >= data.length) positions.sentBuild = 0;
        savePositions();
        renderSentences();
    };
}

function renderSentChoose() {
    const data = getFilteredSentences();
    if (data.length < 2) return `<div class="empty-inline"><i data-lucide="alert-circle"></i><div>Нужно минимум 2 предложения.</div></div>`;

    if (positions.sentChoose >= data.length) positions.sentChoose = 0;
    const sent = data[positions.sentChoose];
    const correct = sent.tense_label;

    const wrongOptions = [];
    const seen = new Set([correct]);

    data.forEach(s => {
        if (wrongOptions.length >= 3) return;
        if (!seen.has(s.tense_label)) {
            seen.add(s.tense_label);
            wrongOptions.push(s.tense_label);
        }
    });

    sentences.forEach(s => {
        if (wrongOptions.length >= 3) return;
        if (!seen.has(s.tense_label)) {
            seen.add(s.tense_label);
            wrongOptions.push(s.tense_label);
        }
    });

    const fallback = ['Present Simple', 'Present Continuous', 'Present Perfect', 'Past Simple', 'Future Simple', 'Past Continuous'];
    for (const f of fallback) {
        if (wrongOptions.length >= 3) break;
        if (f !== correct && !wrongOptions.includes(f)) wrongOptions.push(f);
    }

    const options = [correct, ...wrongOptions.slice(0, 3)].sort(() => Math.random() - 0.5);
    const progressPct = Math.round(((positions.sentChoose + 1) / data.length) * 100);

    return `
        <div class="mode-progress">
            <div class="mode-progress-info">
                <span class="mode-progress-label">${positions.sentChoose + 1} из ${data.length}</span>
                <span class="mode-progress-pct">${progressPct}%</span>
            </div>
            <div class="mode-progress-bar"><div class="mode-progress-fill" style="width:${progressPct}%"></div></div>
        </div>
        <div class="mode-card sent-task">
            <div class="mode-badge"><i data-lucide="search"></i> Определи время</div>
            <div class="sent-en-big">${sent.en}</div>
            <button class="speak-btn" onclick="speak('${sent.en.replace(/'/g, "\\'")}')">
                <i data-lucide="volume-2"></i>
            </button>
            <div class="test-options" style="margin-top: 20px;">
                ${options.map(opt => `<button class="test-option" data-answer="${opt}">${opt}</button>`).join('')}
            </div>
            <div class="sent-feedback" id="sent-choose-feedback"></div>
            <button class="btn btn-success btn-lg" id="sent-choose-next" style="display:none;">
                Дальше <i data-lucide="arrow-right"></i>
            </button>
        </div>
    `;
}

function attachSentChooseHandlers() {
    const data = getFilteredSentences();
    if (data.length < 2) return;

    const sent = data[positions.sentChoose];
    const correct = sent.tense_label;
    const feedback = document.getElementById('sent-choose-feedback');

    document.querySelectorAll('#content .test-option').forEach(btn => {
        btn.onclick = () => {
            const answer = btn.dataset.answer;

            if (answer === correct) {
                btn.classList.add('correct');
                feedback.innerHTML = `<i data-lucide="check-circle"></i> Правильно! ${correct} (+10 XP)`;
                feedback.className = 'sent-feedback correct';
                addXP(10);
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('#content .test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                feedback.innerHTML = `<i data-lucide="x-circle"></i> Правильный ответ: ${correct} (+2 XP)`;
                feedback.className = 'sent-feedback wrong';
                addXP(2);
            }
            document.querySelectorAll('#content .test-option').forEach(b => b.disabled = true);
            document.getElementById('sent-choose-next').style.display = 'inline-flex';
            refreshIcons();
        };
    });

    document.getElementById('sent-choose-next').onclick = () => {
        positions.sentChoose++;
        if (positions.sentChoose >= data.length) positions.sentChoose = 0;
        savePositions();
        renderSentences();
    };
}

function renderSentTranslate() {
    const data = getFilteredSentences();
    if (data.length === 0) return `<div class="empty-inline"><i data-lucide="inbox"></i><div>Нет предложений.</div></div>`;

    if (positions.sentTranslate >= data.length) positions.sentTranslate = 0;
    const sent = data[positions.sentTranslate];
    const progressPct = Math.round(((positions.sentTranslate + 1) / data.length) * 100);

    return `
        <div class="mode-progress">
            <div class="mode-progress-info">
                <span class="mode-progress-label">${positions.sentTranslate + 1} из ${data.length}</span>
                <span class="mode-progress-pct">${progressPct}%</span>
            </div>
            <div class="mode-progress-bar"><div class="mode-progress-fill" style="width:${progressPct}%"></div></div>
        </div>
        <div class="mode-card sent-task">
            <div class="mode-badge"><i data-lucide="pencil"></i> Переведи · ${sent.tense_label}</div>
            <div class="sent-ru-big">${sent.ru}</div>
            <input type="text" class="write-input" id="sent-translate-input" placeholder="Введи перевод..." autocomplete="off" autocapitalize="off" spellcheck="false">
            <button class="btn btn-primary btn-lg" id="sent-translate-check">
                <i data-lucide="eye"></i> Показать эталон
            </button>
            <div class="sent-reference" id="sent-translate-ref" style="display:none;">
                <div class="sent-ref-label">Эталон</div>
                <div class="sent-ref-en">${sent.en}</div>
                <button class="speak-btn" onclick="speak('${sent.en.replace(/'/g, "\\'")}')">
                    <i data-lucide="volume-2"></i>
                </button>
                <div class="sent-ref-hint">Оцени себя честно:</div>
                <div class="card-actions">
                    <button class="btn btn-success" id="sent-mark-correct">✓ Совпало +10 XP</button>
                    <button class="btn btn-warning" id="sent-mark-partial">~ Частично +5 XP</button>
                    <button class="btn btn-secondary" id="sent-mark-wrong">✗ Не смог +2 XP</button>
                </div>
            </div>
            <div class="sent-feedback" id="sent-translate-feedback"></div>
            <button class="btn btn-success btn-lg" id="sent-translate-next" style="display:none;">
                Дальше <i data-lucide="arrow-right"></i>
            </button>
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
        document.getElementById('sent-translate-next').style.display = 'inline-flex';
        refreshIcons();
    };

    document.getElementById('sent-mark-correct').onclick = () => {
        addXP(10);
        document.getElementById('sent-translate-feedback').textContent = '✓ +10 XP';
        document.getElementById('sent-translate-feedback').className = 'sent-feedback correct';
        document.querySelectorAll('#sent-translate-ref button').forEach(b => b.disabled = true);
        markDuoDone(sent.id, 'translate');
    };

    document.getElementById('sent-mark-partial').onclick = () => {
        addXP(5);
        document.getElementById('sent-translate-feedback').textContent = '~ +5 XP';
        document.getElementById('sent-translate-feedback').className = 'sent-feedback';
        document.querySelectorAll('#sent-translate-ref button').forEach(b => b.disabled = true);
    };

    document.getElementById('sent-mark-wrong').onclick = () => {
        addXP(2);
        document.getElementById('sent-translate-feedback').textContent = '✗ +2 XP';
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

// ===== LEARNING PATH =====
function renderLearningPath() {
    if (!modulesData) {
        document.getElementById('content').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon"><i data-lucide="map"></i></div>
                <div class="empty-title">Нет данных</div>
                <div class="empty-text">Файл <b>modules.json</b> не загружен.</div>
            </div>
        `;
        refreshIcons();
        return;
    }

    // Если выбран уровень — показываем подмодули
    if (currentModuleLevel) {
        renderSubmodules(currentModuleLevel);
        return;
    }

    // Иначе — список уровней
    renderLevelsList();
}

function renderLevelsList() {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];

    let levelsHtml = '';
    levels.forEach(level => {
        const mod = modulesData[level];
        if (!mod) return;

        const unlocked = levelUnlocked[level] === true;
        const progress = getLevelProgressPercent(level);

        levelsHtml += `
            <div class="module-level-card ${unlocked ? '' : 'locked'}" data-level="${level}">
                <div class="module-level-head">
                    <div class="module-level-badge">${level}</div>
                    <div class="module-level-info">
                        <div class="module-level-title">Уровень ${level}</div>
                        <div class="module-level-sub">${mod.num_submodules} подмодулей · ${mod.total_words} слов</div>
                    </div>
                    ${unlocked ? '' : '<i data-lucide="lock" class="module-lock"></i>'}
                </div>
                <div class="module-level-progress">
                    <div class="module-level-bar">
                        <div class="module-level-fill" style="width:${progress}%"></div>
                    </div>
                    <div class="module-level-pct">${progress}%</div>
                </div>
            </div>
        `;
    });

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="list-header">
                <div>
                    <div class="list-title"><i data-lucide="graduation-cap"></i> Модули</div>
                    <div class="list-subtitle">5 уровней · ${Object.values(modulesData).reduce((s, m) => s + m.num_submodules, 0)} подмодулей</div>
                </div>
            </div>

            <div class="module-levels">
                ${levelsHtml}
            </div>
        </div>
    `;

    document.querySelectorAll('.module-level-card').forEach(card => {
        card.onclick = () => {
            const level = card.dataset.level;
            if (!levelUnlocked[level]) {
                alert(`Уровень ${level} заблокирован. Сначала сдай контрольную предыдущего уровня.`);
                return;
            }
            currentModuleLevel = level;
            renderLearningPath();
        };
    });

    refreshIcons();
}
function renderSubmoduleTask() {
    if (!activeSubmodule) return;

    const tasks = activeSubmodule.tasks;
    const idx = activeSubmodule.currentIndex;

    // Проверяем — всё пройдено?
    // Проверяем — очередь пуста?
    if (tasks.length === 0) {
        finishSubmodule();
        return;
    }

    // Если currentIndex вышел за границы — сбрасываем
    if (activeSubmodule.currentIndex >= tasks.length) {
        activeSubmodule.currentIndex = 0;
    }

    const task = tasks[idx];
    const prog = currentModuleProgress[activeSubmodule.subId] || {};
    const total = prog.total_tasks || tasks.length;
    const done = prog.done_tasks || 0;
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    // Рендер в зависимости от типа
    let taskHtml = '';
    if (task.type === 'card') taskHtml = renderCardTask(task);
    else if (task.type === 'write') taskHtml = renderWriteTask(task);
    else if (task.type === 'listen') taskHtml = renderListenTask(task);
    else if (task.type === 'phrase') taskHtml = renderPhraseTask(task);
    else if (task.type === 'sentence') taskHtml = renderSentenceTask(task);

    const typeLabels = {
        card: '📇 Карточка',
        write: '📝 Письмо',
        listen: '👂 Аудио',
        phrase: '📖 Фраза',
        sentence: '🧩 Грамматика',
    };

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="list-header">
                <div>
                    <div class="list-title">
                        <button class="btn-back" id="back-to-subs"><i data-lucide="arrow-left"></i></button>
                        ${activeSubmodule.subId}
                    </div>
                    <div class="list-subtitle">${typeLabels[task.type]} · Задание ${idx + 1} из ${total}</div>
                </div>
            </div>
                       <div class="mode-progress">
                <div class="mode-progress-info">
                    <span class="mode-progress-label">Правильно: ${done} / ${total}</span>
                    <span class="mode-progress-pct">${pct}%</span>
                </div>
                <div class="mode-progress-bar">
                    <div class="mode-progress-fill" style="width:${pct}%"></div>
                </div>
            </div>

            <div class="mode-card">
                ${taskHtml}
            </div>
        </div>
    `;

    document.getElementById('back-to-subs').onclick = () => {
        activeSubmodule = null;
        renderSubmodules(activeSubmodule?.level || currentModuleLevel);
        renderSubmodules(currentModuleLevel);
    };

    // Привязка обработчиков
    if (task.type === 'card') attachCardTaskHandlers(task);
    else if (task.type === 'write') attachWriteTaskHandlers(task);
    else if (task.type === 'listen') attachListenTaskHandlers(task);
    else if (task.type === 'phrase') attachPhraseTaskHandlers(task);
    else if (task.type === 'sentence') attachSentenceTaskHandlers(task);

    refreshIcons();
}

// === РЕНДЕРЫ ЗАДАНИЙ ===

function findWord(word) {
    return vocabulary.find(w => w.word.toLowerCase() === word.toLowerCase());
}

function renderCardTask(task) {
    const w = findWord(task.word);
    if (!w) return '<div>Слово не найдено</div>';

    const correct = w.translation;
    const allWords = getFilteredVocabulary().filter(x =>
        x.translation && x.translation !== correct && x.translation.length < 30
    );
    const wrongOptions = [];
    let guard = 0;
    while (wrongOptions.length < 3 && guard < 200) {
        guard++;
        const r = allWords[Math.floor(Math.random() * allWords.length)];
        if (r && r.translation && !wrongOptions.includes(r.translation)) {
            wrongOptions.push(r.translation);
        }
    }
    const options = shuffleArray([correct, ...wrongOptions]);

    return `
        <div class="test-question">
            ${w.word}
            <button class="speak-btn" onclick="speak('${w.word.replace(/'/g, "\\'")}')">
                <i data-lucide="volume-2"></i>
            </button>
        </div>
        <div class="test-options">
            ${options.map(o => `<button class="test-option" data-answer="${o.replace(/"/g, '&quot;')}">${o}</button>`).join('')}
        </div>
        <div class="test-feedback" id="task-feedback"></div>
    `;
}

function handleControlCorrect() {
    if (!activeControlTest) return;
    activeControlTest.correct++;
    activeControlTest.currentIndex++;
}

function handleControlError() {
    if (!activeControlTest) return;
    activeControlTest.wrong++;
    activeControlTest.currentIndex++;
}

function showNextButtonControl() {
    const old = document.getElementById('task-next-btn');
    if (old) old.remove();
    const fb = document.getElementById('task-feedback');
    if (!fb) return;

    const btn = document.createElement('button');
    btn.id = 'task-next-btn';
    btn.className = 'btn btn-success btn-lg';
    btn.style.marginTop = '16px';
    btn.innerHTML = 'Дальше <i data-lucide="arrow-right"></i>';
    btn.onclick = () => renderControlTask();
    fb.parentNode.insertBefore(btn, fb.nextSibling);
    if (window.lucide) window.lucide.createIcons();
}

// ==== CARD CONTROL ====
function attachCardTaskHandlersControl(task) {
    const w = findWord(task.word);
    if (!w) return;
    const correct = w.translation;

    document.querySelectorAll('#content .test-option').forEach(btn => {
        btn.onclick = () => {
            const ans = btn.dataset.answer;
            if (ans === correct) {
                btn.classList.add('correct');
                document.getElementById('task-feedback').innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
                document.getElementById('task-feedback').className = 'test-feedback correct';
                handleControlCorrect();
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('#content .test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                document.getElementById('task-feedback').innerHTML = `<i data-lucide="x-circle"></i> Правильно: ${correct}`;
                document.getElementById('task-feedback').className = 'test-feedback wrong';
                handleControlError();
            }
            document.querySelectorAll('#content .test-option').forEach(b => b.disabled = true);
            showNextButtonControl();
            refreshIcons();
        };
    });
}

// ==== WRITE CONTROL ====
function attachWriteTaskHandlersControl(task) {
    const w = findWord(task.word);
    if (!w) return;
    const input = document.getElementById('task-input');
    input.focus();

    document.getElementById('task-check').onclick = () => {
        const ans = input.value.trim().toLowerCase();
        const fb = document.getElementById('task-feedback');
        if (ans === w.word.toLowerCase()) {
            fb.innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
            fb.className = 'write-feedback correct';
            handleControlCorrect();
        } else {
            fb.innerHTML = `<i data-lucide="x-circle"></i> Правильно: <b>${w.word}</b>`;
            fb.className = 'write-feedback wrong';
            handleControlError();
        }
        input.disabled = true;
        document.getElementById('task-check').disabled = true;
        showNextButtonControl();
        refreshIcons();
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('task-check').disabled) {
            document.getElementById('task-check').click();
        }
    });
}

// ==== LISTEN CONTROL ====
function attachListenTaskHandlersControl(task) {
    const w = findWord(task.word);
    if (!w) return;
    const input = document.getElementById('task-input');
    input.focus();

    document.getElementById('task-play').onclick = () => speak(w.word);

    document.getElementById('task-check').onclick = () => {
        const ans = input.value.trim().toLowerCase();
        const fb = document.getElementById('task-feedback');
        if (ans === w.word.toLowerCase()) {
            fb.innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
            fb.className = 'write-feedback correct';
            handleControlCorrect();
        } else {
            fb.innerHTML = `<i data-lucide="x-circle"></i> Правильно: <b>${w.word}</b>`;
            fb.className = 'write-feedback wrong';
            handleControlError();
        }
        input.disabled = true;
        document.getElementById('task-check').disabled = true;
        showNextButtonControl();
        refreshIcons();
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('task-check').disabled) {
            document.getElementById('task-check').click();
        }
    });
}

// ==== PHRASE CONTROL ====
function attachPhraseTaskHandlersControl(task) {
    const p = phrases.find(x => x.phrase.toLowerCase() === task.phrase.toLowerCase());
    if (!p) return;
    const correct = p.translation;

    document.querySelectorAll('#content .test-option').forEach(btn => {
        btn.onclick = () => {
            const ans = btn.dataset.answer;
            if (ans === correct) {
                btn.classList.add('correct');
                document.getElementById('task-feedback').innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
                document.getElementById('task-feedback').className = 'test-feedback correct';
                handleControlCorrect();
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('#content .test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                document.getElementById('task-feedback').innerHTML = `<i data-lucide="x-circle"></i> Правильно: ${correct}`;
                document.getElementById('task-feedback').className = 'test-feedback wrong';
                handleControlError();
            }
            document.querySelectorAll('#content .test-option').forEach(b => b.disabled = true);
            showNextButtonControl();
            refreshIcons();
        };
    });
}

// ==== SENTENCE CONTROL ====
function attachSentenceTaskHandlersControl(task) {
    const sent = sentences.find(s => s.id === task.sentId);
    if (!sent) return;
    const poolEl = document.getElementById('sent-pool');
    const answerEl = document.getElementById('sent-answer');
    const checkBtn = document.getElementById('sent-check');
    let picked = [];

    function updateUI() {
        poolEl.innerHTML = '';
        const shuffled = shuffleArray([...sent.words]);
        shuffled.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip';
            btn.textContent = w;
            const used = picked.filter(p => p === w).length;
            const avail = shuffled.filter(p => p === w).length;
            if (used >= avail) btn.disabled = true;
            btn.onclick = () => { picked.push(w); updateUI(); };
            poolEl.appendChild(btn);
        });
        answerEl.innerHTML = '';
        picked.forEach((w, i) => {
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip picked';
            btn.textContent = w;
            btn.onclick = () => { picked.splice(i, 1); updateUI(); };
            answerEl.appendChild(btn);
        });
        checkBtn.style.display = picked.length === sent.words.length ? 'inline-flex' : 'none';
    }

    updateUI();

    checkBtn.onclick = () => {
        const userAns = picked.join(' ').trim();
        const correct = sent.words.join(' ').trim();
        const fb = document.getElementById('task-feedback');
        if (userAns === correct) {
            fb.innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
            fb.className = 'sent-feedback correct';
            handleControlCorrect();
        } else {
            fb.innerHTML = `<i data-lucide="x-circle"></i> Правильно: <b>${correct}</b>`;
            fb.className = 'sent-feedback wrong';
            handleControlError();
        }
        document.querySelectorAll('#content .sent-word-chip').forEach(b => b.disabled = true);
        checkBtn.disabled = true;
        document.getElementById('sent-reset').disabled = true;
        showNextButtonControl();
        refreshIcons();
    };

    document.getElementById('sent-reset').onclick = () => {
        picked = [];
        updateUI();
    };
}

function attachCardTaskHandlers(task) {
    const w = findWord(task.word);
    if (!w) return;
    const correct = w.translation;

    document.querySelectorAll('#content .test-option').forEach(btn => {
        btn.onclick = () => {
            const ans = btn.dataset.answer;
            if (ans === correct) {
                btn.classList.add('correct');
                document.getElementById('task-feedback').innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
                document.getElementById('task-feedback').className = 'test-feedback correct';
                handleTaskCorrect();
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('#content .test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                document.getElementById('task-feedback').innerHTML = `<i data-lucide="x-circle"></i> Правильно: ${correct}`;
                document.getElementById('task-feedback').className = 'test-feedback wrong';
                handleTaskError();
            }
            document.querySelectorAll('#content .test-option').forEach(b => b.disabled = true);
            showNextButton();
            refreshIcons();
        };
    });
}

function renderWriteTask(task) {
    const w = findWord(task.word);
    if (!w) return '<div>Слово не найдено</div>';
    return `
        <div class="write-prompt">
            <div class="write-prompt-label">Переведи на английский:</div>
            <div class="write-prompt-word">${w.translation}</div>
            <div class="write-prompt-hint"><i data-lucide="lightbulb"></i> ${w.word.length} букв</div>
        </div>
        <input type="text" class="write-input" id="task-input" placeholder="Введи слово..." autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="card-actions">
            <button class="btn btn-primary btn-lg" id="task-check"><i data-lucide="check"></i> Проверить</button>
        </div>
        <div class="write-feedback" id="task-feedback"></div>
    `;
}

function attachWriteTaskHandlers(task) {
    const w = findWord(task.word);
    if (!w) return;
    const input = document.getElementById('task-input');
    input.focus();

    document.getElementById('task-check').onclick = () => {
        const ans = input.value.trim().toLowerCase();
        const fb = document.getElementById('task-feedback');
        if (ans === w.word.toLowerCase()) {
            fb.innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
            fb.className = 'write-feedback correct';
            input.disabled = true;
            document.getElementById('task-check').disabled = true;
            handleTaskCorrect();
        } else {
            fb.innerHTML = `<i data-lucide="x-circle"></i> Правильно: <b>${w.word}</b>`;
            fb.className = 'write-feedback wrong';
            input.disabled = true;
            document.getElementById('task-check').disabled = true;
            handleTaskError();
        }
        showNextButton();
        refreshIcons();
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('task-check').disabled) {
            document.getElementById('task-check').click();
        }
    });
}

function renderListenTask(task) {
    const w = findWord(task.word);
    if (!w) return '<div>Слово не найдено</div>';
    return `
        <div class="mode-badge"><i data-lucide="ear"></i> Слушай и пиши</div>
        <button class="listen-big-btn" onclick="speak('${w.word.replace(/'/g, "\\'")}')">
            <i data-lucide="volume-2"></i>
        </button>
        <div class="listen-hint">Нажми и слушай</div>
        <input type="text" class="write-input" id="task-input" placeholder="Введи слово..." autocomplete="off" autocapitalize="off" spellcheck="false">
        <div class="card-actions">
            <button class="btn btn-primary btn-lg" id="task-check"><i data-lucide="check"></i> Проверить</button>
            <button class="btn btn-secondary" id="task-play"><i data-lucide="volume-2"></i> Повторить</button>
        </div>
        <div class="write-feedback" id="task-feedback"></div>
    `;
}

function attachListenTaskHandlers(task) {
    const w = findWord(task.word);
    if (!w) return;
    const input = document.getElementById('task-input');
    input.focus();

    document.getElementById('task-play').onclick = () => speak(w.word);

    document.getElementById('task-check').onclick = () => {
        const ans = input.value.trim().toLowerCase();
        const fb = document.getElementById('task-feedback');
        if (ans === w.word.toLowerCase()) {
            fb.innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
            fb.className = 'write-feedback correct';
            input.disabled = true;
            document.getElementById('task-check').disabled = true;
            handleTaskCorrect();
        } else {
            fb.innerHTML = `<i data-lucide="x-circle"></i> Правильно: <b>${w.word}</b>`;
            fb.className = 'write-feedback wrong';
            input.disabled = true;
            document.getElementById('task-check').disabled = true;
            handleTaskError();
        }
        showNextButton();
        refreshIcons();
    };

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('task-check').disabled) {
            document.getElementById('task-check').click();
        }
    });
}

function renderPhraseTask(task) {
    const p = phrases.find(x => x.phrase.toLowerCase() === task.phrase.toLowerCase());
    if (!p) return '<div>Фраза не найдена</div>';
    const correct = p.translation;
    const allPhrases = phrases.filter(x => x.translation && x.translation !== correct);
    const wrongOptions = [];
    let guard = 0;
    while (wrongOptions.length < 3 && guard < 200) {
        guard++;
        const r = allPhrases[Math.floor(Math.random() * allPhrases.length)];
        if (r && r.translation && !wrongOptions.includes(r.translation)) {
            wrongOptions.push(r.translation);
        }
    }
    const options = shuffleArray([correct, ...wrongOptions]);

    return `
        <div class="test-question">
            ${p.phrase}
            <button class="speak-btn" onclick="speak('${p.phrase.replace(/'/g, "\\'")}')">
                <i data-lucide="volume-2"></i>
            </button>
        </div>
        <div class="test-options">
            ${options.map(o => `<button class="test-option" data-answer="${o.replace(/"/g, '&quot;')}">${o}</button>`).join('')}
        </div>
        <div class="test-feedback" id="task-feedback"></div>
    `;
}

function attachPhraseTaskHandlers(task) {
    const p = phrases.find(x => x.phrase.toLowerCase() === task.phrase.toLowerCase());
    if (!p) return;
    const correct = p.translation;

    document.querySelectorAll('#content .test-option').forEach(btn => {
        btn.onclick = () => {
            const ans = btn.dataset.answer;
            if (ans === correct) {
                btn.classList.add('correct');
                document.getElementById('task-feedback').innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
                document.getElementById('task-feedback').className = 'test-feedback correct';
                handleTaskCorrect();
            } else {
                btn.classList.add('wrong');
                document.querySelectorAll('#content .test-option').forEach(b => {
                    if (b.dataset.answer === correct) b.classList.add('correct');
                });
                document.getElementById('task-feedback').innerHTML = `<i data-lucide="x-circle"></i> Правильно: ${correct}`;
                document.getElementById('task-feedback').className = 'test-feedback wrong';
                handleTaskError();
            }
            document.querySelectorAll('#content .test-option').forEach(b => b.disabled = true);
            showNextButton();
            refreshIcons();
        };
    });
}

function renderSentenceTask(task) {
    const sent = sentences.find(s => s.id === task.sentId);
    if (!sent) return '<div>Предложение не найдено</div>';
    const shuffled = shuffleArray([...sent.words]);
    return `
        <div class="mode-badge"><i data-lucide="puzzle"></i> Собери предложение</div>
        <div class="sent-ru">${sent.ru}</div>
        <div class="sent-words" id="sent-pool">
            ${shuffled.map(w => `<button class="sent-word-chip" data-word="${w.replace(/"/g, '&quot;')}">${w}</button>`).join('')}
        </div>
        <div class="sent-answer" id="sent-answer"></div>
        <div class="sent-feedback" id="task-feedback"></div>
        <div class="card-actions">
            <button class="btn btn-primary btn-lg" id="sent-check" style="display:none;"><i data-lucide="check"></i> Проверить</button>
            <button class="btn btn-secondary" id="sent-reset"><i data-lucide="rotate-ccw"></i> Сбросить</button>
        </div>
    `;
}

function attachSentenceTaskHandlers(task) {
    const sent = sentences.find(s => s.id === task.sentId);
    if (!sent) return;
    const poolEl = document.getElementById('sent-pool');
    const answerEl = document.getElementById('sent-answer');
    const checkBtn = document.getElementById('sent-check');
    let picked = [];

    function updateUI() {
        poolEl.innerHTML = '';
        const shuffled = shuffleArray([...sent.words]);
        shuffled.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip';
            btn.textContent = w;
            const used = picked.filter(p => p === w).length;
            const avail = shuffled.filter(p => p === w).length;
            if (used >= avail) btn.disabled = true;
            btn.onclick = () => { picked.push(w); updateUI(); };
            poolEl.appendChild(btn);
        });
        answerEl.innerHTML = '';
        picked.forEach((w, i) => {
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip picked';
            btn.textContent = w;
            btn.onclick = () => { picked.splice(i, 1); updateUI(); };
            answerEl.appendChild(btn);
        });
        checkBtn.style.display = picked.length === sent.words.length ? 'inline-flex' : 'none';
    }

    updateUI();

    checkBtn.onclick = () => {
        const userAns = picked.join(' ').trim();
        const correct = sent.words.join(' ').trim();
        const fb = document.getElementById('task-feedback');
        if (userAns === correct) {
            fb.innerHTML = '<i data-lucide="check-circle"></i> Правильно!';
            fb.className = 'sent-feedback correct';
            handleTaskCorrect();
        } else {
            fb.innerHTML = `<i data-lucide="x-circle"></i> Правильно: <b>${correct}</b>`;
            fb.className = 'sent-feedback wrong';
            handleTaskError();
        }
        document.querySelectorAll('#content .sent-word-chip').forEach(b => b.disabled = true);
        checkBtn.disabled = true;
        document.getElementById('sent-reset').disabled = true;
        showNextButton();
        refreshIcons();
    };

    document.getElementById('sent-reset').onclick = () => {
        picked = [];
        updateUI();
    };
}

// === ОБРАБОТКА ОТВЕТОВ ===
function showNextButton() {
    // Удаляем старую кнопку, если есть
    const old = document.getElementById('task-next-btn');
    if (old) old.remove();

    // Находим feedback
    const fb = document.getElementById('task-feedback');
    if (!fb) return;

    // Создаём кнопку
    const btn = document.createElement('button');
    btn.id = 'task-next-btn';
    btn.className = 'btn btn-success btn-lg';
    btn.style.marginTop = '16px';
    btn.innerHTML = 'Дальше <i data-lucide="arrow-right"></i>';
    btn.onclick = () => nextTask();

    fb.parentNode.insertBefore(btn, fb.nextSibling);

    if (window.lucide) window.lucide.createIcons();
}

function handleTaskCorrect() {
    if (!activeSubmodule) return;
    const prog = currentModuleProgress[activeSubmodule.subId];
    const task = activeSubmodule.tasks[activeSubmodule.currentIndex];

    // Если задание УНИКАЛЬНОЕ и ещё не пройдено — считаем
    if (task && task.key && !prog.completedKeys.includes(task.key)) {
        prog.completedKeys.push(task.key);
        prog.done_tasks = prog.completedKeys.length;
    }

    // Убираем задание из очереди
    activeSubmodule.tasks.splice(activeSubmodule.currentIndex, 1);

    prog.currentIndex = activeSubmodule.currentIndex;
    prog.taskOrder = activeSubmodule.tasks;
    saveModuleProgress();
}

function handleTaskError() {
    if (!activeSubmodule) return;
    const task = activeSubmodule.tasks[activeSubmodule.currentIndex];

    // Убираем из текущей позиции
    activeSubmodule.tasks.splice(activeSubmodule.currentIndex, 1);
    // Добавляем в конец
    activeSubmodule.tasks.push(task);

    const prog = currentModuleProgress[activeSubmodule.subId];
    prog.currentIndex = activeSubmodule.currentIndex;
    prog.taskOrder = activeSubmodule.tasks;
    saveModuleProgress();
}

function nextTask() {
    if (!activeSubmodule) return;
    renderSubmoduleTask();
}

function finishControlTest() {
    if (!activeControlTest) return;
    const level = activeControlTest.level;
    const total = activeControlTest.tasks.length;
    const correct = activeControlTest.correct;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = pct >= 85;

    if (passed) {
        // Разблокируем следующий уровень
        const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
        const nextIdx = levels.indexOf(level) + 1;
        if (nextIdx < levels.length) {
            levelUnlocked[levels[nextIdx]] = true;
            localStorage.setItem('levelUnlocked', JSON.stringify(levelUnlocked));
        }
    }

    // Сохраняем результат
    const key = `control_${level}`;
    currentModuleProgress[key] = {
        passed: passed,
        correct: correct,
        total: total,
        pct: pct,
    };
    saveModuleProgress();

    const emoji = passed ? '🏆' : '😢';
    const title = passed ? 'Контрольная пройдена!' : 'Не хватило баллов';
    const nextLevel = passed ? getNextLevel(level) : null;
    const subtitle = passed
        ? (nextLevel ? `Уровень ${nextLevel} разблокирован!` : 'Ты прошёл все уровни! 🎉')
        : `Нужно 85% (${Math.ceil(total * 0.85)}/${total}). Попробуй ещё раз!`;

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap lp-done-wrap">
            <div class="lp-done-card">
                <div class="lp-done-icon">${emoji}</div>
                <div class="lp-done-title">${title}</div>
                <div class="lp-done-sub">Контрольная ${level}</div>
                <div class="lp-done-stats">
                    Результат: <b>${correct}/${total}</b> (${pct}%)
                </div>
                <div class="lp-done-text">${subtitle}</div>
                <div class="lp-done-actions">
                    <button class="btn btn-primary" id="control-back">
                        <i data-lucide="arrow-left"></i> К уровням
                    </button>
                    ${passed ? '' : `<button class="btn btn-secondary" id="control-retry">
                        <i data-lucide="rotate-ccw"></i> Пересдать
                    </button>`}
                </div>
            </div>
        </div>
    `;

    document.getElementById('control-back').onclick = () => {
        activeControlTest = null;
        currentModuleLevel = null;
        renderLearningPath();
    };

    const retryBtn = document.getElementById('control-retry');
    if (retryBtn) {
        retryBtn.onclick = () => {
            const lvl = activeControlTest.level;
            activeControlTest = null;
            startControlTest(lvl);
        };
    }

    refreshIcons();
}

function getNextLevel(level) {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
    const idx = levels.indexOf(level);
    return idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : null;
}

function finishSubmodule() {
    if (!activeSubmodule) return;
    const prog = currentModuleProgress[activeSubmodule.subId];
    const total = prog.total_tasks || 149;
    const done = prog.done_tasks || 0;
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const passed = pct >= 85;
    prog.passed = passed;
    saveModuleProgress();

    const emoji = passed ? '🎉' : '💪';
    const title = passed ? 'Отлично! Подмодуль пройден!' : 'Ещё немного!';
    const subtitle = passed
        ? `Ты справился на ${pct}%. Следующий подмодуль разблокирован.`
        : `Ты набрал ${pct}%. Нужно 85% для прохождения.`;

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap lp-done-wrap">
            <div class="lp-done-card">
                <div class="lp-done-icon">${emoji}</div>
                <div class="lp-done-title">${title}</div>
                <div class="lp-done-sub">${activeSubmodule.subId}</div>
                <div class="lp-done-stats">
                    Прогресс: <b>${pct}%</b> (${done}/${total})
                </div>
                <div class="lp-done-text">${subtitle}</div>
                <div class="lp-done-actions">
                    <button class="btn btn-primary" id="finish-back">
                        <i data-lucide="arrow-left"></i> К подмодулям
                    </button>
                    <button class="btn btn-secondary" id="finish-retry">
                        <i data-lucide="rotate-ccw"></i> Начать заново
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('finish-back').onclick = () => {
        const lvl = activeSubmodule.level;
        activeSubmodule = null;
        renderSubmodules(lvl);
    };

    document.getElementById('finish-retry').onclick = () => {
        const lvl = activeSubmodule.level;
        const sid = activeSubmodule.subId;
        // Полный сброс прогресса
        delete currentModuleProgress[sid];
        saveModuleProgress();
        activeSubmodule = null;
        startSubmodule(lvl, sid);
    };

    refreshIcons();
}

function renderSubmodules(level) {
    const mod = modulesData[level];
    if (!mod) return;

    let subsHtml = '';
    mod.submodules.forEach((sub, idx) => {
        const prog = currentModuleProgress[sub.id] || { done_tasks: 0, total_tasks: 0, passed: false };
        const total = prog.total_tasks || (sub.words.length * 3 + sub.phrases.length + sub.sentences.length);
        const done = prog.done_tasks || 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const isPassed = prog.passed === true;
        const isLocked = idx > 0 && !isSubmoduleUnlocked(level, idx);

        subsHtml += `
            <div class="module-sub-card ${isPassed ? 'passed' : ''} ${isLocked ? 'locked' : ''}" data-sub-id="${sub.id}">
                <div class="module-sub-head">
                    <div class="module-sub-id">${sub.id}</div>
                    <div class="module-sub-info">
                        <div class="module-sub-title">${sub.words.length} слов · ${sub.phrases.length} фраз · ${sub.sentences.length} предложений</div>
                    </div>
                    ${isPassed ? '<i data-lucide="check-circle" class="module-sub-icon"></i>' : ''}
                    ${isLocked ? '<i data-lucide="lock" class="module-sub-icon"></i>' : ''}
                </div>
                <div class="module-sub-progress">
                    <div class="module-sub-bar">
                        <div class="module-sub-fill" style="width:${pct}%"></div>
                    </div>
                    <div class="module-sub-pct">${done}/${total} · ${pct}%</div>
                </div>
            </div>
        `;
    });

    // Контрольная
    // Контрольная — ВСЕГДА разблокирована
    const passed = currentModuleProgress[`control_${level}`]?.passed === true;

    const controlHtml = `
        <div class="module-control-card ${passed ? 'passed' : ''}" data-control="true">
            <div class="module-control-head">
                <div class="module-control-icon">${passed ? '✅' : '🏆'}</div>
                <div class="module-control-info">
                    <div class="module-control-title">Контрольная ${level}</div>
                    <div class="module-control-sub">${mod.control_test.total_questions} вопросов · порог ${mod.control_test.threshold * 100}%</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="list-header">
                <div>
                    <div class="list-title">
                        <button class="btn-back" id="back-to-levels"><i data-lucide="arrow-left"></i></button>
                        Уровень ${level}
                    </div>
                    <div class="list-subtitle">${mod.num_submodules} подмодулей · ${mod.total_words} слов</div>
                </div>
            </div>

            <div class="module-subs">
                ${subsHtml}
                ${controlHtml}
            </div>
        </div>
    `;

    document.getElementById('back-to-levels').onclick = () => {
        currentModuleLevel = null;
        renderLearningPath();
    };

    document.querySelectorAll('.module-sub-card').forEach(card => {
        card.onclick = () => {
            if (card.classList.contains('locked')) {
                alert('Этот подмодуль заблокирован. Пройди предыдущий на 85%+.');
                return;
            }
            const subId = card.dataset.subId;
            startSubmodule(level, subId);
        };
    });

    document.querySelectorAll('.module-control-card').forEach(card => {
        card.onclick = () => {
            startControlTest(level);
        };
    });

    refreshIcons();
}
function buildControlTest(level) {
    const mod = modulesData[level];
    if (!mod) return [];

    // Собираем ВСЕ слова/фразы/предложения уровня
    const allWords = [];
    const allPhrases = [];
    const allSentences = [];

    mod.submodules.forEach(sub => {
        sub.words.forEach(w => allWords.push(w));
        sub.phrases.forEach(p => allPhrases.push(p));
        sub.sentences.forEach(s => allSentences.push(s));
    });

    // Перемешиваем
    const shuffledWords = shuffleArray([...allWords]);
    const shuffledPhrases = shuffleArray([...allPhrases]);
    const shuffledSentences = shuffleArray([...allSentences]);

    const tasks = [];

    // 10 карточек
    for (let i = 0; i < 10 && i < shuffledWords.length; i++) {
        tasks.push({ type: 'card', word: shuffledWords[i], key: `control:${level}:card:${shuffledWords[i]}:${i}` });
    }

    // 5 письмо
    for (let i = 10; i < 15 && i < shuffledWords.length; i++) {
        tasks.push({ type: 'write', word: shuffledWords[i], key: `control:${level}:write:${shuffledWords[i]}:${i}` });
    }

    // 5 аудио
    for (let i = 15; i < 20 && i < shuffledWords.length; i++) {
        tasks.push({ type: 'listen', word: shuffledWords[i], key: `control:${level}:listen:${shuffledWords[i]}:${i}` });
    }

    // 5 фраз
    for (let i = 0; i < 5 && i < shuffledPhrases.length; i++) {
        tasks.push({ type: 'phrase', phrase: shuffledPhrases[i], key: `control:${level}:phrase:${shuffledPhrases[i]}:${i}` });
    }

    // 5 предложений
    for (let i = 0; i < 5 && i < shuffledSentences.length; i++) {
        tasks.push({ type: 'sentence', sentId: shuffledSentences[i], key: `control:${level}:sentence:${shuffledSentences[i]}:${i}` });
    }

    // Финальный shuffle
    return shuffleArray(tasks);
}

function buildSubmoduleTasks(level, subId) {
    const mod = modulesData[level];
    if (!mod) return [];
    const sub = mod.submodules.find(s => s.id === subId);
    if (!sub) return [];

    const tasks = [];

    // 1. Карточки (слово → перевод)
    sub.words.forEach(word => {
        tasks.push({
            type: 'card',
            word: word,
            key: `${subId}:card:${word}`,
        });
    });

    // 2. Письмо (перевод → слово)
    sub.words.forEach(word => {
        tasks.push({
            type: 'write',
            word: word,
            key: `${subId}:write:${word}`,
        });
    });

    // 3. Аудио (слушаешь → пишешь)
    sub.words.forEach(word => {
        tasks.push({
            type: 'listen',
            word: word,
            key: `${subId}:listen:${word}`,
        });
    });

    // 4. Фразы
    sub.phrases.forEach(phrase => {
        tasks.push({
            type: 'phrase',
            phrase: phrase,
            key: `${subId}:phrase:${phrase}`,
        });
    });

    // 5. Грамматика (сборка предложения)
    sub.sentences.forEach(sentId => {
        tasks.push({
            type: 'sentence',
            sentId: sentId,
            key: `${subId}:sentence:${sentId}`,
        });
    });

    return shuffleArray(tasks);
}
function startControlTest(level) {
    const tasks = buildControlTest(level);
    if (tasks.length === 0) {
        alert('Недостаточно данных для контрольной.');
        return;
    }

    activeControlTest = {
        level: level,
        tasks: tasks,
        currentIndex: 0,
        correct: 0,
        wrong: 0,
    };

    renderControlTask();
}

function renderControlTask() {
    if (!activeControlTest) return;

    const tasks = activeControlTest.tasks;
    const idx = activeControlTest.currentIndex;
    const total = tasks.length;

    // Конец?
    if (idx >= total) {
        finishControlTest();
        return;
    }

    const task = tasks[idx];
    const pct = Math.round((idx / total) * 100);

    let taskHtml = '';
    if (task.type === 'card') taskHtml = renderCardTask(task);
    else if (task.type === 'write') taskHtml = renderWriteTask(task);
    else if (task.type === 'listen') taskHtml = renderListenTask(task);
    else if (task.type === 'phrase') taskHtml = renderPhraseTask(task);
    else if (task.type === 'sentence') taskHtml = renderSentenceTask(task);

    const typeLabels = {
        card: '📇 Карточка',
        write: '📝 Письмо',
        listen: '👂 Аудио',
        phrase: '📖 Фраза',
        sentence: '🧩 Грамматика',
    };

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="list-header">
                <div>
                    <div class="list-title">
                        <button class="btn-back" id="back-from-control"><i data-lucide="arrow-left"></i></button>
                        🏆 Контрольная ${activeControlTest.level}
                    </div>
                    <div class="list-subtitle">${typeLabels[task.type]} · Вопрос ${idx + 1} из ${total}</div>
                </div>
            </div>
            <div class="mode-progress">
                <div class="mode-progress-info">
                    <span class="mode-progress-label">Вопрос ${idx + 1} / ${total}</span>
                    <span class="mode-progress-pct">${pct}%</span>
                </div>
                <div class="mode-progress-bar">
                    <div class="mode-progress-fill" style="width:${pct}%"></div>
                </div>
            </div>
            <div class="mode-card">
                ${taskHtml}
            </div>
        </div>
    `;

    document.getElementById('back-from-control').onclick = () => {
        if (confirm('Выйти из контрольной? Прогресс не сохранится.')) {
            activeControlTest = null;
            renderSubmodules(activeControlTest?.level || currentModuleLevel);
        }
    };

    // Привязка обработчиков (как в подмодуле, но с control)
    if (task.type === 'card') attachCardTaskHandlersControl(task);
    else if (task.type === 'write') attachWriteTaskHandlersControl(task);
    else if (task.type === 'listen') attachListenTaskHandlersControl(task);
    else if (task.type === 'phrase') attachPhraseTaskHandlersControl(task);
    else if (task.type === 'sentence') attachSentenceTaskHandlersControl(task);

    refreshIcons();
}

function startSubmodule(level, subId) {
    const sub = modulesData[level]?.submodules.find(s => s.id === subId);
    if (!sub) return;

    // Прогресс подмодуля
    let prog = currentModuleProgress[subId];
    if (!prog) {
        prog = {
            done_tasks: 0,
            total_tasks: 0,
            passed: false,
            taskOrder: [],
            currentIndex: 0,
            errors: [],
            completedKeys: [],   // ключи УНИКАЛЬНЫХ пройденных заданий
        };
    }
    if (!prog.completedKeys) prog.completedKeys = [];

    // Если порядок не сохранён — создаём
    if (!prog.taskOrder || prog.taskOrder.length === 0) {
        const tasks = buildSubmoduleTasks(level, subId);
        prog.taskOrder = tasks;
        prog.total_tasks = tasks.length;
        prog.currentIndex = 0;
    }

    currentModuleProgress[subId] = prog;
    saveModuleProgress();

    activeSubmodule = {
        level: level,
        subId: subId,
        tasks: prog.taskOrder,
        currentIndex: prog.currentIndex,
        errors: prog.errors || [],
    };

    renderSubmoduleTask();
}

function saveModuleProgress() {
    localStorage.setItem('moduleProgress', JSON.stringify(currentModuleProgress));
}

function updateSubmoduleProgress(subId, doneTasks, totalTasks, passed, currentIndex, errors) {
    currentModuleProgress[subId] = {
        ...currentModuleProgress[subId],
        done_tasks: doneTasks,
        total_tasks: totalTasks,
        passed: passed,
        currentIndex: currentIndex,
        errors: errors,
    };
    saveModuleProgress();
}
function isSubmoduleUnlocked(level, index) {
    if (index === 0) return true; // A1.1 всегда открыт
    const mod = modulesData[level];
    if (!mod) return false;
    const prevSub = mod.submodules[index - 1];
    const prevProg = currentModuleProgress[prevSub.id] || { done_tasks: 0, total_tasks: 0 };
    const total = prevProg.total_tasks || (prevSub.words.length * 3 + prevSub.phrases.length + prevSub.sentences.length);
    const done = prevProg.done_tasks || 0;
    const pct = total > 0 ? (done / total) * 100 : 0;
    return pct >= 85; // 85%+ от заданий → следующий открыт
}

function getLevelProgressPercent(level) {
    const mod = modulesData[level];
    if (!mod) return 0;

    let totalDone = 0;
    let totalTasks = 0;

    mod.submodules.forEach(sub => {
        const prog = currentModuleProgress[sub.id] || {};
        const total = prog.total_tasks || (sub.words.length * 3 + sub.phrases.length + sub.sentences.length);
        totalTasks += total;
        totalDone += (prog.done_tasks || 0);
    });

    return totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
}

function attachLearningPathHandlers() {
    document.querySelectorAll('[data-tense-toggle]').forEach(el => {
        el.onclick = () => {
            const key = el.dataset.tenseToggle;
            const idx = lpExpandedTenses.indexOf(key);
            if (idx === -1) lpExpandedTenses.push(key);
            else lpExpandedTenses.splice(idx, 1);
            localStorage.setItem('lpExpandedTenses', JSON.stringify(lpExpandedTenses));
            renderLearningPath();
        };
    });

    document.querySelectorAll('.lp-level-btn').forEach(btn => {
        btn.onclick = () => {
            startLPGroup(btn.dataset.tense, btn.dataset.level);
        };
    });

    const resetBtn = document.getElementById('lp-reset');
    if (resetBtn) {
        resetBtn.onclick = () => {
            if (!confirm('Сбросить прогресс Пути обучения? XP и слова останутся.')) return;
            duoProgress = {};
            localStorage.setItem('duoProgress', JSON.stringify(duoProgress));
            syncToFirebase();
            renderLearningPath();
        };
    }
}

// ===== LEARNING PATH — Sentences =====
function rebuildLPQueue() {
    lpQueue = sentences
        .filter(s => sentTenseFilter === 'all' || s.tense === sentTenseFilter)
        .filter(s => sentLevelFilter === 'all' || s.level === sentLevelFilter)
        .map(s => s.id)
        .sort((a, b) => a - b);
    lpIndex = 0;
    lpSkippedThisSession = new Set();
}

function startLPGroup(tense, level) {
    sentTenseFilter = tense;
    sentLevelFilter = level;
    sentFromLP = true;
    sentReturnToLP = true;
    sentOrderOverride = 'ordered';

    rebuildLPQueue();

    renderMode('sentences');
}

function renderSentencesLP() {
    while (lpIndex < lpQueue.length) {
        const id = lpQueue[lpIndex];
        if (isDuoDone(id) || lpSkippedThisSession.has(id)) {
            lpIndex++;
        } else {
            break;
        }
    }

    const tense = sentTenseFilter;
    const level = sentLevelFilter;

    const groupAll = sentences.filter(s => {
        const mT = tense === 'all' || s.tense === tense;
        const mL = level === 'all' || s.level === level;
        return mT && mL;
    });
    const groupDone = groupAll.filter(s => isDuoDone(s.id)).length;

    if (lpIndex >= lpQueue.length) {
        renderLPDoneScreen(tense, level, groupDone, groupAll.length);
        return;
    }

    const sentId = lpQueue[lpIndex];
    const sent = sentences.find(s => s.id === sentId);
    if (!sent) {
        lpIndex++;
        renderSentencesLP();
        return;
    }

    const prog = duoProgress[sentId] || { build: false, translate: false };
    const needMode = !prog.build ? 'build' : 'translate';

    const tenseLabel = sent.tense_label || tense;
    const levelLabel = sent.level || level;

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="list-header">
                <div>
                    <div class="list-title">
                        <i data-lucide="book-open"></i> ${tenseLabel} · ${levelLabel}
                    </div>
                    <div class="list-subtitle">
                        Пройдено ${groupDone} из ${groupAll.length} · Задание ${lpIndex + 1} из ${lpQueue.length}
                    </div>
                </div>
                <button class="btn btn-secondary" id="sent-back-to-lp">
                    <i data-lucide="arrow-left"></i> Назад в Путь
                </button>
            </div>

            ${needMode === 'build' ? renderBuildUILP(sent) : renderTranslateUILP(sent)}
        </div>
    `;

    document.getElementById('sent-back-to-lp').onclick = () => {
        sentFromLP = false;
        sentReturnToLP = false;
        sentOrderOverride = null;
        lpQueue = [];
        lpIndex = 0;
        lpSkippedThisSession = new Set();
        renderMode('learning');
    };

    if (needMode === 'build') attachBuildHandlersLP(sent);
    else attachTranslateHandlersLP(sent);

    refreshIcons();
}

function renderBuildUILP(sent) {
    const shuffled = [...sent.words].sort(() => Math.random() - 0.5);
    return `
        <div class="mode-card sent-task">
            <div class="mode-badge">
                <i data-lucide="puzzle"></i> Собери предложение
            </div>
            <div class="sent-ru">${sent.ru}</div>
            <div class="sent-words" id="sent-words-pool">
                ${shuffled.map(w => `<button class="sent-word-chip" data-word="${w}">${w}</button>`).join('')}
            </div>
            <div class="sent-answer" id="sent-answer-area"></div>
            <div class="sent-feedback" id="sent-build-feedback"></div>
            <div class="card-actions">
                <button class="btn btn-primary btn-lg" id="sent-build-check" style="display:none;">
                    <i data-lucide="check"></i> Проверить
                </button>
                <button class="btn btn-secondary" id="sent-build-reset">
                    <i data-lucide="rotate-ccw"></i> Сбросить
                </button>
                <button class="btn btn-secondary" id="sent-build-show">
                    <i data-lucide="eye"></i> Показать ответ
                </button>
            </div>
            <button class="btn btn-success btn-lg" id="sent-build-next" style="display:none;">
                Дальше <i data-lucide="arrow-right"></i>
            </button>
        </div>
    `;
}

function renderTranslateUILP(sent) {
    return `
        <div class="mode-card sent-task">
            <div class="mode-badge">
                <i data-lucide="pencil"></i> Переведи
            </div>
            <div class="sent-ru-big">${sent.ru}</div>
            <input type="text" class="write-input" id="sent-translate-input" placeholder="Введи перевод..." autocomplete="off" autocapitalize="off" spellcheck="false">
            <button class="btn btn-primary btn-lg" id="sent-translate-check">
                <i data-lucide="eye"></i> Показать эталон
            </button>
            <div class="sent-reference" id="sent-translate-ref" style="display:none;">
                <div class="sent-ref-label">Эталон</div>
                <div class="sent-ref-en">${sent.en}</div>
                <button class="speak-btn" onclick="speak('${sent.en.replace(/'/g, "\\'")}')">
                    <i data-lucide="volume-2"></i>
                </button>
                <div class="sent-ref-hint">Оцени себя честно:</div>
                <div class="card-actions">
                    <button class="btn btn-success" id="sent-mark-correct">✓ Совпало +10 XP</button>
                    <button class="btn btn-warning" id="sent-mark-partial">~ Частично +5 XP</button>
                    <button class="btn btn-secondary" id="sent-mark-wrong">✗ Не смог +2 XP</button>
                </div>
            </div>
            <div class="sent-feedback" id="sent-translate-feedback"></div>
            <button class="btn btn-secondary" id="sent-translate-skip" style="margin-top: 12px;">
                <i data-lucide="skip-forward"></i> Пропустить перевод (потом)
            </button>
        </div>
    `;
}

function attachBuildHandlersLP(sent) {
    const poolEl = document.getElementById('sent-words-pool');
    const answerEl = document.getElementById('sent-answer-area');
    const feedback = document.getElementById('sent-build-feedback');
    const checkBtn = document.getElementById('sent-build-check');
    const resetBtn = document.getElementById('sent-build-reset');
    const showBtn = document.getElementById('sent-build-show');
    const nextBtn = document.getElementById('sent-build-next');

    let picked = [];

    function updateUI() {
        poolEl.innerHTML = '';
        const shuffled = [...sent.words].sort(() => Math.random() - 0.5);
        shuffled.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip';
            btn.textContent = w;
            const used = picked.filter(p => p === w).length;
            const available = shuffled.filter(p => p === w).length;
            if (used >= available) btn.disabled = true;
            btn.onclick = () => { picked.push(w); updateUI(); };
            poolEl.appendChild(btn);
        });

        answerEl.innerHTML = '';
        picked.forEach((w, i) => {
            const btn = document.createElement('button');
            btn.className = 'sent-word-chip picked';
            btn.textContent = w;
            btn.onclick = () => { picked.splice(i, 1); updateUI(); };
            answerEl.appendChild(btn);
        });

        checkBtn.style.display = picked.length === sent.words.length ? 'inline-flex' : 'none';
    }

    updateUI();
    refreshIcons();

    checkBtn.onclick = () => {
        const userAnswer = picked.join(' ').trim();
        const correct = sent.words.join(' ').trim();

        if (userAnswer === correct) {
            feedback.innerHTML = '<i data-lucide="check-circle"></i> Правильно! +10 XP';
            feedback.className = 'sent-feedback correct';
            addXP(10);
            markDuoDone(sent.id, 'build');

            document.querySelectorAll('.sent-word-chip').forEach(b => b.disabled = true);
            checkBtn.disabled = true;
            resetBtn.disabled = true;
            showBtn.disabled = true;
            refreshIcons();

            setTimeout(() => {
                if (currentMode === 'sentences' && sentFromLP) {
                    renderSentencesLP();
                }
            }, 700);
        } else {
            feedback.innerHTML = `<i data-lucide="x-circle"></i> Твой: ${userAnswer}<br>Правильно: <b>${correct}</b> (+2 XP)`;
            feedback.className = 'sent-feedback wrong';
            addXP(2);

            document.querySelectorAll('.sent-word-chip').forEach(b => b.disabled = true);
            checkBtn.disabled = true;
            resetBtn.disabled = true;
            showBtn.disabled = true;
            nextBtn.style.display = 'inline-flex';
            refreshIcons();
        }
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
        nextBtn.style.display = 'inline-flex';
        refreshIcons();
    };

    nextBtn.onclick = () => {
        lpIndex++;
        renderSentencesLP();
    };
}

function attachTranslateHandlersLP(sent) {
    const input = document.getElementById('sent-translate-input');
    input.focus();

    function goNext() {
        lpIndex++;
        renderSentencesLP();
    }

    document.getElementById('sent-translate-check').onclick = () => {
        const userAnswer = input.value.trim();
        if (!userAnswer) {
            alert('Сначала введи свой перевод');
            return;
        }
        document.getElementById('sent-translate-ref').style.display = 'block';
        document.getElementById('sent-translate-check').disabled = true;
        input.disabled = true;
        refreshIcons();
    };

    document.getElementById('sent-mark-correct').onclick = () => {
        addXP(10);
        const fb = document.getElementById('sent-translate-feedback');
        fb.textContent = '✓ +10 XP';
        fb.className = 'sent-feedback correct';
        document.querySelectorAll('#sent-translate-ref button').forEach(b => b.disabled = true);
        markDuoDone(sent.id, 'translate');

        setTimeout(() => {
            if (currentMode === 'sentences' && sentFromLP) goNext();
        }, 700);
    };

    document.getElementById('sent-mark-partial').onclick = () => {
        addXP(5);
        const fb = document.getElementById('sent-translate-feedback');
        fb.textContent = '~ +5 XP';
        fb.className = 'sent-feedback';
        document.querySelectorAll('#sent-translate-ref button').forEach(b => b.disabled = true);
        setTimeout(() => {
            if (currentMode === 'sentences' && sentFromLP) goNext();
        }, 700);
    };

    document.getElementById('sent-mark-wrong').onclick = () => {
        addXP(2);
        const fb = document.getElementById('sent-translate-feedback');
        fb.textContent = '✗ +2 XP';
        fb.className = 'sent-feedback wrong';
        document.querySelectorAll('#sent-translate-ref button').forEach(b => b.disabled = true);
        setTimeout(() => {
            if (currentMode === 'sentences' && sentFromLP) goNext();
        }, 700);
    };

    const skipBtn = document.getElementById('sent-translate-skip');
    if (skipBtn) {
        skipBtn.onclick = () => {
            lpSkippedThisSession.add(sent.id);
            goNext();
        };
    }

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !document.getElementById('sent-translate-check').disabled) {
            document.getElementById('sent-translate-check').click();
        }
    });
}

function renderLPDoneScreen(tense, level, done, total) {
    const firstSent = sentences.find(s => {
        const mT = tense === 'all' || s.tense === tense;
        const mL = level === 'all' || s.level === level;
        return mT && mL;
    });
    const tenseLabel = tense === 'all' ? 'Все времена' : (firstSent?.tense_label || tense);
    const levelLabel = level === 'all' ? 'Все уровни' : level;

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap lp-done-wrap">
            <div class="lp-done-card">
                <div class="lp-done-icon">🎉</div>
                <div class="lp-done-title">Отлично!</div>
                <div class="lp-done-sub">${tenseLabel} · ${levelLabel}</div>
                <div class="lp-done-stats">
                    Пройдено <b>${done}</b> из <b>${total}</b>
                </div>
                <div class="lp-done-actions">
                    <button class="btn btn-primary" id="lp-done-back">
                        <i data-lucide="arrow-left"></i> Вернуться в Путь
                    </button>
                    <button class="btn btn-secondary" id="lp-done-retry">
                        <i data-lucide="rotate-ccw"></i> Пройти заново
                    </button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('lp-done-back').onclick = () => {
        sentFromLP = false;
        sentReturnToLP = false;
        sentOrderOverride = null;
        lpQueue = [];
        lpIndex = 0;
        lpSkippedThisSession = new Set();
        renderMode('learning');
    };

    document.getElementById('lp-done-retry').onclick = () => {
        if (!confirm('Сбросить прогресс этой группы и пройти заново?')) return;

        const t = sentTenseFilter;
        const l = sentLevelFilter;
        sentences.forEach(s => {
            const mT = t === 'all' || s.tense === t;
            const mL = l === 'all' || s.level === l;
            if (mT && mL) delete duoProgress[s.id];
        });
        localStorage.setItem('duoProgress', JSON.stringify(duoProgress));
        syncToFirebase();

        rebuildLPQueue();
        renderSentencesLP();
    };

    refreshIcons();
}

// ===== PROFILE =====
function renderProfile() {
    const levelTotal = getLevelTotal();
    const levelLearned = getLevelLearnedCount();
    const dueCount = getDueWords().length;
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const uid = currentUser ? currentUser.uid : '(нет)';

    document.getElementById('content').innerHTML = `
        <div class="mode-wrap">
            <div class="list-header">
                <div>
                    <div class="list-title"><i data-lucide="user"></i> Профиль</div>
                    <div class="list-subtitle">Настройки и статистика</div>
                </div>
            </div>

            <div class="profile-section">
                <div class="profile-label">Имя</div>
                <input type="text" class="write-input" id="profile-name" placeholder="Введи имя" value="${userName}" style="text-align: left;">
                <button class="btn btn-primary" id="btn-save-name">
                    <i data-lucide="check"></i> Сохранить
                </button>
            </div>

            <div class="profile-stats">
                <div class="profile-stat">
                    <div class="profile-stat-value">${xp}</div>
                    <div class="profile-stat-label">XP</div>
                </div>
                <div class="profile-stat">
                    <div class="profile-stat-value">${streak} 🔥</div>
                    <div class="profile-stat-label">Streak</div>
                </div>
                <div class="profile-stat">
                    <div class="profile-stat-value">${levelLearned}/${levelTotal}</div>
                    <div class="profile-stat-label">Learned</div>
                </div>
                <div class="profile-stat">
                    <div class="profile-stat-value">${mastered.length} 🏆</div>
                    <div class="profile-stat-label">Mastered</div>
                </div>
                <div class="profile-stat">
                    <div class="profile-stat-value">${dueCount}</div>
                    <div class="profile-stat-label">Due</div>
                </div>
                <div class="profile-stat">
                    <div class="profile-stat-value">${getLevelName()}</div>
                    <div class="profile-stat-label">Уровень</div>
                </div>
            </div>

            <div class="profile-section">
                <div class="profile-label">Тема</div>
                <button class="btn btn-secondary" id="profile-theme-toggle">
                    ${theme === 'dark' ? '<i data-lucide="sun"></i> Светлая' : '<i data-lucide="moon"></i> Тёмная'}
                </button>
            </div>

            <div class="profile-section">
                <div class="profile-label">Прогресс</div>
                <button class="btn btn-secondary" id="btn-export">
                    <i data-lucide="download"></i> Экспорт JSON
                </button>
                <button class="btn btn-secondary" id="btn-import">
                    <i data-lucide="upload"></i> Импорт JSON
                </button>
                <input type="file" id="import-file" accept=".json" style="display: none;">
            </div>

            <div class="profile-danger">
                <div class="profile-danger-label">Опасная зона</div>
                <button class="btn" id="btn-reset" style="background: var(--danger);">
                    <i data-lucide="trash-2"></i> Сбросить весь прогресс
                </button>
            </div>

            <div class="profile-uid">
                <b>Firebase UID:</b> ${uid}
            </div>
        </div>
    `;

    document.getElementById('btn-save-name').onclick = () => {
        const name = document.getElementById('profile-name').value.trim();
        userName = name;
        localStorage.setItem('userName', userName);
        syncToFirebase();
        updateStats();
        alert('Имя сохранено!');
    };

    document.getElementById('profile-theme-toggle').onclick = () => {
        toggleTheme();
        renderProfile();
    };

    document.getElementById('btn-export').onclick = () => {
        const data = {
            xp, dailyXP, streak, learned, mastered, srsData, positions,
            temporary, currentLevel, userName, lastActiveDate, duoProgress
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `langstep-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    document.getElementById('btn-import').onclick = () => {
        document.getElementById('import-file').click();
    };

    document.getElementById('import-file').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (confirm('Импорт перезапишет текущий прогресс. Продолжить?')) {
                    xp = data.xp ?? xp;
                    dailyXP = data.dailyXP ?? dailyXP;
                    streak = data.streak ?? streak;
                    learned = data.learned ?? learned;
                    mastered = data.mastered ?? mastered;
                    srsData = data.srsData ?? srsData;
                    positions = data.positions ?? positions;
                    temporary = data.temporary ?? temporary;
                    currentLevel = data.currentLevel ?? currentLevel;
                    userName = data.userName ?? userName;
                    lastActiveDate = data.lastActiveDate ?? lastActiveDate;
                    duoProgress = data.duoProgress ?? duoProgress;

                    localStorage.setItem('xp', xp.toString());
                    localStorage.setItem('dailyXP', dailyXP.toString());
                    localStorage.setItem('streak', streak.toString());
                    localStorage.setItem('learned', JSON.stringify(learned));
                    localStorage.setItem('mastered', JSON.stringify(mastered));
                    localStorage.setItem('srsData', JSON.stringify(srsData));
                    localStorage.setItem('positions', JSON.stringify(positions));
                    localStorage.setItem('temporary', JSON.stringify(temporary));
                    localStorage.setItem('level', currentLevel);
                    localStorage.setItem('userName', userName);
                    localStorage.setItem('lastActiveDate', lastActiveDate);
                    localStorage.setItem('duoProgress', JSON.stringify(duoProgress));

                    syncToFirebase();
                    updateStats();
                    renderProfile();
                    alert('Импорт завершён!');
                }
            } catch (err) {
                alert('Ошибка чтения файла: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    document.getElementById('btn-reset').onclick = () => {
        if (!confirm('Сбросить ВЕСЬ прогресс? Это необратимо.')) return;
        if (!confirm('Точно? XP, learned, mastered, SRS — всё обнулится.')) return;
        localStorage.clear();
        location.reload();
    };

    refreshIcons();
}

// ===== НАВИГАЦИЯ =====
function nextCard() { }
function prevCard() { }

// ===== ИНИЦИАЛИЗАЦИЯ =====
document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(btn => {
        btn.onclick = () => {
            const mode = btn.dataset.mode;
            if (mode === 'sentences') {
                sentFromLP = false;
                sentReturnToLP = false;
                sentOrderOverride = null;
                lpQueue = [];
                lpIndex = 0;
                lpSkippedThisSession = new Set();
            }
            renderMode(mode);
        };
    });

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.onclick = toggleTheme;

    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) profileBtn.onclick = () => renderMode('profile');

    refreshIcons();

    loadData();
});
