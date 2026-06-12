import 'dotenv/config';
import fs from 'node:fs';
import crypto from 'node:crypto';
import https from 'node:https';
import bcrypt from 'bcryptjs';
import { Driver } from '@ydbjs/core';
import { query } from '@ydbjs/query';
import { retry, defaultRetryConfig } from '@ydbjs/retry';
import { EnvironCredentialsProvider } from '@ydbjs/auth/environ';
import { AccessTokenCredentialsProvider } from '@ydbjs/auth/access-token';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');

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
            resolve(JSON.parse(data).iamToken);
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const connectionString = getYdbConnectionString();
  let credentials = new EnvironCredentialsProvider(connectionString);

  if (ydbConfig.keyFile) {
    const iamToken = await getIamTokenFromKeyFile(ydbConfig.keyFile);
    credentials = new AccessTokenCredentialsProvider({ token: iamToken });
  }

  const driverOptions = { credentialsProvider: credentials };
  if (credentials?.secureOptions) driverOptions.secureOptions = credentials.secureOptions;

  const ydb = new Driver(connectionString, driverOptions);
  const sql = query(ydb);

  const [users] = await retry(defaultRetryConfig, () => sql`
    SELECT id, password, passwordHash
    FROM Users
  `);

  const candidates = users.filter((user) => {
    const plainPassword = String(user.password ?? '');
    const hash = String(user.passwordHash ?? '');
    return plainPassword && (force || !hash);
  });

  console.log(`Users found: ${users.length}`);
  console.log(`Users to migrate: ${candidates.length}`);

  if (dryRun) {
    console.log('Dry run only. No rows were updated.');
    return;
  }

  for (const user of candidates) {
    const passwordHash = await bcrypt.hash(String(user.password), 10);
    await retry(defaultRetryConfig, () => sql`
      UPDATE Users
      SET passwordHash = ${passwordHash}
      WHERE id = ${user.id}
    `);
    console.log(`Migrated user ${user.id}`);
  }

  console.log('Password hash migration completed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
