# Telegram Bot Implementation

## Goal
Build a local Telegram bot backend to receive messages from users in the console, and allow the admin to instantly type and send replies back to the user right from the terminal.

## Architecture & Tech Stack
- **Language/Environment**: Node.js
- **Libraries**:
  - `node-telegram-bot-api` (for Telegram API interaction)
  - `dotenv` (to manage environment variables)
- **Built-in modules**:
  - `readline` (to handle standard input/output from the terminal)

## How the Application Communicates with the Bot
There are two primary ways a backend can communicate with Telegram's servers:

1. **Long Polling (`polling: true`)**:
   - The Node.js application continuously makes HTTP GET requests to the Telegram API servers asking, "Are there any new messages?"
   - If there are no messages, Telegram holds the connection open for a short time (hence "long" polling) before responding empty.
   - If a message arrives, Telegram immediately sends the data back to Node.js.
   - We will use this method because it is the easiest to develop locally on your computer. It requires no public IP address or special firewall rules, as your computer is doing the requesting.

2. **Webhooks**:
   - Instead, you tell Telegram: "Whenever you receive a message for my bot, send an HTTP POST request to *this specific URL*."
   - This approach is more efficient for production environments but requires your Node.js app to be accessible from the public internet (usually requiring a service like Ngrok for local development or deploying to a cloud server).

For this project, we will use **Long Polling** via the `node-telegram-bot-api` library.

## Components Breakdown

1. **`package.json`**:
   - Manages project dependencies and basic metadata.
2. **`.env`**:
   - Stores the secret Telegram Bot Token securely.
   - Requires adding `BOT_TOKEN=` inside.
3. **`index.js`**:
   - The main executable file.
   - Initializes the bot instance with the token from `.env`.
   - Listens on the `message` event from the bot to show incoming chats.
   - Tracks the `chatId` of the most recent sender.
   - Sets up a `readline` interface on `process.stdin` to listen for typed console input.
   - When the Enter key is pressed in the console, sends the entered text back to the tracked `chatId`.

## Requirements (Pending from User)
- **Telegram Bot Token**: Needed to authenticate with the Telegram API. Obtainable from BotFather on Telegram.
