const { exec } = require('child_process');

/**
 * Attempts to open an application on the host laptop.
 * @param {string} appName The name of the application to open (e.g., "chrome", "notepad").
 * @returns {Promise<string>} Result message.
 */
function openApplication(appName) {
    return new Promise((resolve, reject) => {
        // Simple heuristic: passing appName to the Windows 'start' command. 
        // This relies on the app executable being in the PATH or registered.
        const command = `start ${appName}`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                // Return resolve instead of reject so the bot can tell the user it failed instead of crashing
                resolve(`Failed to open application '${appName}'. Error: ${error.message}`);
                return;
            }
            resolve(`Successfully requested to open application: ${appName}`);
        });
    });
}

module.exports = { openApplication };