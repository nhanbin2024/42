require('dotenv').config(); 
const { Client } = require('discord.js-selfbot-v13');
const http = require('http');

const client = new Client({ checkUpdate: false });

// Đọc Token từ biến môi trường (Environment Variables) của Render
const TOKEN = process.env.DISCORD_TOKEN; 
const CHANNEL_ID = '954487343107166228'; 

const MIN_DELAY = 10000; 
const MAX_DELAY = 20000;
const MAX_TASK_AGE = 180000; // 3 phút

// Tạo HTTP Server ảo để Render không quét lỗi Port và tắt Bot
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bot đang hoạt động 24/24!');
});
server.listen(PORT, () => {
    console.log(`[Hệ thống] Server ảo đang chạy tại cổng: ${PORT}`);
});

client.on('ready', () => {
    console.log(`==================================================`);
    console.log(` Đã đăng nhập tài khoản thành công: ${client.user.tag}`);
    console.log(` Hệ thống đang tự động canh task tại kênh: ${CHANNEL_ID}`);
    console.log(`==================================================`);
});

client.on('messageCreate', async (message) => {
    if (message.channelId !== CHANNEL_ID) return;

    const currentTime = Date.now();
    const messageTime = message.createdAt.getTime();
    const messageAge = currentTime - messageTime;

    if (messageAge > MAX_TASK_AGE) return; 

    if (message.components && message.components.length > 0) {
        const randomDelay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
        const seconds = (randomDelay / 1000).toFixed(1);

        console.log(`[${new Date().toLocaleTimeString()}] 🟢 Có TASK! Bấm sau ${seconds}s...`);

        setTimeout(async () => {
            try {
                const freshMessage = await message.channel.messages.fetch(message.id).catch(() => null);
                if (!freshMessage || !freshMessage.components) return;

                for (const row of freshMessage.components) {
                    for (const component of row.components) {
                        if (component.type === 'BUTTON' && component.style === 'SUCCESS') {
                            await freshMessage.clickButton(component.customId);
                            console.log(`[${new Date().toLocaleTimeString()}] ✅ Đã bấm nút kẹp giấy thành công!`);
                            return; 
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Lỗi bấm nút:`, error.message);
            }
        }, randomDelay);
    }
});

if (!TOKEN) {
    console.error("❌ LỖI: Thiếu biến DISCORD_TOKEN!");
    process.exit(1);
}

client.login(TOKEN).catch((err) => {
    console.error("❌ Đăng nhập thất bại!", err.message);
});