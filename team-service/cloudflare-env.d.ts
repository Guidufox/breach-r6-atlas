declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ROOM_RATE_SECRET?: string;
  }
}
