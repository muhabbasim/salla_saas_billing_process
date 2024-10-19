import { describe, test, expect, vi } from 'vitest';
import { Resend } from 'resend';  // Mocked Resend client

import { HandleSendEmails } from "../src/functions/email";

// Mock contentProps and Bindings interfaces
type contentProps = {
  emailTo: string;
  subject: string;
  emailConent: string;
};

type Bindings = {
  RESEND_API_KEY: {
    get: (key: string) => Promise<string | null>;
  };
  
};

// Mock the Resend constructor and its emails.send method
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ success: true })
    }
  }))
}));

describe('HandleSendEmails', () => {
  
  test('should send an email successfully', async () => {
    // Mock environment and API key retrieval from KV
    const env: Bindings = {
      RESEND_API_KEY: {
        get: vi.fn().mockResolvedValue('mock-api-key')
      }
    };

    const content: contentProps = {
      emailTo: 'onboarding@resend.dev',
      subject: 'mjnoonha90@gmail.com',
      emailConent: '<p>This is a test email</p>'
    };

    // Call the function
    const result = await HandleSendEmails(env, content);

    // Expectations
    expect(env.RESEND_API_KEY.get).toHaveBeenCalledWith('resend_api');
    expect(Resend).toHaveBeenCalledWith('mock-api-key');
    expect(result).toEqual({ success: true });
  });

  test('should handle missing API key error', async () => {
    // Mock the environment to simulate missing API key in KV
    const env: Bindings = {
      RESEND_API_KEY: {
        get: vi.fn().mockResolvedValue(null)
      }
    };

    const content: contentProps = {
      emailTo: 'test@example.com',
      subject: 'Test Email',
      emailConent: '<p>This is a test email</p>'
    };

    // Call the function
    const result = await HandleSendEmails(env, content);

    // Expectations
    expect(env.RESEND_API_KEY.get).toHaveBeenCalledWith('resend_api');
    expect(result).toEqual({
      error: true,
      message: 'Resend API key not found in KV storage.'
    });
  });

  test('should handle email send failure', async () => {
    // Mock the environment with a valid API key
    const env: Bindings = {
      RESEND_API_KEY: {
        get: vi.fn().mockResolvedValue('mock-api-key')
      }
    };

    // Simulate an email sending failure by mocking the send method to throw an error
    vi.mocked(Resend).mockImplementationOnce(() => ({
      emails: {
        send: vi.fn().mockRejectedValue(new Error('Failed to send email')),
      }
    }));

    const content: contentProps = {
      emailTo: 'test@example.com',
      subject: 'Test Email',
      emailConent: '<p>This is a test email</p>'
    };

    // Call the function
    const result = await HandleSendEmails(env, content);

    // Expectations
    expect(env.RESEND_API_KEY.get).toHaveBeenCalledWith('resend_api');
    expect(result).toEqual({
      error: true,
      message: 'Failed to send email'
    });
  });
});
