// SendGrid Email Notification Function
async function sendEmailNotification(toEmail: string, subject: string, message: string, c: any) {
  
  const apiKey = c.env.SENDGRID_API_KEY;
  // Use your verified SendGrid sender email
  const senderEmail = "your-verified-sender-email@example.com"; 

  const body = {
    personalizations: [
      {
        to: [{ email: toEmail }]
      }
    ],
    from: { email: senderEmail },
    subject: subject,
    content: [
      {
        type: "text/plain",
        value: message
      }
    ]
  };

  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorMessage = await res.text();
    console.error(`Failed to send email: ${errorMessage}`);
  } else {
    console.log(`Email sent successfully to ${toEmail}`);
  }
}
