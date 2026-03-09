require('dotenv').config();
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const https = require('https');

const ydbConfig = {
    endpoint: process.env.YDB_ENDPOINT,
    database: process.env.YDB_DATABASE,
    keyFile: process.env.YDB_SERVICE_ACCOUNT_KEY_FILE,
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

    const corsOrigin = process.env.CORS_ORIGIN || '*';
    app.use((req, res, next) => {
        res.setHeader('Access-Control-Allow-Origin', corsOrigin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }
        next();
    });

    app.use(express.json());

    const connectionString = getYdbConnectionString();
    let credentials = new EnvironCredentialsProvider(connectionString);

    if (ydbConfig.keyFile) {
        try {
            const iamToken = await getIamTokenFromKeyFile(ydbConfig.keyFile);
            credentials = new AccessTokenCredentialsProvider({ token: iamToken });
        } catch (err) {
            console.error('Ошибка получения IAM-токена из ключа:', err.message);
        }
    }

    const driverOptions = { credentialsProvider: credentials };
    if (credentials?.secureOptions) driverOptions.secureOptions = credentials.secureOptions;

    let ydb, sql;
    try {
        ydb = new Driver(connectionString, driverOptions);
        sql = query(ydb);
    } catch (e) {
        console.error('YDB init error:', e.message);
        process.exit(1);
    }

    // Helper: Сортировка (так как динамический ORDER BY сложен в YQL)
    const sortData = (data, sortBy, order) => {
        if (!sortBy) return data;
        return data.sort((a, b) => {
            if (a[sortBy] < b[sortBy]) return order === 'desc' ? 1 : -1;
            if (a[sortBy] > b[sortBy]) return order === 'desc' ? -1 : 1;
            return 0;
        });
    };

    // Helper: парсинг JSON колонок (в YDB могут храниться как строки)
    const parseJsonFields = (row, fields) => {
        fields.forEach(f => {
            if (row[f] && typeof row[f] === 'string') {
                try { row[f] = JSON.parse(row[f]); } catch (e) { }
            }
        });
        return row;
    };

    // Ограничение входа: 5 неудачных попыток за 1 час → блок на 15 минут (по email)
    const LOGIN_MAX_ATTEMPTS = 5;
    const LOGIN_WINDOW_MS = 60 * 60 * 1000;   // 1 час
    const LOGIN_BLOCK_MS = 15 * 60 * 1000;    // 15 минут
    const loginAttempts = new Map(); // key: email (lowercase), value: { attempts: number[], blockedUntil: number | null }

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

    // --- USERS ---
    app.get('/users', async (req, res) => {
        try {
            let [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users`);
            if (req.query.email) users = users.filter(u => u.email === req.query.email);
            if (req.query.role) users = users.filter(u => u.role === req.query.role);
            if (req.query._limit) users = users.slice(0, Number(req.query._limit));
            res.json(users);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.get('/users/:id', async (req, res) => {
        try {
            const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE id = ${req.params.id}`);
            if (!users.length) return res.status(404).json({ error: 'Not found' });
            res.json(users[0]);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.post('/users', async (req, res) => {
        try {
            const id = req.body.id || generateId();
            const { email, password, name, role, phone, avatar } = req.body;
            const createdAt = req.body.createdAt || new Date().toISOString();

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Users (id, email, password, name, role, phone, avatar, createdAt)
                VALUES (${id}, ${email}, ${password || ''}, ${name}, ${role || 'volunteer'}, ${phone || null}, ${avatar || null}, ${createdAt})
            `);

            res.status(201).json({ id, ...req.body, createdAt });
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.patch('/users/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE id = ${id}`);
            if (!users.length) return res.status(404).json({ error: 'Not found' });

            const row = users[0];
            const updated = {
                id,
                email: String(row.email ?? ''),
                password: String(row.password ?? ''),
                name: String(req.body.name ?? row.name ?? ''),
                role: String(req.body.role ?? row.role ?? 'volunteer'),
                phone: req.body.phone != null ? String(req.body.phone) : String(row.phone ?? ''),
                avatar: req.body.avatar != null ? String(req.body.avatar) : String(row.avatar ?? ''),
                createdAt: String(row.createdAt ?? new Date().toISOString()),
            };
            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Users (id, email, password, name, role, phone, avatar, createdAt)
                VALUES (${updated.id}, ${updated.email}, ${updated.password}, ${updated.name}, ${updated.role}, ${updated.phone}, ${updated.avatar}, ${updated.createdAt})
            `);
            res.json(updated);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    // --- AUTH ---
    app.post('/auth', async (req, res) => {
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
            if (user.password !== password) {
                recordLoginFailure(emailBody);
                return res.status(200).json({
                    status: 'FAIL',
                    error: 'INVALID_PASSWORD',
                    message: 'Неверный пароль',
                });
            }
            clearLoginAttempts(emailBody);
            const { password: _p, ...userWithoutPassword } = user;
            res.status(200).json({
                status: 'OK',
                error: null,
                message: null,
                user: userWithoutPassword,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ status: 'FAIL', error: 'SERVER_ERROR', message: 'Ошибка сервера' });
        }
    });

    app.post('/auth/register', async (req, res) => {
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
            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Users (id, email, password, name, role, phone, avatar, createdAt)
                VALUES (${id}, ${emailBody}, ${password}, ${name}, ${role || 'volunteer'}, null, null, ${createdAt})
            `);
            const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users WHERE id = ${id}`);
            const user = users[0];
            const { password: _p, ...userWithoutPassword } = user;
            res.status(200).json({
                status: 'OK',
                error: null,
                message: null,
                user: userWithoutPassword,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ status: 'FAIL', error: 'SERVER_ERROR', message: 'Ошибка сервера' });
        }
    });

    // --- EVENTS ---
    app.get('/events', async (req, res) => {
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

    app.get('/events/:id', async (req, res) => {
        try {
            const [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events WHERE id = ${req.params.id}`);
            if (!events.length) return res.status(404).json({ error: 'Not found' });
            res.json(parseJsonFields(events[0], ['roles']));
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.post('/events', async (req, res) => {
        try {
            const id = req.body.id || generateId();
            const { title, description, date, endDate, location, city, schedule, categoryId, status, organizerId, maxVolunteers, imageUrl } = req.body;
            const roles = req.body.roles ? JSON.stringify(req.body.roles) : null;
            const createdAt = req.body.createdAt || new Date().toISOString();
            const updatedAt = req.body.updatedAt || new Date().toISOString();

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Events (id, title, description, date, endDate, location, city, schedule, categoryId, status, organizerId, maxVolunteers, roles, imageUrl, createdAt, updatedAt)
                VALUES (${id}, ${title}, ${description}, ${date}, ${endDate || null}, ${location}, ${city || null}, ${schedule || null}, ${categoryId}, ${status || 'draft'}, ${organizerId}, ${maxVolunteers ? Number(maxVolunteers) : null}, ${roles}, ${imageUrl || null}, ${createdAt}, ${updatedAt})
            `);
            res.status(201).json({ id, ...req.body, createdAt, updatedAt });
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.patch('/events/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const [events] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Events WHERE id = ${id}`);
            if (!events.length) return res.status(404).json({ error: 'Not found' });

            const e = events[0];
            const updated = { ...e, ...req.body, updatedAt: new Date().toISOString() };
            const roles = updated.roles && typeof updated.roles !== 'string' ? JSON.stringify(updated.roles) : updated.roles;

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Events (id, title, description, date, endDate, location, city, schedule, categoryId, status, organizerId, maxVolunteers, roles, imageUrl, createdAt, updatedAt)
                VALUES (${id}, ${updated.title}, ${updated.description}, ${updated.date}, ${updated.endDate || null}, ${updated.location}, ${updated.city || null}, ${updated.schedule || null}, ${updated.categoryId}, ${updated.status}, ${updated.organizerId}, ${updated.maxVolunteers ? Number(updated.maxVolunteers) : null}, ${roles}, ${updated.imageUrl || null}, ${updated.createdAt}, ${updated.updatedAt})
            `);
            res.json({ ...updated, roles: typeof updated.roles === 'string' ? JSON.parse(updated.roles) : updated.roles });
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    // --- APPLICATIONS ---
    app.get('/applications', async (req, res) => {
        try {
            let [apps] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Applications`);

            if (req.query.eventId) apps = apps.filter(a => String(a.eventId) === req.query.eventId);
            if (req.query.userId) apps = apps.filter(a => String(a.userId) === req.query.userId);

            if (req.query._expand === 'user') {
                const [users] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Users`);
                apps = apps.map(a => ({ ...a, user: users.find(u => String(u.id) === String(a.userId)) }));
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

    app.post('/applications', async (req, res) => {
        try {
            const id = req.body.id || generateId();
            const { eventId, userId, status, roleId, roleName, message, createdAt, updatedAt } = req.body;

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Applications (id, eventId, userId, status, roleId, roleName, message, createdAt, updatedAt)
                VALUES (${id}, ${eventId}, ${userId}, ${status}, ${roleId || null}, ${roleName || null}, ${message || null}, ${createdAt || new Date().toISOString()}, ${updatedAt || new Date().toISOString()})
            `);
            res.status(201).json({ id, ...req.body });
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.patch('/applications/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const [apps] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Applications WHERE id = ${id}`);
            if (!apps.length) return res.status(404).json({ error: 'Not found' });

            const updated = { ...apps[0], ...req.body, updatedAt: new Date().toISOString() };
            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Applications (id, eventId, userId, status, roleId, roleName, message, createdAt, updatedAt)
                VALUES (${id}, ${updated.eventId}, ${updated.userId}, ${updated.status}, ${updated.roleId || null}, ${updated.roleName || null}, ${updated.message || null}, ${updated.createdAt}, ${updated.updatedAt})
            `);
            res.json(updated);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.delete('/applications/:id', async (req, res) => {
        try {
            await retry(defaultRetryConfig, () => sql`DELETE FROM Applications WHERE id = ${req.params.id}`);
            res.status(204).send();
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    // --- NOTIFICATIONS ---
    app.get('/notifications', async (req, res) => {
        try {
            let [notifs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Notifications`);
            if (req.query.userId) notifs = notifs.filter(n => String(n.userId) === req.query.userId);
            notifs = sortData(notifs, req.query._sort, req.query._order);
            res.json(notifs);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.patch('/notifications/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const [notifs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Notifications WHERE id = ${id}`);
            if (!notifs.length) return res.status(404).json({ error: 'Not found' });

            const updated = { ...notifs[0], ...req.body };
            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO Notifications (id, userId, title, message, read, createdAt)
                VALUES (${id}, ${updated.userId}, ${updated.title}, ${updated.message}, ${updated.read ? true : false}, ${updated.createdAt})
            `);
            res.json(updated);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    // --- EVENT REQUESTS ---
    app.get('/eventRequests', async (req, res) => {
        try {
            let [reqs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM EventRequests`);
            reqs = reqs.map(r => parseJsonFields(r, ['payload']));
            if (req.query.organizerId) reqs = reqs.filter(r => String(r.organizerId) === req.query.organizerId);
            if (req.query.status) reqs = reqs.filter(r => r.status === req.query.status);
            res.json(reqs);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.get('/eventRequests/:id', async (req, res) => {
        try {
            const [reqs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM EventRequests WHERE id = ${req.params.id}`);
            if (!reqs.length) return res.status(404).json({ error: 'Not found' });
            res.json(parseJsonFields(reqs[0], ['payload']));
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.post('/eventRequests', async (req, res) => {
        try {
            const id = req.body.id || generateId();
            const { organizerId, status, rejectionReason, eventId } = req.body;
            const payload = req.body.payload ? JSON.stringify(req.body.payload) : null;
            const createdAt = req.body.createdAt || new Date().toISOString();
            const updatedAt = req.body.updatedAt || new Date().toISOString();

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO EventRequests (id, organizerId, status, payload, rejectionReason, eventId, createdAt, updatedAt)
                VALUES (${id}, ${organizerId}, ${status}, ${payload}, ${rejectionReason || null}, ${eventId || null}, ${createdAt}, ${updatedAt})
            `);
            res.status(201).json({ id, ...req.body, createdAt, updatedAt });
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    app.patch('/eventRequests/:id', async (req, res) => {
        try {
            const id = req.params.id;
            const [reqs] = await retry(defaultRetryConfig, () => sql`SELECT * FROM EventRequests WHERE id = ${id}`);
            if (!reqs.length) return res.status(404).json({ error: 'Not found' });

            const updated = { ...reqs[0], ...req.body, updatedAt: new Date().toISOString() };
            const payload = updated.payload && typeof updated.payload !== 'string' ? JSON.stringify(updated.payload) : updated.payload;

            await retry(defaultRetryConfig, () => sql`
                UPSERT INTO EventRequests (id, organizerId, status, payload, rejectionReason, eventId, createdAt, updatedAt)
                VALUES (${id}, ${updated.organizerId}, ${updated.status}, ${payload}, ${updated.rejectionReason || null}, ${updated.eventId || null}, ${updated.createdAt}, ${updated.updatedAt})
            `);
            res.json({ ...updated, payload: typeof updated.payload === 'string' ? JSON.parse(updated.payload) : updated.payload });
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    // --- CATEGORIES ---
    app.get('/categories', async (req, res) => {
        try {
            const [cats] = await retry(defaultRetryConfig, () => sql`SELECT * FROM Categories`);
            res.json(cats);
        } catch (err) {
            console.error(err); res.status(500).json({ error: 'DB Error' });
        }
    });

    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, () => {
        console.log(`Сервер запущен на порту ${PORT}`);
    });
}

init().catch(console.error);
