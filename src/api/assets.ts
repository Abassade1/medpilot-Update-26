import type { ImageSourcePropType } from "react-native";
import { images } from "../data/assets";

/**
 * v1 asset bridge.
 *
 * Catalog rows carry an `*_asset` key naming an image bundled with the app,
 * rather than a CDN URL. This keeps the approved visuals byte-identical while
 * the media pipeline is stood up; swapping to remote URLs later is a change to
 * this one function.
 */
export function assetSource(key: string | null | undefined, fallback?: ImageSourcePropType): ImageSourcePropType | undefined {
  if (key && key in images) return (images as Record<string, ImageSourcePropType>)[key];
  return fallback;
}
