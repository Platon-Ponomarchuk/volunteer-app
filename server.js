import { createRequire } from 'module';

const require = createRequire(import.meta.url);
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { uploadImage } = await import('./scripts/s3.js');

const ydbConfig = {
    endpoint: process.env.YDB_ENDPOINT,
    database: process.env.YDB_DATABASE,
    authOptions: {
        serviceAccountFile: './key.json'
    }
};

function getYdbConnectionString() {
    const endpoint = (ydbConfig.endpoint ?? '').replace(/\/$/, '');
    const database = ydbConfig.database ?? '/local';
    const path = database.startsWith('/') ? database : `/${database}`;
    return `${endpoint}${path}`;
}

function base64UrlEncode(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getIamTokenFromKeyFile(keyFilePath) {
    const keyFile = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
    const serviceAccountId = keyFile.service_account_id;
    const keyId = keyFile.id;
    const privateKey = crypto.createPrivateKey(keyFile.private_key);

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'PS256', kid: keyId };
    const payload = {
        iss: serviceAccountId,
        aud: 'https://iam.api.cloud.yandex.net/iam/v1/tokens',
        iat: now,
        exp: now + 3600,
    };
    const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
    const toSign = `${headerB64}.${payloadB64}`;
    const signature = crypto.sign('sha256', Buffer.from(toSign), {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: 32,
    });
    const jwt = `${toSign}.${base64UrlEncode(signature)}`;

    const body = JSON.stringify({ jwt });
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname: 'iam.api.cloud.yandex.net',
                path: '/iam/v1/tokens',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`IAM token request failed: ${res.statusCode} ${data}`));
                        return;
                    }
                    try {
                        const json = JSON.parse(data);
                        resolve(json.iamToken);
                    } catch (e) {
                        reject(e);
                    }
                });
            }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

const generateId = () => crypto.randomUUID();

