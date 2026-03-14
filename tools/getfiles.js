const fs = require('fs');
const path = require('path');
const fg = require('fast-glob');
const os = require('os');

// ==========================================
// CONFIGURATION & GUARDRAILS
// ==========================================

// 1. Sensitive Directories (Paths that require user confirmation)
const SENSITIVE_DIRECTORIES = os.platform() === 'win32'
    ? [
        'C:\\Windows',
        'C:\\ProgramData',
        'C:\\Users\\Default',
        'C:\\System Volume Information',
        'C:\\$Recycle.Bin',
        path.join(os.homedir(), 'AppData'),
        path.join(os.homedir(), '.ssh'),
        path.join(os.homedir(), '.aws'),
        path.join(os.homedir(), '.bash_history')
    ]
    : [
        '/System',
        '/Library',
        '/usr/sbin',
        '/usr/bin',
        '/private',
        '/var',
        path.join(os.homedir(), 'Library'),
        path.join(os.homedir(), '.ssh'),
        path.join(os.homedir(), '.aws'),
        path.join(os.homedir(), '.bash_history')
    ];

// 2. Directories to completely ignore during search
const GLOBAL_IGNORED_PATTERNS = [
    '**/node_modules/**',
    '**/.git/**',
    '**/.vscode/**',
    '**/AppData/**',
    '**/$Recycle.Bin/**',
    '**/Library/**',    // macOS Sandbox noise
    '**/System/**',     // macOS System noise
    '**/tmp/**',
    '**/temp/**'
];

// 3. Max Telegram File Size (50MB limit)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Normalizes a path by stripping redundant prefixes and resolving it canonical.
 * Handles macOS specific /Volumes/Macintosh HD aliases.
 */
