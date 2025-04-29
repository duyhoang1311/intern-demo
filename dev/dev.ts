import { api, APIError } from "encore.dev/api";
import { snsClient, TOPIC_ARN } from "../config/aws";
import { PublishCommand } from "@aws-sdk/client-sns";

export const sendTestEvent = api(
  { method: "POST", path: "/dev/sendEvent", expose: true },
  async ({
    name,
    email,
    phone,
    source,
  }: {
    name: string;
    email: string;
    phone?: string;
    source?: string;
  }): Promise<{ success: boolean; eventId: string }> => {
    try {
      const eventId = crypto.randomUUID();

      const event = {
        type: "Lead.New",
        data: {
          id: eventId,
          name,
          email,
          phone,
          status: "new",
          source,
          created_at: new Date().toISOString(),
          workspace_id: "test-workspace",
        },
      };

      const publishCommand = new PublishCommand({
        TopicArn: TOPIC_ARN,
        Message: JSON.stringify(event),
        MessageAttributes: {
          eventType: {
            DataType: "String",
            StringValue: "Lead.New",
          },
        },
      });

      await snsClient.send(publishCommand);

      return {
        success: true,
        eventId,
      };
    } catch (error) {
      console.error("Send test event error:", error);
      throw APIError.internal(
        `Failed to send test event: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
);
