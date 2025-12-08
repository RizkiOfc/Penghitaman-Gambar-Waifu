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

app.post('/process', upload.none(), async (req, res) => {
    try {
        const { imageData, processType } = req.body;
        if (!imageData) return res.json({ success: false, error: 'Pilih gambar dulu' });

        const buffer = Buffer.from(
            imageData.replace(/^data:image\/\w+;base64,/, ''),
            'base64'
        );

        const formData = new FormData();
        formData.append('image', new Blob([buffer]), 'input.png');

        const prompt =
            processType === 'darken'
                ? 'ubah karakter gambar tersebut menjadi kulit hitam.'
                : 'edit gambar karakter menjadi botak natural, rambut dihilangkan secara halus, kulit kepala terlihat jelas';

        formData.append('param', prompt);

        const response = await fetch("https://api.elrayyxml.web.id/api/ai/nanobanana", {
            method: "POST",
            body: formData
        });

        const arrayBuffer = await response.arrayBuffer();
        const base64Result = Buffer.from(arrayBuffer).toString('base64');

        res.json({
            success: true,
            processedImage: `data:image/png;base64,${base64Result}`,
            processType,
            analysis: processType === 'darken' ? 'Sudah dihitamkan.' : 'Sudah dibotakan.'
        });

    } catch (err) {
        res.json({ success: false, error: 'Gagal memproses gambar.' });
    }
});

app.listen(port, () => {
    console.log(`udah on PORT:${port}`);
});

async function nanobanana(prompt, image) {
    try {
        if (!prompt) throw new Error('Prompt is required.');
        if (!Buffer.isBuffer(image)) throw new Error('Image must be a buffer.');

        const inst = axios.create({
            baseURL: 'https://image-editor.org/api',
            headers: {
                origin: 'https://image-editor.org',
                referer: 'https://image-editor.org/editor',
                'user-agent': 'Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36'
            }
        });

        const { data: up } = await inst.post('/upload/presigned', {
            filename: `${Date.now()}_rynn.jpg`,
            contentType: 'image/jpeg'
        });

        if (!up?.data?.uploadUrl) throw new Error('Upload url not found.');
        await axios.put(up.data.uploadUrl, image);

        const { data: cf } = await axios.post('https://api.nekolabs.web.id/tools/bypass/cf-turnstile', {
            url: 'https://image-editor.org/editor',
            siteKey: '0x4AAAAAAB8ClzQTJhVDd_pU'
        });

        if (!cf?.result) throw new Error('Failed to get cf token.');

        const { data: task } = await inst.post('/edit', {
            prompt: 'change skin color to black',
            image_urls: [up.data.fileUrl],
            image_size: 'auto',
            turnstileToken: cf.result,
            uploadIds: [up.data.uploadId],
            userUUID: crypto.randomUUID(),
            imageHash: crypto
                .createHash('sha256')
                .update(image)
                .digest('hex')
                .substring(0, 64)
        });

        if (!task?.data?.taskId) throw new Error('Task id not found.');

        while (true) {
            const { data } = await inst.get(`/task/${task.data.taskId}`);
            if (data?.data?.status === 'completed') {
                return data.data.result;
            }
            await new Promise((res) => setTimeout(res, 1000));
        }

    } catch (error) {
        throw new Error(error.message);
    }
}

nanobanana(
    'change skin color to black',
    fs.readFileSync('./ex/image.jpg')
).then(console.log);
