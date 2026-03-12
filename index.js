require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const readline = require('readline');

// Replace the value of 'BOT_TOKEN' in the .env file with your Telegram Bot token.
const token = process.env.BOT_TOKEN;

if (!token) {
    console.error("Error: BOT_TOKEN is not set in the .env file.");
    process.exit(1);
}

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });

// Keep track of the last user who sent a message so we know who to reply to
let lastChatId = null;

// Sets up a listener for messages from any chat
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    lastChatId = chatId;
    const name = msg.from.first_name || msg.from.username || "Unknown User";

    console.log(`\n[Telegram] Message from ${name}: ${msg.text}`);
    console.log(`(Reply by typing below and pressing Enter...)`);
});

// Set up readline interface to get input from the terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (input) => {
    if (!lastChatId) {
        console.log("No messages received yet. Cannot reply to anyone.");
        return;
    }

    // Send the typed message back to the last user
    bot.sendMessage(lastChatId, input)
        .then(() => {
            console.log(`[Sent] Reply successfully sent to Telegram.`);
        })
        .catch((error) => {
            console.error(`[Error] Failed to send message:`, error.message);
        });
});
//. gut
console.log("Bot backend is running...");
console.log("Waiting for messages from Telegram...");
