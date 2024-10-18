
import { Resend } from 'resend';
import { contentProps } from './utils';

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


// import { Resend } from 'resend';
// import { Bindings } from '../routes/customer_subsction_rt';

// export async function HandleSendEmails(env: any) {

//   try {

//     // Retrieve the API key from Cloudflare KV
//     const resendApiCash = await env.RESEND_API_KEY.get("resend_api");
    
//     if (!resendApiCash) {
//       throw new Error("Resend API key not found in KV storage");
//     }

//     // Prepare the request to send the email
//     const resend = new Resend(env.RESEND_API_KEY);
    
//     const res = await resend.emails.send({
//       from: 'onboarding@resend.dev',
//       to: 'mjnoonha90@gmail.com',
//       subject: 'Hello World',
//       html: '<p>New bill is due <strong>the amount is 30$</strong>!</p>'
//     });

//     return true;

//   } catch (err: any) {
//     console.error("Error sending email:", err.message);
//     return {
//       error: true,
//       message: err.message || "Internal Server Error"
//     };
//   }


// }



    // // Retrieve the API key from Cloudflare KV
    // const resendApiCash = await c.env.RESEND_API_KEY.get("resend_api");

    //     // Prepare the request to send the email
    //     const resendRes = new Resend(resendApiCash);
    
    //     const res = await resendRes.emails.send({
    //       from: 'onboarding@resend.dev',
    //       to: 'mjnoonha90@gmail.com',
    //       subject: 'Hello World',
    //       html: '<p>New bill is due <strong>the amount is 30$</strong>!</p>'
    //     });
    
    // const emailData = {
    //   from: 'onboarding@resend.dev',
    //   to: 'mjnoonha90@gmail.com',
    //   subject: 'Hello World',
    //   html: '<p>New bill is due <strong>the amount is 30$</strong>!</p>'
    // }
    
    //    // Send the email using Resend API
    //    const response = await fetch("https://api.resend.com/emails", {
    //     method: "POST",
    //     headers: {
    //       "Content-Type": "application/json",
    //       "Authorization": `Bearer ${resendApiCash}`,
    //     },
    //     body: JSON.stringify(emailData),
    //   });
  
    //   const result = await res.json();
  
    //   if (!response.ok) {
    //     throw new Error(`Failed to send email: ${result}`);
    //   }

    // return c.json({
    //   "subscription_plan": subscriptionPlan,
    //   "api_key": resendApiCash,
    //   "resend": resendRes,
    //   "sendEmail": res,
    // })
