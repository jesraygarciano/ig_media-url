import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { CheerioAPI } from 'cheerio';

@Injectable()
export class DownloadService {
  private readonly logger = new Logger(DownloadService.name);

  async getMediaUrls(instagramUrl: string): Promise<string[]> {
    try {
      this.logger.log(`Fetching URL: ${instagramUrl}`);
      const response = await axios.get(instagramUrl);
      const $ = cheerio.load(response.data);

      // Log the HTML content for debugging
      this.logger.debug(`HTML Content: ${response.data}`);

      // Try to find the media URLs in different structures
      let mediaUrls = this.extractMediaUrlsFromGraphQl($);
      if (!mediaUrls.length) {
        mediaUrls = this.extractMediaUrlsFromJsonLd($);
      }
      if (!mediaUrls.length) {
        mediaUrls = this.extractMediaUrlsFromOgTags($);
      }
      if (!mediaUrls.length) {
        mediaUrls = this.extractMediaUrlsFromImgTags($);
      }
      if (!mediaUrls.length) {
        mediaUrls = this.extractMediaUrlsFromVideoTags($);
      }

      if (!mediaUrls.length) {
        throw new HttpException('Media not found', HttpStatus.NOT_FOUND);
      }

      return mediaUrls;
    } catch (error) {
      this.logger.error(`Failed to fetch media: ${error.message}`, error.stack);
      throw new HttpException('Failed to fetch media', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private extractMediaUrlsFromGraphQl($: CheerioAPI): string[] {
    try {
      const scriptTag = $('script[type="text/javascript"]').filter((i, el) => {
        return $(el).html().includes('window._sharedData');
      }).html();

      if (scriptTag) {
        const json = JSON.parse(scriptTag.replace('window._sharedData = ', '').slice(0, -1));
        const media = json.entry_data.PostPage[0].graphql.shortcode_media;
        const mediaUrls = [];

        if (media.__typename === 'GraphImage') {
          mediaUrls.push(media.display_url);
        } else if (media.__typename === 'GraphVideo') {
          mediaUrls.push(media.video_url);
        } else if (media.__typename === 'GraphSidecar') {
          media.edge_sidecar_to_children.edges.forEach((edge: any) => {
            if (edge.node.__typename === 'GraphImage') {
              mediaUrls.push(edge.node.display_url);
            } else if (edge.node.__typename === 'GraphVideo') {
              mediaUrls.push(edge.node.video_url);
            }
          });
        }
        return mediaUrls;
      }
    } catch (error) {
      this.logger.warn(`Failed to extract media URLs from GraphQL: ${error.message}`);
    }
    return [];
  }

  private extractMediaUrlsFromJsonLd($: CheerioAPI): string[] {
    try {
      const scriptTag = $('script[type="application/ld+json"]').html();
      if (scriptTag) {
        const json = JSON.parse(scriptTag);
        const mediaUrls = [];
        if (json.video && json.video.contentUrl) {
          mediaUrls.push(json.video.contentUrl);
        } else if (json.image) {
          mediaUrls.push(json.image);
        }
        return mediaUrls;
      }
    } catch (error) {
      this.logger.warn(`Failed to extract media URLs from JSON-LD: ${error.message}`);
    }
    return [];
  }

  private extractMediaUrlsFromOgTags($: CheerioAPI): string[] {
    try {
      const ogImage = $('meta[property="og:image"]').attr('content');
      const ogVideo = $('meta[property="og:video"]').attr('content');
      const mediaUrls = [];
      if (ogVideo) {
        mediaUrls.push(ogVideo);
      } else if (ogImage) {
        mediaUrls.push(ogImage);
      }
      return mediaUrls;
    } catch (error) {
      this.logger.warn(`Failed to extract media URLs from OG tags: ${error.message}`);
    }
    return [];
  }

  private extractMediaUrlsFromImgTags($: CheerioAPI): string[] {
    try {
      const mediaUrls = [];
      $('img[style="object-fit: cover;"][crossorigin="anonymous"]').each((i, el) => {
        const srcset = $(el).attr('srcset');
        if (srcset) {
          const urls = srcset.split(',').map((url) => url.trim().split(' ')[0]);
          const highestResUrl = urls[urls.length - 1];
          mediaUrls.push(highestResUrl);
        } else {
          const src = $(el).attr('src');
          if (src) {
            mediaUrls.push(src);
          }
        }
      });
      return mediaUrls;
    } catch (error) {
      this.logger.warn(`Failed to extract media URLs from img tags: ${error.message}`);
    }
    return [];
  }

  private extractMediaUrlsFromVideoTags($: CheerioAPI): string[] {
    try {
      const mediaUrls = [];
      $('video').each((i, el) => {
        const src = $(el).attr('src');
        if (src) {
          mediaUrls.push(src);
        }
      });
      return mediaUrls;
    } catch (error) {
      this.logger.warn(`Failed to extract media URLs from video tags: ${error.message}`);
    }
    return [];
  }
}
