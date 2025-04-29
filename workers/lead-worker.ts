import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import { sqsClient, QUEUE_URL } from "../config/aws";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

interface LeadEvent {
  type: "Lead.New";
  data: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    status: string;
    source?: string;
    created_at: Date;
    workspace_id: string;
  };
}

interface SNSMessage {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
}

async function processLeadEvent(event: LeadEvent) {
  console.log("\n--- Processing Lead Event ---");
  console.log("Lead data:", JSON.stringify(event.data, null, 2));

  // Example of failure handling with DLQ
  // Uncomment to test DLQ flow
  /*
  // Force failure for emails containing even numbers
  const emailNumber = event.data.email.match(/\d+/);
  if (emailNumber && parseInt(emailNumber[0]) % 2 === 0) {
    console.log(`❌ Forcing failure for lead with email: ${event.data.email}`);
    throw new Error(`Forced failure for even numbered email: ${event.data.email}`);
  }
  */

  // TODO: Add your actual business logic here
  // For example:
  // - Send welcome email
  // - Create initial tasks
  // - Update analytics
  // - etc.

  console.log(`✅ Successfully processed lead: ${event.data.id}`);
}

async function startWorker() {
  console.log("Starting Lead.New event worker...");
  let emptyPolls = 0;

  while (true) {
    try {
      const receiveCommand = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        AttributeNames: ["All"],
        MessageAttributeNames: ["All"],
      });

      const response = await sqsClient.send(receiveCommand);

      if (!response.Messages || response.Messages.length === 0) {
        emptyPolls++;
        if (emptyPolls % 10 === 0) {
          console.log(`No messages received after ${emptyPolls} polls`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }

      emptyPolls = 0;

      // Process each message
      for (const message of response.Messages) {
        try {
          if (!message.Body) {
            console.log("⚠️ Received message with no body, skipping...");
            continue;
          }

          const receiveCount = parseInt(
            message.Attributes?.ApproximateReceiveCount || "0"
          );
          console.log(`\n=== Processing Message (Attempt ${receiveCount}) ===`);
          console.log("Message ID:", message.MessageId);

          // Parse SNS notification
          const snsMessage = JSON.parse(message.Body) as SNSMessage;
          console.log("SNS Message ID:", snsMessage.MessageId);

          // Parse actual event from SNS Message
          const event = JSON.parse(snsMessage.Message) as LeadEvent;
          console.log("Lead Event:", JSON.stringify(event, null, 2));

          if (event.type === "Lead.New") {
            await processLeadEvent(event);

            // Only delete if processing was successful
            const deleteCommand = new DeleteMessageCommand({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            });

            await sqsClient.send(deleteCommand);
            console.log(`✅ Message successfully processed and deleted\n`);
          } else {
            console.log(`⚠️ Unexpected event type: ${event.type}, skipping...`);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          console.error(`❌ Failed to process message: ${errorMessage}`);
          console.log(
            `⏳ Message will return to queue after visibility timeout\n`
          );
          // Do not delete message - let it return to queue for retry
        }
      }
    } catch (error) {
      console.error("Error receiving messages:", error);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// Start the worker
startWorker().catch((error) => {
  console.error("Worker failed:", error);
  process.exit(1);
});
