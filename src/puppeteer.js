const puppeteer = require('puppeteer');

async function fetchTransactionValue(tokenAddress) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    const url = `https://gmgn.ai/sol/token/${tokenAddress}`;

    await page.goto(url);

    // 等待页面加载，直到 1m tab 可点击
    await page.waitForSelector('.css-k9g7wk');  // 1m tab 的选择器
    const tab = await page.$('.css-k9g7wk'); // 获取 tab 元素
    if (tab) {
        console.log('点击 1m tab...');
        await tab.click();  // 点击 1m tab
    } else {
        console.error('无法找到 1m tab，检查选择器是否正确');
        await browser.close();
        return;
    }

    // 等待页面更新，直到目标数据加载完成
    await page.waitForSelector('.css-b5f2qn');  // 等待交易数据更新

    // 获取目标 div 的交易值
    const value = await page.evaluate(() => {
        const transactionValueElement = document.querySelector('.css-b5f2qn');
        return transactionValueElement ? transactionValueElement.textContent : null;
    });

    await browser.close();
    return value ? value.trim() : null;
}

async function startScraping(tokenAddress) {
    const values = [];
    let totalValue = 0;

    for (let i = 0; i < 6; i++) {
        try {
            const value = await fetchTransactionValue(tokenAddress);
            console.log(`抓取第${i + 1}次交易变化值: ${value}`);
            values.push(value);

            if (i > 0) {
                // 解析并计算交易值（如果需要转换）
                const percentageChange = parseFloat(value.replace('%', '').trim());
                totalValue += percentageChange;
            }

            if (i < 5) {
                // 等待 1 分钟再抓取
                console.log('等待 1 分钟...');
                await new Promise(resolve => setTimeout(resolve, 60000)); // 等待 1 分钟
            }
        } catch (error) {
            console.error(`抓取第${i + 1}次时出错:`, error);
        }
    }

    // 计算后 5 次的总交易变化值（如果是百分比）
    console.log(`后 5 次抓取的总交易变化值: ${totalValue}%`);
}

const tokenAddress = 'A3MAr1D9CHwRFavqGAuaGKMVyP8YfkvByqjvKXRSpump';  // 替换为你需要抓取的 token 地址
startScraping(tokenAddress);
