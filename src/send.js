const fetch = require('node-fetch');

const botToken = '8150819500:AAEj8GzTFaDgqPj19njK9EuqBz052we2BtE';
const chatId = '-1002453979546';

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
    console.log(data);
}

module.exports = { sendMessage };
