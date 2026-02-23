import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ACCOUNTS_FILE = path.join(__dirname, 'accounts.txt');

app.use(cors());
app.use(express.json());

// Serve the Vite dist folder in production, or just let Vite handle it in dev
app.use(express.static(path.join(__dirname, 'dist')));

function generateDeviceHeaders() {
    // Generate IDs that look like real browser/app IDs
    const deviceId = crypto.randomUUID().replace(/-/g, '');
    const fingerprint = crypto.randomBytes(32).toString('hex');
    const ts = Date.now().toString();

    return {
        'client-device-id': deviceId,
        'client-code': deviceId,
        'bangsheng-finger-print-token': fingerprint,
        'trace-ts': ts,
        'api-version': '4',
        'device': 'web',
        'client-device-name': 'Chrome V144.0.0.0 (Win10)',
        'lang': 'in',
        'sec-ch-ua-platform': '"Windows"',
        'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'sec-ch-ua-mobile': '?0'
    };
}

function browserHeaders(token, customHeaders = {}, isMinimal = false, hasBody = true, userAgent = null) {
    const defaultUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    const finalUA = userAgent || defaultUA;

    if (isMinimal) {
        h = {
            'User-Agent': finalUA,
            'Accept': 'application/json, text/plain, */*',
            'Origin': 'https://www.xtpro.online',
            'Referer': 'https://www.xtpro.online/en'
        };
        if (hasBody) h['Content-Type'] = 'application/json';
    } else {
        // Default headers for Registration
        h = {
            'User-Agent': finalUA,
            'Accept': 'application/json, text/plain, */*',
            'Content-Type': 'application/json',
            'api-version': '4',
            'device': 'web',
            'Origin': 'https://www.xtpro.online',
            'Referer': 'https://www.xtpro.online/en',
            'sec-fetch-site': 'same-origin',
            'sec-fetch-mode': 'cors',
            'sec-fetch-dest': 'empty',
            'accept-language': 'en-US,en;q=0.9',
            'priority': 'u=1, i'
        };
    }

    if (customHeaders && Object.keys(customHeaders).length > 0) {
        for (const [key, value] of Object.entries(customHeaders)) {
            if (value) h[key] = value;
        }
    }

    if (token) {
        h['authorization'] = 'Bearer ' + token;
        h['token'] = token;
    }
    return h;
}

async function xtFetch(urlPath, opts) {
    opts = opts || {};
    var body = opts.body || null;
    var query = opts.query || null;
    var token = opts.token || null;
    var method = opts.method || 'POST';
    var customHeaders = opts.customHeaders || {};
    var isMinimal = opts.isMinimal || false;
    var userAgent = opts.userAgent || null;

    // Override api-version per Python script logic
    if (urlPath.includes('/acapi/')) {
        customHeaders['api-version'] = '2';
        customHeaders['xt-host'] = 'www.xtpro.online';
    }

    var headers = browserHeaders(token, customHeaders, isMinimal, !!body, userAgent);
    var url = 'https://www.xtpro.online' + urlPath;
    if (query) {
        var qs = new URLSearchParams(query).toString();
        url += '?' + qs;
    }

    console.log(`[API CALL] ${method} ${urlPath} ...`);
    var fetchOpts = { method: method, headers: headers };
    if (body && method !== 'GET') fetchOpts.body = JSON.stringify(body);

    try {
        var res = await fetch(url, fetchOpts);
        var text = await res.text();
        console.log(`[API RESP] ${urlPath} status=${res.status}`);

        if (res.status !== 200) {
            console.log(`[API FAIL BODY] ${urlPath}: ${text.substring(0, 1000)}`);
        }

        try {
            var json = JSON.parse(text);
            json._httpStatus = res.status;
            return json;
        } catch (e) {
            return { rc: -1, _httpStatus: res.status, mc: 'HTTP ' + res.status + ': ' + text.substring(0, 500) };
        }
    } catch (err) {
        console.error(`[API ERR] ${urlPath}: ${err.message}`);
        return { rc: -1, _httpStatus: 500, mc: 'Fetch Error: ' + err.message };
    }
}

function xtSuccess(data) {
    if (data.rc !== undefined) return data.rc === 0 || data.rc === '0';
    if (data.code !== undefined) return data.code === 0 || data.code === '0';
    if (data.returnCode !== undefined) return data.returnCode === 0 || data.returnCode === '0';
    if (data._httpStatus === 200) return true;
    return false;
}

function xtMsg(data) {
    return data.mc || data.msg || data.message || data.desc || JSON.stringify(data);
}

