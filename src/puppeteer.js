// https://gmgn.ai/defi/quotation/v1/tokens/kline/sol/FVWpYkGcLuLfxmR7xZvmuPiBkQ193jvvmMpUmcfCpump?resolution=1m&from=1730891838&to=1730901798

const puppeteer = require("puppeteer");

// Base URL for the API
const apiUrl = `https://gmgn.ai/defi/quotation/v1/tokens/kline/sol/`;
const targetVolume = 100000; // 10w = 100,000

// 启动浏览器并进行配置
let browser = null;
async function launchBrowser() {
    if (browser) {
        return browser;
    }

    browser = await puppeteer.launch({
        headless: true, // 启动无头浏览器
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
    return browser;
}

// 查询交易量
async function getTradingVolume(token, fromTimestamp, toTimestamp) {
    const url = `${apiUrl}${token}?resolution=1m&from=${fromTimestamp}&to=${toTimestamp}`;
    try {
        const page = await (await launchBrowser()).newPage();
        // 设置自定义的 User-Agent，避免被检测为机器人
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        // 优化性能，减少资源加载（不加载图片、CSS等）
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                request.abort(); // 取消加载不必要的资源
            } else {
                request.continue();
            }
        });

        // 打开 URL并等待页面加载完成
        await page.goto(url, { waitUntil: 'domcontentloaded' });
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
    // 立即查询一次
    const fromTimestamp = Math.floor(Date.now() / 1000) - 60; // 1m ago
    let toTimestamp = Math.floor(Date.now() / 1000); // Now
    let volumeData = await getTradingVolume(token, fromTimestamp, toTimestamp);
    if (volumeData) {
        const latestVolume = volumeData[volumeData.length - 1].volume;
        console.log(`Initial volume check: ${latestVolume}`);
        if (parseFloat(latestVolume) >= targetVolume) {
            console.log('Volume exceeded 100,000 on first check!');
            return true;
        }
    }

    let totalVolume = 0;
    // 开始每分钟查询
    for (let i = 0; i < 5; i++) {
        console.log('Waiting for the next minute...');
        await new Promise(resolve => setTimeout(resolve, 60000)); // 等待 1 分钟

        toTimestamp = Math.floor(Date.now() / 1000);
        volumeData = await getTradingVolume(token, fromTimestamp, toTimestamp);
        if (volumeData) {
            const latestVolume = volumeData[volumeData.length - 1].volume;
            console.log(`Volume at ${new Date().toISOString()} : ${latestVolume}`);
            if (parseFloat(latestVolume) > targetVolume) {
                return true;
            }
            totalVolume += parseFloat(latestVolume);
        }
    }

    // 5分钟内的交易量总和
    console.log(`5 minutes are up. Total volume in 5 minutes: ${totalVolume}`);
    return totalVolume > targetVolume * 5;

}

module.exports = { trackVolume };
