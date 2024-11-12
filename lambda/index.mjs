import AWS from 'aws-sdk';
import { createCanvas, loadImage } from 'canvas';
import mysql from 'mysql';

const endpointName = 'jumpstart-dft-mx-od-yolo3-mobilenet-20241112-104251';
const region = 'us-east-1';
const accessKeyId = '';
const secretAccessKey = '';

const sagemakerRuntime = new AWS.SageMakerRuntime({
    region: region,
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey
});

const s3 = new AWS.S3({
    region: region,
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey
});

const db = mysql.createConnection({
    host: 'rds.amazonaws.com',
    user: 'admin',
    password: '',
    database: 'object-detection'
});

const fetchImageFromS3 = async (bucket, key) => {
    const s3Params = { Bucket: bucket, Key: key };
    return s3.getObject(s3Params).promise();
};

const invokeSageMakerEndpoint = async (endpointName, body) => {
    const params = {
        EndpointName: endpointName,
        ContentType: 'application/x-image',
        Body: body,
        Accept: 'application/json;verbose;n_predictions=20'
    };
    return sagemakerRuntime.invokeEndpoint(params).promise();
};

const processImage = async (inputImg, modelPredictions) => {
    const { normalized_boxes, classes, scores, labels } = modelPredictions;
    const classNames = classes.map(idx => labels[parseInt(idx)]);

    const image = await loadImage(inputImg);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    normalized_boxes.forEach((box, idx) => {
        const [left, bot, right, top] = box;
        const x = left * image.width;
        const y = bot * image.height;
        const width = (right - left) * image.width;
        const height = (top - bot) * image.height;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = 'white';
        ctx.fillText(`${classNames[idx]} ${Math.round(scores[idx] * 100)}%`, x, y - 10);
    });

    return canvas.toBuffer('image/jpeg');
};

const uploadImageToS3 = async (bucket, key, body) => {
    const s3Params = {
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'image/jpeg'
    };
    return s3.upload(s3Params).promise();
};

const updateDatabase = async (uploadId, modelPredictions, s3Key) => {
    const upsertQuery = `
        INSERT INTO Inference (uploadId, result)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE
        result = VALUES(result)
    `;
    const updateQuery = 'UPDATE Uploads SET inferenceStatus = ? WHERE id = ?';

    try {
        console.log("Executing upsert query...");
        await new Promise((resolve, reject) => {
            db.query(upsertQuery, [uploadId, JSON.stringify(modelPredictions || [])], (error, results) => {
                if (error) {
                    console.log("ERROR in upsert query", error);
                    return reject(error);
                }
                console.log("Upsert query executed successfully");
                resolve(results);
            });
        });

        console.log("Executing update query...");
        await new Promise((resolve, reject) => {
            db.query(updateQuery, ['SUCCESS', uploadId], (error, results) => {
                if (error) {
                    console.log("ERROR in update query", error);
                    return reject(error);
                }
                console.log("Update query executed successfully");
                resolve(results);
            });
        });

        console.log("Database update completed successfully");
    } catch (error) {
        console.log("ERROR in updateDatabase function", error);
        throw error;
    }
};

exports.handler = async (event) => {
    console.log("EVENT", event);

    const inputImgageKey = event.body;
    const uploadId = event.uploadId;

    try {
        const inputImg = await fetchImageFromS3('storage.platinumj', inputImgageKey);
        const response = await invokeSageMakerEndpoint(endpointName, inputImg.Body);
        console.log("SAGEMAKER RESPONSE");

        const modelPredictions = JSON.parse(response.Body.toString('utf-8'));
        console.log("MODEL PREDICTIONS");

        const outputImgBuffer = await processImage(inputImg.Body, modelPredictions);
        const s3Key = `output/${Date.now()}.jpg`;
        const s3_response = await uploadImageToS3('storage.platinumj', s3Key, outputImgBuffer);
        console.log("S3 RESPONSE UPLOAD");

        await updateDatabase(uploadId, modelPredictions, s3Key);
        console.log("RETYURRNING");
        
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Image processed and uploaded to S3 successfully', s3Key: s3Key })
        };
    } catch (error) {
        console.log("ERROR", error);

        await new Promise((resolve, reject) => {
            db.query('UPDATE Uploads SET inferenceStatus = ? WHERE id = ?', ['FAILED', uploadId], (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });

        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
