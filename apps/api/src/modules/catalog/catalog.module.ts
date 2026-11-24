import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from '../media/media.module.js';
import {
  AdminAlbumsController,
  AdminArtistsController,
  AdminTracksController,
} from './admin-catalog.controller.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import {
  AlbumsController,
  ArtistsController,
  BrowseController,
  ShowcaseController,
  TracksController,
} from './catalog.controller.js';
import { CatalogMapper } from './catalog.mapper.js';
import { CatalogService } from './catalog.service.js';
import { Album } from './entities/album.entity.js';
import { Artist } from './entities/artist.entity.js';
import { Track } from './entities/track.entity.js';
import { TrackAudioService } from './track-audio.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Artist, Album, Track]), MediaModule],
  controllers: [
    ArtistsController,
    AlbumsController,
    TracksController,
    BrowseController,
    ShowcaseController,
    AdminArtistsController,
    AdminAlbumsController,
    AdminTracksController,
  ],
  providers: [CatalogService, CatalogMapper, AdminCatalogService, TrackAudioService],
  exports: [CatalogService, CatalogMapper, AdminCatalogService, TrackAudioService],
})
export class CatalogModule {}
