import { secret } from "encore.dev/config";

// Get secrets from Encore
export const awsAccessKeyId = secret("AWS_ACCESS_KEY_ID");
export const awsSecretAccessKey = secret("AWS_SECRET_ACCESS_KEY");
export const awsRegion = secret("AWS_REGION");
export const queueUrl = secret("SQS_QUEUE_URL");
export const topicArn = secret("SNS_TOPIC_ARN");
