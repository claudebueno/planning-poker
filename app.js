// Configuration
// noinspection JSDeprecatedSymbols

const CONFIG = {
    MAX_PLAYERS: 8,
    CARDS: [0, 1, 2, 3, 5, 8, 13, 21, '?', '∞'],
    STORAGE_KEY: 'planningPoker',
    POLL_INTERVAL: 100  // ms pour fluidité
};

// État global
let state = {
    sessionId: null,
    myName: '',
    myVote: null,
    players: {},
    revealed: false,
    channel: null
};

// Initialisation
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    extractSessionId();
    loadPersistedData();
    initBroadcastChannel();
    renderCards();
    if (state.myName) autoJoin();
}

function extractSessionId() {
    const params = new URLSearchParams(window.location.search);
    state.sessionId = params.get('session') || generateSessionId();
    updateSessionUrl();
}

function generateSessionId() {
    // noinspection JSDeprecatedSymbols
    return 'session-' + Math.random().toString(36).substr(2, 8);
}

function updateSessionUrl() {
    const url = `${window.location.origin}${window.location.pathname}?session=${state.sessionId}`;
    document.getElementById('session-link').innerHTML = `
        <div>📎 <strong>URL à partager :</strong></div>
        <div class="session-url">${url}</div>
        <small>Copiez ce lien pour vos 8 joueurs !</small>
    `;
}

// BroadcastChannel
function initBroadcastChannel() {
    state.channel = new BroadcastChannel(`planning-poker-${state.sessionId}`);
    state.channel.onmessage = handleBroadcastMessage;
}

// Rendu des cartes
function renderCards() {
    const container = document.getElementById('cards-container');
    container.innerHTML = '';
    CONFIG.CARDS.forEach(value => {
        const card = document.createElement('div');
        card.className = 'card';
        card.textContent = value;
        card.dataset.value = value;
        card.onclick = () => selectVote(value);
        container.appendChild(card);
    });
}

// Actions utilisateur
function joinSession() {
    const nameInput = document.getElementById('player-name');
    state.myName = nameInput.value.trim() || 'Anonyme';
    
    if (state.myName.length < 2) {
        nameInput.style.borderColor = 'var(--color-danger)';
        return;
    }
    
    persistData();
    broadcast({ type: 'JOIN', name: state.myName });
    
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    nameInput.style.borderColor = '';
}

function autoJoin() {
    document.getElementById('player-name').value = state.myName;
    joinSession();
}

function selectVote(value) {
    state.myVote = value;
    document.querySelectorAll('.card').forEach(card => {
        card.classList.toggle('selected', card.dataset.value == value);
    });
    broadcast({ type: 'VOTE', name: state.myName, vote: value });
}

function revealVotes() {
    state.revealed = true;
    broadcast({ type: 'REVEAL' });
    document.getElementById('reveal-btn').textContent = 'Cacher';
}

function resetSession() {
    state.revealed = false;
    state.myVote = null;
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected'));
    broadcast({ type: 'RESET' });
    document.getElementById('results').classList.add('hidden');
    document.getElementById('reveal-btn').textContent = 'Révéler';
}

// Communication BroadcastChannel
function handleBroadcastMessage(event) {
    const data = event.data;
    switch (data.type) {
        case 'JOIN':
            addPlayer(data.name);
            break;
        case 'VOTE':
            updatePlayerVote(data.name, data.vote);
            break;
        case 'REVEAL':
            state.revealed = true;
            renderPlayers();
            document.getElementById('reveal-btn').textContent = 'Cacher';
            break;
        case 'RESET':
            state.revealed = false;
            Object.keys(state.players).forEach(name => {
                state.players[name].vote = null;
            });
            renderPlayers();
            document.getElementById('reveal-btn').textContent = 'Révéler';
            break;
    }
}

function addPlayer(name) {
    if (!state.players[name] && Object.keys(state.players).length < CONFIG.MAX_PLAYERS) {
        state.players[name] = { name, vote: null };
        renderPlayers();
    }
}

function updatePlayerVote(name, vote) {
    if (state.players[name]) {
        state.players[name].vote = vote;
        renderPlayers();
    }
}

// Rendu
function renderPlayers() {
    const container = document.getElementById('players-container');
    container.innerHTML = '';
    
    Object.entries(state.players).forEach(([name, player]) => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';
        
        const displayVote = state.revealed 
            ? (player.vote || '-') 
            : (player.vote ? '?' : '-');
            
        playerCard.innerHTML = `
            <div class="player-name">${name}</div>
            <div class="player-vote">${displayVote}</div>
        `;
        
        if (player.vote !== null) playerCard.classList.add('voted');
        if (state.revealed && player.vote !== null) playerCard.classList.add('revealed');
        
        container.appendChild(playerCard);
    });
    
    if (state.revealed && Object.values(state.players).some(p => p.vote !== null)) {
        calculateResults();
    }
}

function calculateResults() {
    const numericVotes = Object.values(state.players)
        .filter(p => p.vote !== null && p.vote !== '?' && p.vote !== '∞' && !isNaN(p.vote))
        .map(p => parseFloat(p.vote));
        
    if (numericVotes.length > 1) {
        const average = (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1);
        document.getElementById('results').textContent = `📊 Moyenne: ${average} (${numericVotes.length} votes)`;
        document.getElementById('results').classList.remove('hidden');
    }
}

// Persistance
function persistData() {
    localStorage.setItem(`${CONFIG.STORAGE_KEY}_${state.sessionId}`, JSON.stringify({
        myName: state.myName,
        sessionId: state.sessionId
    }));
}

function loadPersistedData() {
    try {
        const data = JSON.parse(localStorage.getItem(`${CONFIG.STORAGE_KEY}_${state.sessionId}`));
        if (data) {
            state.myName = data.myName;
            state.sessionId = data.sessionId;
        }
    } catch (e) {}
}

// Broadcast helper
function broadcast(message) {
    if (state.channel) {
        state.channel.postMessage(message);
    }
}

// Thème
function toggleTheme() {
    const isDark = document.body.dataset.theme === 'dark';
    document.body.dataset.theme = isDark ? 'light' : 'dark';
    document.getElementById('theme-btn').textContent = isDark ? '☀️' : '🌙';
}

// Clavier
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('welcome-screen').classList.contains('active')) {
        joinSession();
    }
});
