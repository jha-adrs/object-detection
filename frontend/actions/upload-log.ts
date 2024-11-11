"use server"

import { InferenceStatus, Prisma, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
export const LogUpload = async ({
    filename,
    key,
    inferenceStatus
}:{
    filename: string,
    key: string,
    inferenceStatus: InferenceStatus
}) => {
    console.log("Logging upload", { filename, key, inferenceStatus });
    
    await prisma.uploads.create({
        data: {
            filename: filename,
            s3Key: key,
            inferenceStatus
        }
    })
}