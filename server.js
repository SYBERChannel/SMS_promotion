/**
 * SMS Промо — Backend Server
 * Node.js + Express + Nodemailer (SMTP)
 *
 * Запуск:  node server.js
 * Порт:    3000 (или PORT из .env)
 */

'use strict';

require('dotenv').config();

const express    = require('express');
const nodemailer = require('nodemailer');
const path       = require('path');
const crypto     = require('crypto');

/* ---------- Captcha store ---------- */
// token -> { text: string, expires: number }
const captchaStore = new Map();

function generateCaptchaText() {
    const chars = 'abdefghjkmnpqrstuvwxyz23456789';
    let text = '';
    for (let i = 0; i < 4; i++) {
        text += chars[Math.floor(Math.random() * chars.length)];
    }
    return text;
}

function generateCaptchaSvg(text) {
    const W = 110, H = 46;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
    s += `<rect width="${W}" height="${H}" fill="#f3f3f3" rx="4"/>`;
    // шумовые линии
    for (let i = 0; i < 5; i++) {
        const rnd = () => (Math.random() * 1000 | 0) / 10;
        s += `<line x1="${rnd()%W}" y1="${rnd()%H}" x2="${rnd()%W}" y2="${rnd()%H}" stroke="#d0d0d0" stroke-width="1.2"/>`;
    }
    // шумовые точки
    for (let i = 0; i < 18; i++) {
        s += `<circle cx="${(Math.random()*W).toFixed(1)}" cy="${(Math.random()*H).toFixed(1)}" r="1.2" fill="#c8c8c8"/>`;
    }
    // символы
    const palette = ['#222', '#333', '#1a1a1a', '#444'];
    text.split('').forEach((ch, i) => {
        const x    = 12 + i * 24;
        const y    = 30 + ((Math.random() * 10 - 5) | 0);
        const rot  = ((Math.random() * 28 - 14) | 0);
        const size = 20 + ((Math.random() * 5) | 0);
        const col  = palette[i % palette.length];
        s += `<text x="${x}" y="${y}" font-family="'Courier New',Courier,monospace" font-size="${size}" font-weight="bold" fill="${col}" transform="rotate(${rot} ${x} ${y})">${ch}</text>`;
    });
    s += '</svg>';
    return s;
}

function cleanCaptchaStore() {
    const now = Date.now();
    for (const [k, v] of captchaStore.entries()) {
        if (v.expires < now) captchaStore.delete(k);
    }
}

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---------- Middleware ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Отдаём статику (index.html, style.css, script.js)
app.use(express.static(path.join(__dirname)));

/* ---------- SMTP Transporter (Resend) ---------- */
const transporter = nodemailer.createTransport({
    host:   'smtp.resend.com',
    port:   587,
    secure: false,
    auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY
    }
});

/* Проверка SMTP при старте */
transporter.verify(function (err) {
    if (err) {
        console.error('[RESEND] Ошибка подключения:', err.message);
        console.error('       Проверьте RESEND_API_KEY в файле .env');
    } else {
        console.log('[RESEND] Подключение успешно установлено');
    }
});

/* ---------- Helpers ---------- */

/**
 * Генерирует HTML-письмо для оператора (новая заявка)
 */
