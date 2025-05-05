import { secret } from "encore"; // Thêm Encore secret module
import { SQSClient } from "@aws-sdk/client-sqs";
import { SNSClient } from "@aws-sdk/client-sns";

// Load AWS credentials from Encore secrets
const awsAccessKeyId = secret("AWS_ACCESS_KEY_ID"); // Lấy AWS Access Key từ secrets
const awsSecretAccessKey = secret("AWS_SECRET_ACCESS_KEY"); // Lấy AWS Secret Key từ secrets
const awsRegion = secret("AWS_REGION") || "ap-southeast-2"; // Lấy AWS Region từ secrets (mặc định là "ap-southeast-2" nếu không có)

if (!awsAccessKeyId || !awsSecretAccessKey) {
  throw new Error(
    "AWS credentials are required. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Encore secrets."
  );
}

export const awsConfig = {
  region: awsRegion, // Sử dụng giá trị AWS region từ secrets (hoặc mặc định)
  credentials: {
    accessKeyId: awsAccessKeyId, // Sử dụng giá trị từ Encore secret
    secretAccessKey: awsSecretAccessKey, // Sử dụng giá trị từ Encore secret
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

export const QUEUE_URL = secret("SQS_QUEUE_URL"); // Lấy giá trị URL của SQS từ Encore secrets
export const TOPIC_ARN = secret("SNS_TOPIC_ARN"); // Lấy giá trị ARN của SNS từ Encore secrets

if (!QUEUE_URL || !TOPIC_ARN) {
  throw new Error(
    "SQS_QUEUE_URL and SNS_TOPIC_ARN are required in Encore secrets."
  );
}

// Log queue and topic info
console.log("Queue URL:", QUEUE_URL);
console.log("Topic ARN:", TOPIC_ARN);
