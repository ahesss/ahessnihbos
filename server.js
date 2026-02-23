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

function browserHeaders(token, customHeaders = {}) {
    const h = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'sec-ch-ua-platform': '"Windows"',
        'lang': 'in',
        'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'api-version': '4',
        'sec-ch-ua-mobile': '?0',
        'device': 'web',
        'client-device-name': 'Chrome V144.0.0.0 (Win10)',
        'Origin': 'https://www.xtpro.online',
        'Referer': 'https://www.xtpro.online/en',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'accept-language': 'en-US,en;q=0.9',
        'priority': 'u=1, i'
    };

    // Merge custom headers if provided
    if (customHeaders) {
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

    // override certain endpoints api-version based on python script logic
    if (urlPath.includes('/acapi/')) {
        customHeaders['api-version'] = '2';
    }

    var headers = browserHeaders(token, customHeaders);
    var url = 'https://www.xtpro.online' + urlPath;
    if (query) {
        var qs = new URLSearchParams(query).toString();
        url += '?' + qs;
    }

    var fetchOpts = { method: method, headers: headers };
    if (body && method !== 'GET') fetchOpts.body = JSON.stringify(body);

    var res = await fetch(url, fetchOpts);
    var text = await res.text();

    try {
        var json = JSON.parse(text);
        json._httpStatus = res.status;
        return json;
    } catch (e) {
        return { rc: -1, _httpStatus: res.status, mc: 'HTTP ' + res.status + ': ' + text.substring(0, 500) };
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

// 1. Validate Captcha (Manual)
app.post('/api/validate-captcha', async function (req, res) {
    var captchaResult = req.body.captchaResult;
    var customHeaders = req.body.customHeaders || {};
    if (!captchaResult) return res.status(400).json({ ok: false, msg: 'captchaResult wajib' });

    try {
        var solution = {
            captcha_id: 'f6cb1abffdcdf0b30659fd3bb4c0e929',
            lot_number: captchaResult.lot_number,
            captcha_output: captchaResult.captcha_output,
            pass_token: captchaResult.pass_token,
            gen_time: captchaResult.gen_time
        };

        var data = await xtFetch('/xt-app/public/captcha/validate', {
            query: { data: JSON.stringify(solution), type: '2' },
            method: 'POST',
            customHeaders: customHeaders
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

// 2. Full Register Process (After Manual Captcha)
app.post('/api/register-process', async function (req, res) {
    var email = req.body.email;
    var password = req.body.password;
    var appPassword = req.body.appPassword;
    var refCode = req.body.refCode || 'AKNSZM'; // Fallback to Python script refcode
    var certificate = req.body.certificate;
    var customHeaders = req.body.customHeaders || {};

    if (!email || !password || !appPassword || !certificate) {
        return res.status(400).json({ ok: false, msg: 'Data tidak lengkap' });
    }

    try {
        // A. Send OTP (Python doesn't use custom headers here)
        let sendOtpData = await xtFetch('/uaapi/user/msg/doSendCode', {
            query: { codeType: '101' },
            body: { codeType: '101', receiveAddress: email.trim(), puzzleValidateString: certificate, regChannel: 'xt' }
        });
        if (sendOtpData._httpStatus !== 200 && !xtSuccess(sendOtpData)) {
            throw new Error("Gagal Kirim OTP: " + xtMsg(sendOtpData));
        }

        // B. Fetch OTP via IMAP
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
        let deadline = Date.now() + 65 * 1000;

        while (!otp && Date.now() < deadline) {
            let msgs = await client.search({
                unseen: true,
                since: new Date(Date.now() - 5 * 60 * 1000)
            });
            if (msgs.length > 0) {
                for (let i = msgs.length - 1; i >= 0; i--) {
                    let msg = await client.fetchOne(msgs[i], { source: true });
                    let parsed = await simpleParser(msg.source);
                    let text = (parsed.text || '') + (parsed.html || '');
                    let subject = (parsed.subject || '').toLowerCase();

                    // Verify subject or sender
                    if (subject.includes('verification') || subject.includes('xt') || subject.includes('code')) {
                        let match = text.match(/\b(\d{6})\b/);
                        if (match) { otp = match[1]; break; }
                    }
                }
            }
            if (!otp && Date.now() < deadline) await new Promise(r => setTimeout(r, 4000));
        }
        await client.logout();
        if (!otp) throw new Error("OTP tidak masuk dalam 60 detik.");

        // C. Get Public Key & Encrypt (Python doesn't use custom headers here)
        let keyData = await xtFetch('/uaapi/uaa/authorize/passwd/publicKey', { method: 'POST' });
        if (!keyData?.data?.publicKey) throw new Error("Gagal mengambil public key");
        let loginPwd = rsaEncrypt(password, keyData.data.publicKey);

        // D. Register (Python uses custom headers here)
        let regData = await xtFetch('/uaapi/user/v2/reg', {
            body: {
                userName: email.trim(), countryCode: '', dynamicCode: otp.trim(),
                loginPwd: loginPwd, passwdId: keyData.data.passwdId, recommendCode: refCode.trim(), regChannel: 'xt'
            },
            customHeaders: customHeaders
        });

        if (!xtSuccess(regData)) throw new Error("Gagal mendaftar: " + xtMsg(regData));

        let userId = regData?.data?.userId || regData?.data?.uid || '';
        let token = regData?.data?.accessToken || '';

        fs.appendFileSync(ACCOUNTS_FILE, `${email}|${password}|${userId}|${refCode}|${new Date().toISOString()}|${token}\n`);

        // E. Activity: Apply
        let applyData = await xtFetch('/acapi/general/activity/apply/999999999999991', {
            token: token,
            customHeaders: customHeaders
        });

        // F. Activity: Start Red Packet Rain
        let rainData = await xtFetch('/acapi/public/general/draw/NEWYEAR2026/start-red-packet-rain', {
            token: token,
            query: { activityId: '999999999999991', isFirstRedPacketRain: 'false' },
            customHeaders: customHeaders
        });

        let rainId = rainData?.result?.redPacketRainId;
        console.log(`[${email}] RedPacketRainId: ${rainId}`);

        // G. Activity: Draw (Turbo Draw Loop)
        if (rainId) {
            (async () => {
                for (let i = 0; i < 50; i++) { // Limit to 50 for safety in server environment
                    await xtFetch('/acapi/general/draw/NEWYEAR2026/draw', {
                        token: token,
                        query: { times: '9', redPacketRainId: rainId },
                        customHeaders: customHeaders
                    });
                    await new Promise(r => setTimeout(r, 100)); // Small delay
                }
                console.log(`[${email}] Draw loop finished.`);
            })();
        }

        res.json({ ok: true, userId: userId, token: token, msg: 'Berhasil mendaftar & Draw!' });

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
