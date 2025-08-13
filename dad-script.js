document.addEventListener('DOMContentLoaded', () => {

    // --- SETUP ---
    const app = {
        header: document.getElementById('app-header'),
        content: document.getElementById('activity-content'),
        correctionBox: document.getElementById('correction-box'),
        footer: document.getElementById('activity-footer'),
        dateDisplay: document.getElementById('date-display'),
        dateSubtitleDisplay: document.getElementById('date-subtitle-display'),
        timer: document.getElementById('activity-timer'),
        score: document.getElementById('activity-score'),
    };

    // --- INITIALISATION DU SDK TELEGRAM ---
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();

    // --- INTERNATIONALIZATION (i18n) & STRINGS ---
    const strings = {
        score: { fr: 'Score', en: 'Score', ru: 'Счет' },
        time: { fr: 'Temps', en: 'Time', ru: 'Время' },
        submit: { fr: 'Valider', en: 'Submit', ru: 'Ок' },
        correct_answer_is: {
            fr: 'La bonne réponse est',
            en: 'The correct answer is',
            ru: 'Правильный ответ'
        },
        good_job: { fr: 'Bravo !', en: 'Good job!', ru: 'Молодец!' },
        timeout: { fr: 'Le temps est écoulé !', en: 'Time is up!', ru: 'Время вышло!' }
    };

    // --- STATE MANAGEMENT ---
    let state = {
        lang: 'fr',
        today: new Date(),
        currentActivityIndex: 0,
        score: 0,
        timerInterval: null,
        timeRemaining: 300,
        totalTime: 300,
        mathQuestions: []
    };
    
    // --- DATA (activités, etc.) ---
    const program = {
        0: [ // Dimanche
            { type: 'math_quiz', count: 10, operator: '**', max_val: 10, title: { en: 'Multiplication by itself', fr: 'Mutliplications par lui-même', ru: 'Умножение на себя' } },
        ],
        1: [ // Lundi
            { type: 'math_quiz', count: 10, operator: '+', max_val: 9, title: { en: '1-digit additions', fr: 'Additions à 1 chiffre', ru: 'Сложение однозначных чисел' } },
        ],
        2: [ // Mardi
            { type: 'math_quiz', count: 10, operator: '*', max_val: 10, title: { en: 'Single-digit multiplications', fr: 'Multiplications à 1 chiffre', ru: 'Умножение на однозначное число' } }
        ],
        3: [ // Mercredi
            { type: 'math_quiz', count: 10, operator: '/', max_val: 100, title: { en: '1-digit divisions', fr: 'Divisions à 1 chiffre', ru: 'Деление на 1 цифру' } }
        ],
        4: [ // Jeudi
            { type: 'math_quiz', count: 10, operator: '+', max_val: 10, title: { en: '2-digit additions', fr: 'Additions à 2 chiffres', ru: 'Сложение двухзначных чисел' } }
        ],
        5: [ // Vendredi
            { type: 'math_quiz', count: 10, operator: '*', max_val: 10, title: { en: '2-digit multiplications', fr: 'Multiplications à 2 chiffres', ru: 'Умножение двухзначных чисел' } }
        ],
        6: [ // Samedi
            { type: 'math_quiz', count: 10, operator: '/', max_val: 100, title: { en: '2-digit divisions', fr: 'Divisions à 2 chiffres', ru: '2-значные деления' } }
        ],
    };
    
    // --- UTILITY FUNCTIONS ---
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    function getLangForDate(date) {
        const epoch = new Date('2025-01-01');
        const diff = date.getTime() - epoch.getTime();
        const daysSinceEpoch = Math.floor(diff / (1000 * 60 * 60 * 24));
        return (daysSinceEpoch % 2 === 0) ? 'fr' : 'en';
    }
    function updateTimerDisplay() {
        const minutes = Math.floor(state.timeRemaining / 60);
        const seconds = state.timeRemaining % 60;
        app.timer.textContent = `${t('time')} (${ts('time')}): ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
    function handleTimeout() {
        if (state.timerInterval) clearInterval(state.timerInterval);
        app.content.innerHTML = `<h2>${t('timeout')}</h2>`;
    }
    function t(key) { return strings[key][state.lang]; }
    function ts(key) { return strings[key]['ru']; }

    // --- INITIALIZATION ---
    function init() {
        state.lang = getLangForDate(state.today);
        
        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        app.dateDisplay.textContent = state.today.toLocaleDateString(state.lang, dateOptions);
        app.dateSubtitleDisplay.textContent = state.today.toLocaleDateString('ru-RU', dateOptions);

        const dayOfWeek = state.today.getDay();
        const activities = program[dayOfWeek];

        if (activities) {
            runNextActivity(activities);
        } else {
            app.content.innerHTML = `<h2>Нет заданий на сегодня. Отдыхай!</h2>`;
        }
    }

    // --- CORE LOGIC ---
    async function runNextActivity(activities) {
        if (state.timerInterval) clearInterval(state.timerInterval);
        app.correctionBox.classList.add('hidden');

        if (state.currentActivityIndex >= activities.length) {
            // FIX #2: Correction de l'erreur de traduction
            app.content.innerHTML = `<h2>${t('good_job')} (${ts('good_job')})</h2>`;
            return;
        }

        const activity = activities[state.currentActivityIndex];
        app.header.innerHTML += `<h2 id="activity-title">${activity.title[state.lang]} <span class="subtitle">(${activity.title.ru})</span></h2>`;
        
        switch (activity.type) {
            case 'math_quiz':
                await runMathQuiz(activity);
                break;
        }

        state.currentActivityIndex++;
        runNextActivity(activities);
    }
    
    // --- ACTIVITY MODULE: MATH QUIZ ---
    async function runMathQuiz(config) {
        state.score = 0;
        state.mathQuestions = [];

        // --- Démarrage du minuteur ---
        state.timeRemaining = state.totalTime;
        updateTimerDisplay();

        state.timerInterval = setInterval(() => {
            state.timeRemaining--;
            updateTimerDisplay();
            if (state.timeRemaining <= 0) {
                clearInterval(state.timerInterval);
                handleTimeout();
            }
        }, 1000);

        // Génération des questions
        for (let i = 0; i < config.count; i++) {
            let a, b, result;

            switch (config.operator) {
                case '+':
                case '-':
                case '*':
                    a = Math.floor(Math.random() * (config.max_val + 1));
                    b = Math.floor(Math.random() * (config.max_val + 1));
                    if (config.operator === '-' && a < b) [a, b] = [b, a];
                    break;
                case '/':
                    // FIX #1: Logique spécifique pour les divisions entières avec un dividende limité
                    // On génère le diviseur (b) qui sera un chiffre (entre 1 et 10)
                    b = Math.floor(Math.random() * 10) + 1;
                    // On génère le résultat (quotient), en s'assurant que le dividende ne dépasse pas max_val
                    let maxResult = Math.floor(config.max_val / b);
                    result = Math.floor(Math.random() * maxResult) + 1;
                    // Le dividende est le produit du diviseur et du résultat
                    a = b * result;
                    break;
                case '**':
                    a = Math.floor(Math.random() * (config.max_val + 1));
                    b = 2;
                    break;
            }
            
            const question = `${a} ${config.operator} ${b}`;
            let answer;
            try {
                answer = eval(question);
            } catch (e) {
                answer = undefined;
            }
            state.mathQuestions.push({ question, answer });
        }
        
        app.score.textContent = `${t('score')} (${ts('score')}): ${state.score} / ${config.count}`;

        while (state.mathQuestions.length > 0 && state.timeRemaining > 0) {
            const current = state.mathQuestions.shift();
            const userAnswer = await askMathQuestion(current);

            app.correctionBox.classList.remove('hidden');
            if (state.timerInterval) clearInterval(state.timerInterval);

            if (userAnswer === current.answer) {
                state.score++;
                app.score.textContent = `${t('score')} (${ts('score')}): ${state.score} / ${config.count}`;
                app.correctionBox.className = 'correct';
                // FIX #2: Correction de l'erreur de traduction
                app.correctionBox.innerHTML = `✅ ${t('good_job')} (${ts('good_job')})`;
            } else {
                state.mathQuestions.push(current);
                app.correctionBox.className = 'incorrect';
                app.correctionBox.innerHTML = `❌ ${t('correct_answer_is')} (${ts('correct_answer_is')}): <strong>${current.question} = ${current.answer}</strong>`;
            }
            await sleep(3500);
            
            if (state.timeRemaining > 0) {
                state.timerInterval = setInterval(() => {
                    state.timeRemaining--;
                    updateTimerDisplay();
                    if (state.timeRemaining <= 0) {
                        clearInterval(state.timerInterval);
                        handleTimeout();
                    }
                }, 1000);
            }
            
            app.correctionBox.classList.add('hidden');
        }

        if (state.timerInterval) clearInterval(state.timerInterval);
    }

    function askMathQuestion(q) {
        return new Promise(resolve => {
            app.content.innerHTML = `
                <div class="math-quiz-container">
                    <div class="math-question">${q.question}</div>
                    <form class="math-form">
                        <input type="number" class="math-input" autofocus />
                        <button type="submit" class="math-submit">
                         ${t('submit')}
                         <br>
                         <span class="subtitle">${ts('submit')}</span>
                        </button>
                    </form>
                </div>
            `;
            const form = app.content.querySelector('.math-form');
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = app.content.querySelector('.math-input');
                resolve(parseInt(input.value, 10));
            });
        });
    }

    init();

});
