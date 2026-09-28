// Supabase Storage helpers for uploading illustrations and PDFs
//
// Buckets:
//   illustrations — PRIVATE, generated images of children (versioned paths, never
//                   overwritten). The DB stores object paths; read them through
//                   src/lib/storage/illustration-urls.ts (signed URLs).
//   book-pdfs     — private (user-scoped), stores rendered PDF books

import { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

/**
 * Upload a generated image (buffer) to the private `illustrations` bucket under a
 * NEW, versioned path — never overwritten, so the CDN can never serve a stale
 * preview image for a final render. Returns the OBJECT PATH (the "illustration
 * ref" stored in the DB); sign it with src/lib/storage/illustration-urls.ts.
 *
 *   {folder}/{name}-{version}.{ext}   e.g. <storyId>/final/scene-3-m1x2k3-9f2a.jpg
 *
 * Provider output is always stored here first; temporary provider URLs are
 * never persisted.
 */
export async function uploadGeneratedImage(
  supabase: SupabaseClient,
  folder: string,
  name: string,
  image: Buffer,
  mime: string,
): Promise<string> {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const version = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const path = `${folder}/${name}-${version}.${ext}`;
  const { error } = await supabase.storage
    .from("illustrations")
    .upload(path, image, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`Supabase upload error (${path}): ${error.message}`);
  return path;
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
  const path = bookPdfPath(userId, storyId);

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

/** Object path of a story's customer PDF (never read from stories.pdf_url, which owners can edit). */
export function bookPdfPath(userId: string, storyId: string): string {
  return `${userId}/${storyId}.pdf`;
}

/**
 * Short-lived (10 min) signed download URL for the customer PDF, served straight
 * from Storage with Content-Disposition: attachment — the bytes never pass through
 * a Vercel function (4.5 MB response cap; print-quality books are 5-30 MB).
 */
export async function getSignedBookDownloadUrl(
  supabase: SupabaseClient,
  userId: string,
  storyId: string,
  filename: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("book-pdfs")
    .createSignedUrl(bookPdfPath(userId, storyId), 600, { download: filename });
  if (error || !data?.signedUrl) throw new Error(`Failed to sign book PDF: ${error?.message}`);
  return data.signedUrl;
}

/** ASCII file name for a book download: "el-bosque-de-martina-meapica.pdf". */
export function bookPdfFilename(title: string | null | undefined): string {
  const slug = (title ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return `${slug || "cuento"}-meapica.pdf`;
}

/**
 * Get a long-lived signed URL for Gelato to fetch the PDF during printing.
 * Valid for 7 days — Gelato downloads the file shortly after the order is
 * created, so 7 days provides a comfortable buffer.
 */
export async function getSignedPdfUrlForGelato(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string> {
  const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60; // 604800
  const { data, error } = await supabase.storage
    .from("book-pdfs")
    .createSignedUrl(storagePath, SEVEN_DAYS_SECONDS);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to sign PDF URL for Gelato: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Upload the Gelato interior PDF (pages 2–31, submitted as type "inside").
 * Path: book-pdfs/{userId}/{storyId}-interior-{orderId}.pdf — per order, because the
 * cover geometry depends on the format (softcover + hardcover of one story must not collide).
 */
export async function uploadInteriorPdf(
  supabase: SupabaseClient,
  userId: string,
  storyId: string,
  orderId: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const path = `${userId}/${storyId}-interior-${orderId}.pdf`;
  const { error } = await supabase.storage
    .from("book-pdfs")
    .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Interior PDF upload error: ${error.message}`);
  return path;
}

/**
 * Upload the Gelato cover spread PDF (submitted as type "default").
 * Path: book-pdfs/{userId}/{storyId}-cover-{orderId}.pdf — per order, because the
 * cover geometry depends on the format (softcover + hardcover of one story must not collide).
 */
export async function uploadCoverSpreadPdf(
  supabase: SupabaseClient,
  userId: string,
  storyId: string,
  orderId: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const path = `${userId}/${storyId}-cover-${orderId}.pdf`;
  const { error } = await supabase.storage
    .from("book-pdfs")
    .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(`Cover spread PDF upload error: ${error.message}`);
  return path;
}
