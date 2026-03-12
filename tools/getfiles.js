const fs = require('fs');
const path = require('path');

/**
 * Lists the contents of a directory.
 * @param {string} directoryPath The path to list.
 * @returns {string} The contents.
 */
function listFiles(directoryPath) {
    try {
        // Default to current directory if none provided
        const fullPath = path.resolve(directoryPath || '.');
        const files = fs.readdirSync(fullPath);
        if (files.length === 0) return `Directory is empty: ${fullPath}`;
        return `Contents of ${fullPath}:\n${files.join('\n')}`;
    } catch (err) {
        return `Failed to list files: ${err.message}`;
    }
}

/**
 * Instructs the bot to upload a file to Telegram.
 * @param {string} filePath The requested file path.
 * @returns {object|string} A specific object instructing the bot to send the file, or an error string.
 */
function sendFile(filePath) {
    try {
        const fullPath = path.resolve(filePath);
        if (!fs.existsSync(fullPath)) {
            return `File not found: ${fullPath}`;
        }
        
        // Return a special object the bot can intercept to trigger 'sendDocument'
        return {
            __isFileResponse: true,
            filePath: fullPath
        };
    } catch (err) {
        return `Error accessing file: ${err.message}`;
    }
}

module.exports = { listFiles, sendFile };