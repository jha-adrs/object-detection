"use server"
import { PrismaClient } from "@prisma/client";
import AWS from 'aws-sdk'
const prisma = new PrismaClient();
const s3 = new AWS.S3({
    region: 'eu-north-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const getPresignedURL = (key: string) => {
    const params = {
        Bucket: 'storage.platinumj',
        Key: key,
        Expires: 60000 // URL expiration time in seconds
    };
    return s3.getSignedUrl('getObject', params);
}

export const getUploads = async () => {
    const uploads = await prisma.uploads.findMany({
        take: 10,
        include: {
            inference: true
        },
        orderBy:{
            createdAt: 'desc'
        }
    });
    const S3URLPrefix = process.env.S3_URL_PREFIX;
    let data: {
        id: number,
        file: string,
        inference_url?: string | null
    }[] = [];
    for (let upload of uploads) {
        const curr = {
            id: upload.id,
            file: `${S3URLPrefix}/${upload.s3Key}`,
            inference_url: upload.inference ? getPresignedURL(`${upload.inference.result}`) : null,
        };
        data.push({
            id: curr.id,
            file: curr.file,
            inference_url: curr.inference_url
        });
    }
    return {
        data: data,
        success: true
    }
}