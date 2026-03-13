require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { toolsMapping, toolSchemas } = require('../tools/registry');

// Initialize the Google Gen AI SDK. It automatically picks up GEMINI_API_KEY from .env
const ai = new GoogleGenAI({});

const fs = require('fs');
const path = require('path');
const fileSystemSkill = fs.readFileSync(path.join(__dirname, 'skills', 'fileSystemSkill.md'), 'utf-8');

const systemInstruction = `
You are a highly capable AI assistant that controls my Windows laptop.
You have access to several tools. You must use them to accomplish the user's tasks.
When asked to open an app, use 'openApplication'.
When asked about system stats, use 'getSystemStats'.
When asked to list files, use 'listFiles'.
When asked to send or get a file or folder, use 'sendFile'.
When asked to run a command, use 'executeScript'.

[CRITICAL BATCH INSTRUCTION]
If the user asks for multiple distinct actions at once (e.g. "open notepad and find my resume"), you MUST call the corresponding tools in parallel independently in the same response. Do not wait for one to finish before calling the other.

${fileSystemSkill}
`;

/**
 * Processes a natural language message from the user, calls appropriate tools,
 * and returns a response string or a file object.
 * @param {string} userMessage The text message from the user.
 * @returns {Promise<string|object>} The text to reply with, or a file object to send.
 */
async function processMessage(userMessage) {
    try {
        let fullContents = [{ role: 'user', parts: [{ text: userMessage }] }];
        
        // response will be:
        // which tools to call and what arguments to pass to them
        let response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullContents,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ functionDeclarations: toolSchemas }]
            }
        });

        console.log("gemini first response is : ", response);

        //--------------------------------------------------------

        // tool calling which will help to fetch files, text or both

        const parts = response?.candidates?.[0]?.content?.parts || [];

        const functionCalls = parts
            .filter(p => p.functionCall)
            .map(p => p.functionCall);

        let collectedFiles = [];
        let toolText = "";

        for (const call of functionCalls) {
            const functionName = call.name;
            const args = call.args || {};

            console.log(`[AI] Executing tool: ${functionName}`, args);

            let result;

            try {
                if (!toolsMapping[functionName]) {
                    throw new Error(`Unknown tool '${functionName}'`);
                }

                result = await toolsMapping[functionName](...Object.values(args));
            } catch (err) {
                result = `Tool execution failed: ${err.message}`;
            }

            // Collect files
            if (result?.__isFileResponse) {
                collectedFiles.push(result);
            }

            // Collect text
            if (typeof result === "string") {
                toolText += result;
            }

            if (result?.text) {
                toolText += "\n" + result.text;
            }

            if (result?.files) {
                collectedFiles.push(...result.files);
            }
        }

        console.log("tool text is : ", toolText);
        // console.log("collected files is : ", collectedFiles);

        //--------------------------------------------------

        // gemini 2 calling - sending text for refurbishing the response
        // which will send res

        let res = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Rewrite the following system output in a friendly way for a Telegram user.
                            
                            Output:
                            ${toolText}`
                        }
                    ]
                }
            ],
            // config: {
            //     systemInstruction: systemInstruction,
            // }
        });

        //---------------------------------------------------------

        // now res + text will be send from here 
        // in format :
        // {text: "text", files: [full path of file1, full path of file2, ...]}

        return {
            text: toolText,
            files: collectedFiles   // this files should be an array of full paths of files to be sent
        };
        

    } catch (error) {
        console.error('[AI] Error in processMessage:', error);
        return `Sorry, I encountered an AI error: ${error.message}`;
    }
}

module.exports = { processMessage };
