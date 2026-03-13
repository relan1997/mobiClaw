const {listFiles, sendFile, findFilesByName} = require('./../tools/getfiles');
 
async function test() {
    // This is the EXACT raw object structure returned by the @google/genai SDK
    // when the AI decides it needs to use a tool. We extract 'response.functionCalls[0]'.
    
    // Example full raw response would look like:
    // {
    //   role: "model",
    //   parts: [ { functionCall: { name: "findFilesByName", args: { fileName: "package.json" } } } ]
    // }
    
    // The SDK simplifies this for us into the `functionCalls` array.
    // The SDK simplifies this for us into the `functionCalls` array.


    // user asked like get me resume from my laptop it will find using findFilesByName
    // if single file directly send it if multiple files then send the result of searched files available 
    // on laptop then user specifically choose from them and ask for sending then send it
    // if file not found then send the result of searched files not available on laptop
    // if file found but size is greater than 50MB then send the result of file size is greater than 50MB
    // if file is sensitive send not allowed 
    // if folder is asked zip it then send it 
    // if folder is sensitive send not allowed 
    // 

    // mock batch response: user asks for "package.json" and "cmd.exe"
    const mockGeminiResponse = {
        functionCalls: [
            {
                name: 'findFilesByName',
                args: { fileName: 'package.json' }
            },
            {
                name: 'findFilesByName',
                args: { fileName: 'cmd.exe', searchRoot: 'C:\\Windows\\System32' }
            }
        ]
    };

    const results = await Promise.all(
        mockGeminiResponse.functionCalls.map(async (call) => {
            return await findFilesByName(call.args.fileName, call.args.searchRoot);
        })
    );
    
    console.log(JSON.stringify(results, null, 2));

    // const result3 = await sendFile(mockGeminiFunctionCall.args.fileName);
    // console.log(result3);

    // const result4 = await executeScript(mockGeminiFunctionCall.args.fileName);
    // console.log(result4);

    // const result5 = await openApplication(mockGeminiFunctionCall.args.fileName);
    // console.log(result5);

    // const result6 = await getSystemStats(mockGeminiFunctionCall.args.fileName);
    // console.log(result6);

}

test();
