require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { processMessage } = require('./ai/agent');

const token = process.env.BOT_TOKEN;
const allowedChatsStr = process.env.ALLOWED_CHAT_IDS || '';
// Parse comma-separated chat IDs if provided in .env
const allowedChats = allowedChatsStr.split(',').map(id => id.trim()).filter(id => id.length > 0);

if (!token) {
    console.error("Error: BOT_TOKEN is not set in the .env file.");
    process.exit(1);
}

const bot = new TelegramBot(token, {polling: true});

bot.on('message', async (msg) => {
    // console.log("msg is : ",msg);
    const chatId = msg.chat.id;
    const name = msg.from.first_name || msg.from.username || "Unknown User";

    console.log(`\n[Telegram] Message from ${name} (${chatId}): ${msg.text}`);

    // await bot.sendMessage(chatId, "Hello");
    // console.log(`[Sent] Reply successfully sent to Telegram.`);

    // return;

    // Authorization Check: Only allow listed chat IDs (if list is not empty)
    // if (allowedChats.length > 0 && !allowedChats.includes(chatId.toString())) {
    //     console.warn(`[Auth] Unauthorized access attempt from ${name} (chatId: ${chatId})`);
    //     return;
    // }
    
    if (!msg.text) return;

    // Show 'typing...' status to the user
    bot.sendChatAction(chatId, 'typing').catch(() => {});

    try {
        const result = await processMessage(msg.text);

        if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object' && result[0].__isFileResponse) {
            // Check if AI requested to send multiple files
            for (const fileObj of result) {
                await bot.sendDocument(chatId, fileObj.filePath);
                console.log(`[Sent] File successfully sent: ${fileObj.filePath}`);
                if (fileObj.__isTempFile) require('fs').unlinkSync(fileObj.filePath);
            }
        } else if (typeof result === 'object' && result.__isFileResponse) {
            // Legacy single object fallback
            await bot.sendDocument(chatId, result.filePath);
            console.log(`[Sent] File successfully sent: ${result.filePath}`);
            if (result.__isTempFile) require('fs').unlinkSync(result.filePath);
        } else {
            await bot.sendMessage(chatId, result);
            console.log(`[Sent] Reply successfully sent to Telegram.`);
        }
    } catch (error) {
        console.error(`[Error] Failed to process/send message:`, error);
        bot.sendMessage(chatId, `❌ System Error: ${error.message}`).catch(console.error);
    }
});

console.log("MobiClaw bot backend is running...");
console.log("Waiting for messages from authorized Telegram users...");
