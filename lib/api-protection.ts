import { NextRequest, NextResponse } from 'next/server';

/**
 * API Protection Middleware
 * Chỉ cho phép request từ giao diện ứng dụng, không cho truy cập trực tiếp
 */

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://tmsmindx.vercel.app',
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
  // 1. Kiểm tra origin và referer trước để xác định nguồn request
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Cho phép request từ cùng host (same-origin)
  const isSameOrigin = origin && host && (
    origin === `https://${host}` || 
    origin === `http://${host}`
  );
  
  // Kiểm tra xem request có từ allowed origins không
  const isFromAllowedOrigin = origin && (
    isSameOrigin || 
    ALLOWED_ORIGINS.includes(origin)
  );
  
  const isFromAllowedReferer = referer && (
    (host && referer.includes(host)) ||
    ALLOWED_ORIGINS.some(allowedOrigin => referer.startsWith(allowedOrigin))
  );

  // 2. Kiểm tra custom header hoặc Authorization token (optional cho client requests)
  const apiKey = request.headers.get('x-api-key');
  const authHeader = request.headers.get('authorization');
  
  const hasValidApiKey = apiKey && apiKey === API_SECRET_KEY;
  const hasAuthToken = authHeader && authHeader.startsWith('Bearer ');

  // 3. Kiểm tra user agent
  const userAgent = request.headers.get('user-agent') || '';
  const isToolRequest = (
    userAgent.toLowerCase().includes('curl') ||
    userAgent.toLowerCase().includes('wget') ||
    userAgent.toLowerCase().includes('postman')
  );

  // LOGIC MỚI:
  // - Nếu là request từ allowed origin/referer (browser/client) -> CHO PHÉP
  // - Nếu là tool request (curl/wget/postman) -> YÊU CẦU API key hoặc auth token
  // - Nếu không có origin/referer và không phải tool -> CHỜ phép (internal server request)
  
  // Cho phép nếu request từ client (browser) với origin/referer hợp lệ
  if (isFromAllowedOrigin || isFromAllowedReferer) {
    return { isValid: true };
  }

  // Nếu là tool request, yêu cầu API key hoặc auth token
  if (isToolRequest) {
    if (!hasValidApiKey && !hasAuthToken) {
      return {
        isValid: false,
        error: 'Unauthorized: Tool requests require API key or authentication token'
      };
    }
    return { isValid: true };
  }

  // Nếu có API key hoặc auth token hợp lệ -> cho phép
  if (hasValidApiKey || hasAuthToken) {
    return { isValid: true };
  }

  // Nếu có origin nhưng không valid
  if (origin && !isFromAllowedOrigin) {
    console.warn('[API Protection] Invalid origin:', origin, 'Expected:', ALLOWED_ORIGINS);
    return {
      isValid: false,
      error: `Forbidden: Invalid origin ${origin}`
    };
  }

  // Các trường hợp khác: không có origin, referer, hoặc auth -> block
  return {
    isValid: false,
    error: 'Unauthorized: Missing origin, referer, or authentication'
  };
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
