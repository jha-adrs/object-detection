//Inference Endpoint
"use server"
import { InferenceStatus, PrismaClient } from '@prisma/client';
import AWS from 'aws-sdk';
import { Body } from 'aws-sdk/clients/s3';
import { createCanvas, loadImage } from 'canvas';
import { revalidatePath } from 'next/cache';

const region = 'us-east-1'

const sagemakerRuntime = new AWS.SageMakerRuntime({
    region: region,
    accessKeyId: process.env.TAWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.TAWS_SECRET_ACCESS_KEY
});

const s3 = new AWS.S3({
    region: 'eu-north-1',
    accessKeyId: process.env.TAWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.TAWS_SECRET_ACCESS_KEY
});

const prisma = new PrismaClient();

const fetchImageFromS3 = async (bucket: string, key: string) => {
    const s3Params = { Bucket: bucket, Key: key };
    return s3.getObject(s3Params).promise();
};


const invokeSageMakerEndpoint = async (endpointName: string, body: Body) => {
    const params = {
        EndpointName: endpointName,
        ContentType: 'application/x-image',
        Body: body,
        Accept: 'application/json;verbose;n_predictions=20'
    };
    return sagemakerRuntime.invokeEndpoint(params).promise();
};

const processImage = async (inputImg: Body, modelPredictions: any) => {
    if (inputImg instanceof Buffer || typeof inputImg !== "string") {
        console.log("Wrong image type");
        //throw new Error("Wrong input type in image processing")
    }
    const { normalized_boxes, classes, scores, labels } = modelPredictions;

    const classNames = classes.map((idx: any) => labels[parseInt(idx)]);

    const image = await loadImage(inputImg as Buffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    normalized_boxes.forEach((box: any, idx: any) => {
        const [left, bot, right, top] = box;
        const x = left * image.width;
        const y = bot * image.height;
        const width = (right - left) * image.width;
        const height = (top - bot) * image.height;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(`${classNames[idx]} ${Math.round(scores[idx] * 100)}%`, x, y - 10);
    });

    return canvas.toBuffer('image/jpeg');
};

const uploadImageToS3 = async (bucket: string, key: string, body: any) => {
    const s3Params = {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'image/jpeg'
    };
    return s3.upload(s3Params).promise();
};

const updateDatabase = async (uploadId: number, s3Key: string) => {
    await prisma.inference.upsert({
        where: {
            uploadId: uploadId
        },
        create: {
            uploadId,
            result: s3Key
        },
        update: {
            result: s3Key
        }
    });
    await prisma.uploads.update({
        where: {
            id: uploadId
        },
        data: {
            inferenceStatus: InferenceStatus.SUCCESS
        }
    })
}

export async function GetInference(req: {
    key: string,
    uploadId: number
}) {
    console.log("EVENT", req);
    const inputImgageKey = req.key;
    const uploadId = req.uploadId;

    try {
        const inputImg = await fetchImageFromS3('storage.platinumj', inputImgageKey);
        if (!inputImg?.Body) {
            return Response.json({
                success: false,
                message: "Image not found"
            })
        }
        const response = await invokeSageMakerEndpoint(process.env.SAGEMAKER_ENDPOINT_NAME || "", inputImg.Body);
        console.log("SAGEMAKER RESPONSE");

        const modelPredictions = JSON.parse(response.Body.toString('utf-8'));
        console.log("MODEL PREDICTIONS");

        const outputImgBuffer = await processImage(inputImg.Body, modelPredictions);
        const s3Key = `output/${Date.now()}.jpg`;
        const s3_response = await uploadImageToS3('storage.platinumj', s3Key, outputImgBuffer);
        console.log("S3 RESPONSE UPLOAD");

        await updateDatabase(uploadId, s3Key);
        console.log("RETURNING");

        return Response.json({
            statusCode: 200,
            body: JSON.stringify({ message: 'Image processed and uploaded to S3 successfully', s3Key: s3Key })
        });
    } catch (error: Error | any) {
        console.log("ERROR", error);

        await prisma.uploads.update({
            where: {
                id: uploadId
            }, data: {
                inferenceStatus: InferenceStatus.FAILED
            }
        })

        return Response.json({
            statusCode: 500,
            message: JSON.stringify({ error: error?.message })
        });
    }
} 