import { promisify } from 'util';
import fs from 'fs';
import AWS from 'aws-sdk';


export const uploadFileToS3 = async (filePath: string, bucketName: string, key: string): Promise<string> => {
  const s3 = new AWS.S3();
  const fileContent = await promisify(fs.readFile)(filePath);
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
  };

  await s3.upload(params).promise();

  return `https://${bucketName}.s3.amazonaws.com/${key}`;
};