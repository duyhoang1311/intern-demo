import { secret } from "encore";

// Ép kiểu rõ ràng về string
export const awsAccessKeyId = secret("AWS_ACCESS_KEY_ID") as string;
export const awsSecretAccessKey = secret("AWS_SECRET_ACCESS_KEY") as string;
export const awsRegion = secret("AWS_REGION") as string;
export const queueUrl = secret("SQS_QUEUE_URL") as string;
export const topicArn = secret("SNS_TOPIC_ARN") as string;
