import { secret } from "encore.dev/config";
import { SQSClient } from "@aws-sdk/client-sqs";
import { SNSClient } from "@aws-sdk/client-sns";

// Encore secrets
export const awsAccessKey = secret("AWS_ACCESS_KEY_ID");
export const awsSecretKey = secret("AWS_SECRET_ACCESS_KEY");
export const awsRegion = secret("AWS_REGION");
export const queueUrl = secret("SQS_QUEUE_URL");
export const topicArn = secret("SNS_TOPIC_ARN");

// Config AWS SDK
export const awsConfig = {
  region: awsRegion() || "ap-southeast-2",
  credentials: {
    accessKeyId: awsAccessKey(),
    secretAccessKey: awsSecretKey(),
  },
};

// Clients
export const sqsClient = new SQSClient(awsConfig);
export const snsClient = new SNSClient(awsConfig);

// Logging (safe)
console.log("AWS Config:", {
  region: awsConfig.region,
  accessKeyId: awsConfig.credentials.accessKeyId,
  secretKeyLength: awsConfig.credentials.secretAccessKey.length,
});
console.log("Queue URL:", queueUrl());
console.log("Topic ARN:", topicArn());
