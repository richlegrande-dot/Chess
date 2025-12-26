/**
 * Admin Authentication Service
 * 
 * Implements:
 * - Password-based admin authentication
 * - Short-lived session tokens (no raw password in localStorage)
 * - Token validation middleware
 */

import { PrismaClient } from '@prisma/client';

export interface AdminSessionToken {
  token: string;
  expiresAt: Date;
}

export class AdminAuthService {
  private readonly SESSION_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
  
  constructor(
    private prisma: PrismaClient,
    private adminPassword: string
  ) {
    if (!adminPassword) {
      throw new Error('ADMIN_PASSWORD environment variable is required');
    }
  }

  /**
   * Verify admin password and create session token
   */
  async unlock(password: string): Promise<AdminSessionToken> {
    if (password !== this.adminPassword) {
      throw new Error('Invalid password');
    }

    // Generate a random token
    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + this.SESSION_DURATION_MS);

    // Store token in database
    await this.prisma.adminSession.create({
      data: {
        token,
        expiresAt,
      },
    });

    // Clean up expired tokens
    await this.cleanupExpiredTokens();

    return { token, expiresAt };
  }

  /**
   * Validate session token
   */
  async validateToken(token: string): Promise<boolean> {
    if (!token) {
      return false;
    }

    const session = await this.prisma.adminSession.findUnique({
      where: { token },
    });

    if (!session) {
      return false;
    }

    // Check if token is expired
    if (session.expiresAt < new Date()) {
      // Delete expired token
      await this.prisma.adminSession.delete({
        where: { token },
      });
      return false;
    }

    return true;
  }

  /**
   * Logout (delete token)
   */
  async logout(token: string): Promise<void> {
    try {
      await this.prisma.adminSession.delete({
        where: { token },
      });
    } catch (error) {
      // Token might not exist, ignore error
    }
  }

  /**
   * Clean up expired tokens
   */
  private async cleanupExpiredTokens(): Promise<void> {
    await this.prisma.adminSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  }

  /**
   * Generate a random token
   */
  private generateToken(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

/**
 * Middleware to check admin authentication
 */
export function requireAdmin(authService: AdminAuthService) {
  return async (token: string | null): Promise<void> => {
    if (!token) {
      throw new Error('Unauthorized: No token provided');
    }

    const isValid = await authService.validateToken(token);
    if (!isValid) {
      throw new Error('Unauthorized: Invalid or expired token');
    }
  };
}
