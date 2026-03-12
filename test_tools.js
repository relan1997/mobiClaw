const { getSystemStats } = require('./tools/sysinfo');
const { executeScript } = require('./tools/runscripts');
const { listFiles, sendFile } = require('./tools/getfiles');

async function runTests() {
    console.log("=== Testing Tools Local Execution ===\n");

    console.log("[1] Testing System Stats:");
    const stats = await getSystemStats();
    console.log(stats + "\n");

    console.log("[2] Testing Script Execution ('echo Hello World'):");
    const scriptRes = await executeScript('echo Hello World');
    console.log(scriptRes + "\n");

    console.log("[3] Testing Directory Listing ('.'):");
    const files = listFiles('.');
    console.log(files + "\n");

    console.log("[4] Testing File Send (package.json):");
    const sent = sendFile('package.json');
    console.log(sent);
    console.log("\n");

    console.log("Not testing openApplication automatically to prevent unexpected windows opening.");
    console.log("=== Tests Completed ===");
}

runTests().catch(console.error);
