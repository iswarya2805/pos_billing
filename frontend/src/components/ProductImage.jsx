import { useState } from "react";
import { getImageUrl } from "../utils/imageUrl";

function ProductImage({ image, alt = "Product", className = "product-image" }) {
  const [failed, setFailed] = useState(false);
  const fallback = "/product-placeholder.svg";
  return (
    <img
      className={className}
      src={failed ? fallback : getImageUrl(image)}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default ProductImage;
