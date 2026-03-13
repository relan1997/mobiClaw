const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');
const os = require('os');

// ==========================================
// CONFIGURATION & GUARDRAILS
// ==========================================

// 1. Sensitive Directories (Paths that require user confirmation)
const SENSITIVE_DIRECTORIES = [
    'C:\\Windows',
    'C:\\ProgramData',
    'C:\\Users\\Default',
    'C:\\System Volume Information',
    'C:\\$Recycle.Bin',
    'C:\\pagefile.sys',
    'C:\\hiberfil.sys',
    'C:\\swapfile.sys',
    path.join(os.homedir(), '.ssh'),
    path.join(os.homedir(), '.aws'),
    path.join(os.homedir(), '.azure'),
    path.join(os.homedir(), '.kube'),
    path.join(os.homedir(), '.gnupg'),
    path.join(os.homedir(), 'AppData'),
    path.join(os.homedir(), '.cursor'),
    path.join(os.homedir(), '.bash_history')
];

// 2. Directories to completely ignore during full-system search (Saves RAM/Time)
const GLOBAL_IGNORED_PATTERNS = [
    '**/node_modules/**', 
    '**/.git/**', 
    '**/.vscode/**', 
    '**/AppData/**',
    '**/$Recycle.Bin/**'
];

// 3. Max Telegram File Size (50MB limit)
const MAX_FILE_SIZE = 50 * 1024 * 1024; 

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Dynamically finds available drives on Windows (C:\, D:\) or root (/) on Unix.
 */
function getSystemRoots() {
    if (os.platform() === 'win32') {
        const drives = [];
        for (let i = 65; i <= 90; i++) {
            const drive = String.fromCharCode(i) + ':\\';
            try {
                if (fs.existsSync(drive)) drives.push(drive);
            } catch (e) { }
        }
        return drives.length > 0 ? drives : ['C:\\'];
    }
    return ['/']; 
}

/**
 * Checks if a requested path falls within a defined sensitive directory.
 */
function isPathSensitive(requestedPath) {
    const normalizedRequest = path.resolve(requestedPath).toLowerCase();
    return SENSITIVE_DIRECTORIES.some(sensitivePath => {
        const normalizedSensitive = path.resolve(sensitivePath).toLowerCase();
        return normalizedRequest.startsWith(normalizedSensitive);
    });
}

// ==========================================
// CORE FUNCTIONS
// ==========================================

/**
 * Searches for folders matching a name or sub-path across all Windows drives.
 * If multiple matching folders are found, returns the list of paths.
 * If exactly one match is found, returns the contents of that folder.
 * @param {string} folderName The folder name or sub-path to search for (e.g., 'Documents', 'harshal/Documents').
 * @returns {Promise<string>} The search results or folder contents.
 */
async function listFiles(folderName) {
    try {
        if (!folderName || folderName.trim() === '') {
            return 'Error: Please provide a folder name or sub-path to search for.';
        }

        // Normalize the input: strip leading/trailing slashes, convert backslashes to forward slashes
        const normalizedInput = folderName.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

        const rootsToSearch = getSystemRoots();
        let allFoundPaths = [];

        const blockedRootFolders = [
            'windows', 'program files', 'program files (x86)', 'programdata',
            'system volume information', '$recycle.bin', 'documents and settings',
            'recovery', 'perflogs', 'config.msi'
        ];

        for (const root of rootsToSearch) {
            let safeBase = root.replace(/\\/g, '/').replace(/\/$/, '');
            if (safeBase.length === 2 && safeBase[1] === ':') safeBase += '/';

            // Build search pattern: match any path ending with the normalized input
            let patternsToSearch = [];

            try {
                if (safeBase.endsWith(':/') || safeBase === '/') {
                    const topLevelItems = fs.readdirSync(safeBase, { withFileTypes: true });
                    for (const item of topLevelItems) {
                        if (item.isDirectory()) {
                            if (!blockedRootFolders.includes(item.name.toLowerCase())) {
                                patternsToSearch.push(`${safeBase}${item.name}/**/${normalizedInput}`);
                            }
                        }
                    }
                } else {
                    patternsToSearch.push(`${safeBase}/**/${normalizedInput}`);
                }
            } catch (fsErr) {
                patternsToSearch.push(`${safeBase}/**/${normalizedInput}`);
            }

            console.log(`[listFiles] Searching ${patternsToSearch.length} patterns for '${normalizedInput}'...`);

            const entries = await fg(patternsToSearch, {
                dot: false,
                ignore: GLOBAL_IGNORED_PATTERNS,
                caseSensitiveMatch: false,
                suppressErrors: true,
                absolute: true,
                onlyDirectories: true
            });

            allFoundPaths.push(...entries);
        }

        // Filter out sensitive paths
        const safePaths = allFoundPaths
            .map(p => path.normalize(p))
            .filter(p => !isPathSensitive(p));

        if (safePaths.length === 0) {
            return `No folders found matching '${normalizedInput}'.`;
        }

        // Single match: return the contents of that folder
        if (safePaths.length === 1) {
            const folderPath = safePaths[0];
            const files = fs.readdirSync(folderPath);
            if (files.length === 0) return `Directory is empty: ${folderPath}`;
            return `Contents of ${folderPath}:\n${files.join('\n')}`;
        }

        // Multiple matches: return the list of folder paths
        return `Found ${safePaths.length} folders matching '${normalizedInput}':\n${safePaths.join('\n')}`;
    } catch (err) {
        return `Failed to search for folders: ${err.message}`;
    }
}

/**
 * Instructs the bot to upload a file to Telegram.
 * @param {string} filePath The requested file path.
 * @param {boolean} userConfirmed Whether the user explicitly approved access.
 * @returns {object|string} Instruction object, confirmation request, or error.
 */
