import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
});

const BUCKET = process.env.S3_BUCKET;

export async function uploadImage(key, buffer, contentType = 'image/jpeg') {
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read'
    }));
    return `https://storage.yandexcloud.net/${BUCKET}/${key}`;
}

export async function deleteImage(key) {
    await s3.send(new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: key
    }));
}