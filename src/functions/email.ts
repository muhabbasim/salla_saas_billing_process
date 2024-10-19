
import { Resend } from 'resend';
import { contentProps } from './utils';

type Bindings = {
  RESEND_API_KEY: KVNamespace;
  SUBSCRIPTION_DATA: KVNamespace;
  DB: D1Database;
};

export async function HandleSendEmails(env: any, content: contentProps) {
  try {
    // Retrieve the API key from Cloudflare KV
    const resendApiCash = await env.RESEND_API_KEY.get("resend_api");

    // Check if the API key is null and handle the error
    if (!resendApiCash) {
      throw new Error("Resend API key not found in KV storage.");
    }

    // Initialize the Resend client with the API key
    const resend = new Resend(resendApiCash);

    const res = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: content.emailTo,
      subject: content.subject,
      html: content.emailConent
    });

    console.log("Email sent successfully:", res);
    return res;

  } catch (err: any) {
    console.error("Error sending email:", err.message);
    return {
      error: true,
      message: err.message || "Internal Server Error"
    };
  }
}

