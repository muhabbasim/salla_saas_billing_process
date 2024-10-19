import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateNextBillingDate, getSubscriptionPlan } from "../src/functions/utils";


describe('calculateNextBillingDate', () => {

  // Mock the current date to a fixed point in time (e.g., October 1, 2024)
  const mockDate = new Date('2024-10-01T00:00:00Z');

  beforeEach(() => {
    vi.setSystemTime(mockDate); // Freeze the system time to the mockDate
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real system time after each test
  });

  test('should calculate next billing date for monthly billing', () => {
    const result = calculateNextBillingDate('monthly');
    
    // Expected date is 1 month after the mockDate, which would be November 1, 2024
    expect(result).toBe('2024-11-01');
  });

  test('should calculate next billing date for yearly billing', () => {
    const result = calculateNextBillingDate('yearly');
    
    // Expected date is 1 year after the mockDate, which would be October 1, 2025
    expect(result).toBe('2025-10-01');
  });

  test('should return the current date if billing cycle is invalid', () => {
    const result = calculateNextBillingDate('invalid');
    
    // Since no valid billing cycle is provided, the date should remain as the mock date (October 1, 2024)
    expect(result).toBe('2024-10-01');
  });

});

describe('getSubscriptionPlan', () => {
  const mockEnv = {
    DB: {
      prepare: vi.fn(), // Mock the prepare method
    },
  };

  test('should return the subscription plan details when found', async () => {
    // Mock the DB query to return a subscription plan
    const mockPlan = { id: '1', name: 'Basic Plan', price: 10.00 };
    mockEnv.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(mockPlan),
      }),
    });

    const result = await getSubscriptionPlan('1', mockEnv);

    // Check that the DB query was called correctly
    expect(mockEnv.DB.prepare).toHaveBeenCalledWith("SELECT * FROM subscription_plan WHERE id = ?");
    expect(result).toEqual(mockPlan); // Check that the correct subscription plan is returned
  });

  test('should return an error message when no subscription plan is found', async () => {
    // Mock the DB query to return null (no subscription plan found)
    mockEnv.DB.prepare.mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null),
      }),
    });

    const result = await getSubscriptionPlan('99', mockEnv);

    // Check that the appropriate error message is returned
    expect(result).toEqual({
      error: true,
      message: 'No subscription plan found for id: 99',
    });
  });

});


