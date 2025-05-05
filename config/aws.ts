import { SQSClient } from "@aws-sdk/client-sqs";
import { SNSClient } from "@aws-sdk/client-sns";
import {
  awsAccessKeyId,
  awsSecretAccessKey,
  awsRegion,
  queueUrl,
  topicArn,
} from "./secrets";

export const awsConfig = {
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  },
};

export const sqsClient = new SQSClient(awsConfig);
export const snsClient = new SNSClient(awsConfig);

export const QUEUE_URL = queueUrl;
export const TOPIC_ARN = topicArn;
