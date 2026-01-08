// Game State
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTqYkl2GspjLwFlf7lcSBgYtxD5jJy74Fx35TqyKlxuC5o_FS_XJXekFonv2XpCC7RAtZiqp-UlEkWx/pub?gid=0&single=true&output=csv'; // ここにCSVのURLを貼ってください

const state = {
    players: [], // { name: string, score: number, selected: boolean }
    targetScore: 5,
    currentStars: 0,
    isRolling: false,
    usedTopics: [], // Indices of used topics
    status: 'entry', // 'entry', 'game', 'result'
    currentTopicText: '',
    sheetUrl: '',
    topics: [
        { id: 0, text: "変顔", stars: 1 }
    ]
};

// DOM Elements
const screens = {
    entry: document.getElementById('entry-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen'),
    modal: document.getElementById('confirm-modal')
};

const entryElements = {
    nameInput: document.getElementById('player-name-input'),
    addBtn: document.getElementById('add-player-btn'),
    list: document.getElementById('player-list'),
    targetDisplay: document.getElementById('target-score-display'),
    startBtn: document.getElementById('start-game-btn')
};

const gameElements = {
    topicArea: document.getElementById('topic-area'),
    topicText: document.getElementById('topic-text'),
    topicStars: document.getElementById('topic-stars'),
    playerList: document.getElementById('game-player-list'),
    newGameBtn: document.getElementById('new-game-mini-btn')
};

const resultElements = {
    list: document.getElementById('result-list'),
    backBtn: document.getElementById('back-to-title-btn'),
    modalCancel: document.getElementById('modal-cancel-btn'),
    modalConfirm: document.getElementById('modal-confirm-btn')
};

// --- Initialization ---
function init() {
    loadState();
    setupEventListeners();

    // Auto-load topics if URL is set
    if (SHEET_URL) {
        loadTopicsFromSheet();
    }

    // Restore Screen based on state
    if (state.status === 'game') {
        renderGameScreen();
        // Restore Topic Display
        if (state.currentTopicText) {
            gameElements.topicText.textContent = state.currentTopicText;
            gameElements.topicText.classList.remove('placeholder');
            gameElements.topicStars.innerHTML = '⭐'.repeat(state.currentStars);
        }
        switchScreen('game');
    } else if (state.status === 'result') {
        showResult();
    } else {
        renderEntryScreen();
        switchScreen('entry');
    }
}

function setupEventListeners() {
    // Entry
    entryElements.addBtn.addEventListener('click', addPlayer);
    entryElements.nameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addPlayer();
    });
    entryElements.startBtn.addEventListener('click', startGame);

    // Game
    gameElements.topicArea.addEventListener('click', handleTopicTap);
    gameElements.newGameBtn.addEventListener('click', showResetModal); // Changed to show modal

    // Result
    resultElements.backBtn.addEventListener('click', showResetModal); // Changed to show modal

    // Modal
    resultElements.modalCancel.addEventListener('click', closeModal);
    resultElements.modalConfirm.addEventListener('click', confirmReset);
}

// --- Logic: Entry Screen ---

function adjustTargetScore(delta) {
    let newScore = state.targetScore + delta;
    if (newScore < 3) newScore = 3;
    if (newScore > 15) newScore = 15;
    state.targetScore = newScore;
    saveState();
    renderEntryScreen();
}

function addPlayer() {
    const name = entryElements.nameInput.value.trim();
    if (!name) return;
    if (state.players.some(p => p.name === name)) {
        alert("その名前は既に登録されています");
        return;
    }

    state.players.push({ name: name, score: 0, selected: false });
    entryElements.nameInput.value = '';
    saveState();
    renderEntryScreen();
    entryElements.nameInput.focus();
}

function removePlayer(index) {
    state.players.splice(index, 1);
    saveState();
    renderEntryScreen();
}