function rsaEncrypt(plainText, publicKeyBase64) {
    var pem = '-----BEGIN PUBLIC KEY-----\n' + publicKeyBase64 + '\n-----END PUBLIC KEY-----';
    var encrypted = crypto.publicEncrypt(
        { key: pem, padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(plainText, 'utf-8')
    );
    return encrypted.toString('base64');
}

// 1. Generate unique device headers for a new session
app.get('/api/generate-device-headers', function (req, res) {
    res.json(generateDeviceHeaders());
});

// 2. Validate Captcha (Manual)
app.post('/api/validate-captcha', async function (req, res) {
    var captchaResult = req.body.captchaResult;
    var userAgent = req.body.userAgent || null;
    if (!captchaResult) return res.status(400).json({ ok: false, msg: 'captchaResult wajib' });

    try {
        // Match Python nomenclature exactly
        var solution = {
            captchaId: 'f6cb1abffdcdf0b30659fd3bb4c0e929',
            captcha_id: 'f6cb1abffdcdf0b30659fd3bb4c0e929',
            lot_number: captchaResult.lot_number,
            captcha_output: captchaResult.captcha_output,
            pass_token: captchaResult.pass_token,
            gen_time: captchaResult.gen_time
        };

        var data = await xtFetch('/xt-app/public/captcha/validate', {
            query: { data: JSON.stringify(solution), type: '2' },
            method: 'POST',
            isMinimal: true,
            userAgent: userAgent
        });

        var certificate = data?.data?.certificate;
        if (certificate) {
            res.json({ ok: true, certificate: certificate });
        } else {
            res.json({ ok: false, msg: xtMsg(data) });
        }
    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
});

// 3. Step A: Send OTP
app.post('/api/send-otp', async function (req, res) {
    var email = req.body.email;
    var certificate = req.body.certificate;
    var customHeaders = req.body.customHeaders || {};
    var userAgent = req.body.userAgent || null;

    if (!email || !certificate) return res.status(400).json({ ok: false, msg: 'Email & Certificate wajib' });

    try {
        let sendOtpData = await xtFetch('/uaapi/user/msg/doSendCode', {
            query: { codeType: '101' },
            body: { codeType: '101', receiveAddress: email.trim(), puzzleValidateString: certificate, regChannel: 'xt' },
            isMinimal: true,
            customHeaders: customHeaders,
            userAgent: userAgent
        });
        if (sendOtpData._httpStatus === 200 || xtSuccess(sendOtpData)) {
            res.json({ ok: true, msg: 'OTP sent' });
        } else {
            res.status(400).json({ ok: false, msg: xtMsg(sendOtpData) });
        }
    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
});

// 4. Step B: Fetch OTP from IMAP
app.post('/api/fetch-otp', async function (req, res) {
    var email = req.body.email;
    var appPassword = req.body.appPassword;

    if (!email || !appPassword) return res.status(400).json({ ok: false, msg: 'Email & App Password wajib' });

    try {
        let baseEmail = email.split('@')[0].replace(/\./g, '') + '@' + email.split('@')[1];
        let client = new ImapFlow({
            host: 'imap.gmail.com', port: 993, secure: true,
            auth: { user: baseEmail, pass: appPassword },
            logger: false, tls: { rejectUnauthorized: false },
            verifyOnly: false
        });

        let otp = null;
        await client.connect();
        await client.mailboxOpen('INBOX');

        let msgs = await client.search({
            since: new Date(Date.now() - 10 * 60 * 1000) // Broader search for last 10 mins
        });

        if (msgs.length > 0) {
            // Check last 5 messages for speed and accuracy
            for (let i = msgs.length - 1; i >= Math.max(0, msgs.length - 5); i--) {
                let msg = await client.fetchOne(msgs[i], { source: true });
                let parsed = await simpleParser(msg.source);
                let text = (parsed.text || '') + (parsed.html || '');
                let subject = (parsed.subject || '').toLowerCase();
                let from = (parsed.from?.text || '').toLowerCase();

                // Relaxed criteria: focus on "verification" or "xt" anywhere in subject/sender
                if (subject.includes('verification') || subject.includes('xt') || subject.includes('code') || from.includes('xt')) {
                    let match = text.match(/\b(\d{6})\b/);
                    if (match) { otp = match[1]; break; }
                }
            }
        }
        await client.logout();

        if (otp) {
            res.json({ ok: true, otp: otp });
        } else {
            res.json({ ok: false, msg: 'OTP not found yet' });
        }
    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
});

// 5. Step C: Complete Registration
app.post('/api/complete-register', async function (req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var otp = req.body.otp;
    var refCode = req.body.refCode || 'AKNSZM';
    var customHeaders = req.body.customHeaders || {};
    var userAgent = req.body.userAgent || null;

    if (!email || !password || !otp) return res.status(400).json({ ok: false, msg: 'Data tidak lengkap' });

    try {
        // C. Get Public Key & Encrypt
        let keyData = await xtFetch('/uaapi/uaa/authorize/passwd/publicKey', {
            method: 'POST',
            isMinimal: true,
            userAgent: userAgent
        });
        if (!keyData?.data?.publicKey) throw new Error("Gagal mengambil public key");
        let loginPwd = rsaEncrypt(password, keyData.data.publicKey);

        // D. Register
        let regData = await xtFetch('/uaapi/user/v2/reg', {
            body: {
                userName: email.trim(), countryCode: '', dynamicCode: otp.trim(),
                loginPwd: loginPwd, passwdId: keyData.data.passwdId, recommendCode: refCode.trim(), regChannel: 'xt'
            },
            customHeaders: customHeaders,
            userAgent: userAgent
        });

        if (!xtSuccess(regData)) throw new Error("Gagal mendaftar: " + xtMsg(regData));

        let userId = regData?.data?.userId || regData?.data?.uid || '';
        let token = regData?.data?.accessToken || '';

        // Save to file
        fs.appendFileSync(ACCOUNTS_FILE, `${email}|${password}|${userId}|${refCode}|${new Date().toISOString()}|${token}\n`);

        // E. Activity: Apply (Join Event)
        await xtFetch('/acapi/general/activity/apply/999999999999991', {
            token: token,
            customHeaders: customHeaders
        });

        res.json({ ok: true, userId: userId, token: token, msg: 'Berhasil mendaftar & Join Event!' });

    } catch (err) {
        res.status(500).json({ ok: false, msg: err.message });
    }
});

// Catch-all route to serve React app for non-API requests
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', function () {
    console.log(`[Backend] Berjalan di port ${PORT}`);
});
