import { NextRequest, NextResponse } from 'next/server';

/**
 * API Protection Middleware
 * Chỉ cho phép request từ giao diện ứng dụng, không cho truy cập trực tiếp
 */

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.NEXT_PUBLIC_APP_URL || '',
].filter(Boolean);

// Secret key để validate request từ client
const API_SECRET_KEY = process.env.NEXT_PUBLIC_API_SECRET || 'mindx-teaching-internal-2025';

/**
 * Validate request có đến từ giao diện ứng dụng không
 */
export function validateInternalRequest(request: NextRequest): {
  isValid: boolean;
  error?: string;
} {
  // 1. Kiểm tra custom header hoặc Authorization token
  const apiKey = request.headers.get('x-api-key');
  const authHeader = request.headers.get('authorization');
  
  // Cho phép nếu có Authorization token (đã authenticated qua Firebase)
  // hoặc có x-api-key hợp lệ
  const hasValidApiKey = apiKey && apiKey === API_SECRET_KEY;
  const hasAuthToken = authHeader && authHeader.startsWith('Bearer ');
  
  if (!hasValidApiKey && !hasAuthToken) {
    return {
      isValid: false,
      error: 'Unauthorized: Missing API key or authentication token'
    };
  }

  // 2. Kiểm tra origin
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  
  // Nếu có origin, kiểm tra origin
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return {
      isValid: false,
      error: 'Forbidden: Invalid origin'
    };
  }

  // Nếu có referer, kiểm tra referer
  if (referer) {
    const isValidReferer = ALLOWED_ORIGINS.some(allowedOrigin => 
      referer.startsWith(allowedOrigin)
    );
    
    if (!isValidReferer) {
      return {
        isValid: false,
        error: 'Forbidden: Invalid referer'
      };
    }
  }

  // 3. Kiểm tra không phải browser trực tiếp truy cập
  const userAgent = request.headers.get('user-agent') || '';
  
  // Cho phép các request từ browser với JavaScript enabled
  // Block các request từ curl, wget, postman mà không có API key hoặc auth token
  if (!hasValidApiKey && !hasAuthToken && (
    userAgent.toLowerCase().includes('curl') ||
    userAgent.toLowerCase().includes('wget') ||
    userAgent.toLowerCase().includes('postman')
  )) {
    return {
      isValid: false,
      error: 'Forbidden: Direct access not allowed'
    };
  }

  return { isValid: true };
}

/**
 * Tạo error response khi validation thất bại
 */
export function createUnauthorizedResponse(error: string): NextResponse {
  return NextResponse.json(
    { 
      error: 'Access denied',
      message: 'This API endpoint can only be accessed through the application interface.',
      details: error
    },
    { 
      status: 403,
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      }
    }
  );
}

/**
 * Helper function để wrap API handler với protection
 */
export function withApiProtection(
  handler: (request: NextRequest) => Promise<NextResponse> | NextResponse
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const validation = validateInternalRequest(request);
    
    if (!validation.isValid) {
      console.warn(`[API Protection] Blocked request: ${validation.error}`, {
        url: request.url,
        method: request.method,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
      });
      
      return createUnauthorizedResponse(validation.error || 'Access denied');
    }

    return handler(request);
  };
}
