import { describe, test, expect, vi } from 'vitest';
import { handleBillingCycle } from '../src/functions/billing_engine';
import { calculateNextBillingDate, getSubscriptionPlan, handleGenerateInvoice } from '../src/functions/utils';

// Mock utility functions
vi.mock('../src/functions/utils', () => ({
  calculateNextBillingDate: vi.fn(),
  getSubscriptionPlan: vi.fn(),
  handleGenerateInvoice: vi.fn(),
}));

describe('handleBillingCycle', () => {
  // Mock environment (Cloudflare KV and D1 database)
  const mockEnv = {
    DB: {
      prepare: vi.fn(),
    },
  };

  test('should log "No customers due for billing today" when no customers found', async () => {
    // Mock DB query to return no customers
    mockEnv.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      }),
    });

    // Spy on console.log
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await handleBillingCycle(mockEnv);

    // Check that it logs "No customers due for billing today."
    expect(logSpy).toHaveBeenCalledWith("No customers due for billing today.");

    logSpy.mockRestore(); // Clean up spy
  });

  // test('should process customers due for billing successfully', async () => {
  //   // Mock DB query to return customers due for billing
  //   const mockCustomers = [
  //     { id: 1, subscription_plan_id: 101, next_billing_date: '2024-10-19', subscription_status: 'active', email: "test@email.o" },
  //   ];


  //   mockEnv.DB.prepare.mockReturnValue({
  //     bind: vi.fn().mockReturnValue({
  //       all: vi.fn().mockResolvedValue({ results: mockCustomers }),
  //     }),
  //   });

  //   // Mock the getSubscriptionPlan and handleGenerateInvoice functions
  //   vi.mocked(getSubscriptionPlan).mockResolvedValue({ id: 101, billing_cycle: 'monthly' });
  //   vi.mocked(handleGenerateInvoice).mockResolvedValue({ invoiceId: 1});
  //   vi.mocked(calculateNextBillingDate).mockReturnValue('2024-11-19');

  //   // Spy on console.log
  //   const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

  //   await handleBillingCycle(mockEnv);

  //   // Check that functions were called and processed
  //   // expect(getSubscriptionPlan).toHaveBeenCalledWith(101, mockEnv);
  //   // expect(handleGenerateInvoice).toHaveBeenCalledWith(1, mockEnv, 101, 'invoice_issue');
  //   // expect(mockEnv.DB.prepare).toHaveBeenCalledWith("UPDATE customer SET next_billing_date = ? WHERE id = ?");
  //   // expect(logSpy).toHaveBeenCalledWith(`Invoice generated and next billing date updated for customer 1`);
  //       // Check the sequence of log messages
  //       expect(logSpy).toHaveBeenNthCalledWith(1, "Billing cycle job triggered.");
  //       expect(logSpy).toHaveBeenNthCalledWith(2, `Today's date: 2024-10-19`);
  //       expect(logSpy).toHaveBeenNthCalledWith(3, mockCustomers);
  //       expect(logSpy).toHaveBeenNthCalledWith(4, `Processing customer 1...`);
  //       expect(logSpy).toHaveBeenNthCalledWith(5, { subscriptionPlan: { id: 101, billing_cycle: 'monthly' } });
  //       expect(logSpy).toHaveBeenNthCalledWith(6, { invoice: { invoiceId: 1 } });
  //       expect(logSpy).toHaveBeenNthCalledWith(7, { 'next billing': '2024-11-19' });
  //       expect(logSpy).toHaveBeenNthCalledWith(8, `Invoice generated and next billing date updated for customer 1`);

  //   logSpy.mockRestore();
  // });

  test('should handle errors during billing cycle processing', async () => {
    // Mock DB query to return customers due for billing
    const mockCustomers = [
      { id: 2, subscription_plan_id: 102, next_billing_date: '2024-10-14', subscription_status: 'active' },
    ];

    mockEnv.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: mockCustomers }),
      }),
    });

    // Mock getSubscriptionPlan to return null (simulate error)
    vi.mocked(getSubscriptionPlan).mockResolvedValue(null);

    // Spy on console.error
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleBillingCycle(mockEnv);

    // Check that it logs the error message
    expect(errorSpy).toHaveBeenCalledWith(`Subscription plan not found for customer 2`);

    errorSpy.mockRestore();
  });
});
