const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');
const fs = require('fs');

// Your API ID and Hash from https://my.telegram.org
const apiId = 21544765;
const apiHash = '7d678087b73b63ba9046b375e4c93453';

const sessionFilePath = './session.txt';

let stringSession = new StringSession('');
if (fs.existsSync(sessionFilePath)) {
    const savedSession = fs.readFileSync(sessionFilePath, 'utf-8');
    stringSession = new StringSession(savedSession);
    console.log('Session restored from file.');
}

// Set up readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
async function start() {
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () =>
            new Promise((resolve) =>
                rl.question("Please enter your number: ", resolve)
            ),
        password: async () =>
            new Promise((resolve) =>
                rl.question("Please enter your password: ", resolve)
            ),
        phoneCode: async () =>
            new Promise((resolve) =>
                rl.question("Please enter the code you received: ", resolve)
            ),
        onError: (err) => console.log(err),
    });
    const currentSession = client.session.save();
    fs.writeFileSync(sessionFilePath, currentSession);
    console.log('登录成功');

    // Step 3: Start listening
    client.addEventHandler((event) => {
        if (event.message && event.message.peerId && event.message.peerId.channelId) {
            const message = event.message.message;
            const solanaRegex = /CA:\s*([A-Za-z0-9]+(?:[A-Za-z0-9]*[a-zA-Z]+[A-Za-z0-9]*)*)/;
            const match = message.match(solanaRegex);
            console.log('-----', match);
        }
    });
    console.log(`开始监听频道`);
}

start().catch(console.error);
