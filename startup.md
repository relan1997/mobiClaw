# Startup Guide: Telegram Bot Backend

Follow these steps to set up and run your local Node.js Telegram Bot terminal application.

## 1. Prerequisites
- **Node.js**: Ensure you have Node.js installed on your computer. You can download it from [nodejs.org](https://nodejs.org/).
- **Telegram Bot Token**: You need a token from Telegram to authenticate your bot.
  - Open Telegram and search for `@BotFather`.
  - Type `/newbot` and follow the prompts to create your bot.
  - Copy the **HTTP API Token** provided at the end (it will look something like `123456789:ABCdefGHIjklMNOpqrSTUvwxYZ`).

## 2. Project Setup
1. Open your terminal and navigate to the project directory:
   ```bash
   cd /Users/harshal.relan@zomato.com/Public/Telegram_Bot
   ```
2. Install the required Node.js dependencies:
   ```bash
   npm install
   ```

## 3. Configuration
1. Open the `.env` file located in the project root. (If it doesn't exist, create it).
2. Paste your Telegram Bot Token into the file so it looks exactly like this:
   ```env
   BOT_TOKEN=your_actual_token_here
   ```
   *(Note: Never share this token publicly or commit the `.env` file to a public repository. It is already included in `.gitignore`.)*

## 4. Running the Application
1. Start the bot by running the following command in your terminal:
   ```bash
   node index.js
   ```
2. You should see the following output indicating the bot is ready:
   ```
   Bot backend is running...
   Waiting for messages from Telegram...
   ```

## 5. Usage
- **Receiving Messages**: Keep the terminal window open. When anyone sends a message to your bot on Telegram, you will see their name and message appear in this terminal.
- **Replying**: To reply, simply type your message back directly into the terminal window and press **Enter**. The message will be sent to the user who most recently messaged your bot.