function sendFile(filePath) {
    try {
        const fullPath = path.resolve(filePath);

        if (isPathSensitive(fullPath)) {
            return `Access Denied: The path '${fullPath}' is in a sensitive area. Privacy concerns prevent downloading.`;
        }

        if (!fs.existsSync(fullPath)) return `File or Directory not found: ${fullPath}`;

        let finalPath = fullPath;
        let isTempFile = false;
        const stats = fs.statSync(fullPath);

        // If it's a directory, zip it natively on Windows before sending
        if (stats.isDirectory()) {
            const tempDir = os.tmpdir();
            const zipFileName = `${path.basename(fullPath)}_${Date.now()}.zip`;
            finalPath = path.join(tempDir, zipFileName);
            
            // Native Windows tar command creates zip files if extension is .zip
             require('child_process').execSync(`tar.exe -a -c -f "${finalPath}" -C "${path.dirname(fullPath)}" "${path.basename(fullPath)}"`);
            isTempFile = true;
        }

        const finalStats = fs.statSync(finalPath);
        if (finalStats.size > MAX_FILE_SIZE) {
            const sizeInMB = (finalStats.size / (1024 * 1024)).toFixed(2);
            if (isTempFile) fs.unlinkSync(finalPath); // Clean up oversized zip
            return `Error: Size is too large for Telegram (${sizeInMB} MB). Max is 50 MB.`;
        }
        
        return {
            __isFileResponse: true,
            filePath: finalPath,
            fileName: path.basename(finalPath),
            __isTempFile: isTempFile
        };
    } catch (err) {
        return `Error accessing path: ${err.message}`;
    }
}

/**
 * Searches the entire system or a specified root for a file.
 * @param {string} fileName The name of the file to search for.
 * @param {string} [searchRoot] Optional. A specific drive (e.g., 'D:\'). Defaults to whole system.
 * @param {boolean} userConfirmed Whether the user explicitly approved a sensitive search root.
 * @returns {Promise<string>} A JSON stringified array of paths, or a confirmation request.
 */
async function findFilesByName(fileName, searchRoot = null) {
    try {
        let rootsToSearch = searchRoot ? [path.resolve(searchRoot)] : getSystemRoots();

        if (searchRoot && isPathSensitive(rootsToSearch[0])) {
            return `Access Denied: Searching inside '${rootsToSearch[0]}' accesses sensitive areas. Privacy concerns prevent access.`;
        }

        let allFoundPaths = [];

        for (const root of rootsToSearch) {
            let safeBase = root.replace(/\\/g, '/').replace(/\/$/, ''); 
            if (safeBase.length === 2 && safeBase[1] === ':') safeBase += '/';

            // DYNAMIC PRUNING: On Windows root drives, hidden Junctions like "Documents and Settings" 
            // cause fast-glob to abort entirely. We must scan top-level folders manually and skip blocked ones.
            let patternsToSearch = [];
            
            const blockedRootFolders = [
                'windows', 'program files', 'program files (x86)', 'programdata', 
                'system volume information', '$recycle.bin', 'documents and settings', 
                'recovery', 'perflogs', 'config.msi'
            ];

            try {
                // Check if this is a root directory (e.g. C:/)
                if (safeBase.endsWith(':/') || safeBase === '/') {
                    const topLevelItems = fs.readdirSync(safeBase, { withFileTypes: true });
                    for (const item of topLevelItems) {
                        if (item.isDirectory()) {
                            if (!blockedRootFolders.includes(item.name.toLowerCase())) {
                                patternsToSearch.push(`${safeBase}${item.name}/**/*${fileName}*`);
                            }
                        }
                    }
                } else {
                    patternsToSearch.push(`${safeBase}/**/*${fileName}*`);
                }
            } catch (fsErr) {
                // Fallback to literal if read fails
                patternsToSearch.push(`${safeBase}/**/*${fileName}*`);
            }
            
            console.log(`[Search] Executing ${patternsToSearch.length} safe patterns in ${safeBase}...`);
            
            const entries = await fg(patternsToSearch, {
                dot: false,
                ignore: GLOBAL_IGNORED_PATTERNS,
                caseSensitiveMatch: false,
                suppressErrors: true, 
                absolute: true,
                onlyFiles: false
            });

            allFoundPaths.push(...entries);
        }

        // Filter out any paths that sneak into sensitive directories
        // (e.g. C:/Users/All Users which is a junction to C:/ProgramData)
        let safePaths = [];
        let sensitiveCount = 0;

        for (const p of allFoundPaths) {
            const normalized = path.normalize(p);
            if (isPathSensitive(normalized)) {
                sensitiveCount++;
            } else {
                safePaths.push(normalized);
            }
        }
        
        // If we found sensitive files but no safe ones, politely decline
        if (safePaths.length === 0 && sensitiveCount > 0) {
            return JSON.stringify({ 
                error: `Privacy Block: Found match(es) for '${fileName}', but they are located inside sensitive system directories. Access is denied.` 
            });
        }

        const responseData = { results: safePaths };

        if (safePaths.length > 30) {
            responseData.warning = `Found ${safePaths.length} safe files. Showing top 30 to save space.`;
            responseData.results = safePaths.slice(0, 30);
        }

        if (safePaths.length === 0) {
            return JSON.stringify({ error: `No files found matching '${fileName}'.` });
        }
        
        if (sensitiveCount > 0) {
            responseData.warning = (responseData.warning ? responseData.warning + " " : "") + 
                `Also hid ${sensitiveCount} match(es) located in sensitive system directories.`;
        }
        
        return JSON.stringify(responseData);
    } catch (err) {
        return `Error searching for file: ${err.message}`;
    }
}

module.exports = { listFiles, sendFile, findFilesByName };