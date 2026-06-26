require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const http = require('http');
const https = require('https');

const CHANNEL_IDS = [
    '954487343107166228',
    '1471893529306337492',
    '1451369728407769220',
    '1344553792825462784',
];

const MIN_DELAY    = 10000;
const MAX_DELAY    = 30000;
const MAX_TASK_AGE = 840000;

const rawTokens = process.env.DISCORD_TOKENS || process.env.DISCORD_TOKEN || '';
const TOKENS = rawTokens.split(',').map(t => t.trim()).filter(Boolean);

if (TOKENS.length === 0) {
    console.error('❌ LỖI: Không có token nào! Hãy set DISCORD_TOKENS hoặc DISCORD_TOKEN.');
    process.exit(1);
}

console.log(`[Hệ thống] Tổng số tài khoản: ${TOKENS.length}`);
console.log(`[Hệ thống] Khởi động lúc: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);

process.on('uncaughtException', (err) => {
    console.error(`[⚠️ uncaughtException] ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
    console.error(`[⚠️ unhandledRejection] ${reason}`);
});

const vnTime = () => new Date().toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', hour12: false
});

const REPLIT_URL = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null;

function selfPing() {
    if (!REPLIT_URL) return;
    https.get(REPLIT_URL, () => {
        console.log(`[Keep-alive] Ping thành công — ${vnTime()}`);
    }).on('error', err => console.warn(`[Keep-alive] Ping thất bại: ${err.message}`));
}
setInterval(selfPing, 4 * 60 * 1000);

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Bot đang hoạt động 24/24! Tài khoản: ${TOKENS.length}`);
}).listen(PORT, '0.0.0.0', () => {
    console.log(`[Hệ thống] Server chạy tại cổng: ${PORT}`);
    if (REPLIT_URL) console.log(`[Hệ thống] URL công khai: ${REPLIT_URL}`);
    selfPing();
});

function createBot(token, index) {
    const tag     = `Tài khoản #${index + 1}`;
    const clicked = new Set();

    async function tryClick(message, attempt) {
        try {
            let freshMessage;
            try {
                freshMessage = await message.channel.messages.fetch(message.id);
            } catch (e) {
                freshMessage = null;
            }
            if (!freshMessage || !freshMessage.components) return;

            let lastClickable = null;
            for (const row of freshMessage.components) {
                for (const comp of row.components) {
                    const isButton = comp.type === 'BUTTON' || comp.type === 2;
                    const isLink   = comp.style === 'LINK' || comp.style === 5;
                    console.log(`[Debug][${tag}] type=${comp.type} style=${comp.style} customId=${comp.customId}`);
                    if (isButton && !isLink && comp.customId) lastClickable = comp;
                }
            }

            if (lastClickable) {
                await freshMessage.clickButton(lastClickable.customId);
                console.log(`[${vnTime()}] [${tag}] ✅ Click thành công! (style=${lastClickable.style} customId=${lastClickable.customId})`);
            } else {
                console.log(`[${vnTime()}] [${tag}] ⚠️ Không tìm thấy nút.`);
                clicked.delete(message.id);
            }
        } catch (error) {
            console.error(`[${tag}] ❌ Lỗi (lần ${attempt}): ${error.message}`);
            if (attempt < 2) {
                console.log(`[${tag}] [Retry] Thử lại sau 5 giây...`);
                setTimeout(() => tryClick(message, attempt + 1), 5000);
            } else {
                console.error(`[${tag}] [Retry] Thất bại — bỏ qua task này.`);
                clicked.delete(message.id);
            }
        }
    }

    async function processTask(message) {
        if (clicked.has(message.id)) return;
        if (!message.components || message.components.length === 0) return;
        const age = Date.now() - message.createdAt.getTime();
        if (age > MAX_TASK_AGE) return;

        const delay   = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1)) + MIN_DELAY;
        const seconds = (delay / 1000).toFixed(1);
        console.log(`[${vnTime()}] [${tag}] 🟢 Có TASK! Bấm sau ${seconds}s...`);
        clicked.add(message.id);
        setTimeout(() => tryClick(message, 1), delay);
    }

    let isAlive = false;

    function login() {
        client.login(token).catch(err => {
            console.error(`[${tag}] ❌ Đăng nhập thất bại: ${err.message}`);
            console.log(`[${tag}] 🔄 Thử đăng nhập lại sau 30 giây...`);
            isAlive = false;
            setTimeout(login, 30000);
        });
    }

    const client = new Client({ checkUpdate: false });

    client.on('ready', async () => {
        isAlive = true;
        console.log(`[${tag}] ✅ Đã đăng nhập: ${client.user.tag}`);
        for (const channelId of CHANNEL_IDS) {
            try {
                const channel  = await client.channels.fetch(channelId);
                const messages = await channel.messages.fetch({ limit: 20 });
                let found = 0;
                for (const msg of messages.values()) {
                    const age = Date.now() - msg.createdAt.getTime();
                    if (age <= MAX_TASK_AGE && msg.components?.length > 0) {
                        found++;
                        processTask(msg);
                    }
                }
                if (found > 0) console.log(`[${tag}] Kênh ${channelId}: ${found} task còn hạn`);
            } catch (err) {}
        }
    });

    client.on('disconnect', () => {
        isAlive = false;
        console.warn(`[${tag}] ⚠️ Mất kết nối! Đăng nhập lại sau 15 giây...`);
        setTimeout(login, 15000);
    });

    client.on('error', (err) => {
        console.error(`[${tag}] ❌ Lỗi client: ${err.message}`);
    });

    client.on('messageCreate', (message) => {
        if (!CHANNEL_IDS.includes(message.channelId)) return;
        processTask(message);
    });

    client.on('messageUpdate', (oldMsg, newMsg) => {
        if (!CHANNEL_IDS.includes(newMsg.channelId)) return;
        if (!newMsg.components?.length || clicked.has(newMsg.id)) return;
        processTask(newMsg);
    });

    setInterval(() => {
        const wsStatus = client.ws?.status;
        if (wsStatus !== 0) {
            console.warn(`[${tag}] 🔍 Watchdog: ws.status=${wsStatus} — đăng nhập lại...`);
            isAlive = false;
            login();
        }
    }, 5 * 60 * 1000);

    login();
}

TOKENS.forEach((token, i) => {
    setTimeout(() => createBot(token, i), i * 2000);
});
