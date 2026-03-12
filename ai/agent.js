const { GoogleGenAI } = require('@google/genai');
const { toolsMapping, toolSchemas } = require('../tools/registry');

// Initialize the Google Gen AI SDK. It automatically picks up GEMINI_API_KEY from .env
const ai = new GoogleGenAI({});

const systemInstruction = `
You are a highly capable AI assistant that controls my Windows laptop.
You have access to several tools. You must use them to accomplish the user's tasks.
When asked to open an app, use 'openApplication'.
When asked about system stats, use 'getSystemStats'.
When asked to list files, use 'listFiles'.
When asked to send or get a file, use 'sendFile'.
When asked to run a command, use 'executeScript'.
Always answer politely and concisely. If a tool returns a file to send, simply say something like "Here is the file you requested."
Do NOT assume the user's directory path. Always ask for clarification if the user asks to list files without specifying a directory, or just list the current directory.
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

        // console.log("response is : ",response.candidates[0].content);

        // return "hi";

        // Check if a tool was called
        if (response.functionCalls && response.functionCalls.length > 0) {
            const call = response.functionCalls[0];
            const functionName = call.name;
            const args = call.args;

            console.log(`[AI] Tool requested: ${functionName}`, args);

            if (toolsMapping[functionName]) {
                // Execute the tool
                let toolResult;
                try {
                    // Extract values from the arguments object
                    const argValues = Object.keys(toolSchemas.find(s => s.name === functionName).parameters.properties).map(key => args[key] !== undefined ? args[key] : undefined);
                    // Pass the expected arguments to the function
                    toolResult = await toolsMapping[functionName](...argValues);
                } catch (toolErr) {
                    toolResult = `Tool execution failed: ${toolErr.message}`;
                }
                
                // If it's the special file response object
                if (typeof toolResult === 'object' && toolResult.__isFileResponse) {
                    return toolResult;
                }

                // Call Gemini again with the tool result to get the final answer
                const finalResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [
                        { role: 'user', parts: [{ text: userMessage }] },
                        { role: 'model', parts: [{ functionCall: call }] },
                        {
                            role: 'user',
                            parts: [{
                                functionResponse: {
                                    name: functionName,
                                    response: { result: toolResult }
                                }
                            }]
                        }
                    ],
                    config: { systemInstruction }
                });

                return finalResponse.text;
            } else {
                return `Error: AI requested unknown tool '${functionName}'`;
            }
        }

        return response.text;
    } catch (error) {
        console.error('[AI] Error in processMessage:', error);
        return `Sorry, I encountered an AI error: ${error.message}`;
    }
}

module.exports = { processMessage };
