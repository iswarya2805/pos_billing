import api from "../services/api";

export function getImageUrl(image) {
  if (!image || typeof image !== "string") return "/product-placeholder.svg";
  if (/^https?:\/\//i.test(image)) return image;

  const apiUrl = new URL(api.defaults.baseURL, window.location.origin);
  const apiPrefix = apiUrl.pathname.replace(/\/$/, "");
  let imagePath = image.startsWith("/") ? image : `/${image}`;
  if (imagePath.startsWith("/catalog/")) return imagePath;
  if (apiPrefix && imagePath.startsWith(`${apiPrefix}/uploads/`)) {
    imagePath = imagePath.slice(apiPrefix.length);
  }
  return `${apiUrl.origin}${imagePath}`;
}
