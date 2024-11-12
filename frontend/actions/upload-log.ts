"use server"

import { InferenceStatus, Prisma, PrismaClient } from "@prisma/client"
import { GetInference } from "./get-inference"

const prisma = new PrismaClient()
export const LogUpload = async ({
    filename,
    key,
    inferenceStatus
}: {
    filename: string,
    key: string,
    inferenceStatus: InferenceStatus
}) => {
    console.log("Logging upload", { filename, key, inferenceStatus });

    const response = await prisma.uploads.create({
        data: {
            filename: filename,
            s3Key: key,
            inferenceStatus
        }
    })
    await GetInference({
        uploadId: response.id,
        key
    })
}