async function init() {
    const { Driver } = await import('@ydbjs/core');
    const { query } = await import('@ydbjs/query');
    const { retry, defaultRetryConfig } = await import('@ydbjs/retry');
    const { EnvironCredentialsProvider } = await import('@ydbjs/auth/environ');
    const { AccessTokenCredentialsProvider } = await import('@ydbjs/auth/access-token');

    const app = express();

    const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (!origin || allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
        }
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: Number(process.env.RATE_LIMIT_MAX || 5000),
        message: { error: 'Too many requests' },
        standardHeaders: true,
        legacyHeaders: false,
    });
    app.use(limiter);

    app.use(express.json({ limit: '6mb' }));
    const api = express.Router();

    const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
    if (JWT_SECRET === 'dev-only-change-me') {
        console.warn('[security] JWT_SECRET не задан. Используется dev-only секрет для локального MVP.');
    }

    function sanitizeUser(user) {
        if (!user) return user;
        const { password: _password, passwordHash: _passwordHash, ...safeUser } = user;
        return safeUser;
    }

    function createAuthToken(user) {
        return jwt.sign(
            { sub: String(user.id), id: String(user.id), role: user.role || 'volunteer' },
            JWT_SECRET,
            { expiresIn: '2h' }
        );
    }

    async function hydrateTokenUser(decoded) {
        const userId = decoded?.id || decoded?.sub;
        if (!userId) return null;
        const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE id = ${dbString(userId)}`);
        if (!users.length) return null;
        const user = users[0];
        return {
            ...decoded,
            id: String(user.id),
            sub: String(user.id),
            role: String(user.role || decoded.role || 'volunteer'),
        };
    }

    async function authenticateToken(req, res, next) {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await hydrateTokenUser(decoded);
            if (!user) return res.status(401).json({ error: 'Unauthorized' });
            req.user = user;
            return next();
        } catch {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    async function optionalAuthenticateToken(req, _res, next) {
        const authHeader = req.headers.authorization || '';
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!token) return next();
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = await hydrateTokenUser(decoded);
        } catch {
            req.user = null;
        }
        return next();
    }

    function isAdmin(req) {
        return req.user?.role === 'admin';
    }

    function isApprovedOrganizer(req) {
        return req.user?.role === 'organizer';
    }

    function canAccessUser(req, userId) {
        return isAdmin(req) || String(req.user?.id) === String(userId) || String(req.user?.sub) === String(userId);
    }

    function forbid(res) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const connectionString = getYdbConnectionString();
    
    let credentials;
    try {
        const keyFilePath = ydbConfig.authOptions?.serviceAccountFile;
        if (keyFilePath && fs.existsSync(keyFilePath)) {
            const iamToken = await getIamTokenFromKeyFile(keyFilePath);
            credentials = new AccessTokenCredentialsProvider({ token: iamToken });
            console.log('YDB авторизация через Service Account Key');
        } else {
            credentials = new EnvironCredentialsProvider(connectionString);
            console.log('YDB авторизация через EnvironCredentialsProvider');
        }
    } catch (err) {
        console.error('Ошибка получения IAM-токена:', err.message);
        console.error('Проверьте наличие файла key.json и его содержимое');
        process.exit(1);
    }

    const driverOptions = { credentialsProvider: credentials };
    if (credentials?.secureOptions) driverOptions.secureOptions = credentials.secureOptions;

    let ydb, sql;
    try {
        ydb = new Driver(connectionString, driverOptions);
        sql = query(ydb);
        console.log('YDB драйвер инициализирован');
    } catch (e) {
        console.error('YDB init error:', e.message);
        process.exit(1);
    }

    const sortData = (data, sortBy, order) => {
        if (!sortBy) return data;
        return data.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return order === 'desc' ? 1 : -1;
            if (a[sortBy] > b[sortBy]) return order === 'desc' ? -1 : 1;
            return 0;
        });
    };

    const parseJsonFields = (row, fields) => {
        fields.forEach(f => {
            if (row[f] && typeof row[f] === 'string') {
                try { row[f] = JSON.parse(row[f]); } catch (e) { }
            }
        });
        return row;
    };

    const logYdbError = (label, err) => {
        console.error(label, err);
        if (err?.issues) {
            console.error(`${label} issues:`, JSON.stringify(err.issues, null, 2));
        }
    };

    const parseDataImage = (image) => {
        if (!image || typeof image !== 'string' || !image.startsWith('data:image')) {
            return { error: 'Invalid image' };
        }
        const match = image.match(/^data:image\/(jpeg|jpg|png|webp);base64,([a-zA-Z0-9+/=]+)$/);
        if (!match) return { error: 'Invalid format' };

        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const mime = match[1] === 'jpg' ? 'image/jpeg' : `image/${match[1]}`;
        const buffer = Buffer.from(match[2], 'base64');
        if (buffer.length > 5 * 1024 * 1024) return { error: 'Image is too large' };

        return { ext, mime, buffer };
    };

    const ensureS3Configured = () => {
        const required = ['S3_ENDPOINT', 'S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'];
        const missing = required.filter((key) => !process.env[key]);
        return missing.length ? `S3 is not configured: ${missing.join(', ')}` : null;
    };

    const stringifyRoles = (roles) => {
        if (!roles) return '[]';
        return typeof roles === 'string' ? roles : JSON.stringify(roles);
    };

    const dbString = (value, fallback = '') => {
        if (value === null || value === undefined) return fallback;
        return String(value);
    };

    const dbNumber = (value, fallback = 0) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };

    const dbBool = (value) => value === true || value === 'true';

    const LOGIN_MAX_ATTEMPTS = 5;
    const LOGIN_WINDOW_MS = 60 * 60 * 1000;
    const LOGIN_BLOCK_MS = 15 * 60 * 1000;
    const loginAttempts = new Map();

    function getLoginAttemptsKey(email) {
        return String(email || '').trim().toLowerCase();
    }

    function checkLoginBlocked(email) {
        const key = getLoginAttemptsKey(email);
        const data = loginAttempts.get(key);
        if (!data) return { blocked: false };
        const now = Date.now();
        if (data.blockedUntil && now < data.blockedUntil) {
            const minutesLeft = Math.ceil((data.blockedUntil - now) / 60000);
            return { blocked: true, minutesLeft };
        }
        return { blocked: false };
    }

    function recordLoginFailure(email) {
        const key = getLoginAttemptsKey(email);
        if (!key) return;
        const now = Date.now();
        let data = loginAttempts.get(key);
        if (!data) {
            data = { attempts: [], blockedUntil: null };
            loginAttempts.set(key, data);
        }
        data.attempts.push(now);
        data.attempts = data.attempts.filter(t => t > now - LOGIN_WINDOW_MS);
        if (data.attempts.length >= LOGIN_MAX_ATTEMPTS) {
            data.blockedUntil = now + LOGIN_BLOCK_MS;
        }
    }

    function clearLoginAttempts(email) {
        loginAttempts.delete(getLoginAttemptsKey(email));
    }

    api.get('/users', optionalAuthenticateToken, async (req, res) => {
        try {
            const isPublicOrganizerList = req.query.role === 'organizer' && !req.query.email;
            if (!isPublicOrganizerList && !isAdmin(req)) return forbid(res);
            let [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users`);
            if (req.query.email) users = users.filter(u => u.email === req.query.email);
            if (req.query.role) users = users.filter(u => u.role === req.query.role);
            if (req.query._limit) users = users.slice(0, Number(req.query._limit));
            res.json(users.map(sanitizeUser));
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.get('/users/:id', authenticateToken, async (req, res) => {
        try {
            const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE id = ${req.params.id}`);
            if (!users.length) return res.status(404).json({ error: 'Not found' });
            if (!canAccessUser(req, users[0].id)) return forbid(res);
            res.json(sanitizeUser(users[0]));
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.post('/users', authenticateToken, async (req, res) => {
        try {
            if (!isAdmin(req)) return forbid(res);
            const id = req.body.id || generateId();
            const { email, password, name, role, phone, avatar } = req.body;
            const passwordHash = password ? await bcrypt.hash(password, 10) : '';
            const createdAt = req.body.createdAt || new Date().toISOString();

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Users (id, email, passwordHash, name, role, phone, avatar, createdAt)
                VALUES (${id}, ${dbString(email)}, ${passwordHash}, ${dbString(name)}, ${dbString(role, 'volunteer')}, ${dbString(phone)}, ${dbString(avatar)}, ${createdAt})
            `);

            res.status(201).json(sanitizeUser({ id, ...req.body, passwordHash, createdAt }));
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.patch('/users/:id', authenticateToken, async (req, res) => {
        try {
            const id = req.params.id;
            const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE id = ${id}`);
            if (!users.length) return res.status(404).json({ error: 'Not found' });
            if (!canAccessUser(req, id)) return forbid(res);

            const row = users[0];
            const updated = {
                id,
                email: String(row.email ?? ''),
                passwordHash: req.body.password
                    ? await bcrypt.hash(String(req.body.password), 10)
                    : String(row.passwordHash ?? ''),
                name: String(req.body.name ?? row.name ?? ''),
                role: String(isAdmin(req) ? (req.body.role ?? row.role ?? 'volunteer') : (row.role ?? 'volunteer')),
                phone: req.body.phone != null ? String(req.body.phone) : String(row.phone ?? ''),
                avatar: req.body.avatar != null ? String(req.body.avatar) : String(row.avatar ?? ''),
                createdAt: String(row.createdAt ?? new Date().toISOString()),
            };
            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Users (id, email, passwordHash, name, role, phone, avatar, createdAt)
                VALUES (${updated.id}, ${updated.email}, ${updated.passwordHash}, ${updated.name}, ${updated.role}, ${updated.phone}, ${updated.avatar}, ${updated.createdAt})
            `);
            res.json(sanitizeUser(updated));
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.post('/auth', async (req, res) => {
        try {
            const { email: emailBody, password } = req.body || {};
            if (!emailBody || password === undefined) {
                return res.status(200).json({
                    status: 'FAIL',
                    error: 'INVALID_INPUT',
                    message: 'Укажите email и пароль',
                });
            }
            const block = checkLoginBlocked(emailBody);
            if (block.blocked) {
                const mins = block.minutesLeft;
                const msg = mins <= 1
                    ? 'Слишком много неудачных попыток входа. Попробуйте через минуту.'
                    : `Слишком много неудачных попыток входа. Попробуйте через ${mins} мин.`;
                return res.status(200).json({
                    status: 'FAIL',
                    error: 'LOGIN_BLOCKED',
                    message: msg,
                });
            }
            const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE email = ${emailBody}`);
            if (!users.length) {
                recordLoginFailure(emailBody);
                return res.status(200).json({
                    status: 'FAIL',
                    error: 'USER_NOT_FOUND',
                    message: 'Пользователь с таким email не найден',
                });
            }
            const user = users[0];
            const storedHash = String(user.passwordHash ?? '');
            const passwordOk = storedHash ? await bcrypt.compare(String(password), storedHash) : false;
            if (!passwordOk) {
                recordLoginFailure(emailBody);
                return res.status(200).json({
                    status: 'FAIL',
                    error: 'INVALID_PASSWORD',
                    message: 'Неверный пароль',
                });
            }
            clearLoginAttempts(emailBody);
            const token = createAuthToken(user);
            res.status(200).json({
                status: 'OK',
                error: null,
                message: null,
                user: sanitizeUser(user),
                token,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ status: 'FAIL', error: 'SERVER_ERROR', message: 'Ошибка сервера' });
        }
    });

    api.post('/auth/register', async (req, res) => {
        try {
            const { email: emailBody, password, name, role } = req.body || {};
            if (!emailBody || !password || !name) {
                return res.status(200).json({
                    status: 'FAIL',
                    error: 'INVALID_INPUT',
                    message: 'Заполните email, пароль и имя',
                });
            }
            const [existing] = await retry(defaultRetryConfig, () => sql`SELECT id FROM Users WHERE email = ${emailBody}`);
            if (existing && existing.length > 0) {
                return res.status(200).json({
                    status: 'FAIL',
                    error: 'EMAIL_EXISTS',
                    message: 'Пользователь с таким email уже зарегистрирован',
                });
            }
            const id = generateId();
            const createdAt = new Date().toISOString();
            const passwordHash = await bcrypt.hash(String(password), 10);
            const initialRole = role === 'organizer' ? 'organizer_pending' : 'volunteer';
            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Users (id, email, passwordHash, name, role, phone, avatar, createdAt)
                VALUES (${id}, ${emailBody}, ${passwordHash}, ${name}, ${initialRole}, '', '', ${createdAt})
            `);
            const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE id = ${id}`);
            const user = users[0];
            const token = createAuthToken(user);
            res.status(200).json({
                status: 'OK',
                error: null,
                message: null,
                user: sanitizeUser(user),
                token,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ status: 'FAIL', error: 'SERVER_ERROR', message: 'Ошибка сервера' });
        }
    });

    api.get('/auth/me', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.id || req.user.sub;
            const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE id = ${userId}`);
            if (!users.length) return res.status(404).json({ error: 'Not found' });
            res.json(sanitizeUser(users[0]));
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'DB Error' });
        }
    });

    api.post('/upload-avatar', authenticateToken, async (req, res) => {
        try {
            const s3Error = ensureS3Configured();
            if (s3Error) return res.status(500).json({ error: s3Error });

            const parsed = parseDataImage(req.body?.image);
            if (parsed.error) return res.status(400).json({ error: parsed.error });

            const userId = String(req.user.id || req.user.sub);
            const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE id = ${userId}`);
            if (!users.length) return res.status(404).json({ error: 'User not found' });

            const key = `avatars/${userId}-${Date.now()}.${parsed.ext}`;
            const url = await uploadImage(key, parsed.buffer, parsed.mime);
            const row = users[0];
            const updated = {
                id: userId,
                email: String(row.email ?? ''),
                passwordHash: String(row.passwordHash ?? ''),
                name: String(row.name ?? ''),
                role: String(row.role ?? 'volunteer'),
                phone: row.phone != null ? String(row.phone) : '',
                avatar: url,
                createdAt: String(row.createdAt ?? new Date().toISOString()),
            };

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Users (id, email, passwordHash, name, role, phone, avatar, createdAt)
                VALUES (${updated.id}, ${updated.email}, ${updated.passwordHash}, ${updated.name}, ${updated.role}, ${updated.phone}, ${updated.avatar}, ${updated.createdAt})
            `);

            res.json({ url });
        } catch (err) {
            console.error('Upload error:', err);
            res.status(500).json({ error: 'Upload failed' });
        }
    });

    api.post('/upload-event-image', authenticateToken, async (req, res) => {
        try {
            const s3Error = ensureS3Configured();
            if (s3Error) return res.status(500).json({ error: s3Error });

            const { image, eventId } = req.body || {};
            if (!eventId) return res.status(400).json({ error: 'eventId is required' });

            const parsed = parseDataImage(image);
            if (parsed.error) return res.status(400).json({ error: parsed.error });

            const [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events WHERE id = ${eventId}`);
            if (!events.length) return res.status(404).json({ error: 'Event not found' });

            const event = events[0];
            if (!isAdmin(req) && String(event.organizerId) !== String(req.user.id || req.user.sub)) return forbid(res);

            const key = `events/${eventId}-${Date.now()}.${parsed.ext}`;
            const url = await uploadImage(key, parsed.buffer, parsed.mime);
            const updated = { ...event, imageUrl: url, updatedAt: new Date().toISOString() };
            const roles = stringifyRoles(updated.roles);

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Events (id, title, description, date, endDate, location, city, schedule, categoryId, status, organizerId, maxVolunteers, roles, imageUrl, createdAt, updatedAt)
                VALUES (${eventId}, ${dbString(updated.title)}, ${dbString(updated.description)}, ${dbString(updated.date)}, ${dbString(updated.endDate)}, ${dbString(updated.location)}, ${dbString(updated.city)}, ${dbString(updated.schedule)}, ${dbString(updated.categoryId)}, ${dbString(updated.status, 'draft')}, ${dbString(updated.organizerId)}, ${dbNumber(updated.maxVolunteers)}, CAST(${roles} AS Json), ${dbString(updated.imageUrl)}, ${dbString(updated.createdAt, new Date().toISOString())}, ${dbString(updated.updatedAt, new Date().toISOString())})
            `);

            res.json({ url });
        } catch (err) {
            console.error('Upload error:', err);
            res.status(500).json({ error: 'Upload failed' });
        }
    });

    api.get('/events', async (req, res) => {
        try {
            let [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events`);
            events = events.map(e => parseJsonFields(e, ['roles']));

            if (req.query.categoryId) events = events.filter(e => e.categoryId === req.query.categoryId);
            if (req.query.city) events = events.filter(e => e.city === req.query.city);
            if (req.query.status) events = events.filter(e => e.status === req.query.status);
            if (req.query.date_gte) events = events.filter(e => e.date >= req.query.date_gte);
            if (req.query.date_lte) events = events.filter(e => e.date <= req.query.date_lte);
            if (req.query.organizerId) events = events.filter(e => e.organizerId === req.query.organizerId);
            if (req.query.q) {
                const q = req.query.q.toLowerCase();
                events = events.filter(e => e.title?.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q));
            }

            events = sortData(events, req.query._sort, req.query._order);

            if (req.query._start || req.query._limit) {
                const start = Number(req.query._start || 0);
                const limit = Number(req.query._limit || events.length);
                events = events.slice(start, start + limit);
            }
            res.json(events);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.get('/events/:id', async (req, res) => {
        try {
            const [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events WHERE id = ${req.params.id}`);
            if (!events.length) return res.status(404).json({ error: 'Not found' });
            res.json(parseJsonFields(events[0], ['roles']));
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.post('/events', authenticateToken, async (req, res) => {
        try {
            const id = req.body.id || generateId();
            const { title, description, date, endDate, location, city, schedule, categoryId, status, organizerId, maxVolunteers, imageUrl } = req.body;
            if (!isAdmin(req) && !isApprovedOrganizer(req)) return forbid(res);
            if (!isAdmin(req) && String(organizerId) !== String(req.user.id || req.user.sub)) return forbid(res);
            const roles = stringifyRoles(req.body.roles);
            const createdAt = req.body.createdAt || new Date().toISOString();
            const updatedAt = req.body.updatedAt || new Date().toISOString();

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Events (id, title, description, date, endDate, location, city, schedule, categoryId, status, organizerId, maxVolunteers, roles, imageUrl, createdAt, updatedAt)
                VALUES (${id}, ${dbString(title)}, ${dbString(description)}, ${dbString(date)}, ${dbString(endDate)}, ${dbString(location)}, ${dbString(city)}, ${dbString(schedule)}, ${dbString(categoryId)}, ${dbString(status, 'draft')}, ${dbString(organizerId)}, ${dbNumber(maxVolunteers)}, CAST(${roles} AS Json), ${dbString(imageUrl)}, ${createdAt}, ${updatedAt})
            `);
            res.status(201).json({ id, ...req.body, createdAt, updatedAt });
        } catch (err) {
            logYdbError('Event create error:', err);
            res.status(500).json({ error: 'Event create failed', message: err instanceof Error ? err.message : String(err) });
        }
    });

    api.patch('/events/:id', authenticateToken, async (req, res) => {
        try {
            const id = req.params.id;
            const [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events WHERE id = ${id}`);
            if (!events.length) return res.status(404).json({ error: 'Not found' });

            const e = events[0];
            if (!isAdmin(req) && String(e.organizerId) !== String(req.user.id || req.user.sub)) return forbid(res);
            const updated = { ...e, ...req.body, updatedAt: new Date().toISOString() };
            const roles = stringifyRoles(updated.roles);

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Events (id, title, description, date, endDate, location, city, schedule, categoryId, status, organizerId, maxVolunteers, roles, imageUrl, createdAt, updatedAt)
                VALUES (${id}, ${dbString(updated.title)}, ${dbString(updated.description)}, ${dbString(updated.date)}, ${dbString(updated.endDate)}, ${dbString(updated.location)}, ${dbString(updated.city)}, ${dbString(updated.schedule)}, ${dbString(updated.categoryId)}, ${dbString(updated.status, 'draft')}, ${dbString(updated.organizerId)}, ${dbNumber(updated.maxVolunteers)}, CAST(${roles} AS Json), ${dbString(updated.imageUrl)}, ${dbString(updated.createdAt, new Date().toISOString())}, ${dbString(updated.updatedAt, new Date().toISOString())})
            `);
            res.json({ ...updated, roles: typeof updated.roles === 'string' ? JSON.parse(updated.roles) : updated.roles });
        } catch (err) {
            logYdbError('Event update error:', err);
            res.status(500).json({ error: 'Event update failed', message: err instanceof Error ? err.message : String(err) });
        }
    });

    api.get('/applications', authenticateToken, async (req, res) => {
        try {
            let [apps] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Applications`);
            const currentUserId = String(req.user.id || req.user.sub);

            if (req.query.userId && !isAdmin(req) && String(req.query.userId) !== currentUserId) return forbid(res);
            if (!req.query.userId && !req.query.eventId && !isAdmin(req)) return forbid(res);
            if (req.query.eventId && !isAdmin(req)) {
                const [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events WHERE id = ${req.query.eventId}`);
                if (!events.length || String(events[0].organizerId) !== currentUserId) return forbid(res);
            }

            if (req.query.eventId) apps = apps.filter(a => String(a.eventId) === req.query.eventId);
            if (req.query.userId) apps = apps.filter(a => String(a.userId) === req.query.userId);

            if (req.query._expand === 'user') {
                const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users`);
                apps = apps.map(a => ({ ...a, user: sanitizeUser(users.find(u => String(u.id) === String(a.userId))) }));
            }
            if (req.query._expand === 'event') {
                const [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events`);
                apps = apps.map(a => ({ ...a, event: events.find(e => String(e.id) === String(a.eventId)) }));
            }
            if (req.query._limit) apps = apps.slice(0, Number(req.query._limit));
            res.json(apps);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.post('/applications', authenticateToken, async (req, res) => {
        try {
            const id = req.body.id || generateId();
            const { eventId, userId, status, roleId, roleName, message, createdAt, updatedAt } = req.body;
            if (!isAdmin(req) && String(userId) !== String(req.user.id || req.user.sub)) return forbid(res);

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Applications (id, eventId, userId, status, roleId, roleName, message, createdAt, updatedAt)
                VALUES (${id}, ${dbString(eventId)}, ${dbString(userId)}, ${dbString(status, 'pending')}, ${dbString(roleId)}, ${dbString(roleName)}, ${dbString(message)}, ${createdAt || new Date().toISOString()}, ${updatedAt || new Date().toISOString()})
            `);
            res.status(201).json({ id, ...req.body });
        } catch (err) {
            logYdbError('Application create error:', err);
            res.status(500).json({ error: 'Application create failed', message: err instanceof Error ? err.message : String(err) });
        }
    });

    api.patch('/applications/:id', authenticateToken, async (req, res) => {
        try {
            const id = req.params.id;
            const [apps] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Applications WHERE id = ${id}`);
            if (!apps.length) return res.status(404).json({ error: 'Not found' });
            const appRow = apps[0];
            const [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events WHERE id = ${appRow.eventId}`);
            const currentUserId = String(req.user.id || req.user.sub);
            const ownsApplication = String(appRow.userId) === currentUserId;
            const ownsEvent = events.length && String(events[0].organizerId) === currentUserId;
            if (!isAdmin(req) && !ownsApplication && !ownsEvent) return forbid(res);

            const updated = { ...appRow, ...req.body, updatedAt: new Date().toISOString() };
            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Applications (id, eventId, userId, status, roleId, roleName, message, createdAt, updatedAt)
                VALUES (${id}, ${dbString(updated.eventId)}, ${dbString(updated.userId)}, ${dbString(updated.status, 'pending')}, ${dbString(updated.roleId)}, ${dbString(updated.roleName)}, ${dbString(updated.message)}, ${dbString(updated.createdAt, new Date().toISOString())}, ${dbString(updated.updatedAt, new Date().toISOString())})
            `);
            res.json(updated);
        } catch (err) {
            logYdbError('Application update error:', err);
            res.status(500).json({ error: 'Application update failed', message: err instanceof Error ? err.message : String(err) });
        }
    });

    api.delete('/applications/:id', authenticateToken, async (req, res) => {
        try {
            const [apps] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Applications WHERE id = ${req.params.id}`);
            if (!apps.length) return res.status(404).json({ error: 'Not found' });
            const [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events WHERE id = ${apps[0].eventId}`);
            const currentUserId = String(req.user.id || req.user.sub);
            const ownsApplication = String(apps[0].userId) === currentUserId;
            const ownsEvent = events.length && String(events[0].organizerId) === currentUserId;
            if (!isAdmin(req) && !ownsApplication && !ownsEvent) return forbid(res);
            await retry(defaultRetryConfig, () => sql`DELETE FROM Applications WHERE id = ${req.params.id}`);
            res.status(204).send();
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.get('/notifications', authenticateToken, async (req, res) => {
        try {
            let [notifs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Notifications`);
            if (req.query.userId && !canAccessUser(req, req.query.userId)) return forbid(res);
            if (!req.query.userId && !isAdmin(req)) return forbid(res);
            if (req.query.userId) notifs = notifs.filter(n => String(n.userId) === req.query.userId);
            notifs = sortData(notifs, req.query._sort, req.query._order);
            res.json(notifs);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.patch('/notifications/:id', authenticateToken, async (req, res) => {
        try {
            const id = req.params.id;
            const [notifs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Notifications WHERE id = ${id}`);
            if (!notifs.length) return res.status(404).json({ error: 'Not found' });
            if (!canAccessUser(req, notifs[0].userId)) return forbid(res);

            const updated = { ...notifs[0], ...req.body };
            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Notifications (id, userId, title, message, read, createdAt)
                VALUES (${id}, ${dbString(updated.userId)}, ${dbString(updated.title)}, ${dbString(updated.message)}, ${dbBool(updated.read)}, ${dbString(updated.createdAt, new Date().toISOString())})
            `);
            res.json(updated);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.get('/eventRequests', authenticateToken, async (req, res) => {
        try {
            let [reqs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM EventRequests`);
            reqs = reqs.map(r => parseJsonFields(r, ['payload']));
            if (req.query.organizerId && !canAccessUser(req, req.query.organizerId)) return forbid(res);
            if (!req.query.organizerId && !isAdmin(req)) return forbid(res);
            if (req.query.organizerId) reqs = reqs.filter(r => String(r.organizerId) === req.query.organizerId);
            if (req.query.status) reqs = reqs.filter(r => r.status === req.query.status);
            res.json(reqs);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.get('/eventRequests/:id', authenticateToken, async (req, res) => {
        try {
            const [reqs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM EventRequests WHERE id = ${req.params.id}`);
            if (!reqs.length) return res.status(404).json({ error: 'Not found' });
            if (!canAccessUser(req, reqs[0].organizerId)) return forbid(res);
            res.json(parseJsonFields(reqs[0], ['payload']));
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.post('/eventRequests', authenticateToken, async (req, res) => {
        try {
            const id = req.body.id || generateId();
            const { organizerId, status } = req.body;
            if (!isAdmin(req) && !isApprovedOrganizer(req)) return forbid(res);
            if (!isAdmin(req) && String(organizerId) !== String(req.user.id || req.user.sub)) return forbid(res);
            const payloadObject = req.body.payload ? { ...req.body.payload } : null;
            if (payloadObject?.imageData) {
                const s3Error = ensureS3Configured();
                if (s3Error) return res.status(500).json({ error: s3Error });

                const parsed = parseDataImage(payloadObject.imageData);
                if (parsed.error) return res.status(400).json({ error: parsed.error });
                const key = `events/request-${id}-${Date.now()}.${parsed.ext}`;
                try {
                    payloadObject.imageUrl = await uploadImage(key, parsed.buffer, parsed.mime);
                } catch (uploadErr) {
                    console.error('Event request image upload error:', uploadErr);
                    return res.status(500).json({ error: 'Image upload failed' });
                }
                delete payloadObject.imageData;
            }
            const payload = payloadObject ? JSON.stringify(payloadObject) : '{}';
            const createdAt = req.body.createdAt || new Date().toISOString();
            const updatedAt = req.body.updatedAt || new Date().toISOString();

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO EventRequests (id, organizerId, status, payload, createdAt, updatedAt)
                VALUES (${id}, ${dbString(organizerId)}, ${dbString(status, 'pending')}, CAST(${payload} AS Json), ${createdAt}, ${updatedAt})
            `);
            res.status(201).json({ id, ...req.body, payload: payloadObject, createdAt, updatedAt });
        } catch (err) {
            logYdbError('Event request create error:', err);
            res.status(500).json({
                error: 'Event request create failed',
                message: err instanceof Error ? err.message : String(err),
            });
        }
    });

    api.patch('/eventRequests/:id', authenticateToken, async (req, res) => {
        try {
            const id = req.params.id;
            const [reqs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM EventRequests WHERE id = ${id}`);
            if (!reqs.length) return res.status(404).json({ error: 'Not found' });
            if (!canAccessUser(req, reqs[0].organizerId)) return forbid(res);

            const updated = { ...reqs[0], ...req.body, updatedAt: new Date().toISOString() };
            const payload = updated.payload && typeof updated.payload !== 'string' ? JSON.stringify(updated.payload) : updated.payload;

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO EventRequests (id, organizerId, status, payload, rejectionReason, eventId, createdAt, updatedAt)
                VALUES (${id}, ${dbString(updated.organizerId)}, ${dbString(updated.status, 'pending')}, CAST(${payload || '{}'} AS Json), ${dbString(updated.rejectionReason)}, ${dbString(updated.eventId)}, ${dbString(updated.createdAt, new Date().toISOString())}, ${dbString(updated.updatedAt, new Date().toISOString())})
            `);
            res.json({ ...updated, payload: typeof updated.payload === 'string' ? JSON.parse(updated.payload) : updated.payload });
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    api.get('/categories', async (req, res) => {
        try {
            const [cats] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Categories`);
            res.json(cats);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.use('/api', api);

    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, () => {
        console.log(`Сервер запущен на порту ${PORT}`);
    });
}

init().catch(console.error);
