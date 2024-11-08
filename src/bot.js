const {TelegramClient} = require('telegram');
const {StringSession} = require('telegram/sessions');
const readline = require('readline');
const fs = require('fs');

const { trackVolume } = require('./puppeteer');
const { sendMessage } = require('./send');


const apiId = 21544765;
const apiHash = '7d678087b73b63ba9046b375e4c93453';
const sessionFilePath = './session.txt';
const maxConcurrentQueries = 10; // 限制并发查询的最大数量

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

let runningQueries = 0;
async function withSemaphore(fn) {
    while (runningQueries >= maxConcurrentQueries) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 等待直到有任务完成
    }
    runningQueries++;
    try {
        await fn();
    } finally {
        runningQueries--;
    }
}

let processedMessages = new Set();

async function start() {
    try {
        // Login
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

        // Start listening
        client.addEventHandler((event) => {
            if (event.message && event.message.peerId && event.message.peerId.channelId) {
                const message = event.message.message;
                const messageId = event.message.id;
                if (processedMessages.has(messageId)) {
                    return;  // 跳过重复消息
                }

                // 标记该消息为已处理
                processedMessages.add(messageId);
                const solanaRegex = /CA:\s*([A-Za-z0-9]+(?:[A-Za-z0-9]*[a-zA-Z]+[A-Za-z0-9]*)*)/;
                const match = message.match(solanaRegex);
                if (match && match[1])  {
                    const token = match[1];
                    console.log(`收到 token: ${token} , 时间：${new Date().toString()}`);
                    withSemaphore(async () => {
                        try {
                            const {success, data} = await trackVolume(token);
                            if (success) {
                                await sendMessage(token)
                            }
                        } catch (e) {
                            console.error(`处理 token ${token} 时发生错误:`, e.message);
                        }
                    });
                }
            }
        });
        console.log(`开始监听频道`);
    } catch (e) {
        console.error("发生异常，正在重启...");
        setTimeout(() => {
            start().catch(console.error);
        }, 10000);
    }
}
start().catch(console.error);
