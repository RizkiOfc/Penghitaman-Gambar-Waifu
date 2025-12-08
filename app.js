const express = require('express');
const axios = require('axios');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const upload = multer();
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.render('index', {
        title: 'Penghitaman & Pembotakan Gambar.',
        description: 'Darken & Make your waifu bald with AI'
    });
});

async function nanobanana(prompt, imageBuffer) {
    const inst = axios.create({
        baseURL: 'https://image-editor.org/api',
        headers: {
            origin: 'https://image-editor.org',
            referer: 'https://image-editor.org/editor',
            'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
        }
    });

    const { data: up } = await inst.post('/upload/presigned', {
        filename: `${Date.now()}_img.jpg`,
        contentType: 'image/jpeg'
    });

    if (!up?.data?.uploadUrl) throw new Error('Gagal membuat upload URL');

    await axios.put(up.data.uploadUrl, imageBuffer);

    const { data: cf } = await axios.post("https://api.nekolabs.web.id/tools/bypass/cf-turnstile", {
        url: "https://image-editor.org/editor",
        siteKey: "0x4AAAAAAB8ClzQTJhVDd_pU"
    });

    if (!cf?.result) throw new Error("Tidak bisa mendapatkan CF token");

    const { data: task } = await inst.post('/edit', {
        prompt,
        image_urls: [up.data.fileUrl],
        image_size: 'auto',
        turnstileToken: cf.result,
        uploadIds: [up.data.uploadId],
        userUUID: crypto.randomUUID(),
        imageHash: crypto.createHash('sha256').update(imageBuffer).digest('hex').substring(0, 64)
    });

    if (!task?.data?.taskId) throw new Error("Task ID tidak ditemukan");

    while (true) {
        const { data } = await inst.get(`/task/${task.data.taskId}`);
        if (data?.data?.status === 'completed') {
            return data.data.result;
        }
        await new Promise(res => setTimeout(res, 1200));
    }
}

app.post('/process', upload.none(), async (req, res) => {
    try {
        const { imageData, processType } = req.body;

        if (!imageData) return res.json({ success: false, error: 'Pilih gambar dulu' });

        const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

        let prompt =
            processType === 'darken'
                ? 'change skin color to black'
                : 'remove hair, natural bald head, clean scalp';

        const outputUrl = await nanobanana(prompt, buffer);

        const imgBuffer = (await axios.get(outputUrl, { responseType: 'arraybuffer' })).data;
        const base64Result = Buffer.from(imgBuffer).toString('base64');

        res.json({
            success: true,
            processedImage: `data:image/png;base64,${base64Result}`,
            processType,
            analysis: processType === 'darken' ? 'Sudah dihitamkan.' : 'Sudah dibotakan.'
        });

    } catch (err) {
        res.json({ success: false, error: err.message || 'Gagal memproses gambar.' });
    }
});

app.listen(port, () => console.log(`udah on PORT:${port}`));
