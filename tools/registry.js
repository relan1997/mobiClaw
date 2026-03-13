const { openApplication } = require('./applications');
const { listFiles, sendFile, findFilesByName } = require('./getfiles');
const { executeScript } = require('./runscripts');
const { getSystemStats } = require('./sysinfo');

const toolsMapping = {
    openApplication,
    listFiles,
    sendFile,
    findFilesByName,
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
    },
    {
      name: "listFiles",
      description: "Lists the files and folders inside a specific directory on the user's local machine.",
      parameters: {
        type: "OBJECT",
        properties: {
          directoryPath: {
            type: "STRING",
            description: "The absolute path of the directory to list (e.g., 'C:\\Users\\John\\Documents' or 'D:\\')."
          }
        },
        required: ["directoryPath"]
      }
    },
    {
      name: "sendFile",
      description: "Uploads a specific local file or folder from the user's machine to the Telegram chat. If a folder is passed, it will be automatically zipped before sending.",
      parameters: {
        type: "OBJECT",
        properties: {
          filePath: {
            type: "STRING",
            description: "The absolute path of the file or folder to send (e.g., 'C:\\Users\\John\\Documents\\report.pdf' or 'C:\\Users\\John\\Documents')."
          }
        },
        required: ["filePath"]
      }
    },
    {
      name: "findFilesByName",
      description: "Searches the user's entire local computer (or a specific drive/folder) for files OR folders matching a specific name. Uses fast-glob for substring matching.",
      parameters: {
        type: "OBJECT",
        properties: {
          fileName: {
            type: "STRING",
            description: "The name or partial name of the file or folder to search for (e.g., 'rajat', 'budget.xlsx', 'src', 'config')."
          },
          searchRoot: {
            type: "STRING",
            description: "Optional. A specific drive or directory to narrow the search (e.g., 'D:\\' or 'C:\\Users\\John'). If omitted, it searches the entire system."
          }
        },
        required: ["fileName"]
      }
    }
];

module.exports = { toolsMapping, toolSchemas };
