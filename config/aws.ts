import { config } from "dotenv";
import { SQSClient } from "@aws-sdk/client-sqs";
import { SNSClient } from "@aws-sdk/client-sns";

// Load environment variables from .env file
config();

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error(
    "AWS credentials are required. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables."
  );
}

export const awsConfig = {
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};

// Log AWS config (without exposing sensitive data)
console.log("AWS Config:", {
  region: awsConfig.region,
  accessKeyId: awsConfig.credentials.accessKeyId,
  secretKeyLength: awsConfig.credentials.secretAccessKey.length,
});

export const sqsClient = new SQSClient(awsConfig);
export const snsClient = new SNSClient(awsConfig);

export const QUEUE_URL = process.env.SQS_QUEUE_URL;
export const TOPIC_ARN = process.env.SNS_TOPIC_ARN;

if (!QUEUE_URL || !TOPIC_ARN) {
  throw new Error(
    "SQS_QUEUE_URL and SNS_TOPIC_ARN environment variables are required."
  );
}

// Log queue and topic info
console.log("Queue URL:", QUEUE_URL);
console.log("Topic ARN:", TOPIC_ARN);