function renderEntryScreen() {
    entryElements.list.innerHTML = '';
    state.players.forEach((player, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${player.name}</span>
            <button class="delete-btn" onclick="removePlayer(${index})">×</button>
        `;
        entryElements.list.appendChild(li);
    });

    entryElements.targetDisplay.textContent = state.targetScore;
    entryElements.startBtn.disabled = state.players.length < 2;
}

// --- Logic: Spreadsheet ---

async function loadTopicsFromSheet() {
    if (!SHEET_URL) return;

    try {
        // Try a different CORS Proxy (corsproxy.io) as AllOrigins might be unstable or blocked.
        const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(SHEET_URL);
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Network response was not ok");
        const text = await response.text();

        const rows = text.split('\n').map(row => row.trim()).filter(row => row);
        const newTopics = [];

        rows.forEach((row, index) => {
            const parts = row.split(',');
            if (parts.length >= 1) {
                const topicText = parts[0].trim();
                let topicStars = 1;
                if (parts.length >= 2) {
                    const s = parseInt(parts[1].trim());
                    if (!isNaN(s)) topicStars = Math.max(1, Math.min(3, s));
                }

                if (topicText) {
                    newTopics.push({ id: index, text: topicText, stars: topicStars });
                }
            }
        });

        if (newTopics.length >= 3) {
            // Update state
            state.topics = newTopics;
            // state.sheetUrl is deprecated/unused now
            state.usedTopics = []; // Reset used
            saveState();
            console.log(`Loaded ${newTopics.length} topics from sheet.`);
        }

    } catch (error) {
        console.error("Sheet Load Error:", error);
    }
}

// --- Logic: Game Screen ---

function startGame() {
    if (state.players.length < 2) return;

    // Reset scores on start
    state.players.forEach(p => {
        p.score = 0;
        p.selected = false;
    });

    state.currentStars = 0; // Reset pending stars

    // Reset Topic Display
    gameElements.topicText.textContent = "タップでお題抽選";
    gameElements.topicText.classList.add('placeholder');
    gameElements.topicStars.innerHTML = '';

    state.status = 'game';
    saveState();

    switchScreen('game');
    renderGameScreen();
}

function renderGameScreen() {
    gameElements.playerList.innerHTML = '';
    state.players.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = `game-player-card ${player.selected ? 'selected' : ''}`;
        div.onclick = () => togglePlayerSelection(index);

        let starsHtml = '';
        const filled = '⭐'.repeat(player.score);
        const empty = '☆'.repeat(Math.max(0, state.targetScore - player.score));

        starsHtml = `<span class="star-filled">${filled}</span><span class="star-empty">${empty}</span>`;

        div.innerHTML = `
            <span class="player-info">${player.name}</span>
            <div class="player-score">${starsHtml}</div>
        `;
        gameElements.playerList.appendChild(div);
    });
}

function togglePlayerSelection(index) {
    state.players[index].selected = !state.players[index].selected;
    renderGameScreen();
}

function handleTopicTap() {
    if (state.isRolling) return;

    // 1. Helper: Add score to selected players using CURRENT topic stars (if any)
    const selectedPlayers = state.players.filter(p => p.selected);
    if (selectedPlayers.length > 0 && state.currentStars > 0) {
        // Add score
        let winnerFound = false;
        state.players.forEach(p => {
            if (p.selected) {
                p.score += state.currentStars;
                p.selected = false; // Deselect

                if (p.score >= state.targetScore) {
                    winnerFound = true;
                }
            }
        });

        if (winnerFound) {
            saveState(); // Save state before reflesh
            showResult();
            return;
        }
    } else if (selectedPlayers.length > 0 && state.currentStars === 0) {
        state.players.forEach(p => p.selected = false);
    }

    // Rerender to show score updates immediately
    renderGameScreen();

    // 2. Draw New Topic
    performTopicLottery();
}

function performTopicLottery() {
    state.isRolling = true;
    gameElements.topicText.classList.remove('placeholder');
    gameElements.topicArea.classList.add('shake');
    gameElements.topicStars.innerHTML = '';

    // Temporary shuffle text
    let count = 0;
    const interval = setInterval(() => {
        const rand = state.topics[Math.floor(Math.random() * state.topics.length)];
        gameElements.topicText.textContent = rand.text;
        count++;
        if (count > 40) {
            clearInterval(interval);
            finalizeTopic();
        }
    }, 50);
}

function finalizeTopic() {
    // Filter available topics
    let availableTopics = state.topics.filter(t => !state.usedTopics.includes(t.id));

    // If all topics used, reset
    if (availableTopics.length === 0) {
        state.usedTopics = [];
        availableTopics = state.topics;
    }

    const topic = availableTopics[Math.floor(Math.random() * availableTopics.length)];

    // Mark as used
    state.usedTopics.push(topic.id);

    gameElements.topicText.textContent = topic.text;
    state.currentTopicText = topic.text;
    state.currentStars = topic.stars;

    // Render stars
    gameElements.topicStars.innerHTML = '⭐'.repeat(topic.stars);

    gameElements.topicArea.classList.remove('shake');
    gameElements.topicText.classList.add('pop');
    setTimeout(() => gameElements.topicText.classList.remove('pop'), 300);

    state.isRolling = false;
    saveState();
}

// --- Logic: Result Screen ---

function showResult() {
    state.status = 'result';
    saveState();
    switchScreen('result');

    // Sort logic: Descending score
    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    resultElements.list.innerHTML = '';
    sortedPlayers.forEach((player, index) => {
        const isWinner = index === 0; // Ties handled by simple sort order for now
        const div = document.createElement('div');
        div.className = `result-item ${isWinner ? 'winner' : ''}`;
        div.innerHTML = `
            <span class="r-name">${player.name}</span>
            <span class="r-score">${player.score}⭐</span>
        `;
        resultElements.list.appendChild(div);
    });

    // Confetti
    fireConfetti();
}

function fireConfetti() {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 999 };

    const randomInRange = (min, max) => Math.random() * (max - min) + min;

    const interval = setInterval(function () {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
        confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
    }, 250);
}

// --- Global Utilities ---

function switchScreen(screenName) {
    Object.values(screens).forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });
    screens[screenName].classList.remove('hidden');
    screens[screenName].classList.add('active');
}

function showResetModal() {
    screens.modal.classList.remove('hidden');
}

function closeModal() {
    screens.modal.classList.add('hidden');
}

function confirmReset() {
    closeModal();
    resetGameData();
    switchScreen('entry');
    renderEntryScreen();
}

function resetToEntry() {
    // Deprecated in favor of showResetModal, but kept if needed by other logic (none currently)
    showResetModal();
}

function resetGameData() {
    state.players = [];
    state.targetScore = 5;
    state.currentStars = 0;
    state.usedTopics = [];
    state.isRolling = false;
    state.status = 'entry';
    state.currentTopicText = '';

    saveState();
    renderEntryScreen();
}

// --- Storage ---

function saveState() {
    localStorage.setItem('topicGame_state', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('topicGame_state');
    if (saved) {
        const parsed = JSON.parse(saved);
        state.players = parsed.players || [];
        state.targetScore = parsed.targetScore || 5;
        state.usedTopics = parsed.usedTopics || [];
        state.status = parsed.status || 'entry';
        state.currentTopicText = parsed.currentTopicText || '';
        state.sheetUrl = parsed.sheetUrl || '';
        // Only load topics from parsed if they exist and are valid array
        if (parsed.topics && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
            state.topics = parsed.topics;
        }
        if (parsed.currentStars !== undefined) state.currentStars = parsed.currentStars;
    }
}


// Boot
init();

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg))
            .catch(err => console.log('SW registration failed:', err));
    });
}
