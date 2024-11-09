const API = "https://gmgn.ai/defi/quotation/v1/pairs/sol/new_pairs/1m?limit=500&orderby=open_timestamp&direction=desc&launchpad=pump&period=1h&filters[]=not_honeypot&filters[]=pump";

const {connect} = require('puppeteer-real-browser');
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const { sendMessage } = require('./send');

const db = new sqlite3.Database('tokens.db');
db.getAsync = promisify(db.get);
db.runAsync = promisify(db.run);

async function initDatabase() {
    try {
        await db.runAsync(`CREATE TABLE IF NOT EXISTS tokens (
            tokenAddress TEXT PRIMARY KEY,
            tokenSymbol TEXT,
            count INTEGER DEFAULT 1,
            lastSentTime INTEGER,
            marketCap REAL
        )`);
        console.log('数据库表结构已初始化');
    } catch (error) {
        console.error('数据库初始化失败:', error);
    }
}

// 查询交易量
async function getTradingVolume() {
    try {
        const {page} = await connect({});
        // 设置自定义的 User-Agent，避免被检测为机器人
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        // 优化性能，减少资源加载（不加载图片、CSS等）
        await page.setRequestInterception(true);
        // 如果是验证码请求或者需要跳过的请求，取消该请求
        page.on('request', (request) => {
            if (request.url().includes('some-verification-url')) {
                request.abort();
            } else {
                request.continue();
            }
        });

        // 打开 URL并等待页面加载完成
        await page.goto(API, {waitUntil: 'networkidle0', timeout: 60000});
        // Extract the API response
        const data = await page.evaluate(() => {
            return window.fetch(window.location.href)
                .then(res => res.json())
                .then(json => json);
        });
        await page.close();
        if (data) {
            return data.data;
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
    return null;
}

function formatFirstMessage(token) {
    return `<b>首次通知</b>\n\n` +
        `<b>Token:</b> <a href="https://gmgn.ai/sol/token/${token.tokenAddress}">${token.tokenSymbol}</a>\n` +
        `<b>地址:</b> <code>${token.tokenAddress}</code>\n` +
        `<b>交易量:</b> ${token.volume}\n` +
        `<b>市值:</b> ${token.marketCap}\n\n`;
}

function formatMultiMessage(token, timeInterval, marketCapChange, previousMarketCap, notificationCount) {
    const intervalInMinutes = (timeInterval / 1000 / 60).toFixed(1);
    return `<b>多次通知</b>\n\n` +
        `<b>Token:</b> <a href="https://gmgn.ai/sol/token/${token.tokenAddress}">${token.tokenSymbol}</a>\n` +
        `<b>地址:</b> <code>${token.tokenAddress}</code>\n` +
        `<b>通知次数:</b> ${notificationCount} 次\n` +
        `<b>交易量:</b> ${token.volume}\n`
        `<b>市值:</b> ${token.marketCap}\n\n` +
        `<b>前次市值:</b> ${previousMarketCap}\n` +
        `<b>市值变化:</b> ${marketCapChange}\n` +
        `<b>时间间隔:</b> ${intervalInMinutes} 分钟\n\n`;
}

async function queryAndSendData() {
    try {
        console.log("开始查询");
        const volumeData = await getTradingVolume();
        if (volumeData.pairs && volumeData.pairs.length > 0) {
            const pairs = volumeData.pairs;

            // 提取符合条件的tokens
            const tokens = pairs.map(pair => {
                const tokenInfo = pair.base_token_info;
                const marketCap = parseFloat(tokenInfo.market_cap);
                const volume = parseFloat(tokenInfo.volume);

                // 判断市值并设置交易量阈值
                const targetVolume = marketCap < 1000000 ? 100000 : 150000;
                if (volume > targetVolume) {
                    return {
                        tokenSymbol: tokenInfo.symbol,
                        tokenAddress: tokenInfo.address,
                        volume: tokenInfo.volume,
                        marketCap: tokenInfo.market_cap
                    };
                }
                return null;
            }).filter(token => token !== null); // 移除未符合条件的tokens

            // 过滤掉已发送的 token
            for (const token of tokens) {
                const now = Date.now();
                const result = await db.getAsync(
                    'SELECT * FROM tokens WHERE tokenAddress = ?',
                    [token.tokenAddress]
                );

                if (result) {
                    // 如果是多次发送，计算时间间隔和市值变化
                    const timeInterval = now - result.lastSentTime;
                    const marketCapChange = parseFloat(token.marketCap) - result.marketCap;

                    // 更新数据库：count 自增, lastSentTime 更新为当前时间, 市值更新
                    await db.runAsync(
                        `UPDATE tokens SET 
                            count = count + 1, 
                            lastSentTime = ?, 
                            marketCap = ?
                         WHERE tokenAddress = ?`,
                        [now, token.marketCap, token.tokenAddress]
                    );

                    // 发送多次通知
                    const message = formatMultiMessage(token, timeInterval, marketCapChange, result.marketCap, result.count + 1);
                    await sendMessage(message);
                } else {
                    // 首次发送，插入新记录
                    await db.runAsync(
                        `INSERT INTO tokens (tokenAddress, tokenSymbol, count, lastSentTime, marketCap) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [token.tokenAddress, token.tokenSymbol, 1, now, token.marketCap]
                    );

                    // 发送首次通知
                    const message = formatFirstMessage(token);
                    await sendMessage(message);
                }
            }
        }
    } catch (error) {
        console.error('请求API失败:', error);
    }
}


// 启动时初始化数据库表结构并立即开始查询
async function main() {
    await initDatabase();
    queryAndSendData(); // 启动时立即查询
    setInterval(queryAndSendData, 60000); // 每分钟查询一次
}

main();
