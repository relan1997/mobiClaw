require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fs = require("fs");

const { processMessage } = require('./ai/agent');

const token = process.env.BOT_TOKEN;
const allowedChatsStr = process.env.ALLOWED_CHAT_IDS || '';

const allowedChats = allowedChatsStr
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

if (!token) {
    console.error("Error: BOT_TOKEN is not set in the .env file.");
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// In-memory chat history per chat (keyed by chatId)
const chatHistories = new Map();

/* ---------------- FILE SENDER ---------------- */

async function sendFileToTelegram(bot, chatId, fileInfo) {

    if (!fileInfo || !fileInfo.__isFileResponse) return;

    const stream = fs.createReadStream(fileInfo.filePath);

    await bot.sendDocument(chatId, stream, {
        caption: `📁 File: ${fileInfo.fileName}`
    });

    console.log(`[Sent] File: ${fileInfo.fileName}`);

    if (fileInfo.__isTempFile) {
        fs.unlinkSync(fileInfo.filePath);
    }
}

/* ---------------- MAIN MESSAGE HANDLER ---------------- */

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name || msg.from.username || "Unknown User";

    console.log(`\n--- [Telegram] New Message from ${name} (${chatId}) ---`);
    console.log(`[Message] "${msg.text || '[Non-text message]'}"`);

    if (!msg.text) {
        console.log(`[Info] Skipping processing: No text content in message.`);
        return;
    }

    // Authorization check omitted as per existing code...

    bot.sendChatAction(chatId, 'typing').catch(() => {});

    try {
        console.log(`[Step 1] Retrieving chat history...`);
        // Get or create chat history for this chat
        if (!chatHistories.has(chatId)) {
            console.log(`[History] Creating new history for chatId: ${chatId}`);
            chatHistories.set(chatId, []);
        }
        const history = chatHistories.get(chatId);
        console.log(`[History] Current history length: ${history.length}`);

        console.log(`[Step 2] Passing message to AI Agent...`);
        const result = await processMessage(msg.text, history);

        console.log(`[Step 3] Agent processing finished. Result type: ${typeof result}`);
        if (!result) {
            console.warn(`[Warning] Agent returned an empty result.`);
            return;
        }

        /* -------- SEND TEXT -------- */

        if (result.text) {
            console.log(`[Telegram] Sending text response (length: ${result.text.length})...`);
            await bot.sendMessage(chatId, result.text);
            console.log("[Telegram] Text response sent successfully.");
        }

        /* -------- SEND FILES -------- */

        if (Array.isArray(result.files) && result.files.length > 0) {
            console.log(`[Telegram] Sending ${result.files.length} file(s)...`);
            for (const file of result.files) {
                await sendFileToTelegram(bot, chatId, file);
            }
            console.log("[Telegram] All files sent.");
        }

        /* -------- UPDATE CHAT HISTORY -------- */

        console.log(`[Step 4] Updating chat history...`);
        // Store the user message and bot response in history
        history.push({ role: 'user', text: msg.text });
        if (result.text) {
            history.push({ role: 'bot', text: result.text });
        }

        // Keep only the last 20 messages to avoid memory bloat
        while (history.length > 20) {
            history.shift();
        }
        console.log(`[History] Updated. New length: ${history.length}`);
        console.log(`--- [Telegram] Message handling completed for ${chatId} ---\n`);

    } catch (error) {
        console.error(`[CRITICAL ERROR] Failed to handle message for ${chatId}:`, error);

        bot.sendMessage(
            chatId,
            `❌ System Error:\n${error.message}`
        ).catch(console.error);
    }

});

console.log("Nudge bot backend is running...");
console.log("Waiting for messages from authorized Telegram users...");