function normalizePath(p) {
    if (!p) return '';
    let normalized = p.trim().replace(/\\/g, '/');
    
    // macOS Specific: Strip redundant /Volumes/Macintosh HD prefix
    if (os.platform() === 'darwin') {
        const volPrefix = '/Volumes/Macintosh HD';
        if (normalized.startsWith(volPrefix)) {
            normalized = normalized.substring(volPrefix.length);
        } else if (normalized.startsWith(volPrefix.substring(1))) {
            normalized = normalized.substring(volPrefix.length - 1);
        }
        if (normalized === '') normalized = '/';
    }

    // Attempt to resolve it
    let resolved = path.resolve(normalized);
    
    // If it doesn't exist as resolved, try relative to home dir if it looks like a sub-path
    if (!fs.existsSync(resolved) && !path.isAbsolute(normalized)) {
        const homeResolved = path.join(os.homedir(), normalized);
        if (fs.existsSync(homeResolved)) {
            resolved = homeResolved;
        }
    }

    return resolved;
}
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

    // macOS / Unix
    const roots = ['/'];
    try {
        if (fs.existsSync('/Volumes')) {
            const volumes = fs.readdirSync('/Volumes');
            volumes.forEach(v => {
                const vPath = path.join('/Volumes', v);
                if (fs.lstatSync(vPath).isDirectory()) {
                    roots.push(vPath);
                }
            });
        }
    } catch (e) { }
    return roots;
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

        // Normalize the input
        const normalizedInput = folderName.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

        // 1. Check if the input is already an absolute path
        const absolutePath = normalizePath(folderName);
        if (fs.existsSync(absolutePath) && fs.lstatSync(absolutePath).isDirectory()) {
            console.log(`[listFiles] Input is a valid absolute path: ${absolutePath}`);
            if (isPathSensitive(absolutePath)) {
                return `Access Denied: The path '${absolutePath}' is in a sensitive area. Privacy concerns prevent access.`;
            }
            
            // Canonicalize the absolute path to be safe
            let finalPath = absolutePath;
            try {
                finalPath = fs.realpathSync(absolutePath);
            } catch (e) {}
            
            // Get files and sort by mtime descending
            const files = fs.readdirSync(absolutePath).map(file => {
                const filePath = path.join(absolutePath, file);
                try {
                    return { name: file, mtime: fs.statSync(filePath).mtimeMs };
                } catch (e) {
                    return { name: file, mtime: 0 };
                }
            });
            
            files.sort((a, b) => b.mtime - a.mtime);
            const sortedFileNames = files.map(f => f.name);

            if (sortedFileNames.length === 0) return `Directory is empty: ${absolutePath}`;
            return `Contents of ${absolutePath} (Newest first):\n${sortedFileNames.join('\n')}`;
        }

        const rootsToSearch = getSystemRoots();
        let allFoundPaths = [];

        const blockedRootFolders = os.platform() === 'win32'
            ? ['windows', 'program files', 'program files (x86)', 'programdata', 'system volume information', '$recycle.bin']
            : ['system', 'library', 'var', 'private', 'usr', 'bin', 'sbin', 'dev', 'net', 'home', 'users'];

        for (const root of rootsToSearch) {
            let safeBase = root.replace(/\\/g, '/').replace(/\/$/, '');
            if (safeBase.length === 2 && safeBase[1] === ':') safeBase += '/';
            if (safeBase === '') safeBase = '/';

            // Build search pattern: match any path ending with the normalized input
            let patternsToSearch = [];

            try {
                if (safeBase.endsWith(':/') || safeBase === '/') {
                    const topLevelItems = fs.readdirSync(safeBase, { withFileTypes: true });
                    for (const item of topLevelItems) {
                        if (item.isDirectory()) {
                            if (!blockedRootFolders.includes(item.name.toLowerCase())) {
                                // Match paths ending with internal input
                                patternsToSearch.push(`${safeBase}${item.name}/**/${normalizedInput}`);
                            }
                        }
                    }
                    // Explicitly include home dir
                    const homeDir = os.homedir().replace(/\\/g, '/');
                    patternsToSearch.push(`${homeDir}/**/${normalizedInput}`);
                } else {
                    patternsToSearch.push(`${safeBase}/**/${normalizedInput}`);
                }
            } catch (fsErr) {
                patternsToSearch.push(`${safeBase}/**/${normalizedInput}`);
            }

            console.log(`[listFiles] Searching ${patternsToSearch.length} patterns for path ending in '${normalizedInput}'...`);

            const entries = await fg(patternsToSearch, {
                dot: false,
                ignore: GLOBAL_IGNORED_PATTERNS,
                caseSensitiveMatch: false,
                suppressErrors: true,
                absolute: true,
                onlyDirectories: true,
                deep: 8
            });

            allFoundPaths.push(...entries);
        }

        // Filter out sensitive paths and canonicalize
        const safePathsSet = new Set();
        allFoundPaths.forEach(p => {
            try {
                // Use realpathSync to resolve symlinks and unify paths (e.g. resolve /Volumes/Macintosh HD to /)
                const realP = fs.realpathSync(p);
                const normalizedP = path.normalize(realP);
                if (!isPathSensitive(normalizedP)) {
                    safePathsSet.add(normalizedP);
                }
            } catch (e) {
                // If realpathSync fails (e.g. permission), fallback to normalized original if not sensitive
                const normalizedP = path.normalize(p);
                if (!isPathSensitive(normalizedP)) {
                    safePathsSet.add(normalizedP);
                }
            }
        });

        const safePaths = Array.from(safePathsSet);

        // Sort safePaths by modification time descending
        const pathsWithTime = safePaths.map(p => {
            try {
                return { path: p, mtime: fs.statSync(p).mtimeMs };
            } catch (e) {
                return { path: p, mtime: 0 };
            }
        });
        pathsWithTime.sort((a, b) => b.mtime - a.mtime);
        const sortedSafePaths = pathsWithTime.map(p => p.path);

        if (sortedSafePaths.length === 0) {
            return `No folders found matching '${normalizedInput}'.`;
        }

        // Single match: return the contents of that folder
        if (sortedSafePaths.length === 1) {
            const folderPath = sortedSafePaths[0];
            const files = fs.readdirSync(folderPath).map(file => {
                const filePath = path.join(folderPath, file);
                try {
                    return { name: file, mtime: fs.statSync(filePath).mtimeMs };
                } catch (e) {
                    return { name: file, mtime: 0 };
                }
            });
            
            files.sort((a, b) => b.mtime - a.mtime);
            const sortedFileNames = files.map(f => f.name);

            if (sortedFileNames.length === 0) return `Directory is empty: ${folderPath}`;
            return `Contents of ${folderPath} (Newest first):\n${sortedFileNames.join('\n')}`;
        }

        // Multiple matches: return structured data for agent.js bypass
        const displayLimit = 30;
        const displayPaths = sortedSafePaths.slice(0, displayLimit);
        let summaryText = `I found ${sortedSafePaths.length} folders mapping to '${normalizedInput}' (Ordered by most recently updated).`;
        
        if (sortedSafePaths.length > displayLimit) {
            summaryText += ` Showing the top ${displayLimit}. Please provide the exact absolute path from the list below to view its contents.`;
        } else {
            summaryText += ` Please select the folder you want to open by providing its absolute path.`;
        }

        return {
            __isRawDataResponse: true,
            paths: displayPaths,
            text: summaryText,
            totalCount: sortedSafePaths.length
        };
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
        const fullPath = normalizePath(filePath);

        if (isPathSensitive(fullPath)) {
            return `Access Denied: The path '${fullPath}' is in a sensitive area. Privacy concerns prevent downloading.`;
        }

        if (!fs.existsSync(fullPath)) return `File or Directory not found: ${fullPath}`;

        let finalPath = fullPath;
        let isTempFile = false;
        const stats = fs.statSync(fullPath);

        // If it's a directory, zip it natively
        if (stats.isDirectory()) {
            const tempDir = os.tmpdir();
            const zipFileName = `${path.basename(fullPath)}_${Date.now()}.zip`;
            finalPath = path.join(tempDir, zipFileName);

            const exec = require('child_process').execSync;
            if (os.platform() === 'win32') {
                exec(`tar.exe -a -c -f "${finalPath}" -C "${path.dirname(fullPath)}" "${path.basename(fullPath)}"`);
            } else {
                // macOS / Unix zip
                exec(`zip -r "${finalPath}" "${path.basename(fullPath)}"`, {
                    cwd: path.dirname(fullPath)
                });
            }
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

            const blockedRootFolders = os.platform() === 'win32'
                ? ['windows', 'program files', 'program files (x86)', 'programdata', 'system volume information', '$recycle.bin']
                : ['system', 'library', 'var', 'private', 'usr', 'bin', 'sbin', 'dev', 'net', 'home'];

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