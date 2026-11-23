import { Body, Controller, Get, Headers, HttpCode, Post, Query, Redirect } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiExcludeEndpoint,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type EnvironmentVariables } from '../../config/env.validation.js';
import { type AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public } from '../auth/decorators/auth.decorators.js';
import { BillingStatusDto, CheckoutDto, PlansDto, WebhookAckDto } from './billing.dto.js';
import { BillingService } from './billing.service.js';
import { WebhooksService } from './webhooks.service.js';

@ApiTags('billing')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('billing')
export class BillingController {
  private readonly returnUrl: string;

  constructor(
    private readonly billing: BillingService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.returnUrl = `${config.get('WEB_URL', { infer: true }).replace(/\/+$/, '')}/billing/return`;
  }

  @Get('plans')
  @ApiOkResponse({ type: PlansDto })
  plans(): PlansDto {
    return this.billing.getPlans();
  }

  @Post('checkout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Creates a pending subscription and returns the checkout URL.' })
  @ApiOkResponse({ type: CheckoutDto })
  @ApiConflictResponse({
    description: '`SUBSCRIPTION_EXISTS`: one is pending, authorized or paused.',
  })
  @ApiBadGatewayResponse({ description: '`PAYMENT_PROVIDER_ERROR`.' })
  @ApiServiceUnavailableResponse({ description: '`BILLING_UNAVAILABLE`: no credentials.' })
  checkout(@CurrentUser() user: AuthUser): Promise<CheckoutDto> {
    return this.billing.checkout(user.id);
  }

  @Get('subscription')
  @ApiOkResponse({ type: BillingStatusDto })
  subscription(@CurrentUser() user: AuthUser): Promise<BillingStatusDto> {
    return this.billing.getStatus(user.id);
  }

  @Post('subscription/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancels the open subscription; the paid period is kept.' })
  @ApiOkResponse({ type: BillingStatusDto })
  @ApiNotFoundResponse({ description: '`SUBSCRIPTION_NOT_FOUND`.' })
  @ApiBadGatewayResponse({ description: '`PAYMENT_PROVIDER_ERROR`.' })
  cancel(@CurrentUser() user: AuthUser): Promise<BillingStatusDto> {
    return this.billing.cancel(user.id);
  }

  /** Mercado Pago's `back_url` must be public https; this forwards the buyer to the web. */
  @Public()
  @Get('return')
  @Redirect()
  @ApiExcludeEndpoint()
  back(): { url: string; statusCode: number } {
    return { url: this.returnUrl, statusCode: 302 };
  }
}

@ApiTags('billing')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Public()
  @Post('mercadopago')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Mercado Pago notifications, signed with `x-signature` (no JWT).',
  })
  @ApiOkResponse({ type: WebhookAckDto })
  @ApiUnauthorizedResponse({ description: '`WEBHOOK_SIGNATURE_INVALID`.' })
  async mercadoPago(
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ): Promise<WebhookAckDto> {
    const result = await this.webhooks.handle({ signature, requestId, query, body: body ?? {} });
    return { result };
  }
}
