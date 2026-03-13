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
        // console.log("userMessage is : ",userMessage);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: userMessage,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ functionDeclarations: toolSchemas }]
            }
        });

        // Extract all function calls from the parts array
        const parts = response.candidates && response.candidates[0] && response.candidates[0].content ? response.candidates[0].content.parts : [];
        const functionCalls = parts
            .filter(part => part.functionCall)
            .map(part => part.functionCall);

        // Check if the AI decided to call one or more tools
        if (functionCalls.length > 0) {
            
            console.log(`[AI] Intercepted ${functionCalls.length} parallel tool request(s).`);

            const functionResponses = [];
            const filesToReturn = [];

            // Execute all requested tools in parallel
            await Promise.all(functionCalls.map(async (call) => {
                const functionName = call.name;
                const args = call.args;

                console.log(`[AI] -> Executing: ${functionName}`, args);

                if (toolsMapping[functionName]) {
                    let toolResult;
                    try {
                        const argValues = Object.keys(toolSchemas.find(s => s.name === functionName).parameters.properties)
                            .map(key => args[key] !== undefined ? args[key] : undefined);
                        toolResult = await toolsMapping[functionName](...argValues);
                    } catch (toolErr) {
                        toolResult = `Tool execution failed: ${toolErr.message}`;
                    }

                    // If a tool requests a direct file upload, capture it.
                    if (typeof toolResult === 'object' && toolResult.__isFileResponse) {
                        filesToReturn.push(toolResult);
                    }

                    // Store the result to send back to the AI
                    functionResponses.push({
                        functionResponse: {
                            name: functionName,
                            response: { result: toolResult }
                        }
                    });
                } else {
                    functionResponses.push({
                        functionResponse: {
                            name: functionName,
                            response: { result: `Error: AI requested unknown tool '${functionName}'` }
                        }
                    });
                }
            }));

            // If any tools explicitly asked to send physical files, we short-circuit and return the array of files to index.js
            if (filesToReturn.length > 0) {
                return filesToReturn;
            }

            // Call Gemini again with ALL the accumulated tool results
            const finalParts = [
                { text: userMessage },
                ...functionCalls.map(c => ({ functionCall: c })),
                ...functionResponses
            ];

            const finalResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { role: 'user', parts: [{ text: userMessage }] }, // Original Prompt
                    { role: 'model', parts: finalParts.slice(1, 1 + functionCalls.length) }, // The AI's tool requests
                    { role: 'user', parts: finalParts.slice(1 + functionCalls.length) } // Our execution answers
                ],
                config: { systemInstruction }
            });

            return finalResponse.text;
        }

        return response.text;
    } catch (error) {
        console.error('[AI] Error in processMessage:', error);
        return `Sorry, I encountered an AI error: ${error.message}`;
    }
}

module.exports = { processMessage };
