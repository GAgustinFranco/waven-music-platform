import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module.js';
import { PlaylistTrack } from './playlist-track.entity.js';
import { Playlist } from './playlist.entity.js';
import { MyPlaylistsController, PlaylistsController } from './playlists.controller.js';
import { PlaylistsService } from './playlists.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Playlist, PlaylistTrack]), CatalogModule],
  controllers: [MyPlaylistsController, PlaylistsController],
  providers: [PlaylistsService],
})
export class PlaylistsModule {}
