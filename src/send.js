const fetch = require('node-fetch');

const botToken = '8150819500:AAEj8GzTFaDgqPj19njK9EuqBz052we2BtE';
const chatId = '-1002453979546';

// 你要发送的消息内容
const message = '💊💊💊 PUMP已满 💊💊💊\n' +
    '\n' +
    'YMCA (Trump Dance)\n' +
    '\n' +
    '🎲 CA:\n' +
    'HRZFjN6jNBsS9fXX6zoUTGDtorqcAiYkEtgcvCMSpump\n' +
    '\n' +
    'Check 立即研究 HRZFjN6jNBsS9fXX6zoUTGDtorqcAiYkEtgcvCMSpump\n' +
    '\n' +
    '👥 Reply评论: 0\n' +
    '👑1/2 Process进度耗时: N/A\n' +
    '️🚀2/2 Process进度耗时: N/A\n' +
    '\n' +
    '👨🏻‍💻 Dev Wallet 作者钱包:\n' +
    '  - Balance SOL:  ⚠️ 7.60 SOL\n' +
    '  - Balance USD: $1,373.893\n' +
    '- 🟡 Almost Poor Dev作者有点穷\n' +
    '\n' +
    '🐦  Twitter | 🌏  website |  ✈️   telegram | 💊 Pump\n' +
    '\n' +
    '⚡️ TIP: Buy Sol Meme quickly on GMGN Bot';

// 发送消息到 Telegram 频道
async function sendMessage(message) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            chat_id: chatId,
            text: message,
        }),
    });

    const data = await response.json();
    console.log(data);  // 打印返回的数据，确认消息是否发送成功
}

sendMessage(message);
