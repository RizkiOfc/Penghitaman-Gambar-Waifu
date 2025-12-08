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

class AuthGenerator {
    static #PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDa2oPxMZe71V4dw2r8rHWt59gH
W5INRmlhepe6GUanrHykqKdlIB4kcJiu8dHC/FJeppOXVoKz82pvwZCmSUrF/1yr
rnmUDjqUefDu8myjhcbio6CnG5TtQfwN2pz3g6yHkLgp8cFfyPSWwyOCMMMsTU9s
snOjvdDb4wiZI8x3UwIDAQAB
-----END PUBLIC KEY-----`;
    static #S = 'NHGNy5YFz7HeFb';
    
    constructor(appId) {
        this.appId = appId;
    }
    
    aesEncrypt(data, key, iv) {
        const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(key), Buffer.from(iv));
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }
    
    generateRandomString(l) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const r = crypto.randomBytes(l);
        for (let i = 0; i < l; i++) result += chars.charAt(r[i] % chars.length);
        return result;
    }
    
    generate() {
        const t = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const tempAesKey = this.generateRandomString(16);

        const enc = crypto.publicEncrypt({
            key: AuthGenerator.#PUBLIC_KEY,
            padding: crypto.constants.RSA_PKCS1_PADDING
        }, Buffer.from(tempAesKey));

        const secret_key = enc.toString('base64');
        const data = `${this.appId}:${AuthGenerator.#S}:${t}:${nonce}:${secret_key}`;
        const sign = this.aesEncrypt(data, tempAesKey, tempAesKey);
        
        return { app_id: this.appId, t, nonce, sign, secret_key };
    }
}

async function convert(buffer, prompt) {
    const auth = new AuthGenerator('ai_df');
    const authData = auth.generate();
    const userId = auth.generateRandomString(64).toLowerCase();
    
    const headers = {
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Android 15; Mobile; SM-F958; rv:130.0) Gecko/130.0 Firefox/130.0',
        'Referer': 'https://deepfakemaker.io/nano-banana-ai/'
    };
    
    const instance = axios.create({
        baseURL: 'https://apiv1.deepfakemaker.io/api',
        params: authData,
        headers
    });

    const file = await instance.post('/user/v2/upload-sign', {
        filename: auth.generateRandomString(32) + '_' + Date.now() + '.jpg',
        hash: crypto.createHash('sha256').update(buffer).digest('hex'),
        user_id: userId
    }).then(r => r.data);

    await axios.put(file.data.url, buffer, {
        headers: { 'content-type': 'image/jpeg', 'content-length': buffer.length }
    });

    const task = await instance.post('/replicate/v1/free/nano/banana/task', {
        prompt,
        platform: 'nano_banana',
        images: ['https://cdn.deepfakemaker.io/' + file.data.object_name],
        output_format: 'png',
        user_id: userId
    }).then(r => r.data);

    const result = await new Promise((resolve, reject) => {
        let retries = 20;
        const i = setInterval(async () => {
            const x = await instance.get('/replicate/v1/free/nano/banana/task', {
                params: { user_id: userId, ...task.data }
            }).then(r => r.data);

            if (x.msg === 'success') {
                clearInterval(i);
                resolve(x.data.generate_url);
            }
            if (--retries <= 0) {
                clearInterval(i);
                reject(new Error('Failed to get task.'));
            }
        }, 2500);
    });

    return result;
}

app.post('/process', upload.none(), async (req, res) => {
    try {
        const { imageData, processType } = req.body;
        if (!imageData) return res.json({ success: false, error: 'Pilih gambar dulu' });

        const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const prompt = processType === 'darken'
            ? 'change skin color to black'
            : 'remove hair, bald, clean scalp, natural lighting';

        const url = await convert(buffer, prompt);
        const imgBuffer = (await axios.get(url, { responseType: 'arraybuffer' })).data;

        res.json({
            success: true,
            processedImage: `data:image/png;base64,${Buffer.from(imgBuffer).toString('base64')}`,
            processType,
            analysis: processType === 'darken' ? 'Sudah dihitamkan.' : 'Sudah dibotakan.'
        });

    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

app.listen(port, () => console.log(`udah on PORT:${port}`));
