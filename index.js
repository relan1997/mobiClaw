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

    console.log(`\n[Telegram] Message from ${name} (${chatId}): ${msg.text}`);

    if (!msg.text) return;

    // Authorization check
    // if (allowedChats.length > 0 && !allowedChats.includes(chatId.toString())) {
    //     console.warn(`[Auth] Unauthorized access attempt from ${name} (${chatId})`);
    //     return;
    // }

    bot.sendChatAction(chatId, 'typing').catch(() => {});

    try {

        const result = await processMessage(msg.text);

        console.log("Agent response:", result);

        if (!result) return;

        /* -------- SEND TEXT -------- */

        if (result.text) {
            await bot.sendMessage(chatId, result.text);
            console.log("[Sent] Text response");
        }

        /* -------- SEND FILES -------- */

        if (Array.isArray(result.files) && result.files.length > 0) {

            for (const file of result.files) {
                await sendFileToTelegram(bot, chatId, file);
            }

        }

        /* -------- SEND INFO -------- */

        // if (result.info) {

        //     const infoText =
        //         typeof result.info === "string"
        //             ? result.info
        //             : JSON.stringify(result.info, null, 2);

        //     await bot.sendMessage(chatId, `ℹ️ Info:\n${infoText}`);

        //     console.log("[Sent] Info message");

        // }

    } catch (error) {

        console.error("[Error] Failed to process message:", error);

        bot.sendMessage(
            chatId,
            `❌ System Error:\n${error.message}`
        ).catch(console.error);
    }

});

console.log("MobiClaw bot backend is running...");
console.log("Waiting for messages from authorized Telegram users...");