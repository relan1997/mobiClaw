const si = require('systeminformation');

/**
 * Gets vital system information like CPU, Memory, and OS details.
 * @returns {Promise<string>} A formatted string with the system stats.
 */
async function getSystemStats() {
    try {
        const [cpu, mem, os] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.osInfo()
        ]);

        const cpuLoad = Math.round(cpu.currentLoad);
        const memUsed = Math.round(mem.active / (1024 * 1024 * 1024) * 100) / 100;
        const memTotal = Math.round(mem.total / (1024 * 1024 * 1024) * 100) / 100;
        const memPercent = Math.round((mem.active / mem.total) * 100);

        return `🖥️ **System Status:**\n` +
               `**OS:** ${os.distro} ${os.release}\n` +
               `**CPU Usage:** ${cpuLoad}%\n` +
               `**Memory:** ${memUsed} GB / ${memTotal} GB (${memPercent}%)\n`;
    } catch (error) {
        return `Failed to get system stats: ${error.message}`;
    }
}

module.exports = { getSystemStats };
