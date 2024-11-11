import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
export const getUploads = async () => {
    const uploads = await prisma.uploads.findMany({
        take: 10,
        
        include: {
            inference: true
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
            inference_url: upload.inference ? `${S3URLPrefix}/${upload.inference.result}` : null,
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