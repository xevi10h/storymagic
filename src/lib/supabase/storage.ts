// Supabase Storage helpers for uploading illustrations and PDFs
//
// Buckets:
//   illustrations — public, stores Recraft-generated images permanently
//   book-pdfs     — private (user-scoped), stores rendered PDF books

import { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Upload an image from a remote URL to Supabase Storage.
 * Downloads the image, converts WebP/AVIF → PNG (for PDF compatibility),
 * then uploads it to the illustrations bucket.
 * Returns the permanent public URL.
 */
export async function uploadIllustrationFromUrl(
  supabase: SupabaseClient,
  storyId: string,
  sceneNumber: number,
  imageUrl: string,
): Promise<string> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/png";
  const rawBuffer = Buffer.from(await response.arrayBuffer());

  // Always store as PNG for maximum compatibility (@react-pdf, print, etc.)
  // Recraft V3 often returns WebP which @react-pdf cannot render.
  let finalBuffer: Buffer;
  let finalContentType: string;
  let extension: string;

  if (contentType.includes("jpeg") || contentType.includes("jpg")) {
    finalBuffer = rawBuffer;
    finalContentType = "image/jpeg";
    extension = "jpg";
  } else if (contentType.includes("png")) {
    finalBuffer = rawBuffer;
    finalContentType = "image/png";
    extension = "png";
  } else {
    // WebP, AVIF, or other — convert to PNG
    console.log(`[Storage] Converting ${contentType} → PNG for scene ${sceneNumber}`);
    finalBuffer = await sharp(rawBuffer).png().toBuffer();
    finalContentType = "image/png";
    extension = "png";
  }

  const path = `${storyId}/scene-${sceneNumber}.${extension}`;

  const { error } = await supabase.storage
    .from("illustrations")
    .upload(path, finalBuffer, {
      contentType: finalContentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload error: ${error.message}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/illustrations/${path}`;
}

/**
 * Upload a rendered PDF buffer to Supabase Storage.
 * Stored under book-pdfs/{userId}/{storyId}.pdf
 * Returns a signed URL (valid 1 hour) since the bucket is private.
 */
export async function uploadBookPdf(
  supabase: SupabaseClient,
  userId: string,
  storyId: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const path = `${userId}/${storyId}.pdf`;

  const { error } = await supabase.storage
    .from("book-pdfs")
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    throw new Error(`PDF upload error: ${error.message}`);
  }

  // Generate a permanent path (will be signed on download)
  return path;
}

/**
 * Get a signed download URL for a private PDF.
 * Valid for 1 hour.
 */
export async function getSignedPdfUrl(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("book-pdfs")
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to sign PDF URL: ${error?.message}`);
  }

  return data.signedUrl;
}
