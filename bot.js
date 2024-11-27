const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const questions = [
    "היי! איזה כיף שנפגשנו! ברוכים הבאים למאשרים בקליק, קודם כל והכי חשוב מזל טוב 🎉 אנחנו כאן כדי לוודא שהאירוע שלך יהיה מושלם מהקליק הראשון\n\nאז מה התאריך האירוע שלך? 📅",
    "מעולה רשמנו ביומן ✍ ועכשיו נשמח לדעת באיזה אולם נחגוג? 🥳",
    "מדהים, מקום מהמם ללא ספק ועכשיו, רק עוד שאלה קטנה – כמה מוזמנים יש לנו? 👥",
    "דרך אגב, יעניין אותך לשמוע רק על אישורי הגעה, או שגם על סידורי הושבה? אנחנו יודעים לטפל בשניהם כמו מקצוענים 💪"
];

const finalMessage = "מעולה בדק׳ הקרובות נציג יתפנה ויצטרף לשיחה תודה על ההמתנה 💛";

const userStates = {}; // In-memory storage for user history

const client = new Client();

// WhatsApp Client initialization
const whatsapp = new Client({
    authStrategy: new LocalAuth()
});

whatsapp.on('qr', (qr) => {
    // Generate and scan this code with your phone
    qrcode.generate(qr, { small: true });
});

// Initialize WhatsApp Client
whatsapp.on('ready', () => {
    console.log('Client is ready!');
});


const MESSAGE_DELAY = 2500; // 2-second delay between messages
const TIMEOUT_DURATION = 60000; // 1-minute timeout to clear state
const COOLDOWN_DURATION = 60000; // 1-minute wait after beffore new conversation

whatsapp.on('message', async (message) => {
    const userId = message.from;

    if (userStates[userId]?.cooldown) {
        const now = Date.now();
        const cooldownEnd = userStates[userId].cooldownEndTime;

        if (now < cooldownEnd) {
            console.log(`User ${userId} is in cooldown. Ignoring message.`);
            return;
        }

        console.log(`Cooldown for user ${userId} ended. Starting new session.`);
        clearUserState(userId);
        startNewSession(userId, message);
        return;
    }

    if (!userStates[userId]) {
        startNewSession(userId, message);
    } else {
        const userState = userStates[userId];

        // Add the message to the pending string for combine the waiting
        userState.pendingMessages = userState.pendingMessages
            ? userState.pendingMessages + " " + message.body.trim()
            : message.body.trim();

        // Handle delay
        if (userState.delayTimeout) {
            clearTimeout(userState.delayTimeout);
        }

        userState.delayTimeout = setTimeout(async () => {
            if (!userState.waitingForAnswer) return;

            const currentIndex = userState.currentQuestionIndex;

            // Save the combined answer
            userState.answers[currentIndex] = userState.pendingMessages.trim();
            userState.pendingMessages = "";
            userState.waitingForAnswer = false;

            if (currentIndex < questions.length - 1) {
                userState.currentQuestionIndex++;
                await message.reply(questions[userState.currentQuestionIndex]);
                userState.waitingForAnswer = true;
            } else {
                await message.reply(finalMessage);
                console.log(`User ${userId} answers:`, userState.answers);
                startCooldown(userId);
            }
        }, MESSAGE_DELAY);
    }
});

/**
 * Starts a new questioning for a chat.
 */
async function startNewSession(userId, message) {
    userStates[userId] = {
        currentQuestionIndex: 0,
        answers: [],
        pendingMessages: "", // To save combined messages
        waitingForAnswer: true,
        delayTimeout: null,
        sessionTimeout: null,
        cooldown: false,
        cooldownEndTime: null
    };
    await message.reply(questions[0]);
    resetSessionTimeout(userId, message);
}

/**
 * Resets the session timeout for a user.
 * If no message is received for the provided time, the user's history is cleared, and the next question will start from the beginning.
 */
function resetSessionTimeout(userId, message) {
    const userState = userStates[userId];

    // Clear any existing timeout
    if (userState.sessionTimeout) {
        clearTimeout(userState.sessionTimeout);
    }

    // Set a new session timeout
    userState.sessionTimeout = setTimeout(async () => {
        console.log(`Session for user ${userId} expired due to inactivity.`);
        clearUserState(userId); // Clear the history
    }, TIMEOUT_DURATION);
}

/**
 * wait to the manager to answer
 */
function startCooldown(userId) {
    const userState = userStates[userId];
    userState.cooldown = true; // Activate waiting
    userState.cooldownEndTime = Date.now() + COOLDOWN_DURATION; // Set end time
    console.log(`Cooldown started for user ${userId}. Ends at: ${new Date(userState.cooldownEndTime).toLocaleTimeString()}`);
}

/**
 * Clears the user questions history.
 */
function clearUserState(userId) {
    if (userStates[userId]) {
        clearTimeout(userStates[userId].delayTimeout);
        clearTimeout(userStates[userId].sessionTimeout);
        delete userStates[userId];
    }
}



whatsapp.initialize();
