require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');
const { toolsMapping, toolSchemas } = require('../tools/registry');

// Initialize the Google Gen AI SDK. It automatically picks up GEMINI_API_KEY from .env
const ai = new GoogleGenAI({});

const fs = require('fs');
const path = require('path');
const fileSystemSkill = fs.readFileSync(path.join(__dirname, 'skills', 'fileSystemSkill.md'), 'utf-8');

const systemPrompt = fs.readFileSync(path.join(__dirname, 'systemPrompt.md'), 'utf-8');

// The system prompt contains placeholders like ${FILE_SYSTEM_SKILL_CONTENT}
const systemInstruction = systemPrompt
    .replace('${FILE_SYSTEM_SKILL_CONTENT}', fileSystemSkill)
    .replace('${TOOL_SCHEMAS}', JSON.stringify(toolSchemas, null, 2))
    .replace('${GREETING_SKILL_CONTENT}', '') 
    .replace('${UNHANDLED_QUERY_SKILL_CONTENT}', ''); 


/**
 * Processes a natural language message from the user, calls appropriate tools,
 * and returns a response string or a file object.
 * @param {string} userMessage The text message from the user.
 * @param {Array} chatHistory Optional array of {role, text} objects representing past conversation.
 * @returns {Promise<string|object>} The text to reply with, or a file object to send.
 */
async function processMessage(userMessage, chatHistory = []) {
    console.log(`\n--- [Agent] Starting processMessage ---`);
    console.log(`[Input] User: "${userMessage}" | History Size: ${chatHistory.length}`);

    try {
        // Format chat history as "user: ... / bot: ..." for context
        let historyText = '';
        if (chatHistory.length > 0) {
            historyText = chatHistory
                .map(entry => `${entry.role}: ${entry.text}`)
                .join('\n');
            historyText = `\n\nChat History (for reference):\n${historyText}\n\n`;
        }

        const messageWithHistory = historyText
            ? `${historyText}Current message: ${userMessage}`
            : userMessage;

        let fullContents = [{ role: 'user', parts: [{ text: messageWithHistory }] }];

        console.log(`[Step 1] Requesting Tool Selection from Gemini...`);
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

        console.log("[Step 1] Gemini Response (Raw):", JSON.stringify(response, null, 2));

        //--------------------------------------------------------

        // tool calling which will help to fetch files, text or both

        const parts = response?.candidates?.[0]?.content?.parts || [];
        const functionCalls = parts
            .filter(p => p.functionCall)
            .map(p => p.functionCall);

        console.log(`[Step 2] Tools to execute: ${functionCalls.length}`);

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
                console.log(`[AI] Tool '${functionName}' result received.`);
            } catch (err) {
                console.error(`[AI] Tool '${functionName}' FAILED:`, err.message);
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

        if (functionCalls.length > 0) {
            console.log(`[Step 2] All tools executed. Compiled text length: ${toolText.length}`);
        } else {
            console.log(`[Step 2] No tools were called. LLM likely provided a direct text response.`);
            // If no tools were called, Gemini might have put its response in toolText if it was returned as regular text part
            const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');
            if (textParts) {
                toolText = textParts;
                console.log(`[Step 2] Direct text response found: "${toolText.substring(0, 50)}..."`);
            }
        }

        //--------------------------------------------------

        // gemini 2 calling - sending text for refurbishing the response
        // which will send res

        console.log(`[Step 3] Requesting Response Refurbishing...`);
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
            ]
        });

        const finalFriendlyText = res?.candidates?.[0]?.content?.parts?.[0]?.text || toolText;
        console.log(`[Step 3] Final response ready (length: ${finalFriendlyText.length})`);

        //---------------------------------------------------------

        // now res + text will be send from here 
        // in format :
        // {text: "text", files: [full path of file1, full path of file2, ...]}

        console.log(`--- [Agent] processMessage Completed Successfully ---\n`);
        return {
            text: finalFriendlyText,
            files: collectedFiles   // this files should be an array of full paths of files to be sent
        };


    } catch (error) {
        console.error('[CRITICAL ERROR] processMessage broke:', error);
        return `Sorry, I encountered an AI error: ${error.message}`;
    }
}

module.exports = { processMessage };
