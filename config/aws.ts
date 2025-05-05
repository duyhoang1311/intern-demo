import { SQSClient } from "@aws-sdk/client-sqs";
import { SNSClient } from "@aws-sdk/client-sns";
import { secret } from "encore";

export function createAwsClients() {
  const region = secret("AWS_REGION") ?? "ap-southeast-2";
  const accessKeyId = secret("AWS_ACCESS_KEY_ID");
  const secretAccessKey = secret("AWS_SECRET_ACCESS_KEY");

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing required AWS credentials");
  }

  const awsConfig = {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  };

  const sqsClient = new SQSClient(awsConfig);
  const snsClient = new SNSClient(awsConfig);

  return { sqsClient, snsClient };
}

export function getQueueUrl(): string {
  const url = secret("SQS_QUEUE_URL");
  if (!url) {
    throw new Error("Missing secret: SQS_QUEUE_URL");
  }
  return url;
}

export function getTopicArn(): string {
  const arn = secret("SNS_TOPIC_ARN");
  if (!arn) {
    throw new Error("Missing secret: SNS_TOPIC_ARN");
  }
  return arn;
}
