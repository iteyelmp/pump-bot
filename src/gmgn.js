const API = "https://gmgn.ai/defi/quotation/v1/pairs/sol/new_pairs/1m?limit=500&orderby=open_timestamp&direction=desc&launchpad=pump&period=1h&filters[]=not_honeypot&filters[]=pump";

const {connect} = require('puppeteer-real-browser');
const { sendMessage } = require('./send');

const targetVolume = 100000;

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
    let message = "<b>符合条件的 TOKENS:</b>\n\n";
    tokens.forEach(token => {
        message += `<b>Token:</b> ${token.tokenSymbol}\n`;
        // 使用gmgn.ai格式化token地址为超链接
        message += `<b>地址:</b> <a href="https://gmgn.ai/sol/token/${token.tokenAddress}">${token.tokenAddress}</a>\n`;
        message += `<b>交易量:</b> ${token.volume}\n\n`;
    });
    return message;
}


// 设置每分钟请求一次
setInterval(async () => {
    try {
        console.log("开始查询");
        const volumeData = await getTradingVolume();
        if (volumeData.pairs && volumeData.pairs.length > 0) {
            const pairs = volumeData.pairs;

            // 筛选出volume大于10w的token
            const filteredTokens = pairs.filter(pair => {
                const volume = parseFloat(pair.base_token_info.volume);
                return volume > targetVolume; // 只保留volume大于100000的token
            });

            // 提取符合条件的tokens
            const tokens = filteredTokens.map(pair => {
                return {
                    tokenSymbol: pair.base_token_info.symbol,
                    tokenAddress: pair.base_token_info.address,
                    volume: pair.base_token_info.volume
                };
            });

            // 输出符合条件的tokens
            if (tokens.length > 0) {
                await sendMessage(formatTokensToRichText(tokens));
                console.log('符合条件的token:', tokens);
            } else {
                console.log('没有符合条件的token');
            }
        }
    } catch (error) {
        console.error('请求API失败:', error);
    }
}, 60000); // 每60秒请求一次
