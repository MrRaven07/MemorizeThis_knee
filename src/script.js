// ==========================================
// Part 1: System Component Identification
// ==========================================
const screens = {
    start: document.getElementById('start-screen'),
    settings: document.getElementById('settings-screen'),
    memorize: document.getElementById('memorize-screen'),
    delay: document.getElementById('delay-screen'),
    input: document.getElementById('input-screen'),
    results: document.getElementById('results-screen')
};

const settings = {
    count: document.getElementById('setting-count'),
    memTime: document.getElementById('setting-mem-time'),
    waitTime: document.getElementById('setting-wait-time'),
    typeTime: document.getElementById('setting-type-time')
};

// UI Elements mapping
const displayElements = {
    memTimer: document.getElementById('mem-timer'),
    numberString: document.getElementById('number-display'),
    delayTimer: document.getElementById('delay-timer'),
    inputTimer: document.getElementById('input-timer'),
    userInput: document.getElementById('user-input'),
    resultsView: document.getElementById('results-display'),
    scoreText: document.getElementById('score-text')
};

// ==========================================
// Part 2: Game State Memory
// ==========================================
let activeSequence = "";
let currentTimerInterval = null;

// ==========================================
// Part 3: Core Utility Functions
// ==========================================

// Utility: Switch visible screens safely
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.add('hidden'));
    screens[screenName].classList.remove('hidden');
}

// Utility: Generate random numerical sequence
function generateSequence(length) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += Math.floor(Math.random() * 10).toString();
    }
    return result;
}

// Utility: Master countdown timer
// Accepts duration, element to update, and function to execute on completion
function startCountdown(seconds, displayElement, onComplete) {
    clearInterval(currentTimerInterval);
    
    let timeRemaining = seconds;
    displayElement.textContent = timeRemaining;

    currentTimerInterval = setInterval(() => {
        timeRemaining--;
        displayElement.textContent = timeRemaining;

        if (timeRemaining <= 0) {
            clearInterval(currentTimerInterval);
            onComplete();
        }
    }, 1000);
}

// ==========================================
// Part 4: Game Phase Controllers
// ==========================================

// Phase 1: Settings Navigation
document.getElementById('start-btn').addEventListener('click', () => {
    showScreen('settings');
});

// Phase 3: Trigger Memorization
document.getElementById('begin-btn').addEventListener('click', () => {
    const count = parseInt(settings.count.value, 10);
    const memTime = parseInt(settings.memTime.value, 10);
    
    // Generate and store the sequence
    activeSequence = generateSequence(count);
    displayElements.numberString.textContent = activeSequence;
    
    showScreen('memorize');
    
    startCountdown(memTime, displayElements.memTimer, triggerDelayPhase);
});

// Manual Skip for Memorization Phase
document.getElementById('skip-mem-btn').addEventListener('click', () => {
    clearInterval(currentTimerInterval);
    triggerDelayPhase();
});

// Phase 4: Trigger Delay
function triggerDelayPhase() {
    const waitTime = parseInt(settings.waitTime.value, 10);
    
    showScreen('delay');
    
    startCountdown(waitTime, displayElements.delayTimer, triggerInputPhase);
}

// Phase 5: Trigger Input
function triggerInputPhase() {
    const typeTime = parseInt(settings.typeTime.value, 10);
    
    // Clear previous inputs and prepare the field
    displayElements.userInput.value = "";
    showScreen('input');
    displayElements.userInput.focus(); // Automatically place cursor in input
    
    startCountdown(typeTime, displayElements.inputTimer, calculateResults);
}

// Manual Finish for Input Phase
document.getElementById('finish-btn').addEventListener('click', () => {
    clearInterval(currentTimerInterval);
    calculateResults();
});

// Phase 6: Calculation and Scoring
function calculateResults() {
    const userAttempt = displayElements.userInput.value.trim();
    let resultHTML = "";
    let correctCount = 0;

    // Compare each character
    for (let i = 0; i < activeSequence.length; i++) {
        const targetChar = activeSequence[i];
        const userChar = userAttempt[i];

        if (userChar === targetChar) {
            resultHTML += `<span class="text-correct">${userChar}</span>`;
            correctCount++;
        } else if (userChar === undefined) {
            // User did not type enough numbers
            resultHTML += `<span class="text-incorrect">_</span>`;
        } else {
            // User typed the wrong number
            resultHTML += `<span class="text-incorrect">${userChar}</span>`;
        }
    }

    // Update DOM with results
    displayElements.resultsView.innerHTML = resultHTML;
    displayElements.scoreText.textContent = `You remembered ${correctCount} out of ${activeSequence.length} correctly.`;
    
    showScreen('results');
}

// System Reset
document.getElementById('restart-btn').addEventListener('click', () => {
    showScreen('settings');
});