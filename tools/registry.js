const { openApplication } = require('./applications');
const { listFiles, sendFile, zipFolder, findFilesByName } = require('./getfiles');
const { executeScript } = require('./runscripts');
const { getSystemStats } = require('./sysinfo');

const toolsMapping = {
    openApplication,
    listFiles,
    sendFile,
    zipFolder,
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
      description: "Searches for a folder by name or sub-path on the user's Windows machine. If multiple matching folders are found, returns the list of paths. If exactly one folder is found, lists its contents.",
      parameters: {
        type: "OBJECT",
        properties: {
          directoryPath: {
            type: "STRING",
            description: "The folder name or sub-path to search for (e.g., 'Documents', 'harshal/Documents', 'Projects/myApp')."
          }
        },
        required: ["directoryPath"]
      }
    },
    {
      name: "sendFile",
      description: "Uploads a specific local file from the user's machine to the Telegram chat. Only works with files, NOT folders. For folders, use zipFolder instead.",
      parameters: {
        type: "OBJECT",
        properties: {
          filePath: {
            type: "STRING",
            description: "The absolute path of the file to send (e.g., '/Users/john/Documents/report.pdf')."
          }
        },
        required: ["filePath"]
      }
    },
    {
      name: "zipFolder",
      description: "Compresses an entire folder into a .zip file and sends it to the Telegram chat. Only works with directories, NOT individual files. For files, use sendFile instead.",
      parameters: {
        type: "OBJECT",
        properties: {
          folderPath: {
            type: "STRING",
            description: "The absolute path or name of the folder to zip and send (e.g., '/Users/john/Documents/myProject' or 'Downloads/myProject')."
          }
        },
        required: ["folderPath"]
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
