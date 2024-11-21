import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { S3Client } from '@aws-sdk/client-s3'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
    const { filename, contentType } = await request.json()
    console.log("Uploading", { filename, contentType });

    try {
        const client = new S3Client({
            region: process.env.TAWS_REGION,
            credentials: {
                accessKeyId: process.env.TAWS_ACCESS_KEY_ID || "",
                secretAccessKey: process.env.TAWS_SECRET_ACCESS_KEY || ""
            }
        })
        const { url, fields } = await createPresignedPost(client, {
            Bucket: process.env.TAWS_BUCKET_NAME || "mng-cdn-dev",
            Key: uuidv4(),
            Conditions: [
                ['content-length-range', 0, 10485760], // up to 10 MB
                ['starts-with', '$Content-Type', contentType],
            ],
            Fields: {
                acl: 'public-read',
                'Content-Type': contentType,
            },
            Expires: 600, // Seconds before the presigned post expires. 3600 by default.
        })
        
        return Response.json({ url, fields })
    } catch (error: any) {
        console.error("Error uploading file", error)
        return Response.json({ error: error?.message })
    }
}