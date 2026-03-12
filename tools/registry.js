const { openApplication } = require('./applications');
const { listFiles, sendFile } = require('./getfiles');
const { executeScript } = require('./runscripts');
const { getSystemStats } = require('./sysinfo');

const toolsMapping = {
    openApplication,
    listFiles,
    sendFile,
    executeScript,
    getSystemStats
};

const toolSchemas = [
    {
        name: "openApplication",
        description: "Opens or launches an application on the Windows laptop.",
        parameters: {
            type: "OBJECT",
            properties: {
                appName: { 
                    type: "STRING", 
                    description: "The name of the application to launch (e.g. 'chrome', 'notepad')" 
                }
            },
            required: ["appName"]
        }
    },
    {
        name: "listFiles",
        description: "Lists the contents of a directory on the system to find files. Never returns file contents, only names.",
        parameters: {
            type: "OBJECT",
            properties: {
                directoryPath: { 
                    type: "STRING", 
                    description: "The absolute directory path to list. Leave empty to list the current directory." 
                }
            }
        }
    },
    {
        name: "sendFile",
        description: "Uploads an actual file to the user via Telegram. Use this when the user asks to see the contents of a file or send them a document.",
        parameters: {
            type: "OBJECT",
            properties: {
                filePath: { 
                    type: "STRING", 
                    description: "The absolute path of the file to send." 
                }
            },
            required: ["filePath"]
        }
    },
    {
        name: "executeScript",
        description: "Executes a Command Prompt script/command natively on the Windows laptop. Returns stdout and stderr.",
        parameters: {
            type: "OBJECT",
            properties: {
                command: { 
                    type: "STRING", 
                    description: "The exact shell command to execute." 
                }
            },
            required: ["command"]
        }
    },
    {
        name: "getSystemStats",
        description: "Gets standard system information like CPU usage, RAM, and OS details.",
        parameters: {
            type: "OBJECT",
            properties: {}
        }
    }
];

module.exports = { toolsMapping, toolSchemas };
