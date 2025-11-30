const express = require('express');
const axios = require('axios');
const multer = require('multer');
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
        title: 'Waifu Darkener',
        description: 'Darken & Make your waifu bald with AI'
    });
});

app.post('/process', upload.none(), async (req, res) => {
    try {
        const { imageData, processType } = req.body;

        if (!imageData) {
            return res.json({ success: false, error: 'Pilih gambar dulu' });
        }

        const buffer = Buffer.from(imageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');

        const formData = new FormData();
        formData.append('image', new Blob([buffer]), 'input.png');

        let prompt = processType === 'darken'
            ? 'ubah karakter gambar tersebut menjadi kulit hitam.'
            : 'edit gambar sehingga karakter menjadi botak natural, rambut dihilangkan secara halus, kulit kepala terlihat jelas';

        formData.append('param', prompt);

        const response = await fetch("https://api.elrayyxml.web.id/api/ai/nanobanana", {
            method: "POST",
            body: formData
        });

        const arrayBuffer = await response.arrayBuffer();
        const base64Result = Buffer.from(arrayBuffer).toString('base64');
        const image64 = `data:image/png;base64,${base64Result}`;

        res.json({
            success: true,
            processedImage: image64,
            processType: processType,
            analysis: processType === 'darken' ? 'Sudah dihitamkan.' : 'Sudah dibotakan.'
        });

    } catch (err) {
        res.json({ success: false, error: 'Gagal memproses gambar.' });
    }
});

app.listen(port, () => {
    console.log(`udah on PORT:${port}`) be;
});

