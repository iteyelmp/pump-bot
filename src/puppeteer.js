// https://gmgn.ai/defi/quotation/v1/tokens/kline/sol/FVWpYkGcLuLfxmR7xZvmuPiBkQ193jvvmMpUmcfCpump?resolution=1m&from=1730891838&to=1730901798
const {connect} = require('puppeteer-real-browser');

// Base URL for the API
const apiUrl = `https://gmgn.ai/defi/quotation/v1/tokens/kline/sol/`;

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
async function trackVolume(token, targetVolume = 100000) {
    return new Promise((resolve) => {
        const MAX_COUNT = 5;
        const fromTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1h ago

        let count = 0;
        let failCount = 0;
        let trackingStarted = false;

        const intervalId = setInterval(async () => {
            // 检查是否已达到最大计数
            if (count >= MAX_COUNT) {
                clearInterval(intervalId);
                resolve({ success: false, data: [] });
                return;
            }

            const toTimestamp = Math.floor(Date.now() / 1000);
            const volumeData = await getTradingVolume(token, fromTimestamp, toTimestamp);
            if (volumeData && volumeData.length > 0) {
                // 取最新一分钟交易量数据
                const latestVolume = volumeData[volumeData.length - 1].volume;
                console.log(`${token} ：在第 ${count} 次, 时间：${new Date().toString()}， 交易量：${latestVolume}`);
                // 检测非零交易量，标记为开始正式计数
                if (!trackingStarted && parseFloat(latestVolume) > 0) {
                    trackingStarted = true;
                }

                // 只有在监控开始后才计数并判断是否达到目标交易量
                if (trackingStarted) {
                    count++;
                    if (parseFloat(latestVolume) > targetVolume) {
                        clearInterval(intervalId);
                        resolve({ success: true, data: volumeData });
                    }
                }
            } else {
                failCount++;
                if (failCount > 10) {
                    clearInterval(intervalId);
                    resolve({ success: false, data: [] });
                }
            }
        }, 60000); // 每分钟检查一次，不阻塞主线程
    });
}

module.exports = {trackVolume};