function buildOperatorEmail(data) {
    const tariff  = data.tariff  || 'не указан';
    const message = data.message || 'нет';
    const now     = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <tr>
          <td style="background:#FF4F12;padding:24px 32px;">
            <div style="color:#ffffff;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;opacity:0.8;margin-bottom:6px;">Миранда</div>
            <div style="color:#ffffff;font-size:22px;font-weight:800;line-height:1.2;">Новая заявка на подключение</div>
            <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:6px;">${now} МСК</div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 24px;font-size:15px;color:#555;">
              Поступила новая заявка с сайта. Данные клиента:
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:12px 16px;background:#fff3ee;border-left:4px solid #FF4F12;border-radius:6px 0 0 6px;font-size:13px;color:#888;font-weight:600;width:160px;vertical-align:top;">Имя</td>
                <td style="padding:12px 16px;background:#fff8f5;font-size:15px;color:#1a1a1a;font-weight:600;border-radius:0 6px 6px 0;">${escapeHtml(data.name)}</td>
              </tr>
              <tr><td colspan="2" style="height:8px;"></td></tr>
              <tr>
                <td style="padding:12px 16px;background:#f5f5f5;border-left:4px solid #ccc;border-radius:6px 0 0 6px;font-size:13px;color:#888;font-weight:600;vertical-align:top;">Email</td>
                <td style="padding:12px 16px;background:#fafafa;font-size:15px;color:#1a1a1a;border-radius:0 6px 6px 0;">
                  <a href="mailto:${escapeHtml(data.email)}" style="color:#FF4F12;text-decoration:none;">${escapeHtml(data.email)}</a>
                </td>
              </tr>
              <tr><td colspan="2" style="height:8px;"></td></tr>
              <tr>
                <td style="padding:12px 16px;background:#f5f5f5;border-left:4px solid #7B51D3;border-radius:6px 0 0 6px;font-size:13px;color:#888;font-weight:600;vertical-align:top;">Тариф</td>
                <td style="padding:12px 16px;background:#fafafa;font-size:15px;color:#1a1a1a;font-weight:700;border-radius:0 6px 6px 0;">${escapeHtml(tariff)}</td>
              </tr>
              <tr><td colspan="2" style="height:8px;"></td></tr>
              <tr>
                <td style="padding:12px 16px;background:#f5f5f5;border-left:4px solid #ccc;border-radius:6px 0 0 6px;font-size:13px;color:#888;font-weight:600;vertical-align:top;">Комментарий</td>
                <td style="padding:12px 16px;background:#fafafa;font-size:15px;color:#1a1a1a;border-radius:0 6px 6px 0;white-space:pre-wrap;">${escapeHtml(message)}</td>
              </tr>
            </table>

            <div style="margin-top:28px;padding:16px 20px;background:#e8f5e9;border-radius:8px;border-left:4px solid #4caf50;">
              <p style="margin:0;font-size:14px;color:#2e7d32;font-weight:600;">
                Свяжитесь с клиентом как можно скорее — заявки обрабатываются в течение рабочего дня
              </p>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;border-top:1px solid #eee;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;">
              Это автоматическое письмо с сайта Миранда. Не отвечайте на него.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Генерирует HTML-письмо для клиента (подтверждение заявки)
 */
function buildClientEmail(data) {
    const tariff = data.tariff || 'не выбран';

    return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);max-width:600px;width:100%;">

        <tr>
          <td style="background:linear-gradient(135deg,#FF4F12 0%,#ff7043 100%);padding:36px 32px;text-align:center;">
            <div style="color:#ffffff;font-size:42px;margin-bottom:12px;">&#10003;</div>
            <div style="color:#ffffff;font-size:24px;font-weight:800;line-height:1.2;margin-bottom:8px;">Ваша заявка принята!</div>
            <div style="color:rgba(255,255,255,0.85);font-size:15px;">Мы свяжемся с вами в течение рабочего дня</div>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 32px 0;">
            <p style="margin:0 0 16px;font-size:16px;color:#333;line-height:1.65;">
              Здравствуйте, <strong>${escapeHtml(data.name)}</strong>!
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#555;line-height:1.65;">
              Спасибо за вашу заявку. Мы получили её и уже обрабатываем.
              Наш менеджер свяжется с вами по указанному адресу электронной почты
              в ближайшее рабочее время.
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px 32px;">
            <div style="background:#fff3ee;border-radius:10px;padding:20px 24px;border-left:4px solid #FF4F12;">
              <div style="font-size:13px;font-weight:700;color:#FF4F12;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">Ваша заявка</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:14px;color:#888;padding-bottom:6px;width:130px;">Выбранный тариф:</td>
                  <td style="font-size:14px;color:#1a1a1a;font-weight:700;padding-bottom:6px;">${escapeHtml(tariff)}</td>
                </tr>
                <tr>
                  <td style="font-size:14px;color:#888;">Email:</td>
                  <td style="font-size:14px;color:#1a1a1a;">${escapeHtml(data.email)}</td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 32px;text-align:center;">
            <p style="margin:0 0 20px;font-size:14px;color:#888;">Если у вас есть вопросы — позвоните нам:</p>
            <a href="tel:+79790003330" style="display:inline-block;background:#FF4F12;color:#ffffff;font-size:16px;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;">
              +7 (979) 000-33-30
            </a>
            <p style="margin:16px 0 0;font-size:13px;color:#bbb;">Или по короткому номеру 3330 (бесплатно для абонентов Миранды)</p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 32px;border-top:1px solid #eee;background:#fafafa;">
            <p style="margin:0;font-size:12px;color:#aaa;text-align:center;line-height:1.6;">
              Это автоматическое письмо-подтверждение. Не отвечайте на него.<br>
              © ООО «Миранда-медиа», 2026
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Экранирование HTML-спецсимволов
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;');
}

/**
 * Простая валидация email
 */
