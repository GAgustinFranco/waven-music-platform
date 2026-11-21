import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SearchQueryDto, SearchResultsDto } from './search.dto.js';
import { SearchService } from './search.service.js';

@ApiTags('search')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOkResponse({ type: SearchResultsDto, description: 'Public catalog only, grouped by type.' })
  @ApiBadRequestResponse({ description: 'Missing or too long `q`, unknown `type`, bad `limit`.' })
  search(@Query() query: SearchQueryDto): Promise<SearchResultsDto> {
    return this.searchService.search(query.q, query.type, query.limit);
  }
}
