const API = "https://gmgn.ai/defi/quotation/v1/pairs/sol/new_pairs/1m?limit=500&orderby=open_timestamp&direction=desc&launchpad=pump&period=1h&filters[]=not_honeypot&filters[]=pump";

const {connect} = require('puppeteer-real-browser');
const { sendMessage } = require('./send');

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

function formatTokensToRichText(tokens) {
    let message = "<b>TOKENS 列表异动:</b>\n\n";
    tokens.forEach(token => {
        message += `<b>Token:</b> <a href="https://gmgn.ai/sol/token/${token.tokenAddress}">${token.tokenSymbol}</a>\n`;
        // 使用代码块格式化token地址，便于用户复制
        message += `<b>地址:</b> <code>${token.tokenAddress}</code>\n`;
        message += `<b>交易量:</b> ${token.volume}\n\n`;
    });
    return message;
}

const sentTokens = new Map();
// 设置多久后重新推送已发送的 token（比如 1 小时）
const RESEND_INTERVAL = 8 * 60 * 60 * 1000; // 8 小时

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
                let targetVolume = 0;
                if (marketCap < 1000000) {  // 市值低于100万
                    targetVolume = 100000;  // 1分钟交易量大于10w
                } else {  // 市值高于100万
                    targetVolume = 150000;  // 1分钟交易量大于15w
                }

                // 如果交易量大于阈值，返回token信息
                if (volume > targetVolume) {
                    return {
                        tokenSymbol: tokenInfo.symbol,
                        tokenAddress: tokenInfo.address,
                        volume: tokenInfo.volume
                    };
                }
                return null;
            }).filter(token => token !== null); // 移除未符合条件的tokens

            // 过滤掉已发送的 token
            const newTokens = tokens.filter(token => {
                const now = Date.now();
                const lastSentTime = sentTokens.get(token.tokenAddress);
                // 如果 token 还没发送过，或者已发送时间超过了重新发送的时间间隔
                return !lastSentTime || (now - lastSentTime) > RESEND_INTERVAL;
            });

            // 输出符合条件的tokens
            if (newTokens.length > 0) {
                // 将新推送的 token 地址加入 sentTokens，更新其时间戳
                newTokens.forEach(token => {
                    sentTokens.set(token.tokenAddress, Date.now()); // 更新发送时间戳
                });
                while (sentTokens.size > 500) {
                    // 清除最早的 token，直到 size 小于等于 MAX_TOKENS
                    const earliestToken = sentTokens.keys().next().value;
                    sentTokens.delete(earliestToken);
                }

                await sendMessage(formatTokensToRichText(newTokens));
                console.log('符合条件的token:', newTokens);
            } else {
                console.log('没有符合条件的token');
            }
        }
    } catch (error) {
        console.error('请求API失败:', error);
    }
}

// 设置每分钟请求一次
setInterval(queryAndSendData, 60000); // 每60秒请求一次
// 启动时立即查询一次
queryAndSendData();