function isValidEmail(email) {
    return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Проверка наличия обязательных полей
 */
function isNotEmpty(val) {
    return typeof val === 'string' && val.trim().length > 0;
}

/* ---------- Routes ---------- */

/**
 * POST /api/send-order
 * Принимает данные формы заявки, отправляет два письма:
 *   1. Оператору — уведомление о новой заявке
 *   2. Клиенту  — подтверждение с условиями акции
 */
app.post('/api/send-order', async function (req, res) {
    const { name, email, tariff, message, captchaToken, captcha } = req.body;

    // Валидация капчи
    const captchaEntry = captchaStore.get(captchaToken);
    if (!captchaEntry || Date.now() > captchaEntry.expires) {
        return res.status(400).json({ success: false, error: 'Срок действия капчи истёк. Обновите картинку.', captchaExpired: true });
    }
    if (!captcha || captcha.trim().toLowerCase() !== captchaEntry.text) {
        captchaStore.delete(captchaToken);
        return res.status(400).json({ success: false, error: 'Неверный код с картинки', captchaWrong: true });
    }
    captchaStore.delete(captchaToken); // одноразовое использование

    // Валидация обязательных полей
    if (!isNotEmpty(name)) {
        return res.status(400).json({ success: false, error: 'Укажите имя' });
    }
    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, error: 'Некорректный email' });
    }

    const data = {
        name:    name.trim(),
        email:   email.trim(),
        tariff:  (tariff  || '').trim(),
        message: (message || '').trim()
    };

    try {
        // 1. Письмо оператору
        await transporter.sendMail({
            from:    'Миранда <onboarding@resend.dev>',
            to:      process.env.OPERATOR_EMAIL,
            subject: `[Миранда] Новая заявка от ${data.name} — тариф: ${data.tariff || 'не выбран'}`,
            html:    buildOperatorEmail(data)
        });

        // 2. Письмо клиенту
        await transporter.sendMail({
            from:    'Миранда <onboarding@resend.dev>',
            to:      data.email,
            subject: 'Ваша заявка принята — Миранда',
            html:    buildClientEmail(data)
        });

        console.log(`[ORDER] Заявка от ${data.name} (${data.email}) — тариф: ${data.tariff || 'не выбран'}`);
        return res.json({ success: true });

    } catch (err) {
        console.error('[ORDER] Ошибка отправки письма:', err.message);
        return res.status(500).json({ success: false, error: 'Ошибка отправки письма' });
    }
});

/**
 * POST /api/subscribe
 * Подписка на новости (footer-форма)
 */
app.post('/api/subscribe', async function (req, res) {
    const { email } = req.body;

    if (!isValidEmail(email)) {
        return res.status(400).json({ success: false, error: 'Некорректный email' });
    }

    try {
        // Уведомление оператору
        await transporter.sendMail({
            from:    'Миранда <onboarding@resend.dev>',
            to:      process.env.OPERATOR_EMAIL,
            subject: `[Миранда] Новая подписка на новости: ${email.trim()}`,
            html: `
              <p>Новый подписчик: <strong>${escapeHtml(email.trim())}</strong></p>
              <p style="color:#888;font-size:12px;">Дата: ${new Date().toLocaleString('ru-RU')}</p>
            `
        });

        console.log(`[SUBSCRIBE] Новый подписчик: ${email.trim()}`);
        return res.json({ success: true });

    } catch (err) {
        console.error('[SUBSCRIBE] Ошибка:', err.message);
        return res.status(500).json({ success: false, error: 'Ошибка отправки' });
    }
});

/**
 * GET /captcha?s=<token>
 * Генерирует SVG-картинку капчи и сохраняет ответ в памяти.
 */
app.get('/captcha', function (req, res) {
    const s = req.query.s;
    if (typeof s !== 'string' || !s || s.length > 200) {
        return res.status(400).end();
    }
    cleanCaptchaStore();
    const text = generateCaptchaText();
    const svg  = generateCaptchaSvg(text);
    captchaStore.set(s, { text: text.toLowerCase(), expires: Date.now() + 10 * 60 * 1000 });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(svg);
});

/* Все остальные GET-запросы отдают index.html */
app.get('*', function (req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/* ---------- Start ---------- */
app.listen(PORT, function () {
    console.log('==============================================');
    console.log(`  SMS Промо сервер запущен: http://localhost:${PORT}`);
    console.log('==============================================');
    console.log(`  SMTP хост:    ${process.env.SMTP_HOST || '(не настроен)'}`);
    console.log(`  SMTP порт:    ${process.env.SMTP_PORT || '(не настроен)'}`);
    console.log(`  Почта отправителя: ${process.env.SMTP_USER || '(не настроена)'}`);
    console.log(`  Почта получателя:  ${process.env.OPERATOR_EMAIL || '(не настроена)'}`);
    console.log('==============================================');
});
