// https://gmgn.ai/defi/quotation/v1/tokens/kline/sol/FVWpYkGcLuLfxmR7xZvmuPiBkQ193jvvmMpUmcfCpump?resolution=1m&from=1730891838&to=1730901798
const {connect} = require('puppeteer-real-browser');

// Base URL for the API
const apiUrl = `https://gmgn.ai/defi/quotation/v1/tokens/kline/sol/`;
const targetVolume = 100000; // 10w = 100,000


// 查询交易量
async function getTradingVolume(token, fromTimestamp, toTimestamp) {
    const url = `${apiUrl}${token}?resolution=1m&from=${fromTimestamp}&to=${toTimestamp}`;
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
        await page.goto(url, {waitUntil: 'networkidle0', timeout: 60000});
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

// 主查询函数，逐分钟检查交易量
async function trackVolume(token) {
    const MAX_COUNT = 5;
    const fromTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1m ago
    let count = 0;
    let trackingStarted = false;

    // 开始每分钟查询
    while (count < MAX_COUNT) {
        console.log('等待一分钟...');
        await new Promise(resolve => setTimeout(resolve, 60000));

        const toTimestamp = Math.floor(Date.now() / 1000);
        const volumeData = await getTradingVolume(token, fromTimestamp, toTimestamp);
        if (volumeData && volumeData.length > 0) {
            // 取最新一分钟交易量数据
            const latestVolume = volumeData[volumeData.length - 1].volume;
            console.log(`${token} ：在第 ${count} 次, 时间：${new Date().toISOString()}， 交易量：${latestVolume}`);
            // 过滤掉初始化或移除旧池子期间的零交易量
            if (!trackingStarted) {
                if (parseFloat(latestVolume) > 0) {
                    trackingStarted = true;
                } else {
                    continue;
                }
            }

            // 检查交易量是否超过目标值
            if (parseFloat(latestVolume) > targetVolume) {
                return {success: true, data: volumeData};
            }
        }
        count++;
    }
    return {success: false, data: []};
}

module.exports = {trackVolume